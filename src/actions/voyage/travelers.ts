import { ActionError, defineAction } from "astro:actions";
import { eq } from "drizzle-orm";
import { z } from "astro/zod";
import { getDrizzle } from "@database/drizzle";
import { travelers } from "@database/schemas";
import { applications } from "@database/schemas";
import { reservations } from "@database/schemas";
import { ACTIVE_APPLICATION_STATUSES } from "@/modules/applications/domain/application-transitions";
import { assertVoyagePermission, auditVoyage } from "./_helpers";

const idInput = z.object({ id: z.uuid() });

// RGPD droit d'accès : export JSON du dossier (sans notes internes, TODO §19).
export const exportTravelerData = defineAction({
  input: idInput,
  handler: async (input, context) => {
    const user = await assertVoyagePermission(context, { traveler: ["export"] });
    const db = getDrizzle();
    const [traveler] = await db.select().from(travelers).where(eq(travelers.id, input.id)).limit(1);
    if (!traveler) throw new ActionError({ code: "NOT_FOUND", message: "Voyageuse introuvable." });
    const apps = await db.select().from(applications).where(eq(applications.travelerId, input.id));
    const res = await db.select().from(reservations).where(eq(reservations.travelerId, input.id));
    auditVoyage(context, user.id, "USER_DATA_EXPORT", { resource: "travelers", resourceId: input.id });
    return {
      traveler: {
        email: traveler.email,
        phone: traveler.phone,
        legalName: traveler.legalName,
        preferredName: traveler.preferredName,
        locale: traveler.locale,
        createdAt: traveler.createdAt,
      },
      applications: apps.map((a) => ({ id: a.id, status: a.status, submittedAt: a.submittedAt })),
      reservations: res.map((r) => ({
        reservationNumber: r.reservationNumber,
        status: r.status,
        totalAmount: r.totalAmount,
        amountPaid: r.amountPaid,
        currency: r.currency,
      })),
    };
  },
});

const ACTIVE_RESERVATION_STATUSES = ["pending", "awaiting_payment", "confirmed", "balance_due"] as const;

// RGPD suppression : anonymisation (transactions conservées sans PII, TODO §19).
// Refusée tant qu'un dossier est en cours.
export const anonymizeTraveler = defineAction({
  input: idInput,
  handler: async (input, context) => {
    const user = await assertVoyagePermission(context, { traveler: ["anonymize"] });
    const db = getDrizzle();
    const [traveler] = await db.select().from(travelers).where(eq(travelers.id, input.id)).limit(1);
    if (!traveler) throw new ActionError({ code: "NOT_FOUND", message: "Voyageuse introuvable." });
    const withStatus = await db
      .select({ status: applications.status })
      .from(applications)
      .where(eq(applications.travelerId, input.id));
    if (withStatus.some((a) => (ACTIVE_APPLICATION_STATUSES as readonly string[]).includes(a.status))) {
      throw new ActionError({ code: "CONFLICT", message: "Dossier en cours : anonymisation impossible." });
    }
    const activeRes = await db.select({ status: reservations.status }).from(reservations).where(eq(reservations.travelerId, input.id));
    if (activeRes.some((r) => (ACTIVE_RESERVATION_STATUSES as readonly string[]).includes(r.status))) {
      throw new ActionError({ code: "CONFLICT", message: "Réservation en cours : anonymisation impossible." });
    }
    await db
      .update(travelers)
      .set({
        email: `deleted-${input.id.slice(0, 8)}@deleted.local`,
        phone: null,
        legalName: null,
        preferredName: null,
        dateOfBirth: null,
      })
      .where(eq(travelers.id, input.id));
    auditVoyage(context, user.id, "USER_DELETE", { resource: "travelers", resourceId: input.id });
    return { success: true };
  },
});
