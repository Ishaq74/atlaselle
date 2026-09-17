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
import { invalidateCache } from '@database/cache';
import { trips, tripTranslations, tripRevisions } from '@database/schemas/trips.schema';
import { travelers } from '@database/schemas/travelers.schema';
import { applications } from '@database/schemas/applications.schema';
import { emailDeliveries } from '@database/schemas/email-voyage.schema';
import { policyVersions } from '@database/schemas/policies.schema';
import { user } from '@database/schemas';
import { updateTrip, restoreTripRevision, createTrip } from '@/actions/voyage/trips';
import { createDeparture, updateDeparture } from '@/actions/voyage/departures';
import { publishPolicyVersion } from '@/actions/voyage/policies';
import { retryEmailDelivery } from '@/actions/voyage/email';
import { exportTravelerData, anonymizeTraveler } from '@/actions/voyage/travelers';
import { getTestHelpers } from '../helpers/auth';

const update = (updateTrip as any).handler as (i: any, c: any) => Promise<any>;
const createT = (createTrip as any).handler as (i: any, c: any) => Promise<any>;
const createDep = (createDeparture as any).handler as (i: any, c: any) => Promise<any>;
const updateDep = (updateDeparture as any).handler as (i: any, c: any) => Promise<any>;
const restore = (restoreTripRevision as any).handler as (i: any, c: any) => Promise<any>;
const publishPolicy = (publishPolicyVersion as any).handler as (i: any, c: any) => Promise<any>;
const retryEmail = (retryEmailDelivery as any).handler as (i: any, c: any) => Promise<any>;
const exportData = (exportTravelerData as any).handler as (i: any, c: any) => Promise<any>;
const anonymize = (anonymizeTraveler as any).handler as (i: any, c: any) => Promise<any>;

const db = getDrizzle();
const stamp = Date.now().toString(36);
const TRIP_ID = `test-adm-trip-${stamp}`;

const adminCtx = (userId: string) => ({
  locals: { user: { id: userId, role: 'admin', email: 'admin@test.com', banned: false } },
  request: { headers: new Headers(), url: 'http://localhost:4321/en/admin/trips' },
  clientAddress: '127.0.0.1',
}) as any;

async function cleanup() {
  await db.delete(tripRevisions).where(eq(tripRevisions.tripId, TRIP_ID));
  await db.delete(tripTranslations).where(eq(tripTranslations.tripId, TRIP_ID));
  await db.delete(trips).where(eq(trips.id, TRIP_ID));
  const trs = await db.select({ id: travelers.id, email: travelers.email }).from(travelers);
  for (const t of trs) {
    if (t.email.includes(stamp)) {
      await db.delete(emailDeliveries).where(eq(emailDeliveries.travelerId, t.id));
      await db.delete(travelers).where(eq(travelers.id, t.id));
    }
  }
  invalidateCache();
}

describe('Admin voyage actions (real DB)', () => {
  let adminId: string;
  let helpers: Awaited<ReturnType<typeof getTestHelpers>>;

  beforeAll(async () => {
    helpers = await getTestHelpers();
    const u = helpers.createUser({ email: `adm-voy-${stamp}@test.com`, name: 'Adm Voy', emailVerified: true });
    const saved = await helpers.saveUser(u);
    adminId = saved.id;
    await db.update(user).set({ role: 'admin' }).where(eq(user.id, adminId));
    await cleanup();
    await db.insert(trips).values({
      id: TRIP_ID, status: 'draft', countryCode: 'FR', defaultCurrency: 'EUR',
      durationDays: 4, durationNights: 3, groupMin: 2, groupMax: 8, difficulty: 'easy', difficultyLevel: 2,
    });
  });

  afterAll(async () => {
    await cleanup();
    await helpers.deleteUser(adminId).catch(() => {});
  });

  it('rejects stale writes (optimistic locking)', async () => {
    await expect(
      update({ id: TRIP_ID, groupMax: 9, expectedUpdatedAt: new Date('2020-01-01T00:00:00.000Z').toISOString() }, adminCtx(adminId)),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
    const [trip] = await db.select().from(trips).where(eq(trips.id, TRIP_ID));
    await update({ id: TRIP_ID, groupMax: 9, expectedUpdatedAt: trip.updatedAt.toISOString() }, adminCtx(adminId));
    const [updated] = await db.select().from(trips).where(eq(trips.id, TRIP_ID));
    expect(updated.groupMax).toBe(9);
  });

  it('restores a revision snapshot', async () => {
    const [trip] = await db.select().from(trips).where(eq(trips.id, TRIP_ID));
    const [revision] = await db
      .insert(tripRevisions)
      .values({ tripId: TRIP_ID, snapshot: JSON.stringify({ ...trip, groupMax: 7 }), createdBy: adminId })
      .returning({ id: tripRevisions.id });
    await restore({ id: revision.id }, adminCtx(adminId));
    const [restored] = await db.select().from(trips).where(eq(trips.id, TRIP_ID));
    expect(restored.groupMax).toBe(7);
  });

  it('publishes a policy version exclusively', async () => {
    const { policyDocuments } = await import('@database/schemas/policies.schema');
    const [doc] = await db.select().from(policyDocuments).where(eq(policyDocuments.type, 'booking_terms')).limit(1);
    expect(doc).toBeDefined();
    const versions = await db.select().from(policyVersions).where(eq(policyVersions.documentId, doc.id));
    expect(versions.length).toBeGreaterThanOrEqual(1);
    const target = versions[0];
    expect(target).toBeDefined();
    await publishPolicy({ id: target.id }, adminCtx(adminId));
    const after = await db.select().from(policyVersions).where(eq(policyVersions.documentId, doc.id));
    expect(after.filter((v) => v.published)).toHaveLength(1);
    expect(after.find((v) => v.published)?.id).toBe(target.id);
  });

  it('retries failed email deliveries', async () => {
    const [traveler] = await db.insert(travelers).values({ email: `retry-${stamp}@test.com` }).returning({ id: travelers.id });
    const [delivery] = await db.insert(emailDeliveries).values({
      templateKey: 'application_received', locale: 'fr', toEmail: `retry-${stamp}@test.com`,
      travelerId: traveler.id, status: 'failed', lastError: 'boom',
    }).returning({ id: emailDeliveries.id });
    const res = await retryEmail({ id: delivery.id }, adminCtx(adminId));
    expect(res.success).toBe(true);
    const [row] = await db.select().from(emailDeliveries).where(eq(emailDeliveries.id, delivery.id));
    expect(row.status).toBe('queued');
    await db.delete(emailDeliveries).where(eq(emailDeliveries.id, delivery.id));
    await db.delete(travelers).where(eq(travelers.id, traveler.id));
  });

  it('exports then anonymizes a traveler file', async () => {
    const [traveler] = await db.insert(travelers).values({ email: `rgpd-${stamp}@test.com`, legalName: 'RGPD User' }).returning({ id: travelers.id });
    const data = await exportData({ id: traveler.id }, adminCtx(adminId));
    expect(data.traveler.email).toBe(`rgpd-${stamp}@test.com`);
    expect(data.applications).toEqual([]);
    const ok = await anonymize({ id: traveler.id }, adminCtx(adminId));
    expect(ok.success).toBe(true);
    const [row] = await db.select().from(travelers).where(eq(travelers.id, traveler.id));
    expect(row.email).toContain('@deleted.local');
    expect(row.legalName).toBeNull();
    await db.delete(travelers).where(eq(travelers.id, traveler.id));
  });

  it('refuses anonymization with an active file', async () => {
    const [traveler] = await db.insert(travelers).values({ email: `rgpd2-${stamp}@test.com` }).returning({ id: travelers.id });
    const { departures } = await import('@database/schemas/departures.schema');
    const [dep] = await db.select({ id: departures.id }).from(departures).limit(1);
    await db.insert(applications).values({
      id: `rgpd-app-${stamp}`, travelerId: traveler.id, tripId: TRIP_ID, departureId: dep.id,
      status: 'submitted', activityAcknowledgement: true, consent: true, submittedAt: new Date(),
    });
    await expect(anonymize({ id: traveler.id }, adminCtx(adminId))).rejects.toMatchObject({ code: 'CONFLICT' });
    await db.delete(applications).where(eq(applications.id, `rgpd-app-${stamp}`));
    await db.delete(travelers).where(eq(travelers.id, traveler.id));
  });

  it('creates trips and edits full departure pricing', async () => {
    const created = await createT(
      { countryCode: 'IT', durationDays: 5, durationNights: 4, groupMin: 4, groupMax: 10 },
      adminCtx(adminId),
    );
    expect(created.id).toBeTypeOf('string');
    await expect(
      createT({ countryCode: 'IT', durationDays: 5, durationNights: 4, groupMin: 10, groupMax: 4 }, adminCtx(adminId)),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });

    const { departures } = await import('@database/schemas/departures.schema');
    const dep = await createDep(
      {
        tripId: created.id, startDate: new Date('2027-09-01T08:00:00.000Z'), endDate: new Date('2027-09-05T18:00:00.000Z'),
        capacityMin: 4, capacityMax: 10, priceAmount: 200000, currency: 'EUR',
        depositType: 'percent', depositPercent: 20, pricingRules: { earlyBirdPercent: 5 },
      },
      adminCtx(adminId),
    );
    expect(dep.id).toBeTypeOf('string');
    const [row] = await db.select().from(departures).where(eq(departures.id, dep.id));
    await updateDep(
      { id: dep.id, expectedUpdatedAt: row.updatedAt.toISOString(), taxAmount: 1000, discountType: 'fixed', discountAmount: 5000 },
      adminCtx(adminId),
    );
    const [updated] = await db.select().from(departures).where(eq(departures.id, dep.id));
    expect(updated.taxAmount).toBe(1000);
    expect(updated.discountAmount).toBe(5000);
    await expect(
      updateDep({ id: dep.id, expectedUpdatedAt: new Date('2020-01-01T00:00:00.000Z').toISOString(), priceAmount: 1 }, adminCtx(adminId)),
    ).rejects.toMatchObject({ code: 'CONFLICT' });

    await db.delete(departures).where(eq(departures.id, dep.id));
    const { trips: tripTable } = await import('@database/schemas/trips.schema');
    await db.delete(tripTable).where(eq(tripTable.id, created.id));
  });
});
