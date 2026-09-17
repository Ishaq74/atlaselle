import { ActionError, defineAction } from "astro:actions";
import { and, eq } from "drizzle-orm";
import { z } from "astro/zod";
import { getDrizzle } from "@database/drizzle";
import { faqs, faqTranslations, tripFaqs } from "@database/schemas";
import { LOCALES, type Locale } from "@i18n/config";
import { assertVoyagePermission, assertTripExists, assertFresh, auditVoyage, invalidateVoyageCache } from "./_helpers";

export const createFaq = defineAction({
  input: z.object({
    tripId: z.string().min(1).max(160).nullable().optional(),
    sortOrder: z.number().int().min(0).default(0),
    locale: z.enum(LOCALES),
    question: z.string().min(1).max(500),
    answer: z.string().min(1).max(8000),
  }),
  handler: async (input, context) => {
    const user = await assertVoyagePermission(context, { trip: ["update"] });
    // Vérifier d'abord : sinon un tripId invalide laisse une FAQ orpheline.
    if (input.tripId) await assertTripExists(input.tripId);
    const db = getDrizzle();
    const [faq] = await db.insert(faqs).values({ sortOrder: input.sortOrder }).returning({ id: faqs.id });
    if (!faq) throw new ActionError({ code: "INTERNAL_SERVER_ERROR", message: "FAQ impossible." });
    await db.insert(faqTranslations).values({
      faqId: faq.id, locale: input.locale as Locale, question: input.question, answer: input.answer,
    });
    if (input.tripId) {
      await assertTripExists(input.tripId);
      await db.insert(tripFaqs).values({ tripId: input.tripId, faqId: faq.id, sortOrder: 0 }).onConflictDoNothing();
    }
    auditVoyage(context, user.id, "TRIP_UPDATE", { resource: "faqs", resourceId: faq.id, metadata: { tripId: input.tripId ?? null } });
    invalidateVoyageCache();
    return { id: faq.id };
  },
});

export const upsertFaqTranslation = defineAction({
  input: z.object({
    faqId: z.string().min(1).max(160),
    expectedUpdatedAt: z.string().datetime({ offset: true }).nullable().optional(),
    locale: z.enum(LOCALES),
    question: z.string().min(1).max(500),
    answer: z.string().min(1).max(8000),
  }),
  handler: async (input, context) => {
    const user = await assertVoyagePermission(context, { trip: ["update"] });
    const { faqId, locale, expectedUpdatedAt, ...fields } = input;
    if (expectedUpdatedAt != null) {
      const [existing] = await getDrizzle()
        .select({ updatedAt: faqTranslations.updatedAt })
        .from(faqTranslations)
        .where(and(eq(faqTranslations.faqId, faqId), eq(faqTranslations.locale, locale as Locale)))
        .limit(1);
      if (existing) assertFresh(existing.updatedAt, expectedUpdatedAt, "FAQ");
    }
    await getDrizzle()
      .insert(faqTranslations)
      .values({ faqId, locale: locale as Locale, ...fields })
      .onConflictDoUpdate({ target: [faqTranslations.faqId, faqTranslations.locale], set: { ...fields } });
    auditVoyage(context, user.id, "TRIP_TRANSLATION_UPSERT", { resource: "faq_translations", resourceId: faqId, metadata: { locale } });
    invalidateVoyageCache();
    return { success: true };
  },
});

export const deleteFaq = defineAction({
  input: z.object({ id: z.string().min(1).max(160) }),
  handler: async (input, context) => {
    const user = await assertVoyagePermission(context, { trip: ["update"] });
    await getDrizzle().delete(faqs).where(eq(faqs.id, input.id));
    auditVoyage(context, user.id, "TRIP_UPDATE", { resource: "faqs", resourceId: input.id, metadata: { deleted: true } });
    invalidateVoyageCache();
    return { success: true };
  },
});

export const linkFaqToTrip = defineAction({
  input: z.object({ tripId: z.string().min(1).max(160), faqId: z.string().min(1).max(160) }),
  handler: async (input, context) => {
    const user = await assertVoyagePermission(context, { trip: ["update"] });
    await assertTripExists(input.tripId);
    await getDrizzle().insert(tripFaqs).values({ tripId: input.tripId, faqId: input.faqId, sortOrder: 0 }).onConflictDoNothing();
    auditVoyage(context, user.id, "TRIP_UPDATE", { resource: "trip_faqs", metadata: { tripId: input.tripId, faqId: input.faqId } });
    invalidateVoyageCache();
    return { success: true };
  },
});

export const unlinkFaqFromTrip = defineAction({
  input: z.object({ tripId: z.string().min(1).max(160), faqId: z.string().min(1).max(160) }),
  handler: async (input, context) => {
    const user = await assertVoyagePermission(context, { trip: ["update"] });
    await getDrizzle()
      .delete(tripFaqs)
      .where(and(eq(tripFaqs.tripId, input.tripId), eq(tripFaqs.faqId, input.faqId)));
    auditVoyage(context, user.id, "TRIP_UPDATE", { resource: "trip_faqs", metadata: { tripId: input.tripId, faqId: input.faqId, unlinked: true } });
    invalidateVoyageCache();
    return { success: true };
  },
});
