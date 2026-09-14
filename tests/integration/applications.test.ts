import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';

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
import { trips } from '@database/schemas/trips.schema';
import { departures } from '@database/schemas/departures.schema';
import { applications, applicationDecisions, applicationEvents } from '@database/schemas/applications.schema';
import { travelers } from '@database/schemas/travelers.schema';
import { checkoutSessions } from '@database/schemas/payments.schema';
import { outboxEvents } from '@database/schemas/outbox.schema';
import { user } from '@database/schemas';
import { submitApplication, reviewApplication, withdrawApplication } from '@/actions/voyage/applications';
import { resetRateLimiter } from '@/lib/rate-limit';
import { getTestHelpers } from '../helpers/auth';

const submit = (submitApplication as any).handler as (i: any, c: any) => Promise<any>;
const review = (reviewApplication as any).handler as (i: any, c: any) => Promise<any>;
const withdraw = (withdrawApplication as any).handler as (i: any, c: any) => Promise<any>;

const db = getDrizzle();
const stamp = Date.now().toString(36);
const TRIP_ID = `test-app-trip-${stamp}`;
const DEP_OPEN = `test-app-dep-open-${stamp}`;
const DEP_CLOSED = `test-app-dep-closed-${stamp}`;
const DEP_LATE = `test-app-dep-late-${stamp}`;

const publicCtx = () => ({
  locals: { user: null },
  request: { headers: new Headers() },
  clientAddress: '127.0.0.1',
}) as any;

const adminCtx = (userId: string) => ({
  locals: { user: { id: userId, role: 'admin', email: 'admin@test.com', banned: false } },
  request: { headers: new Headers() },
  clientAddress: '127.0.0.1',
}) as any;

const baseInput = {
  tripId: TRIP_ID,
  departureId: DEP_OPEN,
  legalName: 'Test Voyageuse',
  phone: null,
  roomPreference: 'shared',
  dietaryRequirements: null,
  accessibilityNeeds: null,
  activityAcknowledgement: true,
  motivation: null,
  expectations: null,
  consent: true,
  locale: 'fr',
};

async function cleanup() {
  const apps = await db
    .select({ id: applications.id, travelerId: applications.travelerId })
    .from(applications)
    .where(eq(applications.tripId, TRIP_ID));
  const travelerIds = [...new Set(apps.map((a) => a.travelerId))];
  for (const a of apps) {
    await db.delete(applicationDecisions).where(eq(applicationDecisions.applicationId, a.id));
    await db.delete(applicationEvents).where(eq(applicationEvents.applicationId, a.id));
    await db.delete(outboxEvents).where(eq(outboxEvents.aggregateId, a.id));
    await db.delete(checkoutSessions).where(eq(checkoutSessions.applicationId, a.id));
    await db.delete(applications).where(eq(applications.id, a.id));
    await db.delete(travelers).where(eq(travelers.id, a.travelerId));
  }
  for (const tid of travelerIds) {
    await db.delete(travelers).where(eq(travelers.id, tid));
  }
  await db.delete(departures).where(eq(departures.tripId, TRIP_ID));
  await db.delete(trips).where(eq(trips.id, TRIP_ID));
  invalidateCache();
}

describe('Applications — submit/review/withdraw (real DB)', () => {
  let adminId: string;
  let helpers: Awaited<ReturnType<typeof getTestHelpers>>;

  beforeAll(async () => {
    helpers = await getTestHelpers();
    const u = helpers.createUser({ email: `app-admin-${stamp}@test.com`, name: 'App Admin', emailVerified: true });
    const saved = await helpers.saveUser(u);
    adminId = saved.id;
    await db.update(user).set({ role: 'admin' }).where(eq(user.id, adminId));

    await cleanup();
    await db.insert(trips).values({
      id: TRIP_ID, status: 'published', countryCode: 'FR', defaultCurrency: 'EUR',
      durationDays: 4, durationNights: 3, groupMin: 2, groupMax: 8, difficulty: 'easy', difficultyLevel: 2,
      publishedAt: new Date(),
    });
    await db.insert(departures).values([
      {
        id: DEP_OPEN, tripId: TRIP_ID, startDate: new Date('2027-06-01T08:00:00.000Z'), endDate: new Date('2027-06-04T18:00:00.000Z'),
        status: 'open', capacityMin: 2, capacityMax: 8, priceAmount: 100000, currency: 'EUR', pricingRules: {},
        bookingDeadline: new Date('2027-12-31T23:59:00.000Z'),
      },
      {
        id: DEP_CLOSED, tripId: TRIP_ID, startDate: new Date('2027-07-01T08:00:00.000Z'), endDate: new Date('2027-07-04T18:00:00.000Z'),
        status: 'closed', capacityMin: 2, capacityMax: 8, priceAmount: 100000, currency: 'EUR', pricingRules: {},
      },
      {
        id: DEP_LATE, tripId: TRIP_ID, startDate: new Date('2027-08-01T08:00:00.000Z'), endDate: new Date('2027-08-04T18:00:00.000Z'),
        status: 'open', capacityMin: 2, capacityMax: 8, priceAmount: 100000, currency: 'EUR', pricingRules: {},
        bookingDeadline: new Date('2020-01-01T00:00:00.000Z'),
      },
    ]);
  });

  afterAll(async () => {
    await cleanup();
    await helpers.deleteUser(adminId).catch(() => {});
  });

  beforeEach(() => resetRateLimiter());

  it('submits an application with events and outbox', async () => {
    const res = await submit({ ...baseInput, email: `cand-${stamp}@test.com` }, publicCtx());
    expect(res.id).toBeTypeOf('string');
    const [app] = await db.select().from(applications).where(eq(applications.id, res.id));
    expect(app.status).toBe('submitted');
    expect(app.consent).toBe(true);
    const events = await db.select().from(applicationEvents).where(eq(applicationEvents.applicationId, res.id));
    expect(events.map((e) => e.event).sort()).toEqual(['created', 'submitted']);
    const outbox = await db.select().from(outboxEvents).where(eq(outboxEvents.aggregateId, res.id));
    expect(outbox).toHaveLength(1);
    expect(outbox[0].eventType).toBe('application.submitted');
  });

  it('rejects closed departures and past deadlines', async () => {
    await expect(submit({ ...baseInput, departureId: DEP_CLOSED, email: `c1-${stamp}@test.com` }, publicCtx())).rejects.toThrow(
      /APPLICATION_CLOSED/,
    );
    await expect(submit({ ...baseInput, departureId: DEP_LATE, email: `c2-${stamp}@test.com` }, publicCtx())).rejects.toThrow(
      /APPLICATION_DEADLINE_PASSED/,
    );
  });

  it('conflicts on unverified duplicate emails', async () => {
    const email = `dup-${stamp}@test.com`;
    await submit({ ...baseInput, email }, publicCtx());
    await expect(submit({ ...baseInput, email }, publicCtx())).rejects.toThrow(/APPLICATION_EMAIL_CONFLICT/);
  });

  it('approves then refuses double decision', async () => {
    const res = await submit({ ...baseInput, email: `dec-${stamp}@test.com` }, publicCtx());
    const ok = await review({ id: res.id, decision: 'approved' }, adminCtx(adminId));
    expect(ok.status).toBe('approved');
    const [app] = await db.select().from(applications).where(eq(applications.id, res.id));
    expect(app.status).toBe('approved');
    const decisions = await db.select().from(applicationDecisions).where(eq(applicationDecisions.applicationId, res.id));
    expect(decisions).toHaveLength(1);
    await expect(review({ id: res.id, decision: 'declined' }, adminCtx(adminId))).rejects.toThrow();
  });

  it('withdraws with matching email only', async () => {
    const email = `wd-${stamp}@test.com`;
    const res = await submit({ ...baseInput, email }, publicCtx());
    await expect(withdraw({ id: res.id, email: 'autre@test.com' }, publicCtx())).rejects.toThrow();
    const ok = await withdraw({ id: res.id, email }, publicCtx());
    expect(ok.success).toBe(true);
    const [app] = await db.select().from(applications).where(eq(applications.id, res.id));
    expect(app.status).toBe('withdrawn');
  });
});
