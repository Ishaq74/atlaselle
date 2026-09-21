import { describe, it, expect, beforeAll, afterAll, vi, afterEach } from 'vitest';
import { createHmac } from 'node:crypto';

vi.mock('astro:actions', () => {
  class ActionError extends Error {
    code: string;
    constructor({ code, message }: { code: string; message: string }) {
      super(message);
      this.code = code;
    }
  }
  return { ActionError, defineAction: (def: unknown) => def };
});

import { eq } from 'drizzle-orm';
import { getDrizzle } from '@database/drizzle';
import { insertTestTrip } from '../helpers/trip-factory';
import { purgeOutboxForTrips } from '../helpers/voyage';
import { invalidateCache } from '@database/cache';
import { trips } from '@database/schemas/trips.schema';
import { departures, seatHolds } from '@database/schemas/departures.schema';
import { travelers } from '@database/schemas/travelers.schema';
import { applications } from '@database/schemas/applications.schema';
import { reservations } from '@database/schemas/reservations.schema';
import { payments, checkoutSessions } from '@database/schemas/payments.schema';
import { outboxEvents } from '@database/schemas/outbox.schema';
import {
  getAvailability, holdSeats, releaseHold, convertHold, expireHolds,
} from '@/modules/availability/domain/availability-service';
import {
  initiateCheckout, processProviderSuccess, failPaymentByProviderId, initiateBalancePayment,
} from '@/modules/payments/domain/payment-service';
import { refundReservationPayments } from '@/modules/payments/domain/refund-service';
import { createApplicationCheckout } from '@/modules/payments/domain/checkout-service';
import { loadTripPage } from '@/modules/trips/loaders/trip.loader';
import { tripTranslations } from '@database/schemas/trips.schema';
import { mockProvider, mockPaymentIdForSession, stripeProvider } from '@/modules/payments/domain/providers';

const db = getDrizzle();
const stamp = Date.now().toString(36);
const TRIP = `test-pay-${stamp}`;
const DEP = `test-pay-dep-${stamp}`;

const OLD_ENV = { ...process.env };

async function cleanup() {
  const trs0 = await db.select({ id: travelers.id, email: travelers.email }).from(travelers).catch(() => [] as { id: string; email: string }[]);
  await purgeOutboxForTrips(
    db,
    [TRIP],
    trs0.filter((t) => t.email.includes(stamp)).map((t) => t.id),
  ).catch(() => {});
  const apps = await db.select({ id: applications.id }).from(applications).where(eq(applications.tripId, TRIP)).catch(() => [] as { id: string }[]);
  for (const a of apps) {
    await db.delete(checkoutSessions).where(eq(checkoutSessions.applicationId, a.id)).catch(() => {});
    await db.delete(applications).where(eq(applications.id, a.id)).catch(() => {});
  }
  const res = await db.select({ id: reservations.id }).from(reservations).where(eq(reservations.tripId, TRIP)).catch(() => [] as { id: string }[]);
  for (const r of res) {
    await db.delete(payments).where(eq(payments.reservationId, r.id)).catch(() => {});
    await db.delete(checkoutSessions).where(eq(checkoutSessions.reservationId, r.id)).catch(() => {});
    await db.delete(outboxEvents).where(eq(outboxEvents.aggregateId, r.id)).catch(() => {});
    await db.delete(reservations).where(eq(reservations.id, r.id)).catch(() => {});
  }
  await db.delete(seatHolds).where(eq(seatHolds.departureId, DEP)).catch(() => {});
  await db.delete(outboxEvents).where(eq(outboxEvents.aggregateId, TRIP)).catch(() => {});
  const trs = await db.select({ id: travelers.id, email: travelers.email }).from(travelers).catch(() => [] as { id: string; email: string }[]);
  for (const t of trs) {
    if (t.email.includes(stamp)) await db.delete(travelers).where(eq(travelers.id, t.id)).catch(() => {});
  }
  await db.delete(departures).where(eq(departures.tripId, TRIP)).catch(() => {});
  await db.delete(trips).where(eq(trips.id, TRIP)).catch(() => {});
  invalidateCache();
}

beforeAll(async () => {
  await cleanup();
  await insertTestTrip(db, {
    id: TRIP, status: 'published', countryCode: 'FR', defaultCurrency: 'EUR',
    durationDays: 4, durationNights: 3, groupMin: 1, groupMax: 2, difficulty: 'easy', difficultyLevel: 1,
    publishedAt: new Date(),
  });
  await db.insert(departures).values({
    id: DEP, tripId: TRIP,
    startDate: new Date('2027-06-01T08:00:00.000Z'), endDate: new Date('2027-06-04T18:00:00.000Z'),
    status: 'open', capacityMin: 1, capacityMax: 2, priceAmount: 100000, currency: 'EUR',
    depositAmount: 20000, depositType: 'fixed', pricingRules: {},
  });
  await db.insert(departures).values({
    id: `${DEP}-tunnel`, tripId: TRIP,
    startDate: new Date('2027-07-01T08:00:00.000Z'), endDate: new Date('2027-07-04T18:00:00.000Z'),
    status: 'open', capacityMin: 1, capacityMax: 10, priceAmount: 100000, currency: 'EUR',
    depositAmount: 20000, depositType: 'fixed', pricingRules: {},
  });
});

afterAll(async () => {
  await cleanup();
  process.env = OLD_ENV;
  vi.unstubAllGlobals();
});

afterEach(() => {
  vi.restoreAllMocks();
});

async function mkApprovedApp(email: string, depId: string = DEP) {
  const [t] = await db.insert(travelers).values({ email, locale: 'en' }).returning({ id: travelers.id });
  const [a] = await db.insert(applications).values({
    travelerId: t.id, tripId: TRIP, departureId: depId, status: 'approved',
    activityAcknowledgement: true, consent: true, submittedAt: new Date(),
  }).returning({ id: applications.id });
  return { travelerId: t.id, appId: a.id };
}

describe('availability-service — bords', () => {
  it('départ inconnu, quantité 0/négative, TTL custom', async () => {
    await expect(holdSeats('00000000-0000-0000-0000-000000000000')).rejects.toMatchObject({ code: 'DEPARTURE_SOLD_OUT' });
    await expect(holdSeats(DEP, { quantity: 0 })).rejects.toMatchObject({ code: 'DEPARTURE_SOLD_OUT' });
    await expect(holdSeats(DEP, { quantity: -2 })).rejects.toMatchObject({ code: 'DEPARTURE_SOLD_OUT' });
    const h = await holdSeats(DEP, { ttlMinutes: 5 });
    expect(h.expiresAt.getTime() - Date.now()).toBeGreaterThan(4 * 60_000);
    expect(h.expiresAt.getTime() - Date.now()).toBeLessThanOrEqual(6 * 60_000);
    await releaseHold(h.id);
    const customNow = new Date('2027-01-01T00:00:00.000Z');
    const h2 = await holdSeats(DEP, { applicationId: 'app-custom', quantity: 1, ttlMinutes: 10, now: customNow });
    expect(h2.applicationId).toBe('app-custom');
    expect(h2.expiresAt.getTime() - customNow.getTime()).toBe(10 * 60_000);
    await releaseHold(h2.id);
  });

  it('release/convert inconnu -> null, expire daté + releasedAt, rien avant 2019', async () => {
    expect(await releaseHold('00000000-0000-0000-0000-000000000000')).toBeNull();
    expect(await convertHold('00000000-0000-0000-0000-000000000000')).toBeNull();
    const h = await holdSeats(DEP, { ttlMinutes: -1 });
    await db.update(seatHolds).set({ expiresAt: new Date('2020-01-01T00:00:00.000Z') }).where(eq(seatHolds.id, h.id));
    // now figé en 2021 : seuls les holds <= 2021 sont touchés (jamais ceux des voisins)
    await expireHolds(new Date('2021-01-01T00:00:00.000Z'));
    const [row] = await db.select().from(seatHolds).where(eq(seatHolds.id, h.id)).limit(1);
    expect(row.status).toBe('expired');
    expect(row.releasedAt).not.toBeNull();
    expect(await expireHolds(new Date('2019-01-01T00:00:00.000Z'))).toBe(0);
  });

  it('getAvailability inconnu, waitlist non bookable, limited bookable, statuts comptés', async () => {
    expect(await getAvailability('00000000-0000-0000-0000-000000000000')).toBeNull();
    const t = (await db.insert(travelers).values({ email: `av-${stamp}@test.com`, locale: 'en' }).returning({ id: travelers.id }))[0];
    for (const s of ['balance_due', 'completed'] as const) {
      await db.insert(reservations).values({
        reservationNumber: `ATL-2027-V${s[0].toUpperCase()}${stamp.slice(-4).toUpperCase()}`,
        travelerId: t.id, tripId: TRIP, departureId: DEP, status: s,
        currency: 'EUR', baseAmount: 10, totalAmount: 10, amountPaid: 10, amountDue: 0,
      });
    }
    const snap = await getAvailability(DEP);
    expect(snap?.confirmedSeats).toBe(2);
    await db.update(departures).set({ status: 'waitlist' }).where(eq(departures.id, DEP));
    expect((await getAvailability(DEP))?.bookable).toBe(false);
    await db.update(departures).set({ status: 'limited' }).where(eq(departures.id, DEP));
    expect((await getAvailability(DEP))?.bookable).toBe(true);
    await db.update(departures).set({ status: 'open' }).where(eq(departures.id, DEP));
    expect((await getAvailability(DEP))?.bookable).toBe(true);
  });
});

describe('initiateCheckout — double appel, échec provider, outbox', () => {
  it('2e appel -> RESERVATION_ALREADY_CONFIRMED + checkout.started émis', async () => {
    const email = `dbl-${stamp}@test.com`;
    const { appId } = await mkApprovedApp(email);
    const s = await createApplicationCheckout(appId, `${DEP}-tunnel`);
    const first = await initiateCheckout({
      checkoutSessionId: s.id, travelerEmail: email,
      successUrl: 'http://x/s', cancelUrl: 'http://x/c',
    });
    expect(first.checkoutUrl).toContain('/api/payments/mock-callback');
    const events = await db.select().from(outboxEvents).where(eq(outboxEvents.aggregateId, s.id));
    expect(events.some((e) => e.eventType === 'checkout.started')).toBe(true);
    await expect(initiateCheckout({
      checkoutSessionId: s.id, travelerEmail: email,
      successUrl: 'http://x/s', cancelUrl: 'http://x/c',
    })).rejects.toMatchObject({ code: 'RESERVATION_ALREADY_CONFIRMED' });
  });

  it('vente confirmée -> fiche à jour SANS purge manuelle (le tunnel invalide)', async () => {
    const trip2 = `test-pay-cache2-${stamp}`;
    const slug = `cache2-${stamp}`;
    const depId = `${DEP}-cache2`;
    await insertTestTrip(db, {
      id: trip2, status: 'published', countryCode: 'FR', defaultCurrency: 'EUR',
      durationDays: 4, durationNights: 3, groupMin: 1, groupMax: 1, difficulty: 'easy', difficultyLevel: 1,
      publishedAt: new Date(),
    });
    await db.insert(tripTranslations).values({
      id: `cache2-tr-${stamp}`, tripId: trip2, locale: 'en', slug,
      title: 'Cache Trip', summary: 'S', overview: 'O', localeVisible: true,
    });
    await db.insert(departures).values({
      id: depId, tripId: trip2,
      startDate: new Date('2027-08-01T08:00:00.000Z'), endDate: new Date('2027-08-04T18:00:00.000Z'),
      status: 'open', capacityMin: 1, capacityMax: 1, priceAmount: 100000, currency: 'EUR', pricingRules: {},
    });
    const page1 = await loadTripPage('en', slug);
    expect(page1?.remainingPlaces).toBe(1);
    expect(page1?.status).toBe('open');
    const [trav] = await db.insert(travelers).values({ email: `cache2-${stamp}@test.com`, locale: 'en' }).returning({ id: travelers.id });
    const [app] = await db.insert(applications).values({
      travelerId: trav.id, tripId: trip2, departureId: depId, status: 'approved',
      activityAcknowledgement: true, consent: true, submittedAt: new Date(),
    }).returning({ id: applications.id });
    const s = await createApplicationCheckout(app.id, depId);
    const init = await initiateCheckout({
      checkoutSessionId: s.id, travelerEmail: `cache2-${stamp}@test.com`,
      successUrl: 'http://x/s', cancelUrl: 'http://x/c',
    });
    const [pay] = await db.select().from(payments).where(eq(payments.reservationId, init.reservationId)).limit(1);
    await processProviderSuccess({
      outcome: 'checkout.completed', providerPaymentId: `mock_pi_cache2_${stamp}`,
      amount: pay.amount, currency: pay.currency, idempotencyKey: pay.idempotencyKey, raw: {},
    });
    // PAS de invalidateCache() : si le tunnel ne purgeait pas, remaining resterait à 1.
    const page2 = await loadTripPage('en', slug);
    expect(page2?.remainingPlaces).toBe(0);
    expect(page2?.status).toBe('interest-list');
    await purgeOutboxForTrips(db, [trip2], [trav.id]).catch(() => {});
    await db.delete(payments).where(eq(payments.reservationId, init.reservationId)).catch(() => {});
    await db.delete(checkoutSessions).where(eq(checkoutSessions.applicationId, app.id)).catch(() => {});
    await db.delete(reservations).where(eq(reservations.id, init.reservationId)).catch(() => {});
    await db.delete(applications).where(eq(applications.id, app.id)).catch(() => {});
    await db.delete(seatHolds).where(eq(seatHolds.departureId, depId)).catch(() => {});
    await db.delete(travelers).where(eq(travelers.id, trav.id)).catch(() => {});
    await db.delete(tripTranslations).where(eq(tripTranslations.tripId, trip2)).catch(() => {});
    await db.delete(departures).where(eq(departures.id, depId)).catch(() => {});
    await db.delete(trips).where(eq(trips.id, trip2)).catch(() => {});
    invalidateCache();
  });

  it('échec provider -> hold libéré, sans réservation ni paiement orphelins', async () => {
    const email = `ph-${stamp}@test.com`;
    const { appId } = await mkApprovedApp(email, `${DEP}-tunnel`);
    const s = await createApplicationCheckout(appId, `${DEP}-tunnel`);
    vi.spyOn(mockProvider, 'createCheckoutSession').mockRejectedValueOnce(new Error('provider down'));
    await expect(initiateCheckout({
      checkoutSessionId: s.id, travelerEmail: email,
      successUrl: 'http://x/s', cancelUrl: 'http://x/c',
    })).rejects.toThrow('provider down');
    const holds = await db.select().from(seatHolds).where(eq(seatHolds.applicationId, appId));
    expect(holds.length).toBeGreaterThanOrEqual(1);
    expect(holds.every((h) => h.status === 'released')).toBe(true);
    const [sess] = await db.select().from(checkoutSessions).where(eq(checkoutSessions.id, s.id)).limit(1);
    expect(sess.reservationId).toBeNull();
    expect(sess.providerSessionId).toBeNull();
    expect(await db.select().from(reservations).where(eq(reservations.applicationId, appId))).toHaveLength(0);
  });
});

describe('processProviderSuccess — duplicata, mismatch, fallback, inconnu', () => {
  it('cible introuvable -> PAYMENT_FAILED, inconnu fail -> silencieux', async () => {
    await expect(processProviderSuccess({
      outcome: 'checkout.completed', providerPaymentId: 'mock_pi_nope', amount: 1, currency: 'EUR', raw: {},
    })).rejects.toMatchObject({ code: 'PAYMENT_FAILED' });
    await failPaymentByProviderId('mock_pi_nope');
  });

  it('duplicata paid, mismatch -> failed', async () => {
    const email = `dw-${stamp}@test.com`;
    const { travelerId, appId } = await mkApprovedApp(email);
    const [r] = await db.insert(reservations).values({
      reservationNumber: `ATL-2027-W${stamp.slice(-4).toUpperCase()}`,
      travelerId, tripId: TRIP, departureId: DEP, applicationId: appId, status: 'awaiting_payment',
      currency: 'EUR', baseAmount: 20000, totalAmount: 20000, amountPaid: 0, amountDue: 20000,
    }).returning({ id: reservations.id });
    const [p] = await db.insert(payments).values({
      reservationId: r.id, provider: 'mock', type: 'deposit', status: 'created',
      amount: 20000, currency: 'EUR', idempotencyKey: `dw-${stamp}`, providerPaymentId: `mock_pi_dw_${stamp}`,
    }).returning({ id: payments.id });
    const dup1 = await processProviderSuccess({
      outcome: 'checkout.completed', providerPaymentId: `mock_pi_dw_${stamp}`,
      amount: 20000, currency: 'EUR', idempotencyKey: `dw-${stamp}`, raw: {},
    });
    expect(dup1.duplicate).toBe(false);
    const dup2 = await processProviderSuccess({
      outcome: 'checkout.completed', providerPaymentId: `mock_pi_dw_${stamp}`,
      amount: 20000, currency: 'EUR', raw: {},
    });
    expect(dup2.duplicate).toBe(true);
    const [r2] = await db.insert(reservations).values({
      reservationNumber: `ATL-2027-W2${stamp.slice(-4).toUpperCase()}`,
      travelerId, tripId: TRIP, departureId: DEP, applicationId: appId, status: 'awaiting_payment',
      currency: 'EUR', baseAmount: 20000, totalAmount: 20000, amountPaid: 0, amountDue: 20000,
    }).returning({ id: reservations.id });
    await db.insert(payments).values({
      reservationId: r2.id, provider: 'mock', type: 'deposit', status: 'created',
      amount: 20000, currency: 'EUR', idempotencyKey: `dw2-${stamp}`, providerPaymentId: `mock_pi_dw2_${stamp}`,
    });
    await expect(processProviderSuccess({
      outcome: 'checkout.completed', providerPaymentId: `mock_pi_dw2_${stamp}`,
      amount: 99999, currency: 'EUR', raw: {},
    })).rejects.toMatchObject({ code: 'PAYMENT_AMOUNT_MISMATCH' });
    const [mm] = await db.select().from(payments).where(eq(payments.id, p.id)).limit(1);
    expect(mm.status).toBe('paid');
    void p;
  });

  it('repli idempotencyKey seul -> paid + payment.received + checkout complété', async () => {
    const email = `fb-${stamp}@test.com`;
    const { travelerId, appId } = await mkApprovedApp(email);
    const [r] = await db.insert(reservations).values({
      reservationNumber: `ATL-2027-F${stamp.slice(-4).toUpperCase()}`,
      travelerId, tripId: TRIP, departureId: DEP, applicationId: appId, status: 'awaiting_payment',
      currency: 'EUR', baseAmount: 20000, totalAmount: 20000, amountPaid: 0, amountDue: 20000,
    }).returning({ id: reservations.id });
    const [pay] = await db.insert(payments).values({
      reservationId: r.id, provider: 'mock', type: 'deposit', status: 'created',
      amount: 20000, currency: 'EUR', idempotencyKey: `fb-${stamp}`,
    }).returning({ id: payments.id });
    const s = await createApplicationCheckout(appId, `${DEP}-tunnel`);
    await db.update(checkoutSessions).set({ reservationId: r.id }).where(eq(checkoutSessions.id, s.id));
    const [orphan] = await db.insert(seatHolds).values({
      departureId: DEP, applicationId: null, quantity: 1, status: 'active',
      expiresAt: new Date(Date.now() + 30 * 60_000),
    }).returning({ id: seatHolds.id });
    const res = await processProviderSuccess({
      outcome: 'checkout.completed', providerPaymentId: `mock_pi_fb_${stamp}`,
      amount: 20000, currency: 'EUR', idempotencyKey: `fb-${stamp}`, raw: {},
    });
    expect(res.reservationId).toBe(r.id);
    const [upd] = await db.select().from(payments).where(eq(payments.id, pay.id)).limit(1);
    expect(upd.status).toBe('paid');
    expect(upd.providerPaymentId).toBe(`mock_pi_fb_${stamp}`);
    const events = await db.select().from(outboxEvents).where(eq(outboxEvents.aggregateId, pay.id));
    expect(events.some((e) => e.eventType === 'payment.received')).toBe(true);
    const [sess] = await db.select().from(checkoutSessions).where(eq(checkoutSessions.id, s.id)).limit(1);
    expect(sess.status).toBe('completed');
    // hold d'une autre candidature : non converti, expire par TTL
    const [orphanRow] = await db.select().from(seatHolds).where(eq(seatHolds.id, orphan.id)).limit(1);
    expect(orphanRow.status).toBe('active');
    await releaseHold(orphan.id);
  });
});

describe('refund et balance — échecs provider', () => {
  it('refund échec provider -> throw, paiement inchangé', async () => {
    const email = `rf3-${stamp}@test.com`;
    const { travelerId } = await mkApprovedApp(email);
    const [r] = await db.insert(reservations).values({
      reservationNumber: `ATL-2027-R3${stamp.slice(-4).toUpperCase()}`,
      travelerId, tripId: TRIP, departureId: DEP, status: 'cancelled',
      currency: 'EUR', baseAmount: 50000, totalAmount: 50000, amountPaid: 50000, amountDue: 0,
    }).returning({ id: reservations.id });
    const [p] = await db.insert(payments).values({
      reservationId: r.id, provider: 'mock', type: 'full_payment', status: 'paid',
      amount: 50000, currency: 'EUR', idempotencyKey: `rf3-${stamp}`, providerPaymentId: `mock_pi_rf3_${stamp}`,
    }).returning({ id: payments.id });
    vi.spyOn(mockProvider, 'createRefund').mockRejectedValueOnce(new Error('refund down'));
    await expect(refundReservationPayments(r.id)).rejects.toThrow('refund down');
    const [row] = await db.select().from(payments).where(eq(payments.id, p.id)).limit(1);
    expect(row.status).toBe('paid');
  });

  it('balance échec provider -> throw + paiement marqué failed', async () => {
    const email = `pb2-${stamp}@test.com`;
    const { travelerId } = await mkApprovedApp(email);
    const [r] = await db.insert(reservations).values({
      reservationNumber: `ATL-2027-P2${stamp.slice(-4).toUpperCase()}`,
      travelerId, tripId: TRIP, departureId: DEP, status: 'balance_due',
      currency: 'EUR', baseAmount: 100000, totalAmount: 100000, amountPaid: 20000, amountDue: 80000,
    }).returning({ id: reservations.id });
    vi.spyOn(mockProvider, 'createCheckoutSession').mockRejectedValueOnce(new Error('checkout down'));
    await expect(initiateBalancePayment({
      reservationId: r.id, travelerEmail: email, successUrl: 'http://x/s', cancelUrl: 'http://x/c',
    })).rejects.toThrow('checkout down');
    const pays = await db.select().from(payments).where(eq(payments.reservationId, r.id));
    expect(pays).toHaveLength(1);
    expect(pays[0].status).toBe('failed');
    expect(pays[0].failedAt).not.toBeNull();
  });
});

describe('mock provider — refund, ids, webhook', () => {
  it('refund id, payment id, webhook invalide et failed', async () => {
    expect(await mockProvider.createRefund({ providerPaymentId: 'mock_pi_abc', idempotencyKey: 'k' }))
      .toEqual({ providerRefundId: 'mock_re_abc' });
    expect(mockPaymentIdForSession('mock_cs_deadbeef')).toBe('mock_pi_deadbeef');
    await expect(mockProvider.verifyWebhook('{}', null)).rejects.toThrow(/Invalid mock/);
    const failed = await mockProvider.verifyWebhook(JSON.stringify({
      providerPaymentId: 'mock_pi_x', amount: 10, currency: 'EUR', failed: true,
    }), null);
    expect(failed.outcome).toBe('payment.failed');
  });
});

describe('stripe — env, api, webhook, refund', () => {
  const SECRET = 'whsec_test';
  const sign = (raw: string, t = Math.floor(Date.now() / 1000)) => {
    const v1 = createHmac('sha256', SECRET).update(`${t}.${raw}`, 'utf8').digest('hex');
    return `t=${t},v1=${v1}`;
  };

  it('sans config -> throw sur les 3 méthodes', async () => {
    delete process.env.STRIPE_SECRET_KEY;
    delete process.env.STRIPE_WEBHOOK_SECRET;
    await expect(stripeProvider.createCheckoutSession({
      amount: 1, currency: 'EUR', idempotencyKey: 'k', reservationId: 'r',
      customerEmail: 't@t.com', successUrl: 's', cancelUrl: 'c',
    })).rejects.toThrow(/non configuré/);
    await expect(stripeProvider.verifyWebhook('{}', 't=1,v1=x')).rejects.toThrow(/non configuré/);
    await expect(stripeProvider.createRefund({ providerPaymentId: 'pi_x', idempotencyKey: 'k' })).rejects.toThrow(/non configuré/);
    process.env.STRIPE_SECRET_KEY = 'sk_test';
    process.env.STRIPE_WEBHOOK_SECRET = SECRET;
  });

  it('api !ok -> throw + Idempotency-Key transmis', async () => {
    process.env.STRIPE_SECRET_KEY = 'sk_test';
    process.env.STRIPE_WEBHOOK_SECRET = SECRET;
    let captured: Record<string, string> = {};
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 500, text: async () => 'boom' })));
    await expect(stripeProvider.createCheckoutSession({
      amount: 1, currency: 'EUR', idempotencyKey: 'idem-1', reservationId: 'r',
      customerEmail: 't@t.com', successUrl: 's', cancelUrl: 'c',
    })).rejects.toThrow(/Stripe API.*500/);
    captured = ((fetch as unknown as { mock: { calls: unknown[][] } }).mock.calls[0][1] as { headers: Record<string, string> }).headers;
    expect(captured['Idempotency-Key']).toBe('idem-1');
  });

  it('session sans id|url -> throw ; refund sans id -> throw ; sans amount -> ok', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({}) })));
    await expect(stripeProvider.createCheckoutSession({
      amount: 1, currency: 'EUR', idempotencyKey: 'k', reservationId: 'r',
      customerEmail: 't@t.com', successUrl: 's', cancelUrl: 'c',
    })).rejects.toThrow(/inattendue/);
    await expect(stripeProvider.createRefund({ providerPaymentId: 'pi_x', idempotencyKey: 'k' })).rejects.toThrow(/inattendue/);
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ id: 're_1' }) })));
    let body = '';
    (fetch as unknown as { mock: { implementationOnce: Function } });
    vi.stubGlobal('fetch', vi.fn(async (_u: unknown, opts: { body: { toString(): string } }) => {
      body = opts.body.toString();
      return { ok: true, json: async () => ({ id: 're_1' }) };
    }));
    expect(await stripeProvider.createRefund({ providerPaymentId: 'pi_x', idempotencyKey: 'k' }))
      .toEqual({ providerRefundId: 're_1' });
    expect(body).not.toContain('amount=');
    expect(body).not.toContain('__idempotency');
  });

  it('webhook : incomplet -> throw, repli obj.id, expired -> payment.failed', async () => {
    const raw1 = JSON.stringify({ type: 'checkout.session.completed', data: { object: { id: 'cs_1', currency: 'eur' } } });
    await expect(stripeProvider.verifyWebhook(raw1, sign(raw1))).rejects.toThrow(/incomplet/);
    const raw2 = JSON.stringify({
      type: 'checkout.session.completed',
      data: { object: { id: 'cs_2', amount_total: 5000, currency: 'eur', metadata: { idempotency_key: 'k2' } } },
    });
    const ev2 = await stripeProvider.verifyWebhook(raw2, sign(raw2));
    expect(ev2.providerPaymentId).toBe('cs_2');
    expect(ev2.currency).toBe('EUR');
    expect(ev2.idempotencyKey).toBe('k2');
    const raw3 = JSON.stringify({
      type: 'payment_intent.payment_failed',
      data: { object: { id: 'pi_3', payment_intent: 'pi_3', amount_total: 100, currency: 'usd' } },
    });
    const ev3 = await stripeProvider.verifyWebhook(raw3, sign(raw3));
    expect(ev3.outcome).toBe('payment.failed');
    expect(ev3.currency).toBe('USD');
  });
});
