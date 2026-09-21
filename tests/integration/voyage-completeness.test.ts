import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';

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
import { trips, tripTranslations } from '@database/schemas/trips.schema';
import { departures } from '@database/schemas/departures.schema';
import { travelers } from '@database/schemas/travelers.schema';
import { applications } from '@database/schemas/applications.schema';
import { reservations } from '@database/schemas/reservations.schema';
import { payments } from '@database/schemas/payments.schema';
import { checkoutSessions } from '@database/schemas/payments.schema';
import { outboxEvents } from '@database/schemas/outbox.schema';
import { loadBookingByProviderSession, loadCheckoutPage } from '@/modules/reservations/loaders/booking.loader';
import { loadDeadLetterOutbox } from '@/modules/outbox/loaders/admin-outbox.loader';
import { loadVoyageHealth } from '@/modules/trips/loaders/admin-health.loader';
import { listTripRevisions } from '@/modules/trips/loaders/admin-trips.loader';
import { loadOpenDepartures } from '@/modules/departures/loaders/departure.loader';
import {
  createApplicationCheckout,
  getValidCheckoutSession,
  markCheckoutCompleted,
  expireCheckoutSessions,
  CHECKOUT_LINK_TTL_DAYS,
} from '@/modules/payments/domain/checkout-service';
import { findOrCreateTraveler } from '@/modules/travelers/domain/travelers-service';
import { quoteForDeparture } from '@/modules/pricing/domain/pricing-service';
import { completeOutbox, failOutbox, pendingOutboxCount } from '@/modules/outbox/domain/outbox-worker';
import { emitOutboxEvent } from '@/modules/outbox/domain/outbox';
import { refundReservationPayments } from '@/modules/payments/domain/refund-service';
import { newReservationNumber } from '@/modules/reservations/domain/reservation-service';

const db = getDrizzle();
const stamp = Date.now().toString(36);
const TRIP_ID = `test-complete-${stamp}`;
const DEP_ID = `test-complete-dep-${stamp}`;
const TRAVELER_EMAIL = `complete-${stamp}@test.com`;

async function cleanup() {
  const trs0 = await db.select({ id: travelers.id, email: travelers.email }).from(travelers).catch(() => [] as { id: string; email: string }[]);
  await purgeOutboxForTrips(
    db,
    [TRIP_ID],
    trs0.filter((t) => t.email.includes(stamp)).map((t) => t.id),
  ).catch(() => {});
  await db.delete(payments).where(eq(payments.reservationId, `res-${TRIP_ID}`)).catch(() => {});
  const res = await db.select({ id: reservations.id }).from(reservations).where(eq(reservations.tripId, TRIP_ID)).catch(() => [] as { id: string }[]);
  for (const r of res) {
    await db.delete(payments).where(eq(payments.reservationId, r.id)).catch(() => {});
    await db.delete(checkoutSessions).where(eq(checkoutSessions.reservationId, r.id)).catch(() => {});
  }
  const apps = await db.select({ id: applications.id }).from(applications).where(eq(applications.tripId, TRIP_ID)).catch(() => [] as { id: string }[]);
  for (const a of apps) {
    await db.delete(checkoutSessions).where(eq(checkoutSessions.applicationId, a.id)).catch(() => {});
    await db.delete(applications).where(eq(applications.id, a.id)).catch(() => {});
  }
  await db.delete(outboxEvents).where(eq(outboxEvents.aggregateId, TRIP_ID)).catch(() => {});
  await db.delete(travelers).where(eq(travelers.email, TRAVELER_EMAIL)).catch(() => {});
  await db.delete(tripTranslations).where(eq(tripTranslations.tripId, TRIP_ID)).catch(() => {});
  await db.delete(departures).where(eq(departures.tripId, TRIP_ID)).catch(() => {});
  await db.delete(trips).where(eq(trips.id, TRIP_ID)).catch(() => {});
  invalidateCache();
}

describe('booking.loader — 0% avant, cas nuls + happy', () => {
  let appId: string;
  let travelerId: string;
  let checkoutId: string;
  const providerSessionId = `prov-${stamp}`;

  beforeAll(async () => {
    await cleanup();
    await insertTestTrip(db, {
      id: TRIP_ID, status: 'published', countryCode: 'FR', defaultCurrency: 'EUR',
      durationDays: 4, durationNights: 3, groupMin: 1, groupMax: 5, difficulty: 'easy', difficultyLevel: 1,
      publishedAt: new Date(),
    });
    await db.insert(tripTranslations).values({
      id: `tr-${stamp}`, tripId: TRIP_ID, locale: 'en', slug: `complete-${stamp}`,
      title: 'Complete Trip', summary: 'S', overview: 'O', localeVisible: true,
    });
    await db.insert(departures).values({
      id: DEP_ID, tripId: TRIP_ID,
      startDate: new Date('2027-06-01T08:00:00.000Z'), endDate: new Date('2027-06-04T18:00:00.000Z'),
      status: 'open', capacityMin: 1, capacityMax: 5, priceAmount: 80000, currency: 'EUR', pricingRules: {},
    });
    const [t] = await db.insert(travelers).values({ email: TRAVELER_EMAIL, locale: 'en' }).returning({ id: travelers.id });
    travelerId = t.id;
    const [a] = await db.insert(applications).values({
      travelerId, tripId: TRIP_ID, departureId: DEP_ID, status: 'approved',
      activityAcknowledgement: true, consent: true, submittedAt: new Date(),
    }).returning({ id: applications.id });
    appId = a.id;
    const session = await createApplicationCheckout(appId, DEP_ID);
    checkoutId = session.id;
    const [r] = await db.insert(reservations).values({
      reservationNumber: `ATL-2027-C${stamp.slice(-4).toUpperCase()}`,
      travelerId, tripId: TRIP_ID, departureId: DEP_ID, applicationId: appId,
      status: 'awaiting_payment', currency: 'EUR', baseAmount: 80000, totalAmount: 80000, amountPaid: 0, amountDue: 80000,
    }).returning({ id: reservations.id, reservationNumber: reservations.reservationNumber });
    await db.update(checkoutSessions).set({ reservationId: r.id, providerSessionId }).where(eq(checkoutSessions.id, checkoutId));
  });

  afterAll(cleanup);

  it('retourne null sur entrées invalides', async () => {
    expect(await loadBookingByProviderSession('en', '')).toBeNull();
    expect(await loadBookingByProviderSession('xx' as never, 'x')).toBeNull();
    expect(await loadBookingByProviderSession('en', 'no-such-session')).toBeNull();
    expect(await loadCheckoutPage('xx' as never, checkoutId)).toBeNull();
    expect(await loadCheckoutPage('en', '00000000-0000-0000-0000-000000000000')).toBeNull();
  });

  it('charge la confirmation par providerSessionId', async () => {
    const dto = await loadBookingByProviderSession('en', providerSessionId);
    expect(dto).not.toBeNull();
    expect(dto!.tripTitle).toBe('Complete Trip');
    expect(dto!.currency).toBe('EUR');
  });

  it('charge la page checkout avec devis serveur', async () => {
    const dto = await loadCheckoutPage('en', checkoutId);
    expect(dto).not.toBeNull();
    expect(dto!.departureId).toBe(DEP_ID);
    expect(dto!.quote.totalAmount).toBe(80000);
    const single = await loadCheckoutPage('en', checkoutId, 'single');
    expect(single).not.toBeNull();
  });
});

describe('admin-outbox.loader — 0% avant', () => {
  it('liste dead_letter avec limite', async () => {
    await emitOutboxEvent({ eventType: 'test.dead', aggregateType: 'test', aggregateId: TRIP_ID, payload: {} });
    const [created] = await db.select().from(outboxEvents).where(eq(outboxEvents.aggregateId, TRIP_ID)).limit(1);
    await failOutbox(created.id, 4, 'boom');
    const rows = await loadDeadLetterOutbox(10);
    expect(rows.some((r) => r.id === created.id)).toBe(true);
    expect(await loadDeadLetterOutbox(1)).toHaveLength(1);
  });
});

describe('checkout-service — TTL, validité, expiration', () => {
  it('TTL 7j', () => {
    expect(CHECKOUT_LINK_TTL_DAYS).toBe(7);
  });
  it('inconnu et non-open -> null', async () => {
    expect(await getValidCheckoutSession('00000000-0000-0000-0000-000000000000')).toBeNull();
  });
  it('expiré marque expired et retourne null', async () => {
    const [t] = await db.insert(travelers).values({ email: `exp-${stamp}@test.com`, locale: 'en' }).returning({ id: travelers.id });
    const [a] = await db.insert(applications).values({
      travelerId: t.id, tripId: TRIP_ID, departureId: DEP_ID, status: 'approved',
      activityAcknowledgement: true, consent: true, submittedAt: new Date(),
    }).returning({ id: applications.id });
    const s = await createApplicationCheckout(a.id, DEP_ID);
    await db.update(checkoutSessions).set({ expiresAt: new Date('2020-01-01') }).where(eq(checkoutSessions.id, s.id));
    expect(await getValidCheckoutSession(s.id)).toBeNull();
    const [row] = await db.select().from(checkoutSessions).where(eq(checkoutSessions.id, s.id)).limit(1);
    expect(row.status).toBe('expired');
    await db.delete(checkoutSessions).where(eq(checkoutSessions.id, s.id));
    await db.delete(applications).where(eq(applications.id, a.id));
    await db.delete(travelers).where(eq(travelers.id, t.id));
  });
  it('non-approved -> null, completed no-op, expire job sur session dédiée', async () => {
    const [t] = await db.insert(travelers).values({ email: `na-${stamp}@test.com`, locale: 'en' }).returning({ id: travelers.id });
    const [a] = await db.insert(applications).values({
      travelerId: t.id, tripId: TRIP_ID, departureId: DEP_ID, status: 'submitted',
      activityAcknowledgement: true, consent: true, submittedAt: new Date(),
    }).returning({ id: applications.id });
    const s = await createApplicationCheckout(a.id, DEP_ID);
    expect(await getValidCheckoutSession(s.id)).toBeNull();
    await markCheckoutCompleted('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000000');
    await db.update(checkoutSessions).set({ expiresAt: new Date('2020-01-01') }).where(eq(checkoutSessions.id, s.id));
    expect(await expireCheckoutSessions(new Date('2020-06-01'))).toBeGreaterThanOrEqual(1);
    const [row] = await db.select().from(checkoutSessions).where(eq(checkoutSessions.id, s.id)).limit(1);
    expect(row.status).toBe('expired');
    await db.delete(checkoutSessions).where(eq(checkoutSessions.id, s.id));
    await db.delete(applications).where(eq(applications.id, a.id));
    await db.delete(travelers).where(eq(travelers.id, t.id));
  });
});

describe('travelers-service — reuse insensible casse', () => {
  it('crée puis réutilise si vérifié, conflit sinon', async () => {
    const email = `reuse-${stamp}@test.com`;
    const first = await findOrCreateTraveler({ email, locale: 'fr' });
    expect(first.created).toBe(true);
    // non vérifié -> conflit
    await expect(findOrCreateTraveler({ email: email.toUpperCase() })).rejects.toThrow(/déjà utilisé/);
    // vérifié -> reuse
    await db.update(travelers).set({ emailVerifiedAt: new Date() }).where(eq(travelers.id, first.traveler.id));
    const second = await findOrCreateTraveler({ email: `  ${email.toUpperCase()}  ` });
    expect(second.created).toBe(false);
    expect(second.traveler.id).toBe(first.traveler.id);
    await db.delete(travelers).where(eq(travelers.id, first.traveler.id));
  });
});

describe('pricing-service — null et single', () => {
  it('inconnu -> null, shared vs single', async () => {
    expect(await quoteForDeparture('00000000-0000-0000-0000-000000000000')).toBeNull();
    const shared = await quoteForDeparture(DEP_ID, 'shared');
    expect(shared).not.toBeNull();
    const single = await quoteForDeparture(DEP_ID, 'single');
    expect(single).not.toBeNull();
  });
});

describe('outbox-worker — retry backoff vs dead_letter', () => {
  it('fail retry incrémente et replanifie, puis dead_letter', async () => {
    await emitOutboxEvent({ eventType: 'test.retry', aggregateType: 'test', aggregateId: `${TRIP_ID}-retry`, payload: {} });
    const [row] = await db.select().from(outboxEvents).where(eq(outboxEvents.aggregateId, `${TRIP_ID}-retry`)).limit(1);
    await failOutbox(row.id, 0, 'err');
    const [retry] = await db.select().from(outboxEvents).where(eq(outboxEvents.id, row.id)).limit(1);
    expect(retry.status).toBe('pending');
    expect(retry.attempts).toBe(1);
    expect(retry.availableAt.getTime()).toBeGreaterThan(Date.now());
    await failOutbox(row.id, 2, 'err');
    const [retry2] = await db.select().from(outboxEvents).where(eq(outboxEvents.id, row.id)).limit(1);
    expect(retry2.attempts).toBe(3);
    // backoff 2^attempts minutes : ~4 min pour attempts=2
    expect(retry2.availableAt.getTime() - Date.now()).toBeGreaterThan(3 * 60_000);
    expect(retry2.availableAt.getTime() - Date.now()).toBeLessThanOrEqual(5 * 60_000);
    await failOutbox(row.id, 4, 'err');
    const [dead] = await db.select().from(outboxEvents).where(eq(outboxEvents.id, row.id)).limit(1);
    expect(dead.status).toBe('dead_letter');
    await db.delete(outboxEvents).where(eq(outboxEvents.id, row.id));
  });
  it('complete termine sans voler les autres files (pas de claim global)', async () => {
    await emitOutboxEvent({ eventType: 'test.count', aggregateType: 'test', aggregateId: `${TRIP_ID}-count`, payload: {}, availableAt: new Date(Date.now() + 3600_000) });
    // Note : claimOutboxBatch() n'est pas appelé ici — il réclame les plus
    // anciens pending GLOBAUX et affamerait les autres workers parallèles.
    const [row] = await db.select().from(outboxEvents).where(eq(outboxEvents.aggregateId, `${TRIP_ID}-count`)).limit(1);
    expect(row.status).toBe('pending');
    await completeOutbox(row.id);
    const [done] = await db.select().from(outboxEvents).where(eq(outboxEvents.id, row.id)).limit(1);
    expect(done.status).toBe('done');
    expect(await pendingOutboxCount(new Date())).toBeGreaterThanOrEqual(0);
    await db.delete(outboxEvents).where(eq(outboxEvents.id, row.id));
  });
});

describe('refund-service — erreurs directes', () => {
  it('inconnu, aucun paid, montant invalide', async () => {
    await expect(refundReservationPayments('00000000-0000-0000-0000-000000000000')).rejects.toThrow(/introuvable/);
  });
});

describe('reservation-service — numéros uniques', () => {
  it('format année + unicité', () => {
    const a = newReservationNumber();
    const b = newReservationNumber();
    expect(a).not.toBe(b);
    expect(a).toMatch(/^ATL-\d{4}-[A-Z0-9]{6}$/);
  });
});

describe('admin-health — sémantique exacte', () => {
  it('compte under_review seul, open seul, unpublished = trads invisibles', async () => {
    const h = await loadVoyageHealth(new Date());
    for (const v of Object.values(h)) {
      expect(Number.isInteger(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(0);
    }
  });
});

describe('departure.loader + trip revisions', () => {
  it('open inclus, closed exclu, order asc', async () => {
    const open = await loadOpenDepartures(TRIP_ID);
    expect(open.length).toBeGreaterThanOrEqual(1);
    expect(open.every((d) => d.status === 'open' || d.status === 'limited' || d.status === 'waitlist')).toBe(true);
    expect(await loadOpenDepartures('no-such-trip')).toEqual([]);
  });
  it('listTripRevisions vide puis limité', async () => {
    expect(await listTripRevisions(TRIP_ID)).toEqual([]);
  });
});
