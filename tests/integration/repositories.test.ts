import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { eq } from 'drizzle-orm';
import { getDrizzle } from '@database/drizzle';
import { insertTestTrip } from '../helpers/trip-factory';
import { invalidateCache } from '@database/cache';
import { trips } from '@database/schemas/trips.schema';
import { departures, seatHolds } from '@database/schemas/departures.schema';
import { getDepartureById, getActiveHoldsByDeparture, lockDepartureForUpdate } from '@/modules/departures/repositories/departure.repository';
import { countConfirmedByDeparture, getReservationById } from '@/modules/reservations/repositories/reservation.repository';
import { getTripTitle } from '@/modules/trips/repositories/trip.repository';

const db = getDrizzle();
const stamp = Date.now().toString(36);
const TRIP_ID = `test-repo-trip-${stamp}`;
const DEP_ID = `test-repo-dep-${stamp}`;

async function cleanup() {
  await db.delete(seatHolds).where(eq(seatHolds.departureId, DEP_ID));
  await db.delete(departures).where(eq(departures.id, DEP_ID));
  await db.delete(trips).where(eq(trips.id, TRIP_ID));
  await invalidateCache();
}

describe('Repositories — lectures isolées par module (real DB)', () => {
  beforeAll(async () => {
    await cleanup();
    await insertTestTrip(db, {
      id: TRIP_ID, status: 'published', countryCode: 'FR', defaultCurrency: 'EUR',
      durationDays: 4, durationNights: 3, groupMin: 1, groupMax: 1, difficulty: 'easy', difficultyLevel: 1,
      publishedAt: new Date(),
    });
    await db.insert(departures).values({
      id: DEP_ID, tripId: TRIP_ID,
      startDate: new Date('2027-10-01T08:00:00.000Z'), endDate: new Date('2027-10-04T18:00:00.000Z'),
      status: 'open', capacityMin: 1, capacityMax: 2, priceAmount: 60000, currency: 'EUR', pricingRules: {},
    });
  });

  afterAll(cleanup);

  it('getDepartureById retourne le départ', async () => {
    const dep = await getDepartureById(DEP_ID);
    expect(dep?.id).toBe(DEP_ID);
    expect(await getDepartureById('inexistant')).toBeNull();
  });

  it('getActiveHoldsByDeparture + countConfirmedByDeparture', async () => {
    expect(await getActiveHoldsByDeparture(DEP_ID)).toHaveLength(0);
    expect(await countConfirmedByDeparture(DEP_ID)).toBe(0);
    expect(await getReservationById('inexistant')).toBeNull();
  });

  it('lockDepartureForUpdate verrouille dans une transaction', async () => {
    await db.transaction(async (tx) => {
      const dep = await lockDepartureForUpdate(DEP_ID, tx);
      expect(dep?.id).toBe(DEP_ID);
    });
  });

  it('getTripTitle retourne null sans traduction', async () => {
    expect(await getTripTitle(TRIP_ID)).toBeNull();
  });
});
