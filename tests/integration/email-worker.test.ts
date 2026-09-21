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
import { trips, tripTranslations } from '@database/schemas/trips.schema';
import { departures } from '@database/schemas/departures.schema';
import { travelers } from '@database/schemas/travelers.schema';
import { applications } from '@database/schemas/applications.schema';
import { reservations } from '@database/schemas/reservations.schema';
import { emailDeliveries, emailEvents } from '@database/schemas/email-voyage.schema';
import { outboxEvents } from '@database/schemas/outbox.schema';
import { emitOutboxEvent } from '@/modules/outbox/domain/outbox';
import { processEmailOutboxBatch } from '@/modules/email-voyage/domain/voyage-email-worker';
import { sendBalanceReminders, sendTripReminders } from '@/modules/email-voyage/domain/reminders';
import { sendVoyageEmail } from '@/modules/email-voyage/domain/voyage-email';
import { claimOutboxBatch, completeOutbox, failOutbox, pendingOutboxCount } from '@/modules/outbox/domain/outbox-worker';
import { requeueOutboxEvent } from '@/actions/voyage/outbox';

const db = getDrizzle();
const stamp = Date.now().toString(36);
const TRIP_ID = `test-mail-trip-${stamp}`;
const DEP_ID = `test-mail-dep-${stamp}`;

const sent: { to: string; subject: string }[] = [];
const stubSender = async (payload: { to: string; subject: string; html: string; text: string }) => {
  sent.push({ to: payload.to, subject: payload.subject });
};

async function cleanup() {
  const apps = await db.select({ id: applications.id, travelerId: applications.travelerId }).from(applications).where(eq(applications.tripId, TRIP_ID));
  const travelerIds = [...new Set(apps.map((a) => a.travelerId))];
  const res = await db.select({ id: reservations.id }).from(reservations).where(eq(reservations.tripId, TRIP_ID));
  for (const r of res) {
    const dels = await db.select({ id: emailDeliveries.id }).from(emailDeliveries).where(eq(emailDeliveries.reservationId, r.id));
    for (const d of dels) {
      await db.delete(emailEvents).where(eq(emailEvents.deliveryId, d.id));
      await db.delete(emailDeliveries).where(eq(emailDeliveries.id, d.id));
    }
    await db.delete(outboxEvents).where(eq(outboxEvents.aggregateId, r.id));
    await db.delete(reservations).where(eq(reservations.id, r.id));
  }
  for (const a of apps) {
    await db.delete(outboxEvents).where(eq(outboxEvents.aggregateId, a.id));
    await db.delete(applications).where(eq(applications.id, a.id));
  }
  for (const tid of travelerIds) {
    const dels = await db.select({ id: emailDeliveries.id }).from(emailDeliveries).where(eq(emailDeliveries.travelerId, tid));
    for (const d of dels) {
      await db.delete(emailEvents).where(eq(emailEvents.deliveryId, d.id));
      await db.delete(emailDeliveries).where(eq(emailDeliveries.id, d.id));
    }
    await db.delete(travelers).where(eq(travelers.id, tid));
  }
  await db.delete(tripTranslations).where(eq(tripTranslations.tripId, TRIP_ID));
  await db.delete(departures).where(eq(departures.tripId, TRIP_ID));
  await db.delete(trips).where(eq(trips.id, TRIP_ID));
  invalidateCache();
}

describe('Email worker — outbox → deliveries (real DB, stubbed SMTP)', () => {
  let travelerId: string;
  let applicationId: string;
  let reservationId: string;

  beforeAll(async () => {
    await cleanup();
    sent.length = 0;
    await insertTestTrip(db, {
      id: TRIP_ID, status: 'published', countryCode: 'FR', defaultCurrency: 'EUR',
      durationDays: 4, durationNights: 3, groupMin: 1, groupMax: 5, difficulty: 'easy', difficultyLevel: 1,
      publishedAt: new Date(),
    });
    await db.insert(tripTranslations).values({
      id: `test-mail-tr-${stamp}`, tripId: TRIP_ID, locale: 'fr', slug: `mail-${stamp}`,
      title: 'Voyage mail', summary: 'Résumé', overview: 'Aperçu', localeVisible: true,
    });
    await db.insert(departures).values({
      id: DEP_ID, tripId: TRIP_ID,
      startDate: new Date(Date.now() + 30 * 86_400_000), endDate: new Date(Date.now() + 33 * 86_400_000),
      status: 'open', capacityMin: 1, capacityMax: 5, priceAmount: 100000, currency: 'EUR', pricingRules: {},
    });
    const [traveler] = await db.insert(travelers).values({ email: `mail-${stamp}@test.com`, legalName: 'Mail User', locale: 'fr' }).returning({ id: travelers.id });
    travelerId = traveler.id;
    const [app] = await db.insert(applications).values({
      travelerId, tripId: TRIP_ID, departureId: DEP_ID, status: 'approved',
      activityAcknowledgement: true, consent: true, submittedAt: new Date(),
    }).returning({ id: applications.id });
    applicationId = app.id;
    const [reservation] = await db.insert(reservations).values({
      reservationNumber: `ATL-2027-${stamp.slice(-6).toUpperCase()}`,
      travelerId, tripId: TRIP_ID, departureId: DEP_ID, applicationId,
      status: 'confirmed', currency: 'EUR', baseAmount: 100000, totalAmount: 100000,
      amountPaid: 20000, amountDue: 80000,
      balanceDueDate: new Date(Date.now() + 3 * 86_400_000),
      confirmedAt: new Date(),
    }).returning({ id: reservations.id });
    reservationId = reservation.id;
  });

  afterAll(cleanup);

  it('sends application emails from outbox events', async () => {
    const id = await emitOutboxEvent({ eventType: 'application.submitted', aggregateType: 'application', aggregateId: applicationId, payload: { applicationId } });
    // Workers parallèles partagent outbox : drainer jusqu'à NOTRE événement
    // (limit 25 par batch, les pending voisins passent aussi — sans effet ici).
    for (let i = 0; i < 20; i++) {
      const res = await processEmailOutboxBatch(25, stubSender);
      expect(res.failed).toBe(0);
      const [row] = await db.select().from(outboxEvents).where(eq(outboxEvents.id, id)).limit(1);
      if (row?.status === 'done') break;
      if (i === 19) expect.unreachable('outbox event never processed');
    }
    expect(sent.some((s) => s.to === `mail-${stamp}@test.com`)).toBe(true);
    const deliveries = await db.select().from(emailDeliveries).where(eq(emailDeliveries.travelerId, travelerId));
    expect(deliveries.some((d) => d.status === 'sent')).toBe(true);
  });

  it('skips unknown events (marked done, no email)', async () => {
    const countFor = async () =>
      (await db.select({ id: emailDeliveries.id }).from(emailDeliveries).where(eq(emailDeliveries.reservationId, reservationId))).length;
    const before = await countFor();
    const id = await emitOutboxEvent({ eventType: 'reservation.cancelled', aggregateType: 'reservation', aggregateId: reservationId, payload: { reservationId } });
    for (let i = 0; i < 20; i++) {
      await processEmailOutboxBatch(25, stubSender);
      const [row] = await db.select().from(outboxEvents).where(eq(outboxEvents.id, id)).limit(1);
      if (row?.status === 'done') break;
      if (i === 19) expect.unreachable('outbox event never processed');
    }
    expect(await countFor()).toBe(before);
    await db.delete(outboxEvents).where(eq(outboxEvents.aggregateId, reservationId));
  });

  it('sends balance reminders once (dedupe)', async () => {
    const first = await sendBalanceReminders(new Date(), stubSender);
    expect(first).toBeGreaterThanOrEqual(1);
    const second = await sendBalanceReminders(new Date(), stubSender);
    expect(second).toBe(0);
  });

  it('sends pre-trip and post-trip reminders once', async () => {
    const [traveler] = await db.insert(travelers).values({ email: `rem-${stamp}@test.com`, locale: 'en' }).returning({ id: travelers.id });
    const [preDep] = await db.insert(departures).values({
      tripId: TRIP_ID,
      startDate: new Date(Date.now() + 10 * 86_400_000), endDate: new Date(Date.now() + 13 * 86_400_000),
      status: 'open', capacityMin: 1, capacityMax: 5, priceAmount: 1000, currency: 'EUR', pricingRules: {},
    }).returning({ id: departures.id });
    const [postDep] = await db.insert(departures).values({
      tripId: TRIP_ID,
      startDate: new Date(Date.now() - 8 * 86_400_000), endDate: new Date(Date.now() - 5 * 86_400_000),
      status: 'completed', capacityMin: 1, capacityMax: 5, priceAmount: 1000, currency: 'EUR', pricingRules: {},
    }).returning({ id: departures.id });
    const mkRes = async (depId: string) => {
      const [r] = await db.insert(reservations).values({
        reservationNumber: `ATL-2027-RM${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
        travelerId: traveler.id, tripId: TRIP_ID, departureId: depId,
        status: 'confirmed', currency: 'EUR', baseAmount: 1000, totalAmount: 1000,
        amountPaid: 1000, amountDue: 0, confirmedAt: new Date(),
      }).returning({ id: reservations.id });
      return r.id;
    };
    const preResId = await mkRes(preDep.id);
    const postResId = await mkRes(postDep.id);
    const kinds = async (id: string) =>
      (await db.select().from(emailDeliveries).where(eq(emailDeliveries.reservationId, id))).map((r) => r.templateKey);
    await sendTripReminders(new Date(), stubSender);
    // états lignes (idempotents) : un worker voisin peut envoyer en premier,
    // la déduplication interdit tout doublon — les compteurs globaux, eux, fluctuent.
    expect(await kinds(preResId)).toContain('pre_trip_reminder');
    expect(await kinds(postResId)).toContain('post_trip_followup');
    const beforePre = (await kinds(preResId)).length;
    const beforePost = (await kinds(postResId)).length;
    await sendTripReminders(new Date(), stubSender);
    expect((await kinds(preResId)).length).toBe(beforePre);
    expect((await kinds(postResId)).length).toBe(beforePost);
    await db.delete(reservations).where(eq(reservations.id, preResId));
    await db.delete(reservations).where(eq(reservations.id, postResId));
    await db.delete(departures).where(eq(departures.id, preDep.id));
    await db.delete(departures).where(eq(departures.id, postDep.id));
    await db.delete(travelers).where(eq(travelers.id, traveler.id));
  });

  it('records failed deliveries with events', async () => {
    const boom = async () => {
      throw new Error('smtp down');
    };
    const res = await sendVoyageEmail(
      { template: 'application_received', locale: 'en', toEmail: `fail-${stamp}@test.com`, vars: { name: 'X', trip: 'Y' } },
      boom,
    );
    expect(res.sent).toBe(false);
    const [row] = await db.select().from(emailDeliveries).where(eq(emailDeliveries.id, res.deliveryId));
    expect(row.status).toBe('failed');
    expect(row.lastError).toContain('smtp down');
    const events = await db.select().from(emailEvents).where(eq(emailEvents.deliveryId, res.deliveryId));
    expect(events.map((e) => e.event)).toContain('failed');
    await db.delete(emailEvents).where(eq(emailEvents.deliveryId, res.deliveryId));
    await db.delete(emailDeliveries).where(eq(emailDeliveries.id, res.deliveryId));
  });

  it('dead-letters outbox events after max attempts', async () => {
    const id = await emitOutboxEvent({ eventType: 'application.submitted', aggregateType: 'test', aggregateId: `dl-${stamp}`, payload: {} });
    let found = false;
    for (let i = 0; i < 20; i++) {
      const claimed = await claimOutboxBatch(25);
      if (claimed.some((r) => r.id === id)) {
        found = true;
        break;
      }
      await new Promise((r) => setTimeout(r, 50));
    }
    expect(found).toBe(true);
    await failOutbox(id, 4, 'boom');
    const [row] = await db.select().from(outboxEvents).where(eq(outboxEvents.id, id));
    expect(row.status).toBe('dead_letter');
    await completeOutbox(id);
    const pending = await pendingOutboxCount(new Date());
    expect(pending).toBeGreaterThanOrEqual(0);
    await db.delete(outboxEvents).where(eq(outboxEvents.id, id));
  });

  it('requeues dead-letter events via action', async () => {
    const { user } = await import('@database/schemas');
    const { getTestHelpers } = await import('../helpers/auth');
    const helpers = await getTestHelpers();
    const u = helpers.createUser({ email: `requeue-${stamp}@test.com`, name: 'Requeue', emailVerified: true });
    const saved = await helpers.saveUser(u);
    await db.update(user).set({ role: 'admin' }).where(eq(user.id, saved.id));
    const requeue = (requeueOutboxEvent as any).handler as (i: any, c: any) => Promise<any>;
    const id = await emitOutboxEvent({ eventType: 'x', aggregateType: 'test', aggregateId: `rq-${stamp}`, payload: {} });
    await failOutbox(id, 9, 'boom');
    const ctx = { locals: { user: { id: saved.id, role: 'admin', email: `requeue-${stamp}@test.com`, banned: false } }, request: { headers: new Headers() }, clientAddress: '127.0.0.1' } as any;
    const res = await requeue({ id }, ctx);
    expect(res.success).toBe(true);
    const [row] = await db.select().from(outboxEvents).where(eq(outboxEvents.id, id));
    expect(row.status).toBe('pending');
    await db.delete(outboxEvents).where(eq(outboxEvents.id, id));
    await helpers.deleteUser(saved.id).catch(() => {});
  });
});
