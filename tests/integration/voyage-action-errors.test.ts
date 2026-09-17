import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';

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
import { invalidateCache } from '@database/cache';
import { trips } from '@database/schemas/trips.schema';
import { departures, seatHolds } from '@database/schemas/departures.schema';
import { travelers } from '@database/schemas/travelers.schema';
import { applications, applicationDecisions, applicationEvents } from '@database/schemas/applications.schema';
import { reservations } from '@database/schemas/reservations.schema';
import { payments, checkoutSessions } from '@database/schemas/payments.schema';
import { emailDeliveries } from '@database/schemas/email-voyage.schema';
import { outboxEvents } from '@database/schemas/outbox.schema';
import { user } from '@database/schemas';
import { updateTrip, upsertTripTranslation } from '@/actions/voyage/trips';
import { createDeparture, updateDeparture, setDepartureStatus } from '@/actions/voyage/departures';
import { submitApplication, reviewApplication } from '@/actions/voyage/applications';
import { initiateCheckout } from '@/actions/voyage/checkout';
import { refundPayment, payBalance } from '@/actions/voyage/payments';
import { getValidCheckoutSession } from '@/modules/payments/domain/checkout-service';
import { resetRateLimiter } from '@/lib/rate-limit';
import { getTestHelpers } from '../helpers/auth';

const updateT = (updateTrip as any).handler as (i: any, c: any) => Promise<any>;
const upsertTr = (upsertTripTranslation as any).handler as (i: any, c: any) => Promise<any>;
const createDep = (createDeparture as any).handler as (i: any, c: any) => Promise<any>;
const updateDep = (updateDeparture as any).handler as (i: any, c: any) => Promise<any>;
const setDepStatus = (setDepartureStatus as any).handler as (i: any, c: any) => Promise<any>;
const submit = (submitApplication as any).handler as (i: any, c: any) => Promise<any>;
const review = (reviewApplication as any).handler as (i: any, c: any) => Promise<any>;
const initiate = (initiateCheckout as any).handler as (i: any, c: any) => Promise<any>;
const refund = (refundPayment as any).handler as (i: any, c: any) => Promise<any>;
const payBal = (payBalance as any).handler as (i: any, c: any) => Promise<any>;

const db = getDrizzle();
const stamp = Date.now().toString(36);
const TRIP_ID = `test-err-trip-${stamp}`;
const DEP_ID = `test-err-dep-${stamp}`;

const adminCtx = (userId: string) => ({
  locals: { user: { id: userId, role: 'admin', email: 'admin@test.com', banned: false } },
  request: { headers: new Headers(), url: 'http://localhost:4321/en/admin/trips' },
  clientAddress: '127.0.0.1',
}) as any;

const publicCtx = () => ({
  locals: { user: null },
  request: { headers: new Headers(), url: 'http://localhost:4321/en/apply/x' },
  clientAddress: '127.0.0.1',
}) as any;

async function cleanup() {
  const apps = await db.select({ id: applications.id, travelerId: applications.travelerId }).from(applications).where(eq(applications.tripId, TRIP_ID));
  const travelerIds = new Set<string>();
  const res = await db.select({ id: reservations.id, travelerId: reservations.travelerId }).from(reservations).where(eq(reservations.tripId, TRIP_ID));
  for (const r of res) {
    travelerIds.add(r.travelerId);
    await db.delete(payments).where(eq(payments.reservationId, r.id));
    await db.delete(outboxEvents).where(eq(outboxEvents.aggregateId, r.id));
    await db.delete(reservations).where(eq(reservations.id, r.id));
  }
  for (const a of apps) {
    travelerIds.add(a.travelerId);
    await db.delete(applicationDecisions).where(eq(applicationDecisions.applicationId, a.id));
    await db.delete(applicationEvents).where(eq(applicationEvents.applicationId, a.id));
    await db.delete(checkoutSessions).where(eq(checkoutSessions.applicationId, a.id));
    await db.delete(outboxEvents).where(eq(outboxEvents.aggregateId, a.id));
    await db.delete(applications).where(eq(applications.id, a.id));
  }
  for (const tid of travelerIds) {
    await db.delete(emailDeliveries).where(eq(emailDeliveries.travelerId, tid));
    await db.delete(travelers).where(eq(travelers.id, tid));
  }
  await db.delete(seatHolds).where(eq(seatHolds.departureId, DEP_ID));
  await db.delete(departures).where(eq(departures.tripId, TRIP_ID));
  await db.delete(trips).where(eq(trips.id, TRIP_ID));
  invalidateCache();
}

describe('Voyage action error paths (real DB)', () => {
  let adminId: string;
  let helpers: Awaited<ReturnType<typeof getTestHelpers>>;

  beforeAll(async () => {
    helpers = await getTestHelpers();
    const u = helpers.createUser({ email: `err-admin-${stamp}@test.com`, name: 'Err Admin', emailVerified: true });
    const saved = await helpers.saveUser(u);
    adminId = saved.id;
    await db.update(user).set({ role: 'admin' }).where(eq(user.id, adminId));
    await cleanup();
    await db.insert(trips).values({
      id: TRIP_ID, status: 'published', countryCode: 'FR', defaultCurrency: 'EUR',
      durationDays: 4, durationNights: 3, groupMin: 2, groupMax: 8, difficulty: 'easy', difficultyLevel: 2,
      publishedAt: new Date(),
    });
    await db.insert(departures).values({
      id: DEP_ID, tripId: TRIP_ID,
      startDate: new Date('2027-06-01T08:00:00.000Z'), endDate: new Date('2027-06-04T18:00:00.000Z'),
      status: 'open', capacityMin: 2, capacityMax: 8, priceAmount: 100000, currency: 'EUR', pricingRules: {},
      bookingDeadline: new Date('2027-12-31T23:59:00.000Z'),
    });
  });

  afterAll(async () => {
    await cleanup();
    await helpers.deleteUser(adminId).catch(() => {});
  });

  beforeEach(() => resetRateLimiter());

  it('updateTrip validates existence and group bounds', async () => {
    await expect(updateT({ id: '00000000-0000-0000-0000-000000000000', groupMax: 5 }, adminCtx(adminId))).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(updateT({ id: TRIP_ID, groupMin: 10, groupMax: 5 }, adminCtx(adminId))).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  it('upsertTripTranslation requires an existing trip', async () => {
    await expect(
      upsertTr({ tripId: '00000000-0000-0000-0000-000000000000', locale: 'fr', slug: 'x', title: 'T', summary: 'S', overview: 'O' }, adminCtx(adminId)),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('createDeparture validates dates and capacity', async () => {
    const base = { tripId: TRIP_ID, startDate: new Date('2027-06-01'), endDate: new Date('2027-06-04'), capacityMin: 2, capacityMax: 8, priceAmount: 1000 };
    await expect(createDep({ ...base, startDate: new Date('2027-06-04'), endDate: new Date('2027-06-01') }, adminCtx(adminId))).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    await expect(createDep({ ...base, capacityMin: 9, capacityMax: 8 }, adminCtx(adminId))).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    await expect(createDep({ ...base, tripId: '00000000-0000-0000-0000-000000000000' }, adminCtx(adminId))).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('setDepartureStatus rejects illegal transitions', async () => {
    await expect(setDepStatus({ id: DEP_ID, to: 'completed' }, adminCtx(adminId))).rejects.toThrow();
    await expect(setDepStatus({ id: '00000000-0000-0000-0000-000000000000', to: 'closed' }, adminCtx(adminId))).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('updateDeparture rejects unknown departures', async () => {
    await expect(updateDep({ id: '00000000-0000-0000-0000-000000000000', priceAmount: 5 }, adminCtx(adminId))).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('review supports contact_required with event', async () => {
    const res = await submit(
      {
        tripId: TRIP_ID, departureId: DEP_ID, legalName: 'Contact Me', email: `contact-${stamp}@test.com`, phone: null,
        roomPreference: 'shared', dietaryRequirements: null, accessibilityNeeds: null,
        activityAcknowledgement: true, motivation: null, expectations: null, consent: true, locale: 'en',
      },
      publicCtx(),
    );
    const out = await review({ id: res.id, decision: 'contact_required', internalNote: 'call her' }, adminCtx(adminId));
    expect(out.status).toBe('contact_required');
    const [app] = await db.select().from(applications).where(eq(applications.id, res.id));
    expect(app.status).toBe('contact_required');
    const events = await db.select().from(applicationEvents).where(eq(applicationEvents.applicationId, res.id));
    expect(events.map((e) => e.event)).toContain('contact_requested');
  });

  it('review rejects decisions on draft applications', async () => {
    const [traveler] = await db.insert(travelers).values({ email: `draft-${stamp}@test.com` }).returning({ id: travelers.id });
    const [app] = await db.insert(applications).values({
      travelerId: traveler.id, tripId: TRIP_ID, departureId: DEP_ID, status: 'draft',
      activityAcknowledgement: true, consent: true,
    }).returning({ id: applications.id });
    await expect(review({ id: app.id, decision: 'approved' }, adminCtx(adminId))).rejects.toThrow();
    await db.delete(applications).where(eq(applications.id, app.id));
    await db.delete(travelers).where(eq(travelers.id, traveler.id));
  });

  it('requireAccount trips demand a verified matching user', async () => {
    await db.update(trips).set({ requireAccount: true }).where(eq(trips.id, TRIP_ID));
    try {
      const base = {
        tripId: TRIP_ID, departureId: DEP_ID, legalName: 'Anon', email: `req-${stamp}@test.com`, phone: null,
        roomPreference: 'shared', dietaryRequirements: null, accessibilityNeeds: null,
        activityAcknowledgement: true, motivation: null, expectations: null, consent: true, locale: 'en',
      };
      await expect(submit(base, publicCtx())).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
      const otherCtx = { locals: { user: { id: adminId, email: `other-${stamp}@test.com`, emailVerified: true } }, request: { headers: new Headers() }, clientAddress: '127.0.0.1' } as any;
      await expect(submit(base, otherCtx)).rejects.toMatchObject({ code: 'FORBIDDEN' });
      const ownCtx = { locals: { user: { id: adminId, email: `req-${stamp}@test.com`, emailVerified: true } }, request: { headers: new Headers() }, clientAddress: '127.0.0.1' } as any;
      const res = await submit(base, ownCtx);
      expect(res.id).toBeTypeOf('string');
    } finally {
      await db.update(trips).set({ requireAccount: false }).where(eq(trips.id, TRIP_ID));
    }
  });

  it('initiateCheckout rejects bad sessions, mismatched emails and doubles', async () => {
    await expect(
      initiate({ checkoutSessionId: '00000000-0000-0000-0000-000000000000', travelerEmail: 'x@test.com', locale: 'en' }, publicCtx()),
    ).rejects.toMatchObject({ code: 'GONE' });

    const email = `double-${stamp}@test.com`;
    const sub = await submit(
      {
        tripId: TRIP_ID, departureId: DEP_ID, legalName: 'Double', email, phone: null,
        roomPreference: 'shared', dietaryRequirements: null, accessibilityNeeds: null,
        activityAcknowledgement: true, motivation: null, expectations: null, consent: true, locale: 'en',
      },
      publicCtx(),
    );
    await review({ id: sub.id, decision: 'approved' }, adminCtx(adminId));
    const { checkoutSessions: sessions } = await import('@database/schemas/payments.schema');
    const [checkout] = await db.select().from(sessions).where(eq(sessions.applicationId, sub.id));
    await expect(
      initiate({ checkoutSessionId: checkout.id, travelerEmail: 'autre@test.com', locale: 'en' }, publicCtx()),
    ).rejects.toThrow(/CHECKOUT_EXPIRED/);
    await initiate({ checkoutSessionId: checkout.id, travelerEmail: email, locale: 'en' }, publicCtx());
    await expect(
      initiate({ checkoutSessionId: checkout.id, travelerEmail: email, locale: 'en' }, publicCtx()),
    ).rejects.toThrow(/RESERVATION_ALREADY_CONFIRMED/);
  });

  it('payBalance rejects unknown, settled and mismatched bookings', async () => {
    await expect(
      payBal({ reservationId: '00000000-0000-0000-0000-000000000000', travelerEmail: 'x@test.com', locale: 'en' }, publicCtx()),
    ).rejects.toThrow(/CHECKOUT_EXPIRED/);
  });

  it('refund validates reservation, payment and amount', async () => {
    await expect(refund({ reservationId: '00000000-0000-0000-0000-000000000000' }, adminCtx(adminId))).rejects.toMatchObject({ code: 'NOT_FOUND' });
    const [traveler] = await db.insert(travelers).values({ email: `noref-${stamp}@test.com` }).returning({ id: travelers.id });
    const [reservation] = await db.insert(reservations).values({
      reservationNumber: `ATL-2027-NR${stamp.slice(-4).toUpperCase()}`,
      travelerId: traveler.id, tripId: TRIP_ID, departureId: DEP_ID,
      status: 'confirmed', currency: 'EUR', baseAmount: 1000, totalAmount: 1000, amountPaid: 1000, amountDue: 0,
      confirmedAt: new Date(),
    }).returning({ id: reservations.id });
    await expect(refund({ reservationId: reservation.id }, adminCtx(adminId))).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    await db.delete(reservations).where(eq(reservations.id, reservation.id));
    await db.delete(travelers).where(eq(travelers.id, traveler.id));
  });

  it('failPaymentByProviderId marks payments failed', async () => {
    const [traveler] = await db.insert(travelers).values({ email: `fail-${stamp}@test.com` }).returning({ id: travelers.id });
    const [reservation] = await db.insert(reservations).values({
      reservationNumber: `ATL-2027-FL${stamp.slice(-4).toUpperCase()}`,
      travelerId: traveler.id, tripId: TRIP_ID, departureId: DEP_ID,
      status: 'awaiting_payment', currency: 'EUR', baseAmount: 1000, totalAmount: 1000, amountPaid: 0, amountDue: 1000,
    }).returning({ id: reservations.id });
    const { payments: paymentTable } = await import('@database/schemas/payments.schema');
    const { failPaymentByProviderId: fail } = await import('@/modules/payments/domain/payment-service');
    await db.insert(paymentTable).values({
      reservationId: reservation.id, provider: 'mock', providerPaymentId: `mock_pi_fail_${stamp}`,
      type: 'full_payment', status: 'pending', amount: 1000, currency: 'EUR', idempotencyKey: `fail-${stamp}`,
    });
    await fail(`mock_pi_fail_${stamp}`);
    const [payment] = await db.select().from(paymentTable).where(eq(paymentTable.reservationId, reservation.id));
    expect(payment.status).toBe('failed');
    await db.delete(paymentTable).where(eq(paymentTable.reservationId, reservation.id));
    await db.delete(reservations).where(eq(reservations.id, reservation.id));
    await db.delete(travelers).where(eq(travelers.id, traveler.id));
  });

  it('getValidCheckoutSession expires outdated sessions', async () => {
    const { checkoutSessions: sessions } = await import('@database/schemas/payments.schema');
    const [traveler] = await db.insert(travelers).values({ email: `exp-${stamp}@test.com` }).returning({ id: travelers.id });
    const [app] = await db.insert(applications).values({
      travelerId: traveler.id, tripId: TRIP_ID, departureId: DEP_ID, status: 'approved',
      activityAcknowledgement: true, consent: true, submittedAt: new Date(),
    }).returning({ id: applications.id });
    const [session] = await db.insert(sessions).values({
      applicationId: app.id, departureId: DEP_ID, expiresAt: new Date(Date.now() - 1000),
    }).returning({ id: sessions.id });
    expect(await getValidCheckoutSession(session.id)).toBeNull();
    const [row] = await db.select().from(sessions).where(eq(sessions.id, session.id));
    expect(row.status).toBe('expired');
    await db.delete(sessions).where(eq(sessions.id, session.id));
    await db.delete(applications).where(eq(applications.id, app.id));
    await db.delete(travelers).where(eq(travelers.id, traveler.id));
  });

  it('closed departures are not bookable', async () => {
    const { getAvailability } = await import('@/modules/availability/domain/availability-service');
    const [dep] = await db.insert(departures).values({
      id: `test-err-closed-${stamp}`, tripId: TRIP_ID,
      startDate: new Date('2027-06-01T08:00:00.000Z'), endDate: new Date('2027-06-04T18:00:00.000Z'),
      status: 'closed', capacityMin: 2, capacityMax: 8, priceAmount: 1000, currency: 'EUR', pricingRules: {},
    }).returning({ id: departures.id });
    const snap = await getAvailability(dep.id);
    expect(snap!.bookable).toBe(false);
    const { holdSeats } = await import('@/modules/availability/domain/availability-service');
    await expect(holdSeats(dep.id, { quantity: 1 })).rejects.toThrow(/DEPARTURE_SOLD_OUT/);
    await db.delete(departures).where(eq(departures.id, dep.id));
  });
});
