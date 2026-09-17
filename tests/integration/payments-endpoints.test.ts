import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { createHmac } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { getDrizzle } from '@database/drizzle';
import { invalidateCache } from '@database/cache';
import { trips, tripTranslations } from '@database/schemas/trips.schema';
import { departures, seatHolds } from '@database/schemas/departures.schema';
import { travelers } from '@database/schemas/travelers.schema';
import { applications } from '@database/schemas/applications.schema';
import { reservations } from '@database/schemas/reservations.schema';
import { payments, checkoutSessions } from '@database/schemas/payments.schema';
import { outboxEvents } from '@database/schemas/outbox.schema';
import { POST as webhookPOST } from '@/pages/api/payments/webhook';
import { GET as mockCallbackGET } from '@/pages/api/payments/mock-callback';
import { initiateCheckout } from '@/modules/payments/domain/payment-service';

const db = getDrizzle();
const stamp = Date.now().toString(36);
const TRIP_ID = `test-ep-trip-${stamp}`;
const DEP_ID = `test-ep-dep-${stamp}`;

async function cleanup() {
  const apps = await db.select({ id: applications.id, travelerId: applications.travelerId }).from(applications).where(eq(applications.tripId, TRIP_ID));
  const tids = new Set(apps.map((a) => a.travelerId));
  const res = await db.select({ id: reservations.id, travelerId: reservations.travelerId }).from(reservations).where(eq(reservations.tripId, TRIP_ID));
  for (const r of res) {
    tids.add(r.travelerId);
    await db.delete(payments).where(eq(payments.reservationId, r.id));
    await db.delete(outboxEvents).where(eq(outboxEvents.aggregateId, r.id));
    await db.delete(checkoutSessions).where(eq(checkoutSessions.reservationId, r.id));
    await db.delete(reservations).where(eq(reservations.id, r.id));
  }
  for (const a of apps) {
    await db.delete(checkoutSessions).where(eq(checkoutSessions.applicationId, a.id));
    await db.delete(outboxEvents).where(eq(outboxEvents.aggregateId, a.id));
    await db.delete(applications).where(eq(applications.id, a.id));
  }
  for (const tid of tids) await db.delete(travelers).where(eq(travelers.id, tid));
  await db.delete(seatHolds).where(eq(seatHolds.departureId, DEP_ID));
  await db.delete(tripTranslations).where(eq(tripTranslations.tripId, TRIP_ID));
  await db.delete(departures).where(eq(departures.tripId, TRIP_ID));
  await db.delete(trips).where(eq(trips.id, TRIP_ID));
  invalidateCache();
}

describe('Payments endpoints (mock provider by default)', () => {
  beforeAll(async () => {
    delete process.env.PAYMENT_PROVIDER;
    await cleanup();
    await db.insert(trips).values({
      id: TRIP_ID, status: 'published', countryCode: 'FR', defaultCurrency: 'EUR',
      durationDays: 4, durationNights: 3, groupMin: 1, groupMax: 5, difficulty: 'easy', difficultyLevel: 1,
      publishedAt: new Date(),
    });
    await db.insert(tripTranslations).values({
      id: `test-ep-tr-${stamp}`, tripId: TRIP_ID, locale: 'fr', slug: `ep-${stamp}`,
      title: 'Voyage endpoints', summary: 'Résumé', overview: 'Aperçu', localeVisible: true,
    });
    await db.insert(departures).values({
      id: DEP_ID, tripId: TRIP_ID,
      startDate: new Date('2027-05-01T08:00:00.000Z'), endDate: new Date('2027-05-04T18:00:00.000Z'),
      status: 'open', capacityMin: 1, capacityMax: 5, priceAmount: 100000, currency: 'EUR', pricingRules: {},
    });
  });

  afterAll(cleanup);

  it('rejects Stripe webhooks when provider is mock', async () => {
    const res = await webhookPOST({ request: new Request('http://localhost/api/payments/webhook', { method: 'POST', body: '{}' }) } as any);
    expect(res.status).toBe(404);
  });

  it('rejects invalid Stripe signatures with 400', async () => {
    process.env.PAYMENT_PROVIDER = 'stripe';
    process.env.STRIPE_SECRET_KEY = 'sk_test_x';
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test';
    try {
      const res = await webhookPOST({
        request: new Request('http://localhost/api/payments/webhook', {
          method: 'POST', body: JSON.stringify({ type: 'x' }), headers: { 'stripe-signature': 't=1,v1=bad' },
        }),
      } as any);
      expect(res.status).toBe(400);
    } finally {
      delete process.env.PAYMENT_PROVIDER;
      delete process.env.STRIPE_SECRET_KEY;
      delete process.env.STRIPE_WEBHOOK_SECRET;
    }
  });

  it('processes unknown Stripe events as 200 without side effects', async () => {
    process.env.PAYMENT_PROVIDER = 'stripe';
    process.env.STRIPE_SECRET_KEY = 'sk_test_x';
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test';
    try {
      const raw = JSON.stringify({ type: 'customer.created', data: { object: {} } });
      const t = Math.floor(Date.now() / 1000);
      const v1 = createHmac('sha256', 'whsec_test').update(`${t}.${raw}`, 'utf8').digest('hex');
      const res = await webhookPOST({
        request: new Request('http://localhost/api/payments/webhook', {
          method: 'POST', body: raw, headers: { 'stripe-signature': `t=${t},v1=${v1}` },
        }),
      } as any);
      expect(res.status).toBe(200);
    } finally {
      delete process.env.PAYMENT_PROVIDER;
      delete process.env.STRIPE_SECRET_KEY;
      delete process.env.STRIPE_WEBHOOK_SECRET;
    }
  });

  it('runs the mock callback end to end (302 + confirmed)', async () => {
    const [traveler] = await db.insert(travelers).values({ email: `ep-${stamp}@test.com`, locale: 'fr' }).returning({ id: travelers.id });
    const [app] = await db.insert(applications).values({
      travelerId: traveler.id, tripId: TRIP_ID, departureId: DEP_ID, status: 'approved',
      activityAcknowledgement: true, consent: true, submittedAt: new Date(),
    }).returning({ id: applications.id });
    const [checkout] = await db.insert(checkoutSessions).values({
      applicationId: app.id, departureId: DEP_ID, expiresAt: new Date(Date.now() + 3600_000),
    }).returning({ id: checkoutSessions.id });
    const init = await initiateCheckout({
      checkoutSessionId: checkout.id,
      travelerEmail: `ep-${stamp}@test.com`,
      successUrl: 'http://localhost:4321/fr/booking-confirmed',
      cancelUrl: 'http://localhost:4321/fr/checkout/x',
    });
    const [row] = await db.select().from(checkoutSessions).where(eq(checkoutSessions.id, checkout.id));
    const redirect = vi.fn((url: string, status: number) => new Response(null, { status, headers: { Location: url } }));
    const res: Response = await mockCallbackGET({
      request: new Request(`http://localhost/api/payments/mock-callback?session=${row.providerSessionId}`),
      redirect,
    } as any);
    expect(res.status).toBe(302);
    expect(res.headers.get('Location')).toContain('/fr/booking-confirmed?session_id=');
    const [reservation] = await db.select().from(reservations).where(eq(reservations.id, init.reservationId));
    expect(reservation.status).toBe('completed');
    expect(redirect).toHaveBeenCalled();
  });

  it('returns 404 for unknown mock sessions and non-mock providers', async () => {
    const redirect = vi.fn((_url: string, status: number) => new Response(null, { status }));
    const missing = await mockCallbackGET({
      request: new Request('http://localhost/api/payments/mock-callback?session=nope'),
      redirect,
    } as any);
    expect(missing.status).toBe(404);
    process.env.PAYMENT_PROVIDER = 'stripe';
    try {
      const blocked = await mockCallbackGET({
        request: new Request('http://localhost/api/payments/mock-callback?session=nope'),
        redirect,
      } as any);
      expect(blocked.status).toBe(404);
    } finally {
      delete process.env.PAYMENT_PROVIDER;
    }
  });
});
