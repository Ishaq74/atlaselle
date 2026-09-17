import { describe, expect, it } from 'vitest';
import { getDrizzle } from '@database/drizzle';
import { eq } from 'drizzle-orm';
import { trips } from '@database/schemas/trips.schema';
import { loadTripPage } from '@/modules/trips/loaders/trip.loader';
import { getApplyPath } from '@/i18n/routes';
import type { Locale } from '@/i18n/config';

// Non-régression 500 apply (2026-09-15) : la page construisait ses
// alternateUrls via TRIP_SLUGS[dto.id], mais les ids DB sont "trip-*"
// (seeds) ou libres (admin) alors que les clés TRIP_SLUGS sont
// "south-africa" & co → TypeError → 500 sur TOUTES les pages apply.
// La page lit désormais dto.translations[loc].slug (garanti par le loader).
describe('apply page — alternateUrls sans lookup statique', () => {
  it('chaque voyage publié expose un slug par locale pour getApplyPath', async () => {
    const db = getDrizzle();
    const published = await db.select({ id: trips.id }).from(trips).where(eq(trips.status, 'published'));
    expect(published.length).toBeGreaterThanOrEqual(1);
    for (const { id } of published) {
      // Reproduit la construction de [trip].astro sans TRIP_SLUGS
      const dto = await loadTripPage('en', (await db.query.tripTranslations.findFirst({
        where: (t, { and, eq }) => and(eq(t.tripId, id), eq(t.locale, 'en')),
      }))?.slug ?? '__missing__');
      if (!dto) continue;
      for (const loc of ['fr', 'en', 'es', 'ar'] as Locale[]) {
        const slug = dto.translations[loc].slug;
        expect(slug, `slug ${loc} de ${id}`).toBeTypeOf('string');
        expect(getApplyPath(loc, slug)).toContain(slug);
      }
    }
  });

  it('les 3 slugs FR seeds se chargent avec 4 traductions', async () => {
    for (const slug of ['afrique-du-sud', 'sicile-malte', 'andalousie-maroc']) {
      const dto = await loadTripPage('fr', slug);
      expect(dto, slug).not.toBeNull();
      for (const loc of ['fr', 'en', 'es', 'ar'] as Locale[]) {
        expect(dto!.translations[loc].slug).toBeTruthy();
        expect(dto!.translations[loc].title).toBeTruthy();
      }
    }
  });
});
