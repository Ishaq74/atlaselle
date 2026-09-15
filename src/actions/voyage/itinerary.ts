import { ActionError, defineAction } from "astro:actions";
import { and, eq } from "drizzle-orm";
import { z } from "astro/zod";
import { getDrizzle } from "@database/drizzle";
import { itineraryDays, itineraryDayTranslations } from "@database/schemas";
import { LOCALES, type Locale } from "@i18n/config";
import { assertVoyagePermission, assertTripExists, assertFresh, auditVoyage, invalidateVoyageCache } from "./_helpers";

const idInput = z.object({ id: z.string().min(1).max(160) });

export const createItineraryDay = defineAction({
  input: z.object({
    tripId: z.string().min(1).max(160),
    dayNumber: z.number().int().positive(),
    location: z.string().max(200).nullable().optional(),
    route: z.string().max(300).nullable().optional(),
    activityLevel: z.number().int().min(1).max(5).nullable().optional(),
  }),
  handler: async (input, context) => {
    const user = await assertVoyagePermission(context, { trip: ["update"] });
    await assertTripExists(input.tripId);
    let created: { id: string } | undefined;
    try {
      [created] = await getDrizzle()
        .insert(itineraryDays)
        .values({ tripId: input.tripId, dayNumber: input.dayNumber, location: input.location ?? null, route: input.route ?? null, activityLevel: input.activityLevel ?? null })
        .returning({ id: itineraryDays.id });
    } catch (err: unknown) {
      const cause = err instanceof Error && (err as { cause?: unknown }).cause;
      const text = `${err instanceof Error ? err.message : ""} ${cause instanceof Error ? cause.message : ""} ${(err as { code?: unknown })?.code ?? ""}`;
      if (/unique|duplicate|23505/i.test(text)) {
        throw new ActionError({ code: "CONFLICT", message: "Ce numéro de jour existe déjà." });
      }
      throw err;
    }
    if (!created) throw new ActionError({ code: "INTERNAL_SERVER_ERROR", message: "Jour impossible." });
    auditVoyage(context, user.id, "TRIP_UPDATE", { resource: "itinerary_days", resourceId: created.id, metadata: { tripId: input.tripId } });
    invalidateVoyageCache();
    return { id: created.id };
  },
});

export const updateItineraryDay = defineAction({
  input: z.object({
    id: z.string().min(1).max(160),
    expectedUpdatedAt: z.string().datetime({ offset: true }).nullable().optional(),
    location: z.string().max(200).nullable().optional(),
    route: z.string().max(300).nullable().optional(),
    activityLevel: z.number().int().min(1).max(5).nullable().optional(),
  }),
  handler: async (input, context) => {
    const user = await assertVoyagePermission(context, { trip: ["update"] });
    const { id, expectedUpdatedAt, ...patch } = input;
    const [current] = await getDrizzle().select().from(itineraryDays).where(eq(itineraryDays.id, id)).limit(1);
    if (!current) throw new ActionError({ code: "NOT_FOUND", message: "Jour introuvable." });
    assertFresh(current.updatedAt, expectedUpdatedAt ?? null, "Jour");
    const clean = Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined));
    await getDrizzle().update(itineraryDays).set(clean).where(eq(itineraryDays.id, id));
    auditVoyage(context, user.id, "TRIP_UPDATE", { resource: "itinerary_days", resourceId: id, metadata: { fields: Object.keys(clean) } });
    invalidateVoyageCache();
    return { success: true };
  },
});

export const deleteItineraryDay = defineAction({
  input: idInput,
  handler: async (input, context) => {
    const user = await assertVoyagePermission(context, { trip: ["update"] });
    await getDrizzle().delete(itineraryDays).where(eq(itineraryDays.id, input.id));
    auditVoyage(context, user.id, "TRIP_UPDATE", { resource: "itinerary_days", resourceId: input.id, metadata: { deleted: true } });
    invalidateVoyageCache();
    return { success: true };
  },
});

export const upsertItineraryDayTranslation = defineAction({
  input: z.object({
    dayId: z.string().min(1).max(160),
    expectedUpdatedAt: z.string().datetime({ offset: true }).nullable().optional(),
    locale: z.enum(LOCALES),
    title: z.string().min(1).max(300),
    morning: z.string().max(4000).nullable().optional(),
    afternoon: z.string().max(4000).nullable().optional(),
    evening: z.string().max(4000).nullable().optional(),
    meals: z.string().max(500).nullable().optional(),
    accommodation: z.string().max(500).nullable().optional(),
    transfer: z.string().max(500).nullable().optional(),
    notes: z.string().max(2000).nullable().optional(),
  }),
  handler: async (input, context) => {
    const user = await assertVoyagePermission(context, { trip: ["update"] });
    const { dayId, locale, expectedUpdatedAt, ...fields } = input;
    if (expectedUpdatedAt != null) {
      const [existing] = await getDrizzle()
        .select({ updatedAt: itineraryDayTranslations.updatedAt })
        .from(itineraryDayTranslations)
        .where(and(eq(itineraryDayTranslations.dayId, dayId), eq(itineraryDayTranslations.locale, locale as Locale)))
        .limit(1);
      if (existing) assertFresh(existing.updatedAt, expectedUpdatedAt, "Jour (traduction)");
    }
    // Clés undefined (champ absent du formulaire) = inchangées ; null = effacement explicite.
    const clean = Object.fromEntries(Object.entries(fields).filter(([, v]) => v !== undefined));
    await getDrizzle()
      .insert(itineraryDayTranslations)
      .values({ dayId, locale: locale as Locale, title: "", ...clean })
      .onConflictDoUpdate({
        target: [itineraryDayTranslations.dayId, itineraryDayTranslations.locale],
        set: { ...clean },
      });
    auditVoyage(context, user.id, "TRIP_TRANSLATION_UPSERT", { resource: "itinerary_day_translations", resourceId: dayId, metadata: { locale } });
    invalidateVoyageCache();
    return { success: true };
  },
});
