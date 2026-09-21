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
import { trips } from '@database/schemas/trips.schema';
import { departures } from '@database/schemas/departures.schema';
import { travelers } from '@database/schemas/travelers.schema';
import { applications } from '@database/schemas/applications.schema';
import { reservations } from '@database/schemas/reservations.schema';
import { payments } from '@database/schemas/payments.schema';
import { outboxEvents } from '@database/schemas/outbox.schema';
import { emailDeliveries, emailEvents } from '@database/schemas/email-voyage.schema';
import { auditLog } from '@database/schemas/audit-log.schema';
import { emitOutboxEvent } from '@/modules/outbox/domain/outbox';
import { pendingOutboxCount } from '@/modules/outbox/domain/outbox-worker';
import { purgeOldOutbox } from '@/modules/outbox/domain/retention';
import { purgeExpiredCheckoutSessions } from '@/modules/payments/domain/checkout-service';
import { purgeTerminalHolds } from '@/modules/availability/domain/availability-service';
import { checkoutSessions } from '@database/schemas/payments.schema';
import { seatHolds } from '@database/schemas/departures.schema';
import { sendVoyageEmail } from '@/modules/email-voyage/domain/voyage-email';
import { logAuditEvent } from '@/lib/audit';
import { quoteForDeparture } from '@/modules/pricing/domain/pricing-service';
import { findOrCreateTraveler } from '@/modules/travelers/domain/travelers-service';
import { loadAdminReservations } from '@/modules/reservations/loaders/admin-reservations.loader';
import { loadAdminPayments } from '@/modules/payments/loaders/admin-payments.loader';
import { loadAdminTravelers } from '@/modules/travelers/loaders/admin-travelers.loader';
import { loadAdminDeliveries } from '@/modules/email-voyage/loaders/admin-email.loader';

const db = getDrizzle();
const stamp = Date.now().toString(36);
const TRIP = `test-fin-${stamp}`;
const DEP = `test-fin-dep-${stamp}`;
const stub = async () => {};

async function cleanup() {
  const trs0 = await db.select({ id: travelers.id, email: travelers.email }).from(travelers).catch(() => [] as { id: string; email: string }[]);
  await purgeOutboxForTrips(
    db,
    [TRIP],
    trs0.filter((t) => t.email.includes(stamp)).map((t) => t.id),
  ).catch(() => {});
  const res = await db.select({ id: reservations.id }).from(reservations).where(eq(reservations.tripId, TRIP)).catch(() => [] as { id: string }[]);
  for (const r of res) {
    await db.delete(payments).where(eq(payments.reservationId, r.id)).catch(() => {});
    await db.delete(emailDeliveries).where(eq(emailDeliveries.reservationId, r.id)).catch(() => {});
    await db.delete(reservations).where(eq(reservations.id, r.id)).catch(() => {});
  }
  await db.delete(outboxEvents).where(eq(outboxEvents.aggregateId, TRIP)).catch(() => {});
  await db.delete(auditLog).where(eq(auditLog.resourceId, TRIP)).catch(() => {});
  const trs = await db.select({ id: travelers.id, email: travelers.email }).from(travelers).catch(() => [] as { id: string; email: string }[]);
  for (const t of trs) {
    if (t.email.includes(stamp)) {
      await db.delete(emailDeliveries).where(eq(emailDeliveries.travelerId, t.id)).catch(() => {});
      await db.delete(travelers).where(eq(travelers.id, t.id)).catch(() => {});
    }
  }
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
  await db.insert(departures).values({
    id: DEP, tripId: TRIP,
    startDate: new Date('2027-06-01T08:00:00.000Z'), endDate: new Date('2027-06-04T18:00:00.000Z'),
    status: 'open', capacityMin: 1, capacityMax: 5, priceAmount: 100000, currency: 'EUR',
    pricingRules: { earlyBirdPercent: 10 },
  });
});

afterAll(cleanup);

describe('outbox emit — défauts et planification', () => {
  it('payload {} par défaut, availableAt futur exclu du compte', async () => {
    const id = await emitOutboxEvent({ eventType: 'test.def', aggregateType: 'test', aggregateId: TRIP });
    const [row] = await db.select().from(outboxEvents).where(eq(outboxEvents.id, id)).limit(1);
    expect(row.payload).toEqual({});
    const before = await pendingOutboxCount(new Date());
    await emitOutboxEvent({
      eventType: 'test.future', aggregateType: 'test', aggregateId: TRIP,
      availableAt: new Date(Date.now() + 3600_000),
    });
    expect(await pendingOutboxCount(new Date())).toBe(before);
    // processing et dead_letter exclus du compte pending
    await db.update(outboxEvents).set({ status: 'processing' }).where(eq(outboxEvents.id, id));
    expect(await pendingOutboxCount(new Date())).toBe(before - 1);
    await db.update(outboxEvents).set({ status: 'dead_letter', processedAt: new Date() }).where(eq(outboxEvents.id, id));
    expect(await pendingOutboxCount(new Date())).toBe(before - 1);
    await db.delete(outboxEvents).where(eq(outboxEvents.aggregateId, TRIP));
  });
});

describe('voyage-email — états et tronquage', () => {
  it('sent + sentAt + événement sent', async () => {
    const [t] = await db.insert(travelers).values({ email: `fin-${stamp}@test.com`, locale: 'en' }).returning({ id: travelers.id });
    const res = await sendVoyageEmail({ template: 'application_received', locale: 'en', toEmail: `fin-${stamp}@test.com`, travelerId: t.id }, stub);
    expect(res.sent).toBe(true);
    const [row] = await db.select().from(emailDeliveries).where(eq(emailDeliveries.id, res.deliveryId)).limit(1);
    expect(row.status).toBe('sent');
    expect(row.sentAt).not.toBeNull();
    const events = await db.select().from(emailEvents).where(eq(emailEvents.deliveryId, res.deliveryId));
    expect(events.some((e) => e.event === 'sent')).toBe(true);
  });

  it('lastError tronquée à 500 caractères', async () => {
    const big = async () => { throw new Error('x'.repeat(600)); };
    const res = await sendVoyageEmail({ template: 'application_received', locale: 'en', toEmail: `fin2-${stamp}@test.com` }, big);
    expect(res.sent).toBe(false);
    const [row] = await db.select().from(emailDeliveries).where(eq(emailDeliveries.id, res.deliveryId)).limit(1);
    expect(row.lastError?.length).toBe(500);
  });
});

describe('audit — tronquage métadonnées', () => {
  it('>10Ko -> {_truncated, _originalSize}', async () => {
    await logAuditEvent({
      userId: null, action: 'TRIP_UPDATE', resource: 'trips', resourceId: TRIP,
      metadata: { action: 'x', blob: 'y'.repeat(11 * 1024) },
    });
    const [row] = await db.select().from(auditLog).where(eq(auditLog.resourceId, TRIP)).limit(1);
    expect(row).toBeDefined();
    const meta = row.metadata as Record<string, unknown>;
    expect(meta._truncated).toBe(true);
    expect(meta._originalSize as number).toBeGreaterThan(10 * 1024);
    await db.delete(auditLog).where(eq(auditLog.resourceId, TRIP));
  });
});

describe('pricing-rules DB + travelers champs', () => {
  it('earlyBirdPercent du départ appliqué au devis', async () => {
    const q = await quoteForDeparture(DEP, 'shared');
    expect(q?.discountAmount).toBe(10000);
  });

  it('findOrCreateTraveler stocke les champs', async () => {
    const { traveler, created } = await findOrCreateTraveler({
      email: `fields-${stamp}@test.com`, legalName: 'Nom', phone: '+331', locale: 'fr', userId: null,
    });
    expect(created).toBe(true);
    expect(traveler.legalName).toBe('Nom');
    expect(traveler.phone).toBe('+331');
    expect(traveler.locale).toBe('fr');
    expect(traveler.userId).toBeNull();
  });
});

describe('admin loaders — champs et compteurs', () => {
  it('montants, provider, vérification, tentatives, total', async () => {
    const [t] = await db.insert(travelers).values({ email: `adm-${stamp}@test.com`, locale: 'en', emailVerifiedAt: new Date() }).returning({ id: travelers.id });
    const [r] = await db.insert(reservations).values({
      reservationNumber: `ATL-2027-F${stamp.slice(-4).toUpperCase()}`,
      travelerId: t.id, tripId: TRIP, departureId: DEP, status: 'awaiting_payment',
      currency: 'EUR', baseAmount: 100000, totalAmount: 100000, amountPaid: 0, amountDue: 100000,
    }).returning({ id: reservations.id });
    const [p] = await db.insert(payments).values({
      reservationId: r.id, provider: 'mock', type: 'full_payment', status: 'created',
      amount: 100000, currency: 'EUR', idempotencyKey: `fin-${stamp}`, providerPaymentId: `mock_pi_fin_${stamp}`,
      paidAt: null,
    }).returning({ id: payments.id });
    const [d] = await db.insert(emailDeliveries).values({
      templateKey: 'application_received', locale: 'en', toEmail: `adm-${stamp}@test.com`,
      travelerId: t.id, status: 'sent', attempts: 2, lastError: null, sentAt: new Date(),
    }).returning({ id: emailDeliveries.id });

    const res = await loadAdminReservations({ tripId: TRIP });
    expect(res.meta.total).toBeGreaterThanOrEqual(1);
    const pay = await loadAdminPayments({});
    const foundPay = pay.rows.find((x) => x.id === p.id)!;
    expect(foundPay.reservationNumber).toBe(`ATL-2027-F${stamp.slice(-4).toUpperCase()}`);
    expect(foundPay.provider).toBe('mock');
    expect(foundPay.amount).toBe(100000);
    expect(foundPay.paidAt).toBeNull();
    const trav = await loadAdminTravelers({ search: `adm-${stamp}@test.com` });
    expect(trav.rows[0].emailVerifiedAt).not.toBeNull();
    const mails = await loadAdminDeliveries({ status: 'sent' });
    const foundMail = mails.rows.find((x) => x.id === d.id)!;
    expect(foundMail.attempts).toBe(2);
    expect(foundMail.lastError).toBeNull();
    expect(foundMail.sentAt).not.toBeNull();
    expect(foundMail.locale).toBe('en');
    expect(mails.meta.total).toBeGreaterThanOrEqual(1);
  });
});

describe('rétention — purge vieux terminés, jamais le frais', () => {
  it('outbox done/dead_letter > 90j purgés, pending et récents gardés', async () => {
    const old = new Date('2020-01-01T00:00:00.000Z');
    const [d1] = await db.insert(outboxEvents).values({
      eventType: 'test.old', aggregateType: 'test', aggregateId: TRIP, payload: {},
      status: 'done', createdAt: old, processedAt: old,
    }).returning({ id: outboxEvents.id });
    const [d2] = await db.insert(outboxEvents).values({
      eventType: 'test.old', aggregateType: 'test', aggregateId: TRIP, status: 'dead_letter',
      createdAt: old, processedAt: old, payload: {},
    }).returning({ id: outboxEvents.id });
    const fresh = await emitOutboxEvent({ eventType: 'test.fresh', aggregateType: 'test', aggregateId: TRIP });
    expect(await purgeOldOutbox(90, new Date())).toBeGreaterThanOrEqual(2);
    expect(await db.select().from(outboxEvents).where(eq(outboxEvents.id, d1.id))).toHaveLength(0);
    expect(await db.select().from(outboxEvents).where(eq(outboxEvents.id, d2.id))).toHaveLength(0);
    expect(await db.select().from(outboxEvents).where(eq(outboxEvents.id, fresh))).toHaveLength(1);
    await db.delete(outboxEvents).where(eq(outboxEvents.id, fresh));
  });

  it('sessions expirées/annulées vieilles purgées, open/completed gardées', async () => {
    const old = new Date('2020-01-01T00:00:00.000Z');
    const [t] = await db.insert(travelers).values({ email: `ret-${stamp}@test.com`, locale: 'en' }).returning({ id: travelers.id });
    const [a] = await db.insert(applications).values({
      travelerId: t.id, tripId: TRIP, departureId: DEP, status: 'approved',
      activityAcknowledgement: true, consent: true, submittedAt: new Date(),
    }).returning({ id: applications.id });
    const mk = async (status: 'expired' | 'cancelled' | 'completed' | 'open') => {
      const [s] = await db.insert(checkoutSessions).values({
        applicationId: a.id, departureId: DEP, status, expiresAt: old, createdAt: old,
      }).returning({ id: checkoutSessions.id });
      return s.id;
    };
    const expired = await mk('expired');
    const cancelled = await mk('cancelled');
    const completed = await mk('completed');
    const open = await mk('open');
    expect(await purgeExpiredCheckoutSessions(30, new Date())).toBeGreaterThanOrEqual(2);
    expect(await db.select().from(checkoutSessions).where(eq(checkoutSessions.id, expired))).toHaveLength(0);
    expect(await db.select().from(checkoutSessions).where(eq(checkoutSessions.id, cancelled))).toHaveLength(0);
    expect(await db.select().from(checkoutSessions).where(eq(checkoutSessions.id, completed))).toHaveLength(1);
    expect(await db.select().from(checkoutSessions).where(eq(checkoutSessions.id, open))).toHaveLength(1);
    await db.delete(checkoutSessions).where(eq(checkoutSessions.applicationId, a.id));
    await db.delete(applications).where(eq(applications.id, a.id));
    await db.delete(travelers).where(eq(travelers.id, t.id));
  });

  it('holds terminaux vieux purgés, actifs gardés', async () => {
    const old = new Date('2020-01-01T00:00:00.000Z');
    const [h1] = await db.insert(seatHolds).values({
      departureId: DEP, quantity: 1, status: 'released', expiresAt: old, createdAt: old, releasedAt: old,
    }).returning({ id: seatHolds.id });
    const [h2] = await db.insert(seatHolds).values({
      departureId: DEP, quantity: 1, status: 'active',
      expiresAt: new Date(Date.now() + 30 * 60_000), createdAt: new Date(),
    }).returning({ id: seatHolds.id });
    expect(await purgeTerminalHolds(30, new Date())).toBeGreaterThanOrEqual(1);
    expect(await db.select().from(seatHolds).where(eq(seatHolds.id, h1.id))).toHaveLength(0);
    expect(await db.select().from(seatHolds).where(eq(seatHolds.id, h2.id))).toHaveLength(1);
    await db.delete(seatHolds).where(eq(seatHolds.id, h2.id));
  });
});
