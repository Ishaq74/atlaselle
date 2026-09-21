import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';

// `astro:actions` is a virtual module resolved only by the Astro build pipeline.
vi.mock('astro:actions', () => {
  class ActionError extends Error {
    code: string;
    constructor({ code, message }: { code: string; message: string }) {
      super(message);
      this.code = code;
    }
  }
  return { ActionError, defineAction: (def: any) => def };
});

import { eq } from 'drizzle-orm';
import { getDrizzle } from '@database/drizzle';
import { insertTestTrip } from '../helpers/trip-factory';
import { invalidateCache } from '@database/cache';
import { trips } from '@database/schemas/trips.schema';
import { departures } from '@database/schemas/departures.schema';
import { travelers } from '@database/schemas/travelers.schema';
import { reservations } from '@database/schemas/reservations.schema';
import { payments } from '@database/schemas/payments.schema';
import { applications } from '@database/schemas/applications.schema';
import { user } from '@database/schemas';
import { cancelReservation } from '@/actions/voyage/checkout';
import { expireApplications } from '@/modules/applications/domain/application-service';
import { markBalanceDue } from '@/modules/reservations/domain/reservation-service';
import { getTestHelpers } from '../helpers/auth';

const cancel = (cancelReservation as any).handler as (i: any, c: any) => Promise<any>;

const db = getDrizzle();
const stamp = Date.now().toString(36);
const TRIP_ID = `test-cancel-trip-${stamp}`;

const adminCtx = (userId: string) => ({
  locals: { user: { id: userId, role: 'admin', email: 'admin@test.com', banned: false } },
  request: { headers: new Headers(), url: 'http://localhost:4321/en/admin/trips' },
  clientAddress: '127.0.0.1',
}) as any;

async function makeBooking(suffix: string, startInDays: number, priceAmount = 100000) {
  const depId = `test-cancel-dep-${suffix}-${stamp}`;
  await db.insert(departures).values({
    id: depId, tripId: TRIP_ID,
    startDate: new Date(Date.now() + startInDays * 86_400_000),
    endDate: new Date(Date.now() + (startInDays + 3) * 86_400_000),
    status: 'open', capacityMin: 1, capacityMax: 5, priceAmount, currency: 'EUR', pricingRules: {},
  });
  const [traveler] = await db.insert(travelers).values({ email: `cancel-${suffix}-${stamp}@test.com` }).returning({ id: travelers.id });
  const [reservation] = await db.insert(reservations).values({
    reservationNumber: `ATL-2027-${suffix.slice(-4).toUpperCase()}${stamp.slice(-2).toUpperCase()}`,
    travelerId: traveler.id, tripId: TRIP_ID, departureId: depId,
    status: 'confirmed', currency: 'EUR', baseAmount: priceAmount, totalAmount: priceAmount,
    amountPaid: priceAmount, amountDue: 0, confirmedAt: new Date(),
  }).returning({ id: reservations.id });
  await db.insert(payments).values({
    reservationId: reservation.id, provider: 'mock', providerPaymentId: `mock_pi_cancel_${suffix}_${stamp}`,
    type: 'full_payment', status: 'paid', amount: priceAmount, currency: 'EUR',
    idempotencyKey: `cancel-${suffix}-${stamp}`, paidAt: new Date(),
  });
  return { reservationId: reservation.id, travelerId: traveler.id };
}

async function cleanup() {
  const res = await db.select({ id: reservations.id, travelerId: reservations.travelerId }).from(reservations).where(eq(reservations.tripId, TRIP_ID));
  for (const r of res) {
    await db.delete(payments).where(eq(payments.reservationId, r.id));
    await db.delete(reservations).where(eq(reservations.id, r.id));
    await db.delete(travelers).where(eq(travelers.id, r.travelerId));
  }
  await db.delete(departures).where(eq(departures.tripId, TRIP_ID));
  const apps = await db.select({ id: applications.id }).from(applications).where(eq(applications.tripId, TRIP_ID));
  for (const a of apps) await db.delete(applications).where(eq(applications.id, a.id));
  await db.delete(trips).where(eq(trips.id, TRIP_ID));
  invalidateCache();
}

describe('Cancellation policy + auto-refund + expiry jobs (real DB)', () => {
  let adminId: string;
  let helpers: Awaited<ReturnType<typeof getTestHelpers>>;

  beforeAll(async () => {
    helpers = await getTestHelpers();
    const u = helpers.createUser({ email: `cancel-admin-${stamp}@test.com`, name: 'Cancel Admin', emailVerified: true });
    const saved = await helpers.saveUser(u);
    adminId = saved.id;
    await db.update(user).set({ role: 'admin' }).where(eq(user.id, adminId));
    await cleanup();
    await insertTestTrip(db, {
      id: TRIP_ID, status: 'published', countryCode: 'FR', defaultCurrency: 'EUR',
      durationDays: 4, durationNights: 3, groupMin: 1, groupMax: 5, difficulty: 'easy', difficultyLevel: 1,
      publishedAt: new Date(),
    });
  });

  afterAll(async () => {
    await cleanup();
    await helpers.deleteUser(adminId).catch(() => {});
  });

  it('auto-refunds 100% more than 45 days out', async () => {
    const { reservationId } = await makeBooking('free', 60);
    const res = await cancel({ reservationId }, adminCtx(adminId));
    expect(res.success).toBe(true);
    expect(res.refundAmount).toBe(100000);
    expect(res.providerRefundId).toContain('mock_re_');
    const [reservation] = await db.select().from(reservations).where(eq(reservations.id, reservationId));
    expect(reservation.status).toBe('refunded');
    const [payment] = await db.select().from(payments).where(eq(payments.reservationId, reservationId));
    expect(payment.status).toBe('refunded');
  });

  it('auto-refunds 50% between 15 and 45 days', async () => {
    const { reservationId } = await makeBooking('half', 20);
    const res = await cancel({ reservationId }, adminCtx(adminId));
    expect(res.refundAmount).toBe(50000);
    const [payment] = await db.select().from(payments).where(eq(payments.reservationId, reservationId));
    expect(payment.status).toBe('partially_refunded');
  });

  it('cancels without refund under 15 days', async () => {
    const { reservationId } = await makeBooking('none', 5);
    const res = await cancel({ reservationId }, adminCtx(adminId));
    expect(res.refundAmount).toBe(0);
    expect(res.providerRefundId).toBeNull();
    const [reservation] = await db.select().from(reservations).where(eq(reservations.id, reservationId));
    expect(reservation.status).toBe('cancelled');
  });

  it('expires stale undecided applications', async () => {
    const [traveler] = await db.insert(travelers).values({ email: `old-${stamp}@test.com` }).returning({ id: travelers.id });
    const [dep] = await db.select({ id: departures.id }).from(departures).limit(1);
    await db.insert(applications).values({
      id: `old-app-${stamp}`, travelerId: traveler.id, tripId: TRIP_ID, departureId: dep.id,
      status: 'submitted', activityAcknowledgement: true, consent: true,
      submittedAt: new Date(Date.now() - 31 * 86_400_000), createdAt: new Date(Date.now() - 31 * 86_400_000),
    });
    const count = await expireApplications(new Date());
    expect(count).toBeGreaterThanOrEqual(1);
    const [app] = await db.select().from(applications).where(eq(applications.id, `old-app-${stamp}`));
    expect(app.status).toBe('expired');
    await db.delete(applications).where(eq(applications.id, `old-app-${stamp}`));
    await db.delete(travelers).where(eq(travelers.id, traveler.id));
  });

  it('moves confirmed past-due balances to balance_due', async () => {
    const { reservationId } = await makeBooking('duex', 60);
    await db.update(reservations).set({ status: 'confirmed', amountPaid: 20000, amountDue: 80000, balanceDueDate: new Date(Date.now() - 1000) }).where(eq(reservations.id, reservationId));
    const count = await markBalanceDue(new Date());
    expect(count).toBeGreaterThanOrEqual(1);
    const [reservation] = await db.select().from(reservations).where(eq(reservations.id, reservationId));
    expect(reservation.status).toBe('balance_due');
  });
});
