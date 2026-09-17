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
import { invalidateCache } from '@database/cache';
import { travelers } from '@database/schemas/travelers.schema';
import { applications } from '@database/schemas/applications.schema';
import { reservations } from '@database/schemas/reservations.schema';
import { emailDeliveries } from '@database/schemas/email-voyage.schema';
import { policyDocuments, policyVersions } from '@database/schemas/policies.schema';
import { trips } from '@database/schemas/trips.schema';
import { departures } from '@database/schemas/departures.schema';
import { user } from '@database/schemas';
import { createPolicyVersion, publishPolicyVersion } from '@/actions/voyage/policies';
import { exportTravelerData, anonymizeTraveler } from '@/actions/voyage/travelers';
import { requeueOutboxEvent } from '@/actions/voyage/outbox';
import { retryEmailDelivery } from '@/actions/voyage/email';
import { createItineraryDay, updateItineraryDay, deleteItineraryDay } from '@/actions/voyage/itinerary';
import { createFaq, linkFaqToTrip } from '@/actions/voyage/faq';
import { createTripContent, deleteTripContent } from '@/actions/voyage/contents';
import { getTestHelpers } from '../helpers/auth';
import { purgeOutboxForTrips } from '../helpers/voyage';

const createPolicy = (createPolicyVersion as any).handler as (i: unknown, c: unknown) => Promise<{ id: string; version: number }>;
const publishPolicy = (publishPolicyVersion as any).handler as (i: unknown, c: unknown) => Promise<unknown>;
const exportData = (exportTravelerData as any).handler as (i: unknown, c: unknown) => Promise<{ traveler: Record<string, unknown>; applications: unknown[]; reservations: unknown[] }>;
const anonymize = (anonymizeTraveler as any).handler as (i: unknown, c: unknown) => Promise<unknown>;
const requeue = (requeueOutboxEvent as any).handler as (i: unknown, c: unknown) => Promise<unknown>;
const retryEmail = (retryEmailDelivery as any).handler as (i: unknown, c: unknown) => Promise<unknown>;

const db = getDrizzle();
const stamp = Date.now().toString(36);
const TRIP_ID = `test-miss-trip-${stamp}`;
const DEP_ID = `test-miss-dep-${stamp}`;

const adminCtx = (userId: string) => ({
  locals: { user: { id: userId, role: 'admin', email: 'admin@test.com', banned: false } },
  request: { headers: new Headers(), url: 'http://localhost:4321/en/admin/trips' },
  clientAddress: '127.0.0.1',
}) as never;

describe('actions manquantes — policies, travelers, outbox, email, itinerary, faq, contents', () => {
  let adminId: string;
  let helpers: Awaited<ReturnType<typeof getTestHelpers>>;

  beforeAll(async () => {
    helpers = await getTestHelpers();
    const u = helpers.createUser({ email: `miss-admin-${stamp}@test.com`, name: 'Miss', emailVerified: true });
    const saved = await helpers.saveUser(u);
    adminId = saved.id;
    await db.update(user).set({ role: 'admin' }).where(eq(user.id, adminId));
    await db.insert(trips).values({
      id: TRIP_ID, status: 'draft', countryCode: 'FR', defaultCurrency: 'EUR',
      durationDays: 3, durationNights: 2, groupMin: 1, groupMax: 4, difficulty: 'easy', difficultyLevel: 1,
    });
    await db.insert(departures).values({
      id: DEP_ID, tripId: TRIP_ID,
      startDate: new Date('2027-08-01T08:00:00.000Z'), endDate: new Date('2027-08-03T18:00:00.000Z'),
      status: 'open', capacityMin: 1, capacityMax: 4, priceAmount: 40000, currency: 'EUR', pricingRules: {},
    });
  });

  afterAll(async () => {
    await db.delete(departures).where(eq(departures.tripId, TRIP_ID)).catch(() => {});
    await db.delete(trips).where(eq(trips.id, TRIP_ID)).catch(() => {});
    const trs = await db.select({ id: travelers.id }).from(travelers).catch(() => [] as { id: string }[]);
    const mine: string[] = [];
    for (const t of trs) {
      const em = await db.select({ email: travelers.email }).from(travelers).where(eq(travelers.id, t.id)).limit(1).catch(() => []);
      if (em[0]?.email?.includes(stamp)) mine.push(t.id);
    }
    await purgeOutboxForTrips(db, [TRIP_ID], mine).catch(() => {});
    for (const id of mine) {
      await db.delete(emailDeliveries).where(eq(emailDeliveries.travelerId, id)).catch(() => {});
      await db.delete(applications).where(eq(applications.travelerId, id)).catch(() => {});
      await db.delete(reservations).where(eq(reservations.travelerId, id)).catch(() => {});
      await db.delete(travelers).where(eq(travelers.id, id)).catch(() => {});
    }
    await helpers.deleteUser(adminId).catch(() => {});
    invalidateCache();
  });

  it('policies : NOT_FOUND doc, version +1, publish NOT_FOUND + champs', async () => {
    await expect(createPolicy({ type: 'privacy', locale: 'fr', title: 'T', content: 'C' }, adminCtx(adminId))).rejects.toMatchObject({ code: 'NOT_FOUND' });
    const docs = await db.select().from(policyDocuments).limit(1);
    expect(docs.length).toBeGreaterThan(0);
    const doc = docs[0];
    const v1 = await createPolicy({ type: doc.type as never, locale: doc.locale as never, title: 'V', content: 'C' }, adminCtx(adminId));
    expect(v1.version).toBeGreaterThanOrEqual(1);
    const v2 = await createPolicy({ type: doc.type as never, locale: doc.locale as never, title: 'V2', content: 'C2' }, adminCtx(adminId));
    expect(v2.version).toBe(v1.version + 1);
    await expect(publishPolicy({ id: '00000000-0000-0000-0000-000000000000' }, adminCtx(adminId))).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await publishPolicy({ id: v2.id }, adminCtx(adminId));
    const [row] = await db.select().from(policyVersions).where(eq(policyVersions.id, v2.id)).limit(1);
    expect(row.published).toBe(true);
    expect(row.reviewedBy).toBe(adminId);
    // publier v3 dépublie v2 (une seule publiée par document)
    const v3 = await createPolicy({ type: doc.type as never, locale: doc.locale as never, title: 'V3', content: 'C3' }, adminCtx(adminId));
    await publishPolicy({ id: v3.id }, adminCtx(adminId));
    const [old] = await db.select().from(policyVersions).where(eq(policyVersions.id, v2.id)).limit(1);
    expect(old.published).toBe(false);
    await db.delete(policyVersions).where(eq(policyVersions.id, v3.id)).catch(() => {});
    await db.delete(policyVersions).where(eq(policyVersions.id, v2.id)).catch(() => {});
    await db.delete(policyVersions).where(eq(policyVersions.id, v1.id)).catch(() => {});
  });

  it('travelers : NOT_FOUND, apps/res non-vides, anonymize conflits et nulls', async () => {
    const fake = '00000000-0000-0000-0000-000000000000';
    await expect(exportData({ id: fake }, adminCtx(adminId))).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(anonymize({ id: fake }, adminCtx(adminId))).rejects.toMatchObject({ code: 'NOT_FOUND' });

    const [t] = await db.insert(travelers).values({ email: `full-${stamp}@test.com`, locale: 'en', phone: '+336', preferredName: 'Pref', dateOfBirth: '1990-01-01' }).returning({ id: travelers.id });
    const [a] = await db.insert(applications).values({
      travelerId: t.id, tripId: TRIP_ID, departureId: DEP_ID, status: 'withdrawn',
      activityAcknowledgement: true, consent: true, submittedAt: new Date(),
    }).returning({ id: applications.id });
    const out = await exportData({ id: t.id }, adminCtx(adminId));
    expect(out.applications).toHaveLength(1);
    expect(out.traveler.email).toContain(stamp);

    // dossier actif -> conflit
    const [t2] = await db.insert(travelers).values({ email: `active-${stamp}@test.com`, locale: 'en' }).returning({ id: travelers.id });
    await db.insert(applications).values({
      travelerId: t2.id, tripId: TRIP_ID, departureId: DEP_ID, status: 'submitted',
      activityAcknowledgement: true, consent: true, submittedAt: new Date(),
    });
    await expect(anonymize({ id: t2.id }, adminCtx(adminId))).rejects.toMatchObject({ code: 'CONFLICT' });

    // chaque statut de candidature actif bloque
    for (const [i, s] of (['draft', 'under_review', 'contact_required', 'approved'] as const).entries()) {
      const [tx] = await db.insert(travelers).values({ email: `st${i}-${stamp}@test.com`, locale: 'en' }).returning({ id: travelers.id });
      await db.insert(applications).values({
        travelerId: tx.id, tripId: TRIP_ID, departureId: DEP_ID, status: s,
        activityAcknowledgement: true, consent: true, submittedAt: new Date(),
      });
      await expect(anonymize({ id: tx.id }, adminCtx(adminId))).rejects.toMatchObject({ code: 'CONFLICT' });
    }

    // réservation active -> conflit
    const [t3] = await db.insert(travelers).values({ email: `res-${stamp}@test.com`, locale: 'en' }).returning({ id: travelers.id });
    await db.insert(reservations).values({
      reservationNumber: `ATL-2027-M${stamp.slice(-4).toUpperCase()}`,
      travelerId: t3.id, tripId: TRIP_ID, departureId: DEP_ID, status: 'confirmed',
      currency: 'EUR', baseAmount: 100, totalAmount: 100, amountPaid: 100, amountDue: 0,
    });
    await expect(anonymize({ id: t3.id }, adminCtx(adminId))).rejects.toMatchObject({ code: 'CONFLICT' });

    // succès anonymize nullifie PII
    await db.delete(applications).where(eq(applications.id, a.id));
    await anonymize({ id: t.id }, adminCtx(adminId));
    const [anon] = await db.select().from(travelers).where(eq(travelers.id, t.id)).limit(1);
    expect(anon.phone).toBeNull();
    expect(anon.legalName).toBeNull();
    expect(anon.preferredName).toBeNull();
    expect(anon.dateOfBirth).toBeNull();
    expect(anon.email).toContain('@deleted.local');
  });

  it('outbox : NOT_FOUND id inexistant', async () => {
    await expect(requeue({ id: 'no-such-id' }, adminCtx(adminId))).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('email : NOT_FOUND, BAD_REQUEST non-failed, dead_letter happy', async () => {
    await expect(retryEmail({ id: '00000000-0000-0000-0000-000000000000' }, adminCtx(adminId))).rejects.toMatchObject({ code: 'NOT_FOUND' });
    const [t] = await db.insert(travelers).values({ email: `mail-${stamp}@test.com`, locale: 'en' }).returning({ id: travelers.id });
    const [queued] = await db.insert(emailDeliveries).values({ templateKey: 'application_received', locale: 'en', toEmail: `mail-${stamp}@test.com`, travelerId: t.id, status: 'queued' }).returning({ id: emailDeliveries.id });
    await expect(retryEmail({ id: queued.id }, adminCtx(adminId))).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    await db.update(emailDeliveries).set({ status: 'dead_letter' }).where(eq(emailDeliveries.id, queued.id));
    await retryEmail({ id: queued.id }, adminCtx(adminId));
    const [row] = await db.select().from(emailDeliveries).where(eq(emailDeliveries.id, queued.id)).limit(1);
    expect(row.status).toBe('queued');
    expect(row.attempts).toBe(0);
  });

  it('itinerary : NOT_FOUND trip, update NOT_FOUND, delete silencieux', async () => {
    const create = (createItineraryDay as never as { handler: Function }).handler as Function;
    const update = (updateItineraryDay as never as { handler: Function }).handler as Function;
    const del = (deleteItineraryDay as never as { handler: Function }).handler as Function;
    await expect(create({ tripId: 'no-trip', dayNumber: 1 }, adminCtx(adminId))).rejects.toBeDefined();
    await expect(update({ id: '00000000-0000-0000-0000-000000000000', location: 'X' }, adminCtx(adminId))).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await del({ id: '00000000-0000-0000-0000-000000000000' }, adminCtx(adminId));
  });

  it('faq sans tripId, trip inconnu sans orphelin, link double, contents delete inclusion/exclusion', async () => {
    const mkFaq = (createFaq as never as { handler: Function }).handler as Function;
    const link = (linkFaqToTrip as never as { handler: Function }).handler as Function;
    const mkContent = (createTripContent as never as { handler: Function }).handler as Function;
    const delContent = (deleteTripContent as never as { handler: Function }).handler as Function;
    const faq = await mkFaq({ locale: 'fr', question: 'Q?', answer: 'R.' }, adminCtx(adminId));
    expect(faq.id).toBeTypeOf('string');
    const { faqs: faqTable } = await import('@database/schemas/trips.schema');
    const countBefore = (await db.select({ id: faqTable.id }).from(faqTable)).length;
    await expect(mkFaq({ tripId: 'no-trip', locale: 'fr', question: 'Q?', answer: 'R.' }, adminCtx(adminId))).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect((await db.select({ id: faqTable.id }).from(faqTable)).length).toBe(countBefore);
    await link({ tripId: TRIP_ID, faqId: faq.id }, adminCtx(adminId));
    await link({ tripId: TRIP_ID, faqId: faq.id }, adminCtx(adminId));
    const inc = await mkContent({ tripId: TRIP_ID, kind: 'inclusion', sortOrder: 0 }, adminCtx(adminId));
    const exc = await mkContent({ tripId: TRIP_ID, kind: 'exclusion', sortOrder: 0 }, adminCtx(adminId));
    await delContent({ kind: 'inclusion', id: inc.id }, adminCtx(adminId));
    await delContent({ kind: 'exclusion', id: exc.id }, adminCtx(adminId));
  });
});
