import { ActionError, defineAction, type ActionAPIContext } from "astro:actions";
import { and, eq } from "drizzle-orm";
import { z } from "astro/zod";
import { getDrizzle } from "@database/drizzle";
import { trips, tripTranslations, tripRevisions } from "@database/schemas";
import { LOCALES, type Locale } from "@i18n/config";
import { assertVoyagePermission, assertTripExists, assertFresh, auditVoyage, invalidateVoyageCache } from "./_helpers";
import { assertTransitionTrip } from "@/modules/trips/domain/trip-transitions";
import type { TripStatus } from "@database/schemas/trips.schema";

const idInput = z.object({ id: z.string().min(1).max(160) });

type TripTransition = "review" | "approved" | "published" | "unpublished" | "archived" | "restored";
const TRANSITION_TARGET: Record<TripTransition, TripStatus> = {
  review: "review",
  approved: "approved",
  published: "published",
  unpublished: "unpublished",
  archived: "archived",
  restored: "unpublished",
};
const TRANSITION_PERMISSION: Record<TripTransition, "update" | "publish"> = {
  review: "update",
  approved: "update",
  published: "publish",
  unpublished: "publish",
  archived: "update",
  restored: "update",
};
const TRANSITION_AUDIT = {
  review: "TRIP_UPDATE",
  approved: "TRIP_UPDATE",
  published: "TRIP_PUBLISH",
  unpublished: "TRIP_UNPUBLISH",
  archived: "TRIP_ARCHIVE",
  restored: "TRIP_RESTORE",
} as const;

async function transitionTrip(id: string, to: TripTransition, context: ActionAPIContext) {
  const user = await assertVoyagePermission(context, { trip: [TRANSITION_PERMISSION[to]] });
  const current = await assertTripExists(id);
  const target = TRANSITION_TARGET[to];
  assertTransitionTrip(current.status as TripStatus, target);
  const db = getDrizzle();
  await db.transaction(async (tx) => {
    await tx
      .insert(tripRevisions)
      .values({ tripId: id, snapshot: JSON.stringify(current), createdBy: user.id });
    await tx
      .update(trips)
      .set({ status: target, publishedAt: target === "published" ? new Date() : current.publishedAt })
      .where(eq(trips.id, id));
  });
  auditVoyage(context, user.id, TRANSITION_AUDIT[to], { resource: "trips", resourceId: id, metadata: { from: current.status, to: target } });
  invalidateVoyageCache();
  return { success: true };
}

const createTripSchema = z.object({
  countryCode: z.string().length(2),
  defaultCurrency: z.string().length(3).default("EUR"),
  durationDays: z.number().int().positive(),
  durationNights: z.number().int().min(0),
  groupMin: z.number().int().positive(),
  groupMax: z.number().int().positive(),
  difficulty: z.string().max(32).default("moderate"),
  difficultyLevel: z.number().int().min(1).max(5).default(3),
});

export const createTrip = defineAction({
  input: createTripSchema,
  handler: async (input, context) => {
    const user = await assertVoyagePermission(context, { trip: ["create"] });
    if (input.groupMax < input.groupMin) {
      throw new ActionError({ code: "BAD_REQUEST", message: "groupMax doit être ≥ groupMin." });
    }
    const [created] = await getDrizzle().insert(trips).values({ ...input }).returning({ id: trips.id });
    if (!created) throw new ActionError({ code: "INTERNAL_SERVER_ERROR", message: "Création du voyage impossible." });
    auditVoyage(context, user.id, "TRIP_CREATE", { resource: "trips", resourceId: created.id });
    invalidateVoyageCache();
    return { id: created.id };
  },
});

export const submitTripForReview = defineAction({ input: idInput, handler: (input, context) => transitionTrip(input.id, "review", context) });
export const approveTrip = defineAction({ input: idInput, handler: (input, context) => transitionTrip(input.id, "approved", context) });
export const publishTrip = defineAction({ input: idInput, handler: (input, context) => transitionTrip(input.id, "published", context) });
export const unpublishTrip = defineAction({ input: idInput, handler: (input, context) => transitionTrip(input.id, "unpublished", context) });
export const archiveTrip = defineAction({ input: idInput, handler: (input, context) => transitionTrip(input.id, "archived", context) });
export const restoreTrip = defineAction({ input: idInput, handler: (input, context) => transitionTrip(input.id, "restored", context) });

export const restoreTripRevision = defineAction({
  input: z.object({ id: z.string().min(1).max(160) }),
  handler: async (input, context) => {
    const user = await assertVoyagePermission(context, { trip: ["update"] });
    const db = getDrizzle();
    const [revision] = await db.select().from(tripRevisions).where(eq(tripRevisions.id, input.id)).limit(1);
    if (!revision) throw new ActionError({ code: "NOT_FOUND", message: "Révision introuvable." });
    const snapshot = JSON.parse(revision.snapshot) as Record<string, unknown>;
    const current = await assertTripExists(revision.tripId);
    const { id, createdAt, ...facts } = snapshot;
    void id;
    void createdAt;
    await db.transaction(async (tx) => {
      await tx.insert(tripRevisions).values({ tripId: revision.tripId, snapshot: JSON.stringify(current), createdBy: user.id });
      await tx.update(trips).set({ ...facts, updatedAt: new Date() }).where(eq(trips.id, revision.tripId));
    });
    auditVoyage(context, user.id, "TRIP_REVISION_RESTORE", {
      resource: "trips",
      resourceId: revision.tripId,
      metadata: { revisionId: revision.id },
    });
    invalidateVoyageCache();
    return { success: true };
  },
});

export const tripFactsInput = z.object({
  id: z.string().min(1).max(160),
  expectedUpdatedAt: z.string().datetime({ offset: true }).nullable().optional(),
  countryCode: z.string().length(2).optional(),
  defaultCurrency: z.string().length(3).optional(),
  durationDays: z.number().int().positive().optional(),
  durationNights: z.number().int().min(0).optional(),
  groupMin: z.number().int().positive().optional(),
  groupMax: z.number().int().positive().optional(),
  difficulty: z.string().max(32).optional(),
  difficultyLevel: z.number().int().min(1).max(5).optional(),
  arrivalAirport: z.string().max(8).nullable().optional(),
  departureAirport: z.string().max(8).nullable().optional(),
  accommodationStyle: z.string().max(64).nullable().optional(),
  requireAccount: z.boolean().nullable().optional(),
});

export const updateTrip = defineAction({
  input: tripFactsInput,
  handler: async (input, context) => {
    const user = await assertVoyagePermission(context, { trip: ["update"] });
    const current = await assertTripExists(input.id);
    assertFresh(current.updatedAt, input.expectedUpdatedAt ?? null, "Voyage");
    const { id, expectedUpdatedAt, ...patch } = input;
    void expectedUpdatedAt;
    const clean = Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined));
    if (Object.keys(clean).length === 0) {
      throw new ActionError({ code: "BAD_REQUEST", message: "Aucune modification." });
    }
    if (clean.groupMax !== undefined || clean.groupMin !== undefined) {
      const groupMin = (clean.groupMin as number | undefined) ?? current.groupMin;
      const groupMax = (clean.groupMax as number | undefined) ?? current.groupMax;
      if (groupMax < groupMin) throw new ActionError({ code: "BAD_REQUEST", message: "groupMax doit être ≥ groupMin." });
    }
    await getDrizzle().update(trips).set(clean).where(eq(trips.id, id));
    auditVoyage(context, user.id, "TRIP_UPDATE", { resource: "trips", resourceId: id, metadata: { fields: Object.keys(clean) } });
    invalidateVoyageCache();
    return { success: true };
  },
});

export const tripTranslationInput = z.object({
  tripId: z.string().min(1).max(160),
  expectedUpdatedAt: z.string().datetime({ offset: true }).nullable().optional(),
  locale: z.enum(LOCALES),
  slug: z.string().min(1).max(160).regex(/^[a-z0-9-]+$/, "Slug ASCII uniquement (a-z, 0-9, tirets)."),
  title: z.string().min(1),
  shortTitle: z.string().max(160).nullable().optional(),
  summary: z.string().min(1),
  overview: z.string().min(1),
  highlights: z.string().nullable().optional(),
  experience: z.string().nullable().optional(),
  fitness: z.string().nullable().optional(),
  preparation: z.string().nullable().optional(),
  lodging: z.string().nullable().optional(),
  food: z.string().nullable().optional(),
  faithConsiderations: z.string().nullable().optional(),
  metaTitle: z.string().max(220).nullable().optional(),
  metaDescription: z.string().max(320).nullable().optional(),
  localeVisible: z.boolean().optional(),
});

export const upsertTripTranslation = defineAction({
  input: tripTranslationInput,
  handler: async (input, context) => {
    const user = await assertVoyagePermission(context, { trip: ["update"] });
    await assertTripExists(input.tripId);
    const { tripId, locale, expectedUpdatedAt, ...fields } = input;
    if (expectedUpdatedAt != null) {
      const [existing] = await getDrizzle()
        .select({ updatedAt: tripTranslations.updatedAt })
        .from(tripTranslations)
        .where(and(eq(tripTranslations.tripId, tripId), eq(tripTranslations.locale, locale as Locale)))
        .limit(1);
      if (existing) assertFresh(existing.updatedAt, expectedUpdatedAt, "Traduction");
    }
    await getDrizzle()
      .insert(tripTranslations)
      .values({ tripId, locale: locale as Locale, ...fields })
      .onConflictDoUpdate({
        target: [tripTranslations.tripId, tripTranslations.locale],
        set: { ...fields },
      });
    auditVoyage(context, user.id, "TRIP_TRANSLATION_UPSERT", { resource: "trip_translations", resourceId: tripId, metadata: { locale } });
    invalidateVoyageCache();
    return { success: true };
  },
});
