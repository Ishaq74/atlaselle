import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';

// `astro:actions` est un module virtuel résolu uniquement par le build Astro.
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

import { and, eq, inArray } from 'drizzle-orm';
import { getDrizzle } from '@database/drizzle';
import { insertTestTrip } from '../helpers/trip-factory';
import { purgeOutboxForTrips } from '../helpers/voyage';
import { invalidateCache } from '@database/cache';
import { departures, seatHolds } from '@database/schemas/departures.schema';
import { trips } from '@database/schemas/trips.schema';
import { travelers } from '@database/schemas/travelers.schema';
import { emailDeliveries } from '@database/schemas/email-voyage.schema';
import { applications, applicationDecisions, applicationEvents } from '@database/schemas/applications.schema';
import { reservations, reservationPriceSnapshots } from '@database/schemas/reservations.schema';
import { payments, checkoutSessions } from '@database/schemas/payments.schema';
import { waitlistEntries } from '@database/schemas/waitlist.schema';
import { outboxEvents } from '@database/schemas/outbox.schema';
import { submitApplication } from '@/actions/voyage/applications';
import { initiateCheckout } from '@/actions/voyage/checkout';
import { processProviderSuccess, expireStalePaymentAttempts, initiateBalancePayment } from '@/modules/payments/domain/payment-service';
import { loadBookingByProviderSession, loadMockCallbackContext } from '@/modules/reservations/loaders/booking.loader';
import { mockPaymentIdForSession } from '@/modules/payments/domain/providers';
import { cancelReservation } from '@/modules/reservations/domain/reservation-service';
import { promoteWaitlist, expireWaitlistOffers } from '@/modules/applications/domain/waitlist-service';
import { getAvailability } from '@/modules/availability/domain/availability-service';
import { resetRateLimiter } from '@/lib/rate-limit';
import { getTestHelpers } from '../helpers/auth';

const submit = (submitApplication as any).handler as (i: any, c: any) => Promise<any>;
const initiate = (initiateCheckout as any).handler as (i: any, c: any) => Promise<any>;

const db = getDrizzle();
const stamp = Date.now().toString(36);
const TRIP_ID = `test-wl-trip-${stamp}`;
const HOUR = 3_600_000;

let helpers: Awaited<ReturnType<typeof getTestHelpers>>;
const userIds = new Map<string, string>();
let depCounter = 0;

const publicCtx = () => ({
  locals: { user: null },
  request: { headers: new Headers(), url: 'http://localhost:4321/en/checkout/x' },
  clientAddress: '127.0.0.1',
}) as any;

const applicantCtx = (userId: string, email: string) => ({
  locals: { user: { id: userId, email, emailVerified: true, banned: false } },
  request: { headers: new Headers(), url: 'http://localhost:4321/en/apply/x' },
  clientAddress: '127.0.0.1',
}) as any;

async function mkDep(capacityMax: number, extra: Partial<typeof departures.$inferInsert> = {}) {
  depCounter += 1;
  const id = `test-wl-dep-${stamp}-${depCounter}`;
  await db.insert(departures).values({
    id, tripId: TRIP_ID,
    startDate: new Date('2027-10-01T08:00:00.000Z'), endDate: new Date('2027-10-04T18:00:00.000Z'),
    status: 'open', capacityMin: 1, capacityMax, priceAmount: 100000, currency: 'EUR', pricingRules: {},
    depositType: 'percent', depositPercent: 20,
    balanceDueDate: new Date('2027-08-01T00:00:00.000Z'),
    bookingDeadline: new Date('2027-09-15T23:59:00.000Z'),
    ...extra,
  });
  return id;
}

const emailOf = (tag: string) => `wl-${tag}-${stamp}@test.com`;

async function apply(departureId: string, tag: string) {
  const email = emailOf(tag);
  let userId = userIds.get(email);
  if (!userId) {
    userId = (await helpers.saveUser(helpers.createUser({ email, name: `WL ${tag}`, emailVerified: true }))).id;
    userIds.set(email, userId);
  }
  return submit(
    {
      tripId: TRIP_ID, departureId, legalName: `WL ${tag}`, email, phone: null,
      roomPreference: 'shared', dietaryRequirements: null, accessibilityNeeds: null,
      activityAcknowledgement: true, motivation: null, expectations: null, consent: true, termsAccepted: true, locale: 'en',
    },
    applicantCtx(userId, email),
  );
}

async function reservationOf(applicationId: string) {
  const [row] = await db.select().from(reservations).where(eq(reservations.applicationId, applicationId));
  return row!;
}

async function pay(reservationId: string) {
  const [payment] = await db.select().from(payments).where(eq(payments.reservationId, reservationId));
  const [checkout] = await db.select().from(checkoutSessions).where(eq(checkoutSessions.reservationId, reservationId));
  return processProviderSuccess({
    outcome: 'checkout.completed',
    providerPaymentId: mockPaymentIdForSession(checkout!.providerSessionId!),
    amount: payment!.amount,
    currency: payment!.currency,
    idempotencyKey: payment!.idempotencyKey,
    raw: { mock: true },
  });
}

const entryOf = async (applicationId: string) =>
  (await db.select().from(waitlistEntries).where(eq(waitlistEntries.applicationId, applicationId)))[0]!;

const activeHolds = (departureId: string) =>
  db.select().from(seatHolds).where(and(eq(seatHolds.departureId, departureId), eq(seatHolds.status, 'active')));

const eventsFor = async (aggregateId: string) =>
  (await db.select().from(outboxEvents).where(eq(outboxEvents.aggregateId, aggregateId))).map((e) => e.eventType);

async function backdate(reservationId: string, hours: number) {
  const past = new Date(Date.now() - hours * HOUR);
  await db.update(reservations).set({ createdAt: past }).where(eq(reservations.id, reservationId));
  await db.update(payments).set({ createdAt: past }).where(eq(payments.reservationId, reservationId));
}

// Nettoyage ciblé sur ce fichier (les fichiers de test tournent en parallèle sur la même base).
async function cleanup() {
  const apps = await db.select({ id: applications.id, travelerId: applications.travelerId }).from(applications).where(eq(applications.tripId, TRIP_ID));
  const appIds = apps.map((a) => a.id);
  const res = await db.select({ id: reservations.id }).from(reservations).where(eq(reservations.tripId, TRIP_ID));
  const resIds = res.map((r) => r.id);
  await purgeOutboxForTrips(db, [TRIP_ID], apps.map((a) => a.travelerId));
  if (resIds.length) {
    await db.delete(payments).where(inArray(payments.reservationId, resIds));
    await db.delete(reservationPriceSnapshots).where(inArray(reservationPriceSnapshots.reservationId, resIds));
  }
  if (appIds.length) {
    await db.delete(checkoutSessions).where(inArray(checkoutSessions.applicationId, appIds));
    await db.delete(applicationDecisions).where(inArray(applicationDecisions.applicationId, appIds));
    await db.delete(applicationEvents).where(inArray(applicationEvents.applicationId, appIds));
  }
  await db.delete(seatHolds).where(inArray(seatHolds.departureId, (await db.select({ id: departures.id }).from(departures).where(eq(departures.tripId, TRIP_ID))).map((d) => d.id)));
  await db.delete(reservations).where(eq(reservations.tripId, TRIP_ID));
  await db.delete(applications).where(eq(applications.tripId, TRIP_ID));
  await db.delete(departures).where(eq(departures.tripId, TRIP_ID));
  await db.delete(trips).where(eq(trips.id, TRIP_ID));
  const travelerIds = [...new Set(apps.map((a) => a.travelerId))];
  if (travelerIds.length) {
    await db.delete(emailDeliveries).where(inArray(emailDeliveries.travelerId, travelerIds));
    await db.delete(travelers).where(inArray(travelers.id, travelerIds));
  }
}

describe('Moteur de liste d’attente et tentatives de paiement (DB réelle)', () => {
  beforeAll(async () => {
    helpers = await getTestHelpers();
    await insertTestTrip(db, {
      id: TRIP_ID, status: 'published', countryCode: 'FR', defaultCurrency: 'EUR',
      durationDays: 4, durationNights: 3, groupMin: 1, groupMax: 5, difficulty: 'easy', difficultyLevel: 1,
      publishedAt: new Date(),
    });
  });

  afterAll(async () => {
    await cleanup();
    for (const id of userIds.values()) await helpers.deleteUser(id).catch(() => {});
    invalidateCache();
  });

  beforeEach(() => resetRateLimiter());

  it('complet → liste d’attente → annulation → proposition 48 h → acompte → confirmée', async () => {
    const dep = await mkDep(1);
    const a = await apply(dep, 'a1');
    expect(a.status).toBe('approved');
    const b = await apply(dep, 'b1');
    expect(b.status).toBe('waitlisted');
    expect((await db.select().from(reservations).where(eq(reservations.applicationId, b.id)))).toHaveLength(0);

    const resA = await reservationOf(a.id);
    expect(resA.status).toBe('awaiting_payment');
    await pay(resA.id);
    expect((await reservationOf(a.id)).status).toBe('confirmed');

    await cancelReservation(resA.id);
    const entry = await entryOf(b.id);
    expect(entry.status).toBe('offered');
    expect(entry.expiresAt!.getTime() - Date.now()).toBeGreaterThan(47 * HOUR);
    expect(entry.expiresAt!.getTime() - Date.now()).toBeLessThanOrEqual(48 * HOUR);
    expect((await db.select().from(applications).where(eq(applications.id, b.id)))[0]!.status).toBe('approved');
    expect(await eventsFor(b.id)).toContain('waitlist.offered');
    // une proposition n'est pas une réservation
    expect((await db.select().from(reservations).where(eq(reservations.applicationId, b.id)))).toHaveLength(0);

    const [offerCheckout] = await db.select().from(checkoutSessions)
      .where(and(eq(checkoutSessions.applicationId, b.id), eq(checkoutSessions.status, 'open')));
    const init = await initiate({ checkoutSessionId: offerCheckout!.id, travelerEmail: emailOf('b1'), roomType: 'shared', locale: 'en' }, publicCtx());
    // le hold de l'offre n'est jamais raccourci par la tentative de paiement (40 min)
    const [hold] = await activeHolds(dep);
    expect(hold!.expiresAt.getTime() - Date.now()).toBeGreaterThan(47 * HOUR);
    const [offerAfterInit] = await db.select().from(checkoutSessions).where(eq(checkoutSessions.id, offerCheckout!.id));
    expect(offerAfterInit!.expiresAt.getTime()).toBe(offerCheckout!.expiresAt.getTime());

    await pay(init.reservationId);
    expect((await db.select().from(reservations).where(eq(reservations.id, init.reservationId)))[0]!.status).toBe('confirmed');
    expect((await entryOf(b.id)).status).toBe('promoted');
    expect(await activeHolds(dep)).toHaveLength(0);
    expect((await getAvailability(dep))!.availableSeats).toBe(0);
  });

  it('proposition expirée → place proposée au candidat suivant (FIFO), idempotent', async () => {
    const dep = await mkDep(1);
    const a = await apply(dep, 'a2');
    await pay((await reservationOf(a.id)).id);
    const b = await apply(dep, 'b2');
    const c = await apply(dep, 'c2');
    await cancelReservation((await reservationOf(a.id)).id);
    expect((await entryOf(b.id)).status).toBe('offered');
    expect((await entryOf(c.id)).status).toBe('waiting');

    await db.update(waitlistEntries).set({ expiresAt: new Date(Date.now() - 1000) }).where(eq(waitlistEntries.applicationId, b.id));
    expect(await expireWaitlistOffers()).toBe(1);
    expect((await entryOf(b.id)).status).toBe('expired');
    expect((await entryOf(c.id)).status).toBe('offered');
    expect(await eventsFor(b.id)).toContain('waitlist.offer_expired');
    const holds = await activeHolds(dep);
    expect(holds).toHaveLength(1);
    expect(holds[0]!.applicationId).toBe(c.id);

    expect(await expireWaitlistOffers()).toBe(0);
    expect(await activeHolds(dep)).toHaveLength(1);
  });

  it('durée de proposition réglable par départ', async () => {
    const dep = await mkDep(1, { waitlistOfferTtlHours: 24 });
    const a = await apply(dep, 'a3');
    await pay((await reservationOf(a.id)).id);
    const b = await apply(dep, 'b3');
    await cancelReservation((await reservationOf(a.id)).id);
    const entry = await entryOf(b.id);
    expect(entry.expiresAt!.getTime() - Date.now()).toBeLessThanOrEqual(24 * HOUR);
    expect(entry.expiresAt!.getTime() - Date.now()).toBeGreaterThan(23 * HOUR);
  });

  it('plusieurs promotions concurrentes pour une seule place : une seule attribution', async () => {
    const dep = await mkDep(1);
    const a = await apply(dep, 'a4');
    await pay((await reservationOf(a.id)).id);
    const waiting = [];
    for (const tag of ['b4', 'c4', 'd4']) waiting.push(await apply(dep, tag));
    // place libérée sans déclencheur : seules les promotions concurrentes décident
    await db.update(reservations).set({ status: 'cancelled' }).where(eq(reservations.applicationId, a.id));

    const results = await Promise.all([1, 2, 3, 4].map(() => promoteWaitlist(dep)));
    expect(results.flat()).toHaveLength(1);
    const entries = await Promise.all(waiting.map((w) => entryOf(w.id)));
    expect(entries.map((e) => e.status)).toEqual(['offered', 'waiting', 'waiting']);
    expect(await activeHolds(dep)).toHaveLength(1);
  });

  it('deux annulations simultanées : deux places proposées, pas une de plus', async () => {
    const dep = await mkDep(2);
    const a = await apply(dep, 'a5');
    const a2 = await apply(dep, 'a5b');
    await pay((await reservationOf(a.id)).id);
    await pay((await reservationOf(a2.id)).id);
    const waiting = [];
    for (const tag of ['b5', 'c5', 'd5']) waiting.push(await apply(dep, tag));

    await Promise.all([
      cancelReservation((await reservationOf(a.id)).id),
      cancelReservation((await reservationOf(a2.id)).id),
    ]);
    const entries = await Promise.all(waiting.map((w) => entryOf(w.id)));
    expect(entries.map((e) => e.status)).toEqual(['offered', 'offered', 'waiting']);
    expect(await activeHolds(dep)).toHaveLength(2);
    expect((await getAvailability(dep))!.availableSeats).toBe(0);
  });

  it('deux inscriptions concurrentes pour la dernière place : un seul checkout, une liste d’attente', async () => {
    const dep = await mkDep(1);
    const [x, y] = await Promise.all([apply(dep, 'x6'), apply(dep, 'y6')]);
    expect([x.status, y.status].sort()).toEqual(['approved', 'waitlisted']);
    expect(await activeHolds(dep)).toHaveLength(1);
    const res = await db.select().from(reservations).where(eq(reservations.departureId, dep));
    expect(res).toHaveLength(1);
  });

  it('FIFO strict : une place libre revient à la liste d’attente avant une nouvelle inscription', async () => {
    const dep = await mkDep(1);
    const a = await apply(dep, 'a7');
    await pay((await reservationOf(a.id)).id);
    const b = await apply(dep, 'b7');
    await db.update(reservations).set({ status: 'cancelled' }).where(eq(reservations.applicationId, a.id));
    expect((await getAvailability(dep))!.availableSeats).toBe(1);

    const c = await apply(dep, 'c7');
    expect(c.status).toBe('waitlisted');
    // la place libre est proposée sans attendre le cron, au premier de la file (b), jamais à c
    expect((await entryOf(b.id)).status).toBe('offered');
    expect((await entryOf(c.id)).status).toBe('waiting');
    expect((await activeHolds(dep)).map((h) => h.applicationId)).toEqual([b.id]);
  });

  it('tentative de paiement abandonnée : réservation annulée, place libérée, lien rouvert ; paiement tardif remboursé', async () => {
    const dep = await mkDep(1);
    const a = await apply(dep, 'a8');
    const res = await reservationOf(a.id);
    expect(res.status).toBe('awaiting_payment');
    const [payment] = await db.select().from(payments).where(eq(payments.reservationId, res.id));
    const [oldCheckout] = await db.select().from(checkoutSessions).where(eq(checkoutSessions.reservationId, res.id));

    // Pas encore expirée : rien ne change.
    await expireStalePaymentAttempts();
    expect((await reservationOf(a.id)).status).toBe('awaiting_payment');

    await backdate(res.id, 2);
    expect(await expireStalePaymentAttempts()).toBeGreaterThanOrEqual(1);
    expect((await reservationOf(a.id)).status).toBe('cancelled');
    expect((await db.select().from(payments).where(eq(payments.id, payment!.id)))[0]!.status).toBe('failed');
    expect(await activeHolds(dep)).toHaveLength(0);
    expect((await db.select().from(checkoutSessions).where(eq(checkoutSessions.id, oldCheckout!.id)))[0]!.status).toBe('expired');
    const reopened = await db.select().from(checkoutSessions)
      .where(and(eq(checkoutSessions.applicationId, a.id), eq(checkoutSessions.status, 'open')));
    expect(reopened).toHaveLength(1);
    expect(await eventsFor(a.id)).toContain('application.approved');
    expect((await getAvailability(dep))!.availableSeats).toBe(1);

    // Rejouer le job ne change rien (idempotence).
    await expireStalePaymentAttempts();
    expect((await reservationOf(a.id)).status).toBe('cancelled');
    expect(await db.select().from(checkoutSessions).where(and(eq(checkoutSessions.applicationId, a.id), eq(checkoutSessions.status, 'open')))).toHaveLength(1);

    // Paiement reçu après l'expiration : jamais confirmé, remboursé.
    const late = await processProviderSuccess({
      outcome: 'checkout.completed',
      providerPaymentId: mockPaymentIdForSession(oldCheckout!.providerSessionId!),
      amount: payment!.amount,
      currency: payment!.currency,
      idempotencyKey: payment!.idempotencyKey,
      raw: { mock: true },
    });
    expect(late.duplicate).toBe(false);
    expect((await reservationOf(a.id)).status).toBe('refunded');
    expect((await db.select().from(payments).where(eq(payments.id, payment!.id)))[0]!.status).toBe('refunded');
    const availability = (await getAvailability(dep))!;
    expect(availability.confirmedSeats).toBe(0);
    expect(availability.availableSeats).toBe(1);
  });

  it('tentative abandonnée sur une proposition encore valide : hold conservé, nouvelle tentative possible', async () => {
    const dep = await mkDep(1);
    const a = await apply(dep, 'a9');
    await pay((await reservationOf(a.id)).id);
    const b = await apply(dep, 'b9');
    await cancelReservation((await reservationOf(a.id)).id);
    const [offerCheckout] = await db.select().from(checkoutSessions)
      .where(and(eq(checkoutSessions.applicationId, b.id), eq(checkoutSessions.status, 'open')));
    const init = await initiate({ checkoutSessionId: offerCheckout!.id, travelerEmail: emailOf('b9'), roomType: 'shared', locale: 'en' }, publicCtx());

    await backdate(init.reservationId, 2);
    await expireStalePaymentAttempts();
    expect((await db.select().from(reservations).where(eq(reservations.id, init.reservationId)))[0]!.status).toBe('cancelled');
    expect((await entryOf(b.id)).status).toBe('offered');
    expect(await activeHolds(dep)).toHaveLength(1);
    const [reopened] = await db.select().from(checkoutSessions).where(eq(checkoutSessions.id, offerCheckout!.id));
    expect(reopened!.status).toBe('open');
    expect(reopened!.reservationId).toBeNull();

    const retry = await initiate({ checkoutSessionId: offerCheckout!.id, travelerEmail: emailOf('b9'), roomType: 'shared', locale: 'en' }, publicCtx());
    await pay(retry.reservationId);
    expect((await entryOf(b.id)).status).toBe('promoted');
    expect((await db.select().from(reservations).where(eq(reservations.id, retry.reservationId)))[0]!.status).toBe('confirmed');
  });

  it('FIFO atomique : un candidat approuvé avec un lien ouvert ne peut pas prendre la place libérée devant la file', async () => {
    const dep = await mkDep(1);
    const a = await apply(dep, 'a11');
    await pay((await reservationOf(a.id)).id);
    const b = await apply(dep, 'b11');
    // c : candidature approuvée avec un lien checkout valide (créé quand une place existait)
    const [trav] = await db.select().from(applications).where(eq(applications.id, a.id));
    // un seul dossier actif par voyageuse et départ : on libère le dossier de a
    await db.update(applications).set({ status: 'withdrawn' }).where(eq(applications.id, a.id));
    const [cApp] = await db.insert(applications).values({
      travelerId: trav!.travelerId, tripId: TRIP_ID, departureId: dep, status: 'approved',
      activityAcknowledgement: true, consent: true, submittedAt: new Date(),
    }).returning({ id: applications.id });
    const [cCheckout] = await db.insert(checkoutSessions).values({
      applicationId: cApp!.id, departureId: dep, expiresAt: new Date(Date.now() + 7 * 24 * HOUR),
    }).returning({ id: checkoutSessions.id });
    // place libérée, promotion pas encore passée
    await db.update(reservations).set({ status: 'cancelled' }).where(eq(reservations.applicationId, a.id));

    await expect(
      initiate({ checkoutSessionId: cCheckout!.id, travelerEmail: emailOf('a11'), roomType: 'shared', locale: 'en' }, publicCtx()),
    ).rejects.toMatchObject({ code: expect.anything() });
    expect(await activeHolds(dep)).toHaveLength(0);
    expect((await db.select().from(reservations).where(eq(reservations.applicationId, cApp!.id)))).toHaveLength(0);

    const promoted = await promoteWaitlist(dep);
    expect(promoted.map((p) => p.applicationId)).toEqual([b.id]);
  });

  it('paiement du solde : la session provider est retrouvée par la page de retour et le callback', async () => {
    const dep = await mkDep(2);
    const a = await apply(dep, 'a12');
    const res = await reservationOf(a.id);
    await pay(res.id);
    const balance = await initiateBalancePayment({
      reservationId: res.id, travelerEmail: emailOf('a12'),
      successUrl: 'http://localhost:4321/en/booking-confirmed?session_id={CHECKOUT_SESSION_ID}',
      cancelUrl: 'http://localhost:4321/en/booking-confirmed',
    });
    const sessionId = new URL(balance.checkoutUrl, 'http://localhost').searchParams.get('session')!;
    const booking = await loadBookingByProviderSession('en', sessionId);
    expect(booking?.reservationId).toBe(res.id);
    const ctx = await loadMockCallbackContext(sessionId);
    expect(ctx?.reservationId).toBe(res.id);
    expect(ctx?.payment.amount).toBe(80000);
    await processProviderSuccess({
      outcome: 'checkout.completed', providerPaymentId: mockPaymentIdForSession(sessionId),
      amount: ctx!.payment.amount, currency: ctx!.payment.currency, idempotencyKey: ctx!.payment.idempotencyKey, raw: { mock: true },
    });
    const final = await reservationOf(a.id);
    expect(final.status).toBe('completed');
    expect(final.amountDue).toBe(0);
  });

  it('webhook de paiement reçu deux fois en parallèle : un seul paiement comptabilisé', async () => {
    const dep = await mkDep(1);
    const a = await apply(dep, 'a10');
    const res = await reservationOf(a.id);
    const [payment] = await db.select().from(payments).where(eq(payments.reservationId, res.id));
    const [checkout] = await db.select().from(checkoutSessions).where(eq(checkoutSessions.reservationId, res.id));
    const event = {
      outcome: 'checkout.completed' as const,
      providerPaymentId: mockPaymentIdForSession(checkout!.providerSessionId!),
      amount: payment!.amount,
      currency: payment!.currency,
      idempotencyKey: payment!.idempotencyKey,
      raw: { mock: true },
    };
    const results = await Promise.all([processProviderSuccess(event), processProviderSuccess(event)]);
    expect(results.filter((r) => !r.duplicate)).toHaveLength(1);
    const [final] = await db.select().from(reservations).where(eq(reservations.id, res.id));
    expect(final!.amountPaid).toBe(payment!.amount);
    expect(final!.status).toBe('confirmed');
    expect(await db.select().from(payments).where(and(eq(payments.reservationId, res.id), inArray(payments.status, ['paid'])))).toHaveLength(1);
  });
});
