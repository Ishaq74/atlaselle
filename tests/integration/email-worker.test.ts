import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { eq } from 'drizzle-orm';
import { getDrizzle } from '@database/drizzle';
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
import { sendBalanceReminders } from '@/modules/email-voyage/domain/reminders';

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
    await db.insert(trips).values({
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
      amountPaid: 100000, amountDue: 0,
      balanceDueDate: new Date(Date.now() + 3 * 86_400_000),
      confirmedAt: new Date(),
    }).returning({ id: reservations.id });
    reservationId = reservation.id;
  });

  afterAll(cleanup);

  it('sends application emails from outbox events', async () => {
    await emitOutboxEvent({ eventType: 'application.submitted', aggregateType: 'application', aggregateId: applicationId, payload: { applicationId } });
    const res = await processEmailOutboxBatch(25, stubSender);
    expect(res.done).toBeGreaterThanOrEqual(1);
    expect(res.failed).toBe(0);
    expect(sent.some((s) => s.to === `mail-${stamp}@test.com`)).toBe(true);
    const deliveries = await db.select().from(emailDeliveries).where(eq(emailDeliveries.travelerId, travelerId));
    expect(deliveries.some((d) => d.status === 'sent')).toBe(true);
  });

  it('skips unknown events (marked done, no email)', async () => {
    const before = sent.length;
    await emitOutboxEvent({ eventType: 'reservation.cancelled', aggregateType: 'reservation', aggregateId: reservationId, payload: { reservationId } });
    const res = await processEmailOutboxBatch(25, stubSender);
    expect(res.skipped).toBeGreaterThanOrEqual(1);
    expect(sent.length).toBe(before);
    await db.delete(outboxEvents).where(eq(outboxEvents.aggregateId, reservationId));
  });

  it('sends balance reminders once (dedupe)', async () => {
    const first = await sendBalanceReminders(new Date(), stubSender);
    expect(first).toBeGreaterThanOrEqual(1);
    const second = await sendBalanceReminders(new Date(), stubSender);
    expect(second).toBe(0);
  });
});
