import { describe, expect, it } from 'vitest';
import trips from '@database/data/41-trips.data';
import tripTranslations from '@database/data/42-trip-translations.data';
import departures from '@database/data/43-departures.data';
import itineraryDays from '@database/data/44-itinerary.data';
import itineraryDayTranslations from '@database/data/44b-itinerary-translations.data';
import faqs from '@database/data/45-faq.data';
import faqTranslations from '@database/data/45b-faq-translations.data';
import tripFaqs from '@database/data/45c-trip-faqs.data';
import tripHighlights from '@database/data/46-trip-highlights.data';
import tripHighlightTranslations from '@database/data/46b-trip-highlight-translations.data';
import tripInclusions from '@database/data/46c-trip-inclusions.data';
import tripInclusionTranslations from '@database/data/46d-trip-inclusion-translations.data';
import tripExclusions from '@database/data/46e-trip-exclusions.data';
import tripExclusionTranslations from '@database/data/46f-trip-exclusion-translations.data';
import policyDocuments from '@database/data/47-policy-documents.data';
import policyVersions from '@database/data/47b-policy-versions.data';
import { TRIP_SLUGS, type TripId } from '@/i18n/routes';
import { LOCALES } from '@/i18n/config';

const ASCII_SLUG = /^[a-z0-9-]+$/;
const tripIds = new Set((trips as { id: string }[]).map((t) => t.id));

describe('seeds voyage — invariants contenu', () => {
  it('3 voyages publiés cohérents', () => {
    expect(trips).toHaveLength(3);
    for (const t of trips as any[]) {
      expect(t.status).toBe('published');
      expect(t.publishedAt).toBeInstanceOf(Date);
      expect(t.groupMax).toBeGreaterThanOrEqual(t.groupMin);
      expect(t.difficultyLevel).toBeGreaterThanOrEqual(1);
      expect(t.difficultyLevel).toBeLessThanOrEqual(5);
      expect(t.durationDays).toBeGreaterThan(0);
    }
  });

  it('12 traductions (3×4), slugs ASCII alignés sur routes.ts', () => {
    expect(tripTranslations).toHaveLength(12);
    const seen = new Set<string>();
    for (const tr of tripTranslations as any[]) {
      expect(tripIds.has(tr.tripId)).toBe(true);
      expect(LOCALES).toContain(tr.locale);
      expect(tr.slug).toMatch(ASCII_SLUG);
      const key = `${tr.tripId}:${tr.locale}`;
      expect(seen.has(key)).toBe(false);
      seen.add(key);
      expect(typeof tr.localeVisible).toBe('boolean');
    }
  });

  it('départs : trips existants, dates et capacités cohérentes, ouverts présents', () => {
    expect(departures.length).toBeGreaterThan(0);
    for (const d of departures as any[]) {
      expect(tripIds.has(d.tripId)).toBe(true);
      expect(new Date(d.endDate).getTime()).toBeGreaterThan(new Date(d.startDate).getTime());
      expect(d.capacityMax).toBeGreaterThanOrEqual(d.capacityMin);
      expect(d.priceAmount).toBeGreaterThanOrEqual(0);
    }
    expect((departures as any[]).some((d) => d.status === 'open')).toBe(true);
  });

  it('itinéraire : jours séquentiels, traductions rattachées', () => {
    const dayIds = new Set((itineraryDays as any[]).map((d) => d.id));
    const byTrip = new Map<string, number[]>();
    for (const d of itineraryDays as any[]) {
      expect(tripIds.has(d.tripId)).toBe(true);
      if (!byTrip.has(d.tripId)) byTrip.set(d.tripId, []);
      byTrip.get(d.tripId)!.push(d.dayNumber);
    }
    for (const days of byTrip.values()) {
      expect([...days].sort((a, b) => a - b)).toEqual(days);
      expect(days[0]).toBe(1);
    }
    for (const tr of itineraryDayTranslations as any[]) {
      expect(dayIds.has(tr.dayId)).toBe(true);
      expect(LOCALES).toContain(tr.locale);
    }
  });

  it('faq : liens rattachés aux deux bouts', () => {
    const faqIds = new Set((faqs as any[]).map((f) => f.id));
    for (const tr of faqTranslations as any[]) expect(faqIds.has(tr.faqId)).toBe(true);
    for (const l of tripFaqs as any[]) {
      expect(tripIds.has(l.tripId)).toBe(true);
      expect(faqIds.has(l.faqId)).toBe(true);
    }
  });

  it('contenus : highlights/inclusions/exclusions rattachés + traduits', () => {
    const hlIds = new Set((tripHighlights as any[]).map((h) => h.id));
    const incIds = new Set((tripInclusions as any[]).map((i) => i.id));
    const excIds = new Set((tripExclusions as any[]).map((e) => e.id));
    for (const h of tripHighlights as any[]) expect(tripIds.has(h.tripId)).toBe(true);
    for (const i of tripInclusions as any[]) expect(tripIds.has(i.tripId)).toBe(true);
    for (const e of tripExclusions as any[]) expect(tripIds.has(e.tripId)).toBe(true);
    for (const tr of tripHighlightTranslations as any[]) expect(hlIds.has(tr.highlightId)).toBe(true);
    for (const tr of tripInclusionTranslations as any[]) expect(incIds.has(tr.inclusionId)).toBe(true);
    for (const tr of tripExclusionTranslations as any[]) expect(excIds.has(tr.exclusionId)).toBe(true);
  });

  it('policies : versions rattachées, toutes brouillons non publiés', () => {
    const docIds = new Set((policyDocuments as any[]).map((d) => d.id));
    expect(docIds.size).toBeGreaterThan(0);
    for (const v of policyVersions as any[]) {
      expect(docIds.has(v.documentId)).toBe(true);
      expect(v.published).toBe(false);
    }
  });

  it('TRIP_SLUGS statiques couverts par les seeds EN', () => {
    for (const id of Object.keys(TRIP_SLUGS) as TripId[]) {
      const en = (tripTranslations as any[]).find((t) => t.locale === 'en' && t.slug === TRIP_SLUGS[id].en);
      expect(en, `slug EN manquant pour ${id}`).toBeDefined();
    }
  });
});
