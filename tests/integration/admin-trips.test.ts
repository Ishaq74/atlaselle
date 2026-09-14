import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { eq } from 'drizzle-orm';
import { getDrizzle } from '@database/drizzle';
import { invalidateCache } from '@database/cache';
import { trips, tripTranslations } from '@database/schemas/trips.schema';
import { loadAdminTrips, loadAdminTrip } from '@/modules/trips/loaders/admin-trips.loader';

const db = getDrizzle();
const stamp = Date.now().toString(36);
const TRIP_ID = `test-admin-trip-${stamp}`;
const TITLE = `Admin Test Trip ${stamp}`;

async function cleanup() {
  await db.delete(tripTranslations).where(eq(tripTranslations.tripId, TRIP_ID));
  await db.delete(trips).where(eq(trips.id, TRIP_ID));
  invalidateCache();
}

describe('Admin trips loaders', () => {
  beforeAll(async () => {
    await cleanup();
    await db.insert(trips).values({
      id: TRIP_ID, status: 'draft', countryCode: 'FR', defaultCurrency: 'EUR',
      durationDays: 4, durationNights: 3, groupMin: 2, groupMax: 8,
      difficulty: 'easy', difficultyLevel: 2,
    });
    await db.insert(tripTranslations).values({
      id: `test-admin-tr-${stamp}`, tripId: TRIP_ID, locale: 'fr',
      slug: `admin-test-${stamp}`, title: TITLE, summary: 'Résumé', overview: 'Aperçu', localeVisible: false,
    });
  });

  afterAll(cleanup);

  it('finds the trip by search with pagination meta', async () => {
    const { rows, meta } = await loadAdminTrips({ search: TITLE });
    expect(meta.total).toBeGreaterThanOrEqual(1);
    expect(rows.some((r) => r.id === TRIP_ID)).toBe(true);
    const row = rows.find((r) => r.id === TRIP_ID)!;
    expect(row.status).toBe('draft');
    expect(row.title).toBe(TITLE);
    expect(meta.page).toBe(1);
  });

  it('filters by status', async () => {
    const { rows } = await loadAdminTrips({ status: 'published' });
    expect(rows.every((r) => r.status === 'published')).toBe(true);
    expect(rows.some((r) => r.id === TRIP_ID)).toBe(false);
  });

  it('loads trip detail with translations', async () => {
    const detail = await loadAdminTrip(TRIP_ID);
    expect(detail).not.toBeNull();
    expect(detail!.translations).toHaveLength(1);
    expect(detail!.departures).toEqual([]);
  });

  it('returns null for unknown trips', async () => {
    expect(await loadAdminTrip('00000000-0000-0000-0000-000000000000')).toBeNull();
  });
});
