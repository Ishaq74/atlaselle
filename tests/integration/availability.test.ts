import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { eq } from 'drizzle-orm';
import { getDrizzle } from '@database/drizzle';
import { insertTestTrip } from '../helpers/trip-factory';
import { invalidateCache } from '@database/cache';
import { trips } from '@database/schemas/trips.schema';
import { departures, seatHolds } from '@database/schemas/departures.schema';
import {
  convertHold,
  expireHolds,
  getAvailability,
  holdSeats,
  releaseHold,
} from '@/modules/availability/domain/availability-service';

const db = getDrizzle();
const stamp = Date.now().toString(36);
const TRIP_ID = `test-hold-trip-${stamp}`;
const DEP_ID = `test-hold-dep-${stamp}`;

async function cleanup() {
  await db.delete(seatHolds).where(eq(seatHolds.departureId, DEP_ID));
  await db.delete(departures).where(eq(departures.id, DEP_ID));
  await db.delete(trips).where(eq(trips.id, TRIP_ID));
  invalidateCache();
}

describe('Availability — holds & concurrence (real DB)', () => {
  beforeAll(async () => {
    await cleanup();
    await insertTestTrip(db, {
      id: TRIP_ID, status: 'published', countryCode: 'FR', defaultCurrency: 'EUR',
      durationDays: 4, durationNights: 3, groupMin: 1, groupMax: 1, difficulty: 'easy', difficultyLevel: 1,
      publishedAt: new Date(),
    });
    await db.insert(departures).values({
      id: DEP_ID, tripId: TRIP_ID,
      startDate: new Date('2027-09-01T08:00:00.000Z'), endDate: new Date('2027-09-04T18:00:00.000Z'),
      status: 'open', capacityMin: 1, capacityMax: 1, priceAmount: 50000, currency: 'EUR', pricingRules: {},
    });
  });

  afterAll(cleanup);

  it('holds the last seat then refuses the next', async () => {
    const snap0 = await getAvailability(DEP_ID);
    expect(snap0!.availableSeats).toBe(1);
    expect(snap0!.bookable).toBe(true);

    const hold = await holdSeats(DEP_ID, { quantity: 1 });
    expect(hold.status).toBe('active');

    const snap1 = await getAvailability(DEP_ID);
    expect(snap1!.availableSeats).toBe(0);

    await expect(holdSeats(DEP_ID, { quantity: 1 })).rejects.toThrow(/DEPARTURE_SOLD_OUT/);
    await releaseHold(hold.id);

    const snap2 = await getAvailability(DEP_ID);
    expect(snap2!.availableSeats).toBe(1);
  });

  it('lets exactly one concurrent buyer win the last seat', async () => {
    const results = await Promise.allSettled([holdSeats(DEP_ID, { quantity: 1 }), holdSeats(DEP_ID, { quantity: 1 })]);
    const won = results.filter((r) => r.status === 'fulfilled');
    const lost = results.filter((r) => r.status === 'rejected');
    expect(won).toHaveLength(1);
    expect(lost).toHaveLength(1);
    expect(String((lost[0] as PromiseRejectedResult).reason)).toMatch(/DEPARTURE_SOLD_OUT/);
    if (won[0].status === 'fulfilled') await convertHold(won[0].value.id);
    const snap = await getAvailability(DEP_ID);
    expect(snap!.availableSeats).toBe(1);
  });

  it('expires outdated holds', async () => {
    const past = new Date(Date.now() - 60_000);
    const [hold] = await db
      .insert(seatHolds)
      .values({ departureId: DEP_ID, quantity: 1, expiresAt: past })
      .returning({ id: seatHolds.id });
    const count = await expireHolds(new Date());
    expect(count).toBeGreaterThanOrEqual(1);
    const [row] = await db.select().from(seatHolds).where(eq(seatHolds.id, hold.id));
    expect(row.status).toBe('expired');
    await db.delete(seatHolds).where(eq(seatHolds.id, hold.id));
  });
});
