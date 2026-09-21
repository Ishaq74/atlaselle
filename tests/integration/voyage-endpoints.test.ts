import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { createHmac } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { getDrizzle } from '@database/drizzle';
import { insertTestTrip } from '../helpers/trip-factory';
import { invalidateCache } from '@database/cache';
import { trips, tripTranslations } from '@database/schemas/trips.schema';
import { departures } from '@database/schemas/departures.schema';
import { travelers } from '@database/schemas/travelers.schema';
import { applications } from '@database/schemas/applications.schema';
import { reservations } from '@database/schemas/reservations.schema';
import { payments, checkoutSessions } from '@database/schemas/payments.schema';
import { POST as webhookPOST } from '@/pages/api/payments/webhook';
import { GET as mockCallbackGET } from '@/pages/api/payments/mock-callback';
import { purgeOutboxForTrips } from '../helpers/voyage';

const db = getDrizzle();
const stamp = Date.now().toString(36);
const TRIP = `test-ep2-trip-${stamp}`;
const DEP = `test-ep2-dep-${stamp}`;
const SECRET = 'whsec_ep2';

function signedWebhook(raw: string) {
  const t = Math.floor(Date.now() / 1000);
  const v1 = createHmac('sha256', SECRET).update(`${t}.${raw}`, 'utf8').digest('hex');
  return new Request('http://localhost/api/payments/webhook', {
    method: 'POST',
    body: raw,
    headers: { 'stripe-signature': `t=${t},v1=${v1}` },
  });
}

function stripeEnv() {
  process.env.PAYMENT_PROVIDER = 'stripe';
  process.env.STRIPE_SECRET_KEY = 'sk_test_ep2';
  process.env.STRIPE_WEBHOOK_SECRET = SECRET;
}

function clearStripeEnv() {
  delete process.env.PAYMENT_PROVIDER;
  delete process.env.STRIPE_SECRET_KEY;
  delete process.env.STRIPE_WEBHOOK_SECRET;
}

async function cleanup() {
  const apps = await db.select({ id: applications.id }).from(applications).where(eq(applications.tripId, TRIP)).catch(() => [] as { id: string }[]);
  const res = await db.select({ id: reservations.id }).from(reservations).where(eq(reservations.tripId, TRIP)).catch(() => [] as { id: string }[]);
  const trs = await db.select({ id: travelers.id, email: travelers.email }).from(travelers).catch(() => [] as { id: string; email: string }[]);
  await purgeOutboxForTrips(
    db,
    [TRIP],
    trs.filter((t) => t.email.includes(stamp)).map((t) => t.id),
  ).catch(() => {});
  for (const a of apps) {
    await db.delete(checkoutSessions).where(eq(checkoutSessions.applicationId, a.id)).catch(() => {});
    await db.delete(applications).where(eq(applications.id, a.id)).catch(() => {});
  }
  for (const r of res) {
    await db.delete(payments).where(eq(payments.reservationId, r.id)).catch(() => {});
    await db.delete(checkoutSessions).where(eq(checkoutSessions.reservationId, r.id)).catch(() => {});
    await db.delete(reservations).where(eq(reservations.id, r.id)).catch(() => {});
  }
  for (const t of trs) {
    if (t.email.includes(stamp)) await db.delete(travelers).where(eq(travelers.id, t.id)).catch(() => {});
  }
  await db.delete(tripTranslations).where(eq(tripTranslations.tripId, TRIP)).catch(() => {});
  await db.delete(departures).where(eq(departures.tripId, TRIP)).catch(() => {});
  await db.delete(trips).where(eq(trips.id, TRIP)).catch(() => {});
  invalidateCache();
}

beforeAll(async () => {
  await cleanup();
  await insertTestTrip(db, {
    id: TRIP, status: 'published', countryCode: 'FR', defaultCurrency: 'EUR',
    durationDays: 4, durationNights: 3, groupMin: 1, groupMax: 5, difficulty: 'easy', difficultyLevel: 1,
    publishedAt: new Date(),
  });
  await db.insert(tripTranslations).values({
    id: `ep2-tr-${stamp}`, tripId: TRIP, locale: 'en', slug: `ep2-${stamp}`,
    title: 'EP2', summary: 'S', overview: 'O', localeVisible: true,
  });
  await db.insert(departures).values({
    id: DEP, tripId: TRIP,
    startDate: new Date('2027-05-01T08:00:00.000Z'), endDate: new Date('2027-05-04T18:00:00.000Z'),
    status: 'open', capacityMin: 1, capacityMax: 5, priceAmount: 50000, currency: 'EUR', pricingRules: {},
  });
});

afterAll(cleanup);

describe('webhook Stripe — échec de traitement -> 500 (retry)', () => {
  it('paiement introuvable -> 500 pour retry Stripe', async () => {
    stripeEnv();
    try {
      const raw = JSON.stringify({
        type: 'checkout.session.completed',
        data: { object: { id: 'cs_nope', payment_intent: 'pi_nope_ep2', amount_total: 100, currency: 'eur', metadata: {} } },
      });
      const res = await webhookPOST({ request: signedWebhook(raw) } as never);
      expect(res.status).toBe(500);
    } finally {
      clearStripeEnv();
    }
  });

  it('succès complet -> 200 + réservation confirmée', async () => {
    const [t] = await db.insert(travelers).values({ email: `ep2-${stamp}@test.com`, locale: 'en' }).returning({ id: travelers.id });
    const [r] = await db.insert(reservations).values({
      reservationNumber: `ATL-2027-W${stamp.slice(-4).toUpperCase()}`,
      travelerId: t.id, tripId: TRIP, departureId: DEP, status: 'awaiting_payment',
      currency: 'EUR', baseAmount: 50000, totalAmount: 50000, amountPaid: 0, amountDue: 50000,
    }).returning({ id: reservations.id });
    await db.insert(payments).values({
      reservationId: r.id, provider: 'stripe', type: 'full_payment', status: 'created',
      amount: 50000, currency: 'EUR', idempotencyKey: `ep2-${stamp}`,
    });
    stripeEnv();
    try {
      const raw = JSON.stringify({
        type: 'checkout.session.completed',
        data: {
          object: {
            id: 'cs_ep2_ok', payment_intent: 'pi_ep2_ok', amount_total: 50000, currency: 'eur',
            metadata: { idempotency_key: `ep2-${stamp}` },
          },
        },
      });
      const res = await webhookPOST({ request: signedWebhook(raw) } as never);
      expect(res.status).toBe(200);
    } finally {
      clearStripeEnv();
    }
    const [upd] = await db.select().from(reservations).where(eq(reservations.id, r.id)).limit(1);
    expect(upd.status).toBe('completed');
    const [pay] = await db.select().from(payments).where(eq(payments.reservationId, r.id)).limit(1);
    expect(pay.status).toBe('paid');
    expect(pay.providerPaymentId).toBe('pi_ep2_ok');
  });
});

describe('mock-callback — locale invalide -> repli en', () => {
  it('redirige /en/booking-confirmed quand la locale voyageuse est inconnue', async () => {
    delete process.env.PAYMENT_PROVIDER;
    const [t] = await db.insert(travelers).values({ email: `ep2xx-${stamp}@test.com`, locale: 'xx' as never }).returning({ id: travelers.id });
    const [a] = await db.insert(applications).values({
      travelerId: t.id, tripId: TRIP, departureId: DEP, status: 'approved',
      activityAcknowledgement: true, consent: true, submittedAt: new Date(),
    }).returning({ id: applications.id });
    const [r] = await db.insert(reservations).values({
      reservationNumber: `ATL-2027-X${stamp.slice(-4).toUpperCase()}`,
      travelerId: t.id, tripId: TRIP, departureId: DEP, applicationId: a.id, status: 'awaiting_payment',
      currency: 'EUR', baseAmount: 50000, totalAmount: 50000, amountPaid: 0, amountDue: 50000,
    }).returning({ id: reservations.id });
    await db.insert(payments).values({
      reservationId: r.id, provider: 'mock', type: 'full_payment', status: 'created',
      amount: 50000, currency: 'EUR', idempotencyKey: `ep2xx-${stamp}`,
    });
    const session = `mock_cs_ep2xx_${stamp}`;
    await db.insert(checkoutSessions).values({
      applicationId: a.id, departureId: DEP, reservationId: r.id,
      providerSessionId: session, expiresAt: new Date(Date.now() + 3600_000),
    });
    const redirect = vi.fn((url: string, status: number) => new Response(null, { status, headers: { Location: url } }));
    const res: Response = await mockCallbackGET({
      request: new Request(`http://localhost/api/payments/mock-callback?session=${session}`),
      redirect,
    } as never);
    expect(res.status).toBe(302);
    expect(res.headers.get('Location')).toMatch(/^\/en\/booking-confirmed\?session_id=/);
  });
});
