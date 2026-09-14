import { ActionError, defineAction } from "astro:actions";
import { eq } from "drizzle-orm";
import { z } from "astro/zod";
import { getDrizzle } from "@database/drizzle";
import { applications, applicationDecisions, applicationEvents } from "@database/schemas";
import { travelers } from "@database/schemas";
import { departures } from "@database/schemas";
import { trips } from "@database/schemas";
import { LOCALES, type Locale } from "@i18n/config";
import { checkRateLimit } from "@/lib/rate-limit";
import { sanitizeHtml } from "@/lib/sanitize";
import { extractIp } from "@/lib/audit";
import { assertVoyagePermission, auditVoyage } from "./_helpers";
import { findOrCreateTraveler } from "@/modules/travelers/domain/travelers-service";
import { normalizeEmail } from "@/modules/travelers/domain/traveler-email";
import { assertTransitionApplication } from "@/modules/applications/domain/application-transitions";
import type { ApplicationStatus } from "@database/schemas/applications.schema";
import { emitOutboxEvent } from "@/modules/outbox/domain/outbox";
import { domainError } from "@/lib/voyage-errors";

const CLOSED_DEPARTURE_STATUSES = ["draft", "closed", "cancelled", "completed"] as const;

const submitSchema = z.object({
  tripId: z.string().uuid(),
  departureId: z.string().uuid(),
  legalName: z.string().trim().min(1).max(200).transform(sanitizeHtml),
  email: z.string().trim().email().max(320),
  phone: z.string().trim().max(40).transform(sanitizeHtml).optional(),
  roomPreference: z.enum(["shared", "single"]).default("shared"),
  dietaryRequirements: z.string().trim().max(2000).transform(sanitizeHtml).nullable().optional(),
  accessibilityNeeds: z.string().trim().max(2000).transform(sanitizeHtml).nullable().optional(),
  activityAcknowledgement: z.literal(true),
  motivation: z.string().trim().max(5000).transform(sanitizeHtml).nullable().optional(),
  expectations: z.string().trim().max(5000).transform(sanitizeHtml).nullable().optional(),
  consent: z.literal(true),
  locale: z.enum(LOCALES).default("en"),
});

// Candidature publique : aucune donnée sensible en log/URL, rate-limitée (TODO §11).
export const submitApplication = defineAction({
  input: submitSchema,
  handler: async (input, context) => {
    const ip = extractIp(context.request.headers, context.clientAddress ?? null);
    const rl = checkRateLimit(ip ? `application:${ip}` : "application:__global__", ip ? { window: 900, max: 5 } : { window: 900, max: 20 });
    if (!rl.allowed) throw new ActionError({ code: "TOO_MANY_REQUESTS", message: "Trop de candidatures, réessayez plus tard." });

    const db = getDrizzle();
    const [trip] = await db.select().from(trips).where(eq(trips.id, input.tripId)).limit(1);
    if (!trip || trip.status !== "published") {
      throw domainError("BAD_REQUEST", "APPLICATION_CLOSED", "Ce voyage ne reçoit plus de candidatures.");
    }
    const [dep] = await db.select().from(departures).where(eq(departures.id, input.departureId)).limit(1);
    if (!dep || dep.tripId !== input.tripId) {
      throw new ActionError({ code: "NOT_FOUND", message: "Départ introuvable." });
    }
    if ((CLOSED_DEPARTURE_STATUSES as readonly string[]).includes(dep.status)) {
      throw domainError("BAD_REQUEST", "APPLICATION_CLOSED", "Ce départ ne reçoit plus de candidatures.");
    }
    if (dep.bookingDeadline && dep.bookingDeadline.getTime() < Date.now()) {
      throw domainError("BAD_REQUEST", "APPLICATION_DEADLINE_PASSED", "La date limite de candidature est passée.");
    }

    // Compte obligatoire paramétrable (TODO §11.1 : défaut false en V1).
    const requireAccount = trip.requireAccount ?? false;
    const sessionUser = context.locals.user;
    if (requireAccount) {
      if (!sessionUser?.emailVerified) {
        throw new ActionError({ code: "UNAUTHORIZED", message: "Un compte vérifié est requis pour ce voyage." });
      }
      if (normalizeEmail(sessionUser.email) !== normalizeEmail(input.email)) {
        throw new ActionError({ code: "FORBIDDEN", message: "L'email doit correspondre au compte connecté." });
      }
    }

    let travelerId: string;
    try {
      const { traveler } = await findOrCreateTraveler({
        email: input.email,
        legalName: input.legalName,
        phone: input.phone ?? null,
        locale: input.locale as Locale,
        userId: sessionUser?.id ?? null,
      });
      travelerId = traveler.id;
    } catch (err) {
      if (err instanceof Error && err.message.includes("APPLICATION_EMAIL_CONFLICT")) {
        throw domainError("CONFLICT", "APPLICATION_EMAIL_CONFLICT", "Cet email est déjà utilisé par un dossier non vérifié.");
      }
      throw err;
    }

    const [created] = await db
      .insert(applications)
      .values({
        travelerId,
        tripId: input.tripId,
        departureId: input.departureId,
        status: "submitted",
        roomPreference: input.roomPreference,
        dietaryRequirements: input.dietaryRequirements ?? null,
        accessibilityNeeds: input.accessibilityNeeds ?? null,
        activityAcknowledgement: true,
        motivation: input.motivation ?? null,
        expectations: input.expectations ?? null,
        consent: true,
        submittedAt: new Date(),
      })
      .returning({ id: applications.id });
    if (!created) throw new ActionError({ code: "INTERNAL_SERVER_ERROR", message: "Candidature impossible." });

    await db.insert(applicationEvents).values([
      { applicationId: created.id, event: "created" },
      { applicationId: created.id, event: "submitted" },
    ]);
    await emitOutboxEvent({
      eventType: "application.submitted",
      aggregateType: "application",
      aggregateId: created.id,
      payload: { applicationId: created.id, tripId: input.tripId, departureId: input.departureId, locale: input.locale },
    });
    auditVoyage(context, sessionUser?.id ?? travelerId, "APPLICATION_SUBMIT", {
      resource: "applications",
      resourceId: created.id,
      metadata: { tripId: input.tripId, departureId: input.departureId },
    });
    return { id: created.id };
  },
});

const reviewSchema = z.object({
  id: z.string().uuid(),
  decision: z.enum(["approved", "declined", "contact_required"]),
  internalNote: z.string().trim().max(5000).transform(sanitizeHtml).nullable().optional(),
});

// Décision reviewer : enregistrement horodaté, jamais d'écrasement (TODO §11.4).
export const reviewApplication = defineAction({
  input: reviewSchema,
  handler: async (input, context) => {
    const user = await assertVoyagePermission(context, { application: ["approve"] });
    const db = getDrizzle();
    const [current] = await db.select().from(applications).where(eq(applications.id, input.id)).limit(1);
    if (!current) throw new ActionError({ code: "NOT_FOUND", message: "Candidature introuvable." });
    const target: ApplicationStatus =
      input.decision === "approved" ? "approved" : input.decision === "declined" ? "declined" : "contact_required";
    await db.transaction(async (tx) => {
      // Passage en revue explicite avant décision (TODO §11.3–11.4).
      const from = current.status as ApplicationStatus;
      if (from === "submitted") {
        await tx.update(applications).set({ status: "under_review" }).where(eq(applications.id, input.id));
        await tx.insert(applicationEvents).values({ applicationId: input.id, event: "review_started", actorId: user.id });
      } else {
        assertTransitionApplication(from, "under_review");
      }
      assertTransitionApplication("under_review", target);
      await tx.insert(applicationDecisions).values({
        applicationId: input.id,
        decision: input.decision,
        adminUserId: user.id,
        internalNote: input.internalNote ?? null,
      });
      await tx.update(applications).set({ status: target }).where(eq(applications.id, input.id));
      await tx.insert(applicationEvents).values({
        applicationId: input.id,
        event: target === "approved" ? "approved" : target === "declined" ? "declined" : "contact_requested",
        actorId: user.id,
      });
    });
    await emitOutboxEvent({
      eventType: `application.${target}`,
      aggregateType: "application",
      aggregateId: input.id,
      payload: { applicationId: input.id, decision: input.decision },
    });
    auditVoyage(context, user.id, "APPLICATION_DECISION", {
      resource: "applications",
      resourceId: input.id,
      metadata: { from: current.status, decision: input.decision },
    });
    return { success: true, status: target };
  },
});

const withdrawSchema = z.object({ id: z.string().uuid(), email: z.string().trim().email().max(320) });

export const withdrawApplication = defineAction({
  input: withdrawSchema,
  handler: async (input, context) => {
    const db = getDrizzle();
    const [current] = await db.select().from(applications).where(eq(applications.id, input.id)).limit(1);
    if (!current) throw new ActionError({ code: "NOT_FOUND", message: "Candidature introuvable." });
    const [traveler] = await db
      .select({ id: travelers.id, email: travelers.email })
      .from(travelers)
      .where(eq(travelers.id, current.travelerId))
      .limit(1);
    if (!traveler || normalizeEmail(traveler.email) !== normalizeEmail(input.email)) {
      throw new ActionError({ code: "FORBIDDEN", message: "Email ne correspondant pas au dossier." });
    }
    assertTransitionApplication(current.status as ApplicationStatus, "withdrawn");
    await db.transaction(async (tx) => {
      await tx.update(applications).set({ status: "withdrawn" }).where(eq(applications.id, input.id));
      await tx.insert(applicationEvents).values({ applicationId: input.id, event: "withdrawn" });
    });
    auditVoyage(context, current.travelerId, "APPLICATION_DECISION", {
      resource: "applications",
      resourceId: input.id,
      metadata: { decision: "withdrawn" },
    });
    return { success: true };
  },
});
