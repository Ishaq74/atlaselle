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
import { insertTestTrip } from '../helpers/trip-factory';
import { invalidateCache } from '@database/cache';
import { trips } from '@database/schemas/trips.schema';
import { departures, seatHolds } from '@database/schemas/departures.schema';
import { applications, applicationDecisions, applicationEvents } from '@database/schemas/applications.schema';
import { travelers } from '@database/schemas/travelers.schema';
import { reservations } from '@database/schemas/reservations.schema';
import { payments, checkoutSessions } from '@database/schemas/payments.schema';
import { outboxEvents } from '@database/schemas/outbox.schema';
import { user } from '@database/schemas';
import { submitApplication, reviewApplication } from '@/actions/voyage/applications';
import { initiateCheckout } from '@/actions/voyage/checkout';
import { payBalance } from '@/actions/voyage/payments';
import { refundPayment } from '@/actions/voyage/payments';
import { processProviderSuccess } from '@/modules/payments/domain/payment-service';
import { mockPaymentIdForSession } from '@/modules/payments/domain/providers';
import { resetRateLimiter } from '@/lib/rate-limit';
import { getTestHelpers } from '../helpers/auth';

const submit = (submitApplication as any).handler as (i: any, c: any) => Promise<any>;
const review = (reviewApplication as any).handler as (i: any, c: any) => Promise<any>;
const initiate = (initiateCheckout as any).handler as (i: any, c: any) => Promise<any>;
const payBalanceHandler = (payBalance as any).handler as (i: any, c: any) => Promise<any>;
const refund = (refundPayment as any).handler as (i: any, c: any) => Promise<any>;

const db = getDrizzle();
const stamp = Date.now().toString(36);
const TRIP_ID = `test-tunnel-trip-${stamp}`;
const DEP_ID = `test-tunnel-dep-${stamp}`;

const publicCtx = (origin = 'http://localhost:4321') => ({
  locals: { user: null },
  request: { headers: new Headers(), url: `${origin}/en/checkout/x` },
  clientAddress: '127.0.0.1',
}) as any;

// Candidature = compte vérifié obligatoire (inconditionnel) : ctx dont
// locals.user.email matche input.email. L'id doit exister en base (FK travelers.userId).
let applicantId = '';
const applicantCtx = (email: string) => ({
  locals: { user: { id: applicantId, email, emailVerified: true, banned: false } },
  request: { headers: new Headers(), url: 'http://localhost:4321/en/apply/x' },
  clientAddress: '127.0.0.1',
}) as any;

const adminCtx = (userId: string) => ({
  locals: { user: { id: userId, role: 'admin', email: 'admin@test.com', banned: false } },
  request: { headers: new Headers(), url: 'http://localhost:4321/en/admin/trips' },
  clientAddress: '127.0.0.1',
}) as any;

async function cleanup() {
  const apps = await db.select({ id: applications.id, travelerId: applications.travelerId }).from(applications).where(eq(applications.tripId, TRIP_ID));
  const travelerIds = [...new Set(apps.map((a) => a.travelerId))];
  const res = await db.select({ id: reservations.id }).from(reservations).where(eq(reservations.tripId, TRIP_ID));
  for (const r of res) {
    const pays = await db.select({ id: payments.id }).from(payments).where(eq(payments.reservationId, r.id));
    for (const p of pays) {
      await db.delete(outboxEvents).where(eq(outboxEvents.aggregateId, p.id));
    }
    await db.delete(outboxEvents).where(eq(outboxEvents.aggregateId, r.id));
    await db.delete(payments).where(eq(payments.reservationId, r.id));
    await db.delete(reservations).where(eq(reservations.id, r.id));
  }
  for (const a of apps) {
    await db.delete(applicationDecisions).where(eq(applicationDecisions.applicationId, a.id));
    await db.delete(applicationEvents).where(eq(applicationEvents.applicationId, a.id));
    await db.delete(checkoutSessions).where(eq(checkoutSessions.applicationId, a.id));
  }
  for (const a of apps) {
    await db.delete(outboxEvents).where(eq(outboxEvents.aggregateId, a.id));
    await db.delete(applications).where(eq(applications.id, a.id));
  }
  for (const tid of travelerIds) {
    await db.delete(travelers).where(eq(travelers.id, tid));
  }
  await db.delete(seatHolds).where(eq(seatHolds.departureId, DEP_ID));
  await db.delete(departures).where(eq(departures.id, DEP_ID));
  await db.delete(trips).where(eq(trips.id, TRIP_ID));
  invalidateCache();
}

async function approveFlow(email: string) {
  const sub = await submit(
    {
      tripId: TRIP_ID, departureId: DEP_ID, legalName: 'Tunnel User', email, phone: null,
      roomPreference: 'shared', dietaryRequirements: null, accessibilityNeeds: null,
      activityAcknowledgement: true, motivation: null, expectations: null, consent: true, termsAccepted: true, locale: 'en',
    },
    applicantCtx(email),
  );
  await review({ id: sub.id, decision: 'approved' }, (globalThis as any).__adminCtx);
  const [checkout] = await db.select().from(checkoutSessions).where(eq(checkoutSessions.applicationId, sub.id));
  return { applicationId: sub.id, checkout };
}

describe('Booking tunnel — mock provider (real DB)', () => {
  let adminId: string;
  let helpers: Awaited<ReturnType<typeof getTestHelpers>>;

  beforeAll(async () => {
    helpers = await getTestHelpers();
    const u = helpers.createUser({ email: `tunnel-admin-${stamp}@test.com`, name: 'Tunnel Admin', emailVerified: true });
    const saved = await helpers.saveUser(u);
    adminId = saved.id;
    await db.update(user).set({ role: 'admin' }).where(eq(user.id, adminId));
    (globalThis as any).__adminCtx = adminCtx(adminId);
    applicantId = (await helpers.saveUser(helpers.createUser({ email: `tunnel-cand-${stamp}@test.com`, name: 'Tunnel Candidate', emailVerified: true }))).id;

    await cleanup();
    await insertTestTrip(db, {
      id: TRIP_ID, status: 'published', countryCode: 'FR', defaultCurrency: 'EUR',
      durationDays: 4, durationNights: 3, groupMin: 1, groupMax: 5, difficulty: 'easy', difficultyLevel: 1,
      publishedAt: new Date(),
    });
    await db.insert(departures).values({
      id: DEP_ID, tripId: TRIP_ID,
      startDate: new Date('2027-10-01T08:00:00.000Z'), endDate: new Date('2027-10-04T18:00:00.000Z'),
      status: 'open', capacityMin: 1, capacityMax: 5, priceAmount: 100000, currency: 'EUR', pricingRules: {},
      bookingDeadline: new Date('2027-09-15T23:59:00.000Z'),
    });
  });

  afterAll(async () => {
    await cleanup();
    await helpers.deleteUser(adminId).catch(() => {});
    await helpers.deleteUser(applicantId).catch(() => {});
    delete (globalThis as any).__adminCtx;
  });

  beforeEach(() => resetRateLimiter());

  it('runs approved → checkout → payment → confirmation with hold conversion', async () => {
    const email = `tunnel-${stamp}@test.com`;
    const { checkout } = await approveFlow(email);
    expect(checkout.status).toBe('open');

    const init = await initiate(
      { checkoutSessionId: checkout.id, travelerEmail: email, roomType: 'shared', locale: 'en' },
      publicCtx(),
    );
    expect(init.reservationId).toBeTypeOf('string');
    expect(init.checkoutUrl).toContain('/api/payments/mock-callback?session=');

    const [checkoutRow] = await db.select().from(checkoutSessions).where(eq(checkoutSessions.id, checkout.id));
    const [payment] = await db.select().from(payments).where(eq(payments.reservationId, init.reservationId));
    expect(payment.status).toBe('created');

    const done = await processProviderSuccess({
      outcome: 'checkout.completed',
      providerPaymentId: mockPaymentIdForSession(checkoutRow.providerSessionId!),
      amount: payment.amount,
      currency: payment.currency,
      idempotencyKey: payment.idempotencyKey,
      raw: { mock: true },
    });
    expect(done.duplicate).toBe(false);

    const [reservation] = await db.select().from(reservations).where(eq(reservations.id, init.reservationId));
    expect(reservation.status).toBe('completed');
    expect(reservation.amountPaid).toBe(reservation.totalAmount);
    expect(reservation.reservationNumber).toMatch(/^ATL-\d{4}-[A-Z0-9]{6}$/);

    const holds = await db.select().from(seatHolds).where(eq(seatHolds.departureId, DEP_ID));
    expect(holds.every((h) => h.status === 'converted')).toBe(true);

    const events = await db.select().from(outboxEvents).where(eq(outboxEvents.aggregateId, init.reservationId));
    expect(events.map((e) => e.eventType)).toContain('booking.confirmed');
  });

  it('treats duplicate webhooks as idempotent', async () => {
    const email = `tunnel2-${stamp}@test.com`;
    const { checkout } = await approveFlow(email);
    const init = await initiate(
      { checkoutSessionId: checkout.id, travelerEmail: email, roomType: 'shared', locale: 'en' },
      publicCtx(),
    );
    const [checkoutRow] = await db.select().from(checkoutSessions).where(eq(checkoutSessions.id, checkout.id));
    const [payment] = await db.select().from(payments).where(eq(payments.reservationId, init.reservationId));
    const event = {
      outcome: 'checkout.completed' as const,
      providerPaymentId: mockPaymentIdForSession(checkoutRow.providerSessionId!),
      amount: payment.amount,
      currency: payment.currency,
      idempotencyKey: payment.idempotencyKey,
      raw: { mock: true },
    };
    const first = await processProviderSuccess(event);
    const second = await processProviderSuccess(event);
    expect(first.duplicate).toBe(false);
    expect(second.duplicate).toBe(true);
    const paid = await db.select().from(payments).where(eq(payments.reservationId, init.reservationId));
    expect(paid.filter((p) => p.status === 'paid')).toHaveLength(1);
  });

  it('rejects amount mismatches', async () => {
    const email = `tunnel3-${stamp}@test.com`;
    const { checkout } = await approveFlow(email);
    const init = await initiate(
      { checkoutSessionId: checkout.id, travelerEmail: email, roomType: 'shared', locale: 'en' },
      publicCtx(),
    );
    const [checkoutRow] = await db.select().from(checkoutSessions).where(eq(checkoutSessions.id, checkout.id));
    const [payment] = await db.select().from(payments).where(eq(payments.reservationId, init.reservationId));
    await expect(
      processProviderSuccess({
        outcome: 'checkout.completed',
        providerPaymentId: mockPaymentIdForSession(checkoutRow.providerSessionId!),
        amount: payment.amount + 1,
        currency: payment.currency,
        idempotencyKey: payment.idempotencyKey,
        raw: { mock: true },
      }),
    ).rejects.toThrow(/PAYMENT_AMOUNT_MISMATCH/);
  });

  it('refunds a paid booking', async () => {
    const email = `tunnel4-${stamp}@test.com`;
    const { checkout } = await approveFlow(email);
    const init = await initiate(
      { checkoutSessionId: checkout.id, travelerEmail: email, roomType: 'shared', locale: 'en' },
      publicCtx(),
    );
    const [checkoutRow] = await db.select().from(checkoutSessions).where(eq(checkoutSessions.id, checkout.id));
    const [payment] = await db.select().from(payments).where(eq(payments.reservationId, init.reservationId));
    await processProviderSuccess({
      outcome: 'checkout.completed',
      providerPaymentId: mockPaymentIdForSession(checkoutRow.providerSessionId!),
      amount: payment.amount,
      currency: payment.currency,
      idempotencyKey: payment.idempotencyKey,
      raw: { mock: true },
    });
    const res = await refund({ reservationId: init.reservationId }, (globalThis as any).__adminCtx);
    expect(res.success).toBe(true);
    expect(res.providerRefundId).toContain('mock_re_');
    const [reservation] = await db.select().from(reservations).where(eq(reservations.id, init.reservationId));
    expect(reservation.status).toBe('refunded');
  });

  it('charges deposit first, then balance to completion', async () => {
    const depId = `test-tunnel-depdep-${stamp}`;
    await db.insert(departures).values({
      id: depId, tripId: TRIP_ID,
      startDate: new Date('2027-11-01T08:00:00.000Z'), endDate: new Date('2027-11-04T18:00:00.000Z'),
      status: 'open', capacityMin: 1, capacityMax: 5, priceAmount: 100000, currency: 'EUR',
      depositType: 'fixed', depositAmount: 20000, pricingRules: {},
      bookingDeadline: new Date('2027-10-15T23:59:00.000Z'),
    });
    const email = `tunneldep-${stamp}@test.com`;
    const sub = await submit(
      {
        tripId: TRIP_ID, departureId: depId, legalName: 'Tunnel User', email, phone: null,
        roomPreference: 'shared', dietaryRequirements: null, accessibilityNeeds: null,
        activityAcknowledgement: true, motivation: null, expectations: null, consent: true, termsAccepted: true, locale: 'en',
      },
      applicantCtx(email),
    );
    await review({ id: sub.id, decision: 'approved' }, (globalThis as any).__adminCtx);
    const [checkout] = await db.select().from(checkoutSessions).where(eq(checkoutSessions.applicationId, sub.id));
    const init = await initiate(
      { checkoutSessionId: checkout.id, travelerEmail: email, roomType: 'shared', locale: 'en' },
      publicCtx(),
    );
    const [checkoutRow] = await db.select().from(checkoutSessions).where(eq(checkoutSessions.id, checkout.id));
    const [deposit] = await db.select().from(payments).where(eq(payments.reservationId, init.reservationId));
    expect(deposit.type).toBe('deposit');
    expect(deposit.amount).toBe(20000);
    await processProviderSuccess({
      outcome: 'checkout.completed',
      providerPaymentId: mockPaymentIdForSession(checkoutRow.providerSessionId!),
      amount: deposit.amount,
      currency: deposit.currency,
      idempotencyKey: deposit.idempotencyKey,
      raw: { mock: true },
    });
    const [confirmed] = await db.select().from(reservations).where(eq(reservations.id, init.reservationId));
    expect(confirmed.status).toBe('confirmed');
    expect(confirmed.amountDue).toBe(80000);

    const bal = await payBalanceHandler(
      { reservationId: init.reservationId, travelerEmail: email, locale: 'en' },
      publicCtx(),
    );
    expect(bal.checkoutUrl).toContain('/api/payments/mock-callback?session=');
    const balanceRows = await db.select().from(payments).where(eq(payments.reservationId, init.reservationId));
    const balancePayment = balanceRows.find((p: { type: string }) => p.type === 'balance')!;
    expect(balancePayment.amount).toBe(80000);
    await processProviderSuccess({
      outcome: 'checkout.completed',
      providerPaymentId: mockPaymentIdForSession(`bal-${stamp}`),
      amount: balancePayment.amount,
      currency: balancePayment.currency,
      idempotencyKey: balancePayment.idempotencyKey,
      raw: { mock: true },
    });
    const [done] = await db.select().from(reservations).where(eq(reservations.id, init.reservationId));
    expect(done.status).toBe('completed');
    expect(done.amountDue).toBe(0);
  });
});
