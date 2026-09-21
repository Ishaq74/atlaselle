import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { eq } from 'drizzle-orm';
import { getDrizzle } from '@database/drizzle';
import { insertTestTrip } from '../helpers/trip-factory';
import { invalidateCache } from '@database/cache';
import { trips, tripTranslations } from '@database/schemas/trips.schema';
import { departures } from '@database/schemas/departures.schema';
import { itineraryDays, itineraryDayTranslations } from '@database/schemas/itinerary.schema';
import { loadTripPage, loadTripsList } from '@/modules/trips/loaders/trip.loader';

const db = getDrizzle();
const stamp = Date.now().toString(36);
const TRIP_ID = `test-trip-${stamp}`;
const SLUG_FR = `voyage-test-${stamp}`;
const SLUG_EN = `test-trip-${stamp}`;

async function cleanup() {
  const dayRows = await db.select({ id: itineraryDays.id }).from(itineraryDays).where(eq(itineraryDays.tripId, TRIP_ID));
  for (const d of dayRows) {
    await db.delete(itineraryDayTranslations).where(eq(itineraryDayTranslations.dayId, d.id));
  }
  await db.delete(itineraryDays).where(eq(itineraryDays.tripId, TRIP_ID));
  await db.delete(departures).where(eq(departures.tripId, TRIP_ID));
  await db.delete(tripTranslations).where(eq(tripTranslations.tripId, TRIP_ID));
  await db.delete(trips).where(eq(trips.id, TRIP_ID));
  invalidateCache();
}

describe('Trip loaders (DB voyage)', () => {
  beforeAll(async () => {
    await cleanup();
    await insertTestTrip(db, {
      id: TRIP_ID,
      status: 'published',
      countryCode: 'FR',
      defaultCurrency: 'EUR',
      durationDays: 4,
      durationNights: 3,
      groupMin: 4,
      groupMax: 10,
      difficulty: 'easy',
      difficultyLevel: 2,
      publishedAt: new Date(),
    });
    await db.insert(tripTranslations).values([
      {
        id: `test-tr-fr-${stamp}`, tripId: TRIP_ID, locale: 'fr', slug: SLUG_FR,
        title: 'Voyage test', summary: 'Résumé test', overview: 'Aperçu test', localeVisible: true,
      },
      {
        id: `test-tr-en-${stamp}`, tripId: TRIP_ID, locale: 'en', slug: SLUG_EN,
        title: 'Test trip', summary: 'Test summary', overview: 'Test overview', localeVisible: true,
      },
    ]);
    await db.insert(departures).values({
      id: `test-dep-${stamp}`,
      tripId: TRIP_ID,
      startDate: new Date('2027-05-01T08:00:00.000Z'),
      endDate: new Date('2027-05-04T18:00:00.000Z'),
      status: 'open',
      capacityMin: 4,
      capacityMax: 10,
      priceAmount: 100000,
      currency: 'EUR',
      pricingRules: {},
    });
    await db.insert(itineraryDays).values({ id: `test-day-${stamp}`, tripId: TRIP_ID, dayNumber: 1, location: 'Testville' });
    await db.insert(itineraryDayTranslations).values({
      id: `test-dayt-${stamp}`, dayId: `test-day-${stamp}`, locale: 'fr', title: 'Jour 1', morning: 'Matin',
    });
  });

  afterAll(cleanup);

  it('loads a published trip page in French', async () => {
    const dto = await loadTripPage('fr', SLUG_FR);
    expect(dto).not.toBeNull();
    expect(dto!.id).toBe(TRIP_ID);
    expect(dto!.translations.fr.title).toBe('Voyage test');
    expect(dto!.translations.en.title).toBe('Test trip');
    expect(dto!.price).toBe(1000);
    expect(dto!.currency).toBe('EUR');
    expect(dto!.capacity).toBe(10);
    expect(dto!.remainingPlaces).toBe(10);
    expect(dto!.status).toBe('open');
    expect(dto!.translations.fr.itinerary).toHaveLength(1);
    expect(dto!.translations.fr.itinerary[0].title).toBe('Jour 1');
  });

  it('returns null for unknown slugs and locales', async () => {
    expect(await loadTripPage('fr', 'inexistant')).toBeNull();
    expect(await loadTripPage('es', SLUG_FR)).toBeNull();
  });

  it('lists published trips with visible translations', async () => {
    const list = await loadTripsList('en');
    const found = list.find((t) => t.id === TRIP_ID);
    expect(found).toBeDefined();
    expect(found!.slug).toBe(SLUG_EN);
    expect(found!.priceFrom).toBe(1000);
  });
});
