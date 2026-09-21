import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { eq } from 'drizzle-orm';
import { getDrizzle } from '@database/drizzle';
import { insertTestTrip } from '../helpers/trip-factory';
import { invalidateCache } from '@database/cache';
import { trips, tripTranslations } from '@database/schemas/trips.schema';
import { departures } from '@database/schemas/departures.schema';
import { travelers } from '@database/schemas/travelers.schema';
import { applications } from '@database/schemas/applications.schema';
import { reservations } from '@database/schemas/reservations.schema';
import { payments } from '@database/schemas/payments.schema';
import { emailDeliveries } from '@database/schemas/email-voyage.schema';
import { loadAdminApplications } from '@/modules/applications/loaders/admin-applications.loader';
import { loadAdminReservations, loadAdminReservation } from '@/modules/reservations/loaders/admin-reservations.loader';
import { loadAdminPayments } from '@/modules/payments/loaders/admin-payments.loader';
import { loadAdminTravelers } from '@/modules/travelers/loaders/admin-travelers.loader';
import { loadAdminDeliveries } from '@/modules/email-voyage/loaders/admin-email.loader';
import { loadAdminPolicies } from '@/modules/policies/loaders/admin-policies.loader';
import { loadVoyageHealth } from '@/modules/trips/loaders/admin-health.loader';
import { loadOpenDepartures } from '@/modules/departures/loaders/departure.loader';

const db = getDrizzle();
const stamp = Date.now().toString(36);
const TRIP_ID = `test-loaders-trip-${stamp}`;
const EMAIL = `loaders-${stamp}@test.com`;

async function cleanup() {
  const apps = await db.select({ id: applications.id, travelerId: applications.travelerId }).from(applications).where(eq(applications.tripId, TRIP_ID));
  for (const a of apps) await db.delete(applications).where(eq(applications.id, a.id));
  const res = await db.select({ id: reservations.id, travelerId: reservations.travelerId }).from(reservations).where(eq(reservations.tripId, TRIP_ID));
  for (const r of res) {
    await db.delete(payments).where(eq(payments.reservationId, r.id));
    await db.delete(reservations).where(eq(reservations.id, r.id));
  }
  const tids = new Set([...apps.map((a) => a.travelerId), ...res.map((r) => r.travelerId)]);
  for (const tid of tids) {
    await db.delete(emailDeliveries).where(eq(emailDeliveries.travelerId, tid));
    await db.delete(travelers).where(eq(travelers.id, tid));
  }
  await db.delete(tripTranslations).where(eq(tripTranslations.tripId, TRIP_ID));
  await db.delete(departures).where(eq(departures.tripId, TRIP_ID));
  await db.delete(trips).where(eq(trips.id, TRIP_ID));
  invalidateCache();
}

describe('Admin voyage loaders (real DB)', () => {
  let travelerId: string;

  beforeAll(async () => {
    await cleanup();
    await insertTestTrip(db, {
      id: TRIP_ID, status: 'published', countryCode: 'FR', defaultCurrency: 'EUR',
      durationDays: 4, durationNights: 3, groupMin: 1, groupMax: 5, difficulty: 'easy', difficultyLevel: 1,
      publishedAt: new Date(),
    });
    await db.insert(tripTranslations).values({
      id: `test-loaders-tr-${stamp}`, tripId: TRIP_ID, locale: 'fr', slug: `loaders-${stamp}`,
      title: 'Voyage loaders', summary: 'Résumé', overview: 'Aperçu', localeVisible: true,
    });
    await db.insert(departures).values({
      id: `test-loaders-dep-${stamp}`, tripId: TRIP_ID,
      startDate: new Date('2027-05-01T08:00:00.000Z'), endDate: new Date('2027-05-04T18:00:00.000Z'),
      status: 'open', capacityMin: 1, capacityMax: 5, priceAmount: 50000, currency: 'EUR', pricingRules: {},
    });
    const [traveler] = await db.insert(travelers).values({ email: EMAIL, locale: 'fr' }).returning({ id: travelers.id });
    travelerId = traveler.id;
    const [app] = await db.insert(applications).values({
      travelerId, tripId: TRIP_ID, departureId: `test-loaders-dep-${stamp}`, status: 'submitted',
      activityAcknowledgement: true, consent: true, submittedAt: new Date(),
    }).returning({ id: applications.id });
    const [reservation] = await db.insert(reservations).values({
      reservationNumber: `ATL-2027-LD${stamp.slice(-4).toUpperCase()}`,
      travelerId, tripId: TRIP_ID, departureId: `test-loaders-dep-${stamp}`, applicationId: app.id,
      status: 'awaiting_payment', currency: 'EUR', baseAmount: 50000, totalAmount: 50000, amountPaid: 0, amountDue: 50000,
    }).returning({ id: reservations.id });
    await db.insert(payments).values({
      reservationId: reservation.id, provider: 'mock', type: 'full_payment', status: 'created',
      amount: 50000, currency: 'EUR', idempotencyKey: `loaders-${stamp}`,
    });
    await db.insert(emailDeliveries).values({
      templateKey: 'application_received', locale: 'fr', toEmail: EMAIL, travelerId, status: 'sent', sentAt: new Date(),
    });
  });

  afterAll(cleanup);

  it('lists applications with traveler emails', async () => {
    const { rows, meta } = await loadAdminApplications({ tripId: TRIP_ID });
    expect(meta.total).toBeGreaterThanOrEqual(1);
    expect(rows.some((r) => r.travelerEmail === EMAIL)).toBe(true);
  });

  it('filters applications by status', async () => {
    const { rows } = await loadAdminApplications({ tripId: TRIP_ID, status: 'approved' });
    expect(rows.every((r) => r.status === 'approved')).toBe(true);
  });

  it('lists reservations with amounts', async () => {
    const { rows } = await loadAdminReservations({ tripId: TRIP_ID });
    const found = rows.find((r) => r.travelerEmail === EMAIL)!;
    expect(found.totalAmount).toBe(50000);
    expect(found.status).toBe('awaiting_payment');
  });

  it('lists payments', async () => {
    const { rows, meta } = await loadAdminPayments({});
    expect(meta.total).toBeGreaterThanOrEqual(1);
    expect(rows.some((r) => r.type === 'full_payment')).toBe(true);
  });

  it('searches travelers without sensitive data', async () => {
    const { rows } = await loadAdminTravelers({ search: EMAIL });
    expect(rows).toHaveLength(1);
    expect(rows[0]).not.toHaveProperty('phone');
    expect(rows[0]).not.toHaveProperty('dietaryRequirements');
    expect(rows[0].applicationsCount).toBe(1);
    expect(rows[0].reservationsCount).toBe(1);
  });

  it('lists email deliveries', async () => {
    const { rows } = await loadAdminDeliveries({ templateKey: 'application_received' });
    expect(rows.some((r) => r.toEmail === EMAIL && r.status === 'sent')).toBe(true);
  });

  it('lists policy documents with published versions', async () => {
    const docs = await loadAdminPolicies();
    expect(docs.length).toBeGreaterThanOrEqual(8);
    expect(docs.every((d) => d.versions.length >= 1)).toBe(true);
  });

  it('loads open departures for a trip', async () => {
    const open = await loadOpenDepartures(TRIP_ID);
    expect(open).toHaveLength(1);
    expect(open[0].priceAmount).toBe(50000);
  });

  it('computes voyage health counters', async () => {
    const health = await loadVoyageHealth(new Date());
    for (const v of Object.values(health)) {
      expect(Number.isInteger(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(0);
    }
  });

  it('loads reservation detail with payments and trip title', async () => {
    const { rows } = await loadAdminReservations({ tripId: TRIP_ID });
    expect(rows.length).toBeGreaterThanOrEqual(1);
    const detail = await loadAdminReservation(rows[0].id);
    expect(detail).not.toBeNull();
    expect(detail!.payments.length).toBeGreaterThanOrEqual(1);
    expect(detail!.tripTitle.length).toBeGreaterThan(0);
    expect(detail!.traveler).toBeDefined();
    expect(await loadAdminReservation('00000000-0000-0000-0000-000000000000')).toBeNull();
  });
});
