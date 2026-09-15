import { asc, eq } from "drizzle-orm";
import { getDrizzle } from "@database/drizzle";
import {
  tripHighlights,
  tripHighlightTranslations,
  tripInclusions,
  tripInclusionTranslations,
  tripExclusions,
  tripExclusionTranslations,
  faqs,
  faqTranslations,
  tripFaqs,
} from "@database/schemas/trips.schema";

export async function loadAdminContents(tripId: string) {
  const db = getDrizzle();
  const highlights = await db.select().from(tripHighlights).where(eq(tripHighlights.tripId, tripId)).orderBy(asc(tripHighlights.sortOrder));
  const inclusions = await db.select().from(tripInclusions).where(eq(tripInclusions.tripId, tripId)).orderBy(asc(tripInclusions.sortOrder));
  const exclusions = await db.select().from(tripExclusions).where(eq(tripExclusions.tripId, tripId)).orderBy(asc(tripExclusions.sortOrder));

  const highlightTranslations = await Promise.all(
    highlights.map(async (h) => ({
      highlight: h,
      translations: await db.select().from(tripHighlightTranslations).where(eq(tripHighlightTranslations.highlightId, h.id)),
    })),
  );
  const inclusionTranslations = await Promise.all(
    inclusions.map(async (i) => ({
      inclusion: i,
      translations: await db.select().from(tripInclusionTranslations).where(eq(tripInclusionTranslations.inclusionId, i.id)),
    })),
  );
  const exclusionTranslations = await Promise.all(
    exclusions.map(async (e) => ({
      exclusion: e,
      translations: await db.select().from(tripExclusionTranslations).where(eq(tripExclusionTranslations.exclusionId, e.id)),
    })),
  );
  return { highlights: highlightTranslations, inclusions: inclusionTranslations, exclusions: exclusionTranslations };
}

export async function loadAdminTripFaqs(tripId: string) {
  const db = getDrizzle();
  const linked = await db.select().from(tripFaqs).where(eq(tripFaqs.tripId, tripId)).orderBy(asc(tripFaqs.sortOrder));
  const out = [];
  for (const link of linked) {
    const [faq] = await db.select().from(faqs).where(eq(faqs.id, link.faqId)).limit(1);
    if (!faq) continue;
    const translations = await db.select().from(faqTranslations).where(eq(faqTranslations.faqId, faq.id));
    out.push({ faq, translations });
  }
  const all = await db.select().from(faqs).orderBy(asc(faqs.sortOrder)).limit(200);
  return { linked: out, all };
}
