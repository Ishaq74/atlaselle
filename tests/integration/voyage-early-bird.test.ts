/**
 * Early bird — intégration bout à bout.
 *
 * La remise se pilote par `pricingRules` (jsonb, déjà en place) : ici on
 * garantit que la fenêtre (mois avant départ + fullPayment) se propage depuis
 * le depart en DB jusqu'au paiement réel — acompte = total remisé, type
 * full_payment, réservation SOLDÉE dès le webhook (zéro solde ultérieur) —
 * et que la fenêtre expirée retombe sur le chemin acompte historique.
 */
import { describe, it, expect, beforeAll, afterAll, vi, afterEach } from 'vitest';

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
import { departures, seatHolds } from '@database/schemas/departures.schema';
import { travelers } from '@database/schemas/travelers.schema';
import { applications } from '@database/schemas/applications.schema';
import { reservations, reservationPriceSnapshots } from '@database/schemas/reservations.schema';
import { payments, checkoutSessions } from '@database/schemas/payments.schema';
import { outboxEvents } from '@database/schemas/outbox.schema';
import {
  initiateCheckout, processProviderSuccess,
} from '@/modules/payments/domain/payment-service';
import { createApplicationCheckout } from '@/modules/payments/domain/checkout-service';
import { quoteForDeparture } from '@/modules/pricing/domain/pricing-service';

const db = getDrizzle();
const stamp = Date.now().toString(36);
const TRIP = `test-eb-${stamp}`;
// Départ 2027-06-01 : cutoff(4 mois) = 2027-02-01, encore future — fenêtre active.
const DEP_FULL = `test-eb-full-${stamp}`;
// Fenêtre expirée via borne absolue : toujours faux, déterministe pour des années.
const DEP_EXPIRED = `test-eb-expired-${stamp}`;

const OLD_ENV = { ...process.env };

async function cleanup() {
  const trs0 = await db.select({ id: travelers.id, email: travelers.email }).from(travelers).catch(() => [] as { id: string; email: string }[]);
  await purgeOutboxForTrips(db, [TRIP], trs0.filter((t) => t.email.includes(stamp)).map((t) => t.id)).catch(() => {});
  const apps = await db.select({ id: applications.id }).from(applications).where(eq(applications.tripId, TRIP)).catch(() => [] as { id: string }[]);
  for (const a of apps) {
    await db.delete(checkoutSessions).where(eq(checkoutSessions.applicationId, a.id)).catch(() => {});
    await db.delete(applications).where(eq(applications.id, a.id)).catch(() => {});
  }
  const res = await db.select({ id: reservations.id }).from(reservations).where(eq(reservations.tripId, TRIP)).catch(() => [] as { id: string }[]);
  for (const r of res) {
    await db.delete(payments).where(eq(payments.reservationId, r.id)).catch(() => {});
    await db.delete(checkoutSessions).where(eq(checkoutSessions.reservationId, r.id)).catch(() => {});
    await db.delete(reservationPriceSnapshots).where(eq(reservationPriceSnapshots.reservationId, r.id)).catch(() => {});
    await db.delete(outboxEvents).where(eq(outboxEvents.aggregateId, r.id)).catch(() => {});
    await db.delete(reservations).where(eq(reservations.id, r.id)).catch(() => {});
  }
  await db.delete(seatHolds).where(eq(seatHolds.departureId, DEP_FULL)).catch(() => {});
  await db.delete(seatHolds).where(eq(seatHolds.departureId, DEP_EXPIRED)).catch(() => {});
  await db.delete(outboxEvents).where(eq(outboxEvents.aggregateId, TRIP)).catch(() => {});
  const trs = await db.select({ id: travelers.id, email: travelers.email }).from(travelers).catch(() => [] as { id: string; email: string }[]);
  for (const t of trs) {
    if (t.email.includes(stamp)) await db.delete(travelers).where(eq(travelers.id, t.id)).catch(() => {});
  }
  await db.delete(departures).where(eq(departures.tripId, TRIP)).catch(() => {});
  await db.delete(outboxEvents).where(eq(outboxEvents.aggregateId, TRIP)).catch(() => {});
}

beforeAll(async () => {
  await cleanup();
  await insertTestTrip(db, {
    id: TRIP, status: 'published', countryCode: 'FR', defaultCurrency: 'EUR',
    durationDays: 4, durationNights: 3, groupMin: 1, groupMax: 2, difficulty: 'easy', difficultyLevel: 1,
    publishedAt: new Date(),
  });
  await db.insert(departures).values({
    id: DEP_FULL, tripId: TRIP,
    startDate: new Date('2027-06-01T08:00:00.000Z'), endDate: new Date('2027-06-04T18:00:00.000Z'),
    status: 'open', capacityMin: 1, capacityMax: 2, priceAmount: 100000, currency: 'EUR',
    depositAmount: 20000, depositType: 'fixed',
    pricingRules: { earlyBirdPercent: 10, earlyBirdMonths: 4, earlyBirdFullPayment: true },
  });
  await db.insert(departures).values({
    id: DEP_EXPIRED, tripId: TRIP,
    startDate: new Date('2027-06-01T08:00:00.000Z'), endDate: new Date('2027-06-04T18:00:00.000Z'),
    status: 'open', capacityMin: 1, capacityMax: 2, priceAmount: 100000, currency: 'EUR',
    depositAmount: 20000, depositType: 'fixed',
    pricingRules: { earlyBirdPercent: 10, earlyBirdBefore: '2026-01-01' },
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

async function mkApprovedApp(email: string, depId: string) {
  const [t] = await db.insert(travelers).values({ email, locale: 'en' }).returning({ id: travelers.id });
  const [a] = await db.insert(applications).values({
    travelerId: t.id, tripId: TRIP, departureId: depId, status: 'approved',
    activityAcknowledgement: true, consent: true, submittedAt: new Date(),
  }).returning({ id: applications.id });
  return { travelerId: t.id, appId: a.id };
}

describe('early bird — quote depuis le départ (façade services)', () => {
  it('facade : fenêtre active → earlyBird exposé, acompte écrasé au total remisé', async () => {
    const q = await quoteForDeparture(DEP_FULL);
    expect(q?.earlyBird?.active).toBe(true);
    expect(q?.earlyBird?.fullPayment).toBe(true);
    expect(q?.totalAmount).toBe(90000); // 100000 − 10 %
    expect(q?.depositAmount).toBe(90000);
    expect(q?.balanceAmount).toBe(0);
  });

  it('facade : fenêtre expirée → earlyBird inactif, chemin acompte historique', async () => {
    const q = await quoteForDeparture(DEP_EXPIRED);
    expect(q?.earlyBird?.active).toBe(false);
    expect(q?.earlyBird?.fullPayment).toBe(false);
    expect(q?.totalAmount).toBe(100000);
    expect(q?.depositAmount).toBe(20000);
    expect(q?.balanceAmount).toBe(80000);
  });
});

describe('early bird — paiement réel', () => {
  it('fenêtre active : full_payment au total remisé, réservation soldée au webhook', async () => {
    const email = `eb-full-${stamp}@test.com`;
    const { travelerId, appId } = await mkApprovedApp(email, DEP_FULL);
    const s = await createApplicationCheckout(appId, DEP_FULL);
    const init = await initiateCheckout({
      checkoutSessionId: s.id, travelerEmail: email,
      successUrl: 'http://x/s', cancelUrl: 'http://x/c',
    });
    expect(init.checkoutUrl).toContain('/api/payments/mock-callback');
    const [pay] = await db.select().from(payments).where(eq(payments.reservationId, init.reservationId)).limit(1);
    expect(pay.type).toBe('full_payment');
    expect(pay.amount).toBe(90000); // acompte fixe 20000 ignoré : total remisé encaissé
    // Snapshot immuable : total remisé + early bird conservé pour l'audit.
    const [snap] = await db.select().from(reservationPriceSnapshots).where(eq(reservationPriceSnapshots.reservationId, init.reservationId)).limit(1);
    const snapshot = snap?.snapshot as { totalAmount?: number; earlyBird?: { fullPayment?: boolean } };
    expect(snapshot.earlyBird?.fullPayment).toBe(true);
    await processProviderSuccess({
      outcome: 'checkout.completed', providerPaymentId: `mock_pi_ebfull_${stamp}`,
      amount: pay.amount, currency: pay.currency, idempotencyKey: pay.idempotencyKey, raw: {},
    });
    const [res] = await db.select().from(reservations).where(eq(reservations.id, init.reservationId)).limit(1);
    expect(res.totalAmount).toBe(90000);
    expect(res.amountPaid).toBe(90000);
    expect(res.amountDue).toBe(0);
    expect(res.status).toBe('completed');
    await purgeOutboxForTrips(db, [TRIP], [travelerId]).catch(() => {});
  });

  it('fenêtre expirée : acompte 20000 classique, réservation non soldée au webhook', async () => {
    const email = `eb-late-${stamp}@test.com`;
    const { travelerId, appId } = await mkApprovedApp(email, DEP_EXPIRED);
    const s = await createApplicationCheckout(appId, DEP_EXPIRED);
    const init = await initiateCheckout({
      checkoutSessionId: s.id, travelerEmail: email,
      successUrl: 'http://x/s', cancelUrl: 'http://x/c',
    });
    const [pay] = await db.select().from(payments).where(eq(payments.reservationId, init.reservationId)).limit(1);
    expect(pay.type).toBe('deposit');
    expect(pay.amount).toBe(20000);
    await processProviderSuccess({
      outcome: 'checkout.completed', providerPaymentId: `mock_pi_eblate_${stamp}`,
      amount: pay.amount, currency: pay.currency, idempotencyKey: pay.idempotencyKey, raw: {},
    });
    const [res] = await db.select().from(reservations).where(eq(reservations.id, init.reservationId)).limit(1);
    expect(res.status).toBe('confirmed'); // solde restant → pas completed
    expect(res.amountDue).toBe(80000);
    await purgeOutboxForTrips(db, [TRIP], [travelerId]).catch(() => {});
  });
});
