import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';

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

import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { getDrizzle } from '@database/drizzle';
import { insertTestTrip } from '../helpers/trip-factory';
import { invalidateCache } from '@database/cache';
import { trips } from '@database/schemas/trips.schema';
import { departures } from '@database/schemas/departures.schema';
import { travelers } from '@database/schemas/travelers.schema';
import { applications, applicationEvents } from '@database/schemas/applications.schema';
import { reservations } from '@database/schemas/reservations.schema';
import { payments, checkoutSessions } from '@database/schemas/payments.schema';
import { outboxEvents } from '@database/schemas/outbox.schema';
import { user } from '@database/schemas';
import { resetRateLimiter } from '@/lib/rate-limit';
import { submitApplication, reviewApplication, withdrawApplication } from '@/actions/voyage/applications';
import { initiateCheckout, cancelReservation } from '@/actions/voyage/checkout';
import { refundPayment, payBalance } from '@/actions/voyage/payments';
import { getTestHelpers } from '../helpers/auth';
import { purgeOutboxForTrips } from '../helpers/voyage';

const submit = (submitApplication as never as { handler: Function }).handler as Function;
const review = (reviewApplication as never as { handler: Function }).handler as Function;
const withdraw = (withdrawApplication as never as { handler: Function }).handler as Function;
const initiate = (initiateCheckout as never as { handler: Function }).handler as Function;
const cancel = (cancelReservation as never as { handler: Function }).handler as Function;
const refund = (refundPayment as never as { handler: Function }).handler as Function;
const payBal = (payBalance as never as { handler: Function }).handler as Function;

const db = getDrizzle();
const stamp = Date.now().toString(36);
const TRIP = `test-a2-trip-${stamp}`;
const TRIP_DRAFT = `test-a2-draft-${stamp}`;
const TRIP_ACC = `test-a2-acc-${stamp}`;
const DEP = `test-a2-dep-${stamp}`;
const DEP_ACC = `test-a2-depacc-${stamp}`;

const baseSubmit = {
  legalName: 'Jane Doe', phone: null, roomPreference: 'shared',
  dietaryRequirements: null, accessibilityNeeds: null,
  activityAcknowledgement: true, motivation: null, expectations: null, consent: true, termsAccepted: true, locale: 'en',
};

const publicCtx = () =>
  ({
    locals: {},
    request: { headers: new Headers(), url: 'http://localhost:4321/en/apply/x' },
    clientAddress: `10.0.${Math.floor(Math.random() * 200) + 10}.${Math.floor(Math.random() * 200) + 10}`,
  }) as never;
// Candidature = compte vérifié obligatoire (inconditionnel) : ctx dont
// locals.user.email matche input.email. L'id doit exister en base (FK travelers.userId).
const verifiedCtx = (userId: string, email: string) =>
  ({
    locals: { user: { id: userId, email, emailVerified: true, banned: false } },
    request: { headers: new Headers(), url: 'http://localhost:4321/en/apply/x' },
    clientAddress: `10.0.${Math.floor(Math.random() * 200) + 10}.${Math.floor(Math.random() * 200) + 10}`,
  }) as never;
const adminCtx = (userId: string) =>
  ({
    locals: { user: { id: userId, role: 'admin', email: 'admin@test.com', banned: false } },
    request: { headers: new Headers(), url: 'http://localhost:4321/en/admin/trips' },
    clientAddress: '127.0.0.1',
  }) as never;

async function cleanup() {
  const tids = [TRIP, TRIP_DRAFT, TRIP_ACC];
  const allTrs = await db.select({ id: travelers.id, email: travelers.email }).from(travelers).catch(() => [] as { id: string; email: string }[]);
  await purgeOutboxForTrips(
    db,
    tids,
    allTrs.filter((t) => t.email.includes(stamp)).map((t) => t.id),
  ).catch(() => {});
  for (const tid of tids) {
    const apps = await db.select({ id: applications.id }).from(applications).where(eq(applications.tripId, tid)).catch(() => [] as { id: string }[]);
    for (const a of apps) {
      await db.delete(applicationEvents).where(eq(applicationEvents.applicationId, a.id)).catch(() => {});
      await db.delete(checkoutSessions).where(eq(checkoutSessions.applicationId, a.id)).catch(() => {});
      await db.delete(outboxEvents).where(eq(outboxEvents.aggregateId, a.id)).catch(() => {});
      await db.delete(applications).where(eq(applications.id, a.id)).catch(() => {});
    }
    const res = await db.select({ id: reservations.id }).from(reservations).where(eq(reservations.tripId, tid)).catch(() => [] as { id: string }[]);
    for (const r of res) {
      await db.delete(payments).where(eq(payments.reservationId, r.id)).catch(() => {});
      await db.delete(checkoutSessions).where(eq(checkoutSessions.reservationId, r.id)).catch(() => {});
      await db.delete(outboxEvents).where(eq(outboxEvents.aggregateId, r.id)).catch(() => {});
      await db.delete(reservations).where(eq(reservations.id, r.id)).catch(() => {});
    }
  }
  const trs = await db.select({ id: travelers.id, email: travelers.email }).from(travelers).catch(() => [] as { id: string; email: string }[]);
  for (const t of trs) {
    if (t.email.includes(stamp)) {
      await db.delete(travelers).where(eq(travelers.id, t.id)).catch(() => {});
    }
  }
  await db.delete(departures).where(eq(departures.tripId, TRIP)).catch(() => {});
  await db.delete(departures).where(eq(departures.tripId, TRIP_DRAFT)).catch(() => {});
  await db.delete(departures).where(eq(departures.tripId, TRIP_ACC)).catch(() => {});
  await db.delete(trips).where(eq(trips.id, TRIP)).catch(() => {});
  await db.delete(trips).where(eq(trips.id, TRIP_DRAFT)).catch(() => {});
  await db.delete(trips).where(eq(trips.id, TRIP_ACC)).catch(() => {});
  invalidateCache();
}

beforeAll(async () => {
  await cleanup();
  await insertTestTrip(db, [
    {
      id: TRIP, status: 'published', countryCode: 'FR', defaultCurrency: 'EUR',
      durationDays: 4, durationNights: 3, groupMin: 1, groupMax: 5, difficulty: 'easy', difficultyLevel: 1,
      publishedAt: new Date(),
    },
    {
      id: TRIP_DRAFT, status: 'draft', countryCode: 'FR', defaultCurrency: 'EUR',
      durationDays: 4, durationNights: 3, groupMin: 1, groupMax: 5, difficulty: 'easy', difficultyLevel: 1,
    },
    {
      id: TRIP_ACC, status: 'published', countryCode: 'FR', defaultCurrency: 'EUR',
      durationDays: 4, durationNights: 3, groupMin: 1, groupMax: 5, difficulty: 'easy', difficultyLevel: 1,
      requireAccount: true, publishedAt: new Date(),
    },
  ]);
  await db.insert(departures).values([
    {
      id: DEP, tripId: TRIP,
      startDate: new Date('2027-06-01T08:00:00.000Z'), endDate: new Date('2027-06-04T18:00:00.000Z'),
      status: 'open', capacityMin: 1, capacityMax: 5, priceAmount: 50000, currency: 'EUR', pricingRules: {},
    },
    {
      id: `${DEP}-closed`, tripId: TRIP,
      startDate: new Date('2027-06-01T08:00:00.000Z'), endDate: new Date('2027-06-04T18:00:00.000Z'),
      status: 'closed', capacityMin: 1, capacityMax: 5, priceAmount: 50000, currency: 'EUR', pricingRules: {},
    },
    {
      id: `${DEP}-draft`, tripId: TRIP,
      startDate: new Date('2027-06-01T08:00:00.000Z'), endDate: new Date('2027-06-04T18:00:00.000Z'),
      status: 'draft', capacityMin: 1, capacityMax: 5, priceAmount: 50000, currency: 'EUR', pricingRules: {},
    },
    {
      id: `${DEP}-cancelled`, tripId: TRIP,
      startDate: new Date('2027-06-01T08:00:00.000Z'), endDate: new Date('2027-06-04T18:00:00.000Z'),
      status: 'cancelled', capacityMin: 1, capacityMax: 5, priceAmount: 50000, currency: 'EUR', pricingRules: {},
    },
    {
      id: `${DEP}-completed`, tripId: TRIP,
      startDate: new Date('2027-06-01T08:00:00.000Z'), endDate: new Date('2027-06-04T18:00:00.000Z'),
      status: 'completed', capacityMin: 1, capacityMax: 5, priceAmount: 50000, currency: 'EUR', pricingRules: {},
    },
    {
      id: `${DEP}-past`, tripId: TRIP,
      startDate: new Date('2027-06-01T08:00:00.000Z'), endDate: new Date('2027-06-04T18:00:00.000Z'),
      status: 'open', capacityMin: 1, capacityMax: 5, priceAmount: 50000, currency: 'EUR', pricingRules: {},
      bookingDeadline: new Date('2020-01-01T00:00:00.000Z'),
    },
    {
      id: DEP_ACC, tripId: TRIP_ACC,
      startDate: new Date('2027-06-01T08:00:00.000Z'), endDate: new Date('2027-06-04T18:00:00.000Z'),
      status: 'open', capacityMin: 1, capacityMax: 5, priceAmount: 50000, currency: 'EUR', pricingRules: {},
    },
  ]);
});

afterAll(cleanup);

describe('submitApplication — fermetures, délais, comptes, rate-limit', () => {
  let adminId: string;
  let helpers: Awaited<ReturnType<typeof getTestHelpers>>;

  beforeAll(async () => {
    helpers = await getTestHelpers();
    const u = helpers.createUser({ email: `a2-admin-${stamp}@test.com`, name: 'A2', emailVerified: true });
    const saved = await helpers.saveUser(u);
    adminId = saved.id;
    await db.update(user).set({ role: 'admin' }).where(eq(user.id, adminId));
  });

  afterAll(async () => {
    await helpers.deleteUser(adminId).catch(() => {});
  });

  beforeEach(() => resetRateLimiter());

  it('rate-limit après 5 essais (même IP)', async () => {
    const ctxFor = (email: string) =>
      ({ locals: { user: { id: adminId, email, emailVerified: true, banned: false } }, request: { headers: new Headers(), url: 'http://x/' }, clientAddress: '192.168.99.77' }) as never;
    for (let i = 0; i < 5; i++) {
      await submit({ ...baseSubmit, tripId: TRIP, departureId: DEP, email: `rl${i}-${stamp}@test.com` }, ctxFor(`rl${i}-${stamp}@test.com`));
    }
    await expect(submit({ ...baseSubmit, tripId: TRIP, departureId: DEP, email: `rl5-${stamp}@test.com` }, ctxFor(`rl5-${stamp}@test.com`))).rejects.toMatchObject({ code: 'TOO_MANY_REQUESTS' });
  });

  it('voyage draft/inconnu -> APPLICATION_CLOSED, départ mismatch -> NOT_FOUND', async () => {
    await expect(submit({ ...baseSubmit, tripId: TRIP_DRAFT, departureId: DEP, email: `c1-${stamp}@test.com` }, verifiedCtx(adminId, `c1-${stamp}@test.com`))).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    await expect(submit({ ...baseSubmit, tripId: 'no-trip', departureId: DEP, email: `c2-${stamp}@test.com` }, verifiedCtx(adminId, `c2-${stamp}@test.com`))).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    await expect(submit({ ...baseSubmit, tripId: TRIP, departureId: DEP_ACC, email: `c3-${stamp}@test.com` }, verifiedCtx(adminId, `c3-${stamp}@test.com`))).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('statuts fermés draft/closed/cancelled/completed -> APPLICATION_CLOSED + deadline passée', async () => {
    for (const suffix of ['closed', 'draft', 'cancelled', 'completed']) {
      await expect(
        submit({ ...baseSubmit, tripId: TRIP, departureId: `${DEP}-${suffix}`, email: `${suffix}-${stamp}@test.com` }, verifiedCtx(adminId, `${suffix}-${stamp}@test.com`)),
      ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    }
    await expect(
      submit({ ...baseSubmit, tripId: TRIP, departureId: `${DEP}-past`, email: `past-${stamp}@test.com` }, verifiedCtx(adminId, `past-${stamp}@test.com`)),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  it('compte exigé pour tout voyage : UNAUTHORIZED sans session, FORBIDDEN email différent', async () => {
    // Inconditionnel depuis 2026-09-21 : valable sur un voyage SANS requireAccount.
    await expect(
      submit({ ...baseSubmit, tripId: TRIP, departureId: DEP, email: `acc-${stamp}@test.com` }, publicCtx()),
    ).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
    await expect(
      submit({ ...baseSubmit, tripId: TRIP, departureId: DEP, email: `other-${stamp}@test.com` }, verifiedCtx(adminId, 'verified@test.com')),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('doublon actif -> CONFLICT, après withdraw -> nouvelle candidature OK', async () => {
    const email = `dup-${stamp}@test.com`;
    const first = await submit({ ...baseSubmit, tripId: TRIP, departureId: DEP, email }, verifiedCtx(adminId, email));
    expect(first.id).toBeTypeOf('string');
    // non vérifié : le conflit email répond d'abord (règle anti-spam préexistante)
    const errMail = await submit({ ...baseSubmit, tripId: TRIP, departureId: DEP, email }, verifiedCtx(adminId, email)).catch((e: unknown) => e);
    expect((errMail as { code: string }).code).toBe('CONFLICT');
    expect((errMail as Error).message).toContain('APPLICATION_EMAIL_CONFLICT');
    await db.update(travelers).set({ emailVerifiedAt: new Date() }).where(eq(travelers.email, email));
    // vérifié : la déduplication dossier répond
    const errDup = await submit({ ...baseSubmit, tripId: TRIP, departureId: DEP, email }, verifiedCtx(adminId, email)).catch((e: unknown) => e);
    expect((errDup as { code: string }).code).toBe('CONFLICT');
    expect((errDup as Error).message).toContain('APPLICATION_DUPLICATE');
    await withdraw({ id: first.id, email }, publicCtx());
    const second = await submit({ ...baseSubmit, tripId: TRIP, departureId: DEP, email }, verifiedCtx(adminId, email));
    expect(second.id).toBeTypeOf('string');
    expect(second.id).not.toBe(first.id);
  });

  it('deux candidatures simultanées même email -> une passe, une EMAIL_CONFLICT', async () => {
    const email = `race-${stamp}@test.com`;
    const ctxA = verifiedCtx(adminId, email);
    const ctxB = verifiedCtx(adminId, email);
    const [one, two] = await Promise.allSettled([
      submit({ ...baseSubmit, tripId: TRIP, departureId: DEP, email }, ctxA),
      submit({ ...baseSubmit, tripId: TRIP, departureId: DEP, email }, ctxB),
    ]);
    const ok = [one, two].filter((s) => s.status === 'fulfilled');
    const ko = [one, two].filter((s) => s.status === 'rejected');
    expect(ok).toHaveLength(1);
    expect(ko).toHaveLength(1);
    expect(String((ko[0] as PromiseRejectedResult).reason?.message ?? '')).toContain('APPLICATION_EMAIL_CONFLICT');
  });

  it('deux candidatures simultanées voyageur vérifié -> une passe, une DUPLICATE (garde anti-course)', async () => {
    const email = `racev-${stamp}@test.com`;
    const [t] = await db.insert(travelers).values({ email, locale: 'en', emailVerifiedAt: new Date() }).returning({ id: travelers.id });
    void t;
    const [one, two] = await Promise.allSettled([
      submit({ ...baseSubmit, tripId: TRIP, departureId: DEP, email }, verifiedCtx(adminId, email)),
      submit({ ...baseSubmit, tripId: TRIP, departureId: DEP, email }, verifiedCtx(adminId, email)),
    ]);
    const ok = [one, two].filter((s) => s.status === 'fulfilled');
    const ko = [one, two].filter((s) => s.status === 'rejected');
    expect(ok).toHaveLength(1);
    expect(ko).toHaveLength(1);
    expect(String((ko[0] as PromiseRejectedResult).reason?.message ?? '')).toContain('APPLICATION_DUPLICATE');
  });
});

describe('review/withdraw — décisions et retraits', () => {
  let adminId: string;
  let helpers: Awaited<ReturnType<typeof getTestHelpers>>;

  beforeAll(async () => {
    helpers = await getTestHelpers();
    const u = helpers.createUser({ email: `a2-rev-${stamp}@test.com`, name: 'A2R', emailVerified: true });
    const saved = await helpers.saveUser(u);
    adminId = saved.id;
    await db.update(user).set({ role: 'admin' }).where(eq(user.id, adminId));
  });

  afterAll(async () => {
    await helpers.deleteUser(adminId).catch(() => {});
  });

  beforeEach(() => resetRateLimiter());

  async function mkApp(status: 'submitted' | 'contact_required' | 'approved', email: string) {
    const [t] = await db.insert(travelers).values({ email, locale: 'en' }).returning({ id: travelers.id });
    const id = randomUUID();
    await db.insert(applications).values({
      id, travelerId: t.id, tripId: TRIP, departureId: DEP, status,
      activityAcknowledgement: true, consent: true, submittedAt: new Date(),
    });
    return { id, email };
  }

  it('review NOT_FOUND, approved happy + checkout TTL 7j, declined + event', async () => {
    await expect(review({ id: randomUUID(), decision: 'approved' }, adminCtx(adminId))).rejects.toMatchObject({ code: 'NOT_FOUND' });
    const a = await mkApp('submitted', `appr-${stamp}@test.com`);
    const res = await review({ id: a.id, decision: 'approved', internalNote: null }, adminCtx(adminId));
    expect(res.status).toBe('approved');
    const sessions = await db.select().from(checkoutSessions).where(eq(checkoutSessions.applicationId, a.id));
    expect(sessions).toHaveLength(1);
    const ttlDays = (sessions[0].expiresAt.getTime() - Date.now()) / 86_400_000;
    expect(ttlDays).toBeGreaterThan(6);
    expect(ttlDays).toBeLessThanOrEqual(8);
    const outbox = await db.select().from(outboxEvents).where(eq(outboxEvents.aggregateId, a.id));
    expect(outbox.some((e) => e.eventType === 'application.approved')).toBe(true);
    expect(outbox.some((e) => e.eventType === 'checkout.created')).toBe(true);
    const d = await mkApp('submitted', `decl-${stamp}@test.com`);
    await review({ id: d.id, decision: 'declined', internalNote: 'trop tôt' }, adminCtx(adminId));
    const ev = await db.select().from(applicationEvents).where(eq(applicationEvents.applicationId, d.id));
    expect(ev.some((e) => e.event === 'declined')).toBe(true);
    const { applicationDecisions: decisions } = await import('@database/schemas/applications.schema');
    const dec = await db.select().from(decisions).where(eq(decisions.applicationId, d.id));
    expect(dec).toHaveLength(1);
    expect(dec[0].internalNote).toBe('trop tôt');
  });

  it('review depuis contact_required, refus depuis approved', async () => {
    const a = await mkApp('contact_required', `cr-${stamp}@test.com`);
    const res = await review({ id: a.id, decision: 'approved' }, adminCtx(adminId));
    expect(res.status).toBe('approved');
    const b = await mkApp('approved', `ap2-${stamp}@test.com`);
    await expect(review({ id: b.id, decision: 'declined' }, adminCtx(adminId))).rejects.toBeDefined();
  });

  it('withdraw NOT_FOUND, FORBIDDEN email, happy puis double -> erreur', async () => {
    await expect(withdraw({ id: randomUUID(), email: `x-${stamp}@test.com` }, publicCtx())).rejects.toMatchObject({ code: 'NOT_FOUND' });
    const a = await mkApp('submitted', `wd-${stamp}@test.com`);
    await expect(withdraw({ id: a.id, email: `wrong-${stamp}@test.com` }, publicCtx())).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await withdraw({ id: a.id, email: a.email }, publicCtx());
    await expect(withdraw({ id: a.id, email: a.email }, publicCtx())).rejects.toBeDefined();
  });
});

describe('checkout initiate + cancel action', () => {
  let adminId: string;
  let helpers: Awaited<ReturnType<typeof getTestHelpers>>;

  beforeAll(async () => {
    helpers = await getTestHelpers();
    const u = helpers.createUser({ email: `a2-cko-${stamp}@test.com`, name: 'A2C', emailVerified: true });
    const saved = await helpers.saveUser(u);
    adminId = saved.id;
    await db.update(user).set({ role: 'admin' }).where(eq(user.id, adminId));
  });

  afterAll(async () => {
    await helpers.deleteUser(adminId).catch(() => {});
  });

  beforeEach(() => resetRateLimiter());

  it('initiate single + accord + locale fr, session expirée -> GONE', async () => {
    const [t] = await db.insert(travelers).values({ email: `ck-${stamp}@test.com`, locale: 'fr' }).returning({ id: travelers.id });
    const appId = randomUUID();
    await db.insert(applications).values({
      id: appId, travelerId: t.id, tripId: TRIP, departureId: DEP, status: 'approved',
      activityAcknowledgement: true, consent: true, submittedAt: new Date(),
    });
    const { createApplicationCheckout } = await import('@/modules/payments/domain/checkout-service');
    const { policyVersions } = await import('@database/schemas/policies.schema');
    const s = await createApplicationCheckout(appId, DEP);
    const [pv] = await db.select({ id: policyVersions.id }).from(policyVersions).limit(1);
    const ctx = { locals: {}, request: { headers: new Headers(), url: 'http://localhost:4321/en/checkout/x' }, clientAddress: '10.9.9.9' } as never;
    await expect(
      initiate({ checkoutSessionId: s.id, travelerEmail: `ck-${stamp}@test.com`, termsAccepted: true, agreementVersionId: '00000000-0000-0000-0000-000000000000' }, ctx),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    const res = await initiate({ checkoutSessionId: s.id, travelerEmail: `ck-${stamp}@test.com`, roomType: 'single', agreementVersionId: pv.id, locale: 'fr', termsAccepted: true }, ctx);
    expect(res.checkoutUrl).toBeTruthy();
    // email normalisé : casse différente acceptée (puis conflit réservation existante -> CONFLICT transport)
    await expect(initiate({ checkoutSessionId: s.id, travelerEmail: `CK-${stamp}@TEST.COM` }, ctx)).rejects.toMatchObject({ code: 'CONFLICT' });
    await db.update(checkoutSessions).set({ expiresAt: new Date('2020-01-01') }).where(eq(checkoutSessions.id, s.id));
    await expect(initiate({ checkoutSessionId: s.id, travelerEmail: `ck-${stamp}@test.com` }, ctx)).rejects.toMatchObject({ code: 'GONE' });
  });

  it('cancel NOT_FOUND, remboursement manuel sans paid, idempotence 2e cancel', async () => {
    await expect(cancel({ reservationId: randomUUID() }, adminCtx(adminId))).rejects.toMatchObject({ code: 'NOT_FOUND' });
    const [t] = await db.insert(travelers).values({ email: `cx-${stamp}@test.com`, locale: 'en' }).returning({ id: travelers.id });
    const [r] = await db.insert(reservations).values({
      reservationNumber: `ATL-2027-X${stamp.slice(-4).toUpperCase()}`,
      travelerId: t.id, tripId: TRIP, departureId: DEP, status: 'confirmed',
      currency: 'EUR', baseAmount: 100000, totalAmount: 100000, amountPaid: 100000, amountDue: 0,
    }).returning({ id: reservations.id });
    await db.insert(payments).values({
      reservationId: r.id, provider: 'mock', type: 'full_payment', status: 'failed',
      amount: 100000, currency: 'EUR', idempotencyKey: `cx-${stamp}`, providerPaymentId: `mock_cx_${stamp}`,
    });
    const res = await cancel({ reservationId: r.id }, adminCtx(adminId));
    expect(res.success).toBe(true);
    expect(res.providerRefundId).toBeNull();
    await expect(cancel({ reservationId: r.id }, adminCtx(adminId))).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });
});

describe('refundPayment + payBalance actions', () => {
  let adminId: string;
  let helpers: Awaited<ReturnType<typeof getTestHelpers>>;

  beforeAll(async () => {
    helpers = await getTestHelpers();
    const u = helpers.createUser({ email: `a2-pay-${stamp}@test.com`, name: 'A2P', emailVerified: true });
    const saved = await helpers.saveUser(u);
    adminId = saved.id;
    await db.update(user).set({ role: 'admin' }).where(eq(user.id, adminId));
  });

  afterAll(async () => {
    await helpers.deleteUser(adminId).catch(() => {});
  });

  it('refund NOT_FOUND, sans paid -> BAD_REQUEST, partiel + total', async () => {
    await expect(refund({ reservationId: randomUUID() }, adminCtx(adminId))).rejects.toMatchObject({ code: 'NOT_FOUND' });
    const [t] = await db.insert(travelers).values({ email: `rf-${stamp}@test.com`, locale: 'en' }).returning({ id: travelers.id });
    const [r] = await db.insert(reservations).values({
      reservationNumber: `ATL-2027-R${stamp.slice(-4).toUpperCase()}`,
      travelerId: t.id, tripId: TRIP, departureId: DEP, status: 'cancelled',
      currency: 'EUR', baseAmount: 100000, totalAmount: 100000, amountPaid: 100000, amountDue: 0,
    }).returning({ id: reservations.id });
    await expect(refund({ reservationId: r.id }, adminCtx(adminId))).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    await db.insert(payments).values({
      reservationId: r.id, provider: 'mock', type: 'full_payment', status: 'paid',
      amount: 100000, currency: 'EUR', idempotencyKey: `rf-${stamp}`, providerPaymentId: `mock_rf_${stamp}`,
    });
    const part = await refund({ reservationId: r.id, amount: 40000 }, adminCtx(adminId));
    expect(part.success).toBe(true);
    expect(part.providerRefundId).toBeTruthy();
    const full = await refund({ reservationId: r.id, amount: 60000 }, adminCtx(adminId));
    expect(full.success).toBe(true);
  });

  it('payBalance inconnu -> GONE, soldée -> CONFLICT, email faux -> GONE, happy', async () => {
    const ctx = { locals: {}, request: { headers: new Headers(), url: 'http://localhost:4321/en/booking-confirmed' }, clientAddress: '10.8.8.8' } as never;
    await expect(payBal({ reservationId: randomUUID(), travelerEmail: `z-${stamp}@test.com` }, ctx)).rejects.toMatchObject({ code: 'GONE' });
    const [t] = await db.insert(travelers).values({ email: `pb-${stamp}@test.com`, locale: 'en' }).returning({ id: travelers.id });
    const [sold] = await db.insert(reservations).values({
      reservationNumber: `ATL-2027-S${stamp.slice(-4).toUpperCase()}`,
      travelerId: t.id, tripId: TRIP, departureId: DEP, status: 'confirmed',
      currency: 'EUR', baseAmount: 100000, totalAmount: 100000, amountPaid: 100000, amountDue: 0,
    }).returning({ id: reservations.id });
    await expect(payBal({ reservationId: sold.id, travelerEmail: `pb-${stamp}@test.com` }, ctx)).rejects.toMatchObject({ code: 'CONFLICT' });
    const [due] = await db.insert(reservations).values({
      reservationNumber: `ATL-2027-D${stamp.slice(-4).toUpperCase()}`,
      travelerId: t.id, tripId: TRIP, departureId: DEP, status: 'balance_due',
      currency: 'EUR', baseAmount: 100000, totalAmount: 100000, amountPaid: 20000, amountDue: 80000,
    }).returning({ id: reservations.id });
    await expect(payBal({ reservationId: due.id, travelerEmail: `wrong-${stamp}@test.com` }, ctx)).rejects.toMatchObject({ code: 'GONE' });
    const ok = await payBal({ reservationId: due.id, travelerEmail: `pb-${stamp}@test.com`, locale: 'en' }, ctx);
    expect(ok.checkoutUrl).toBeTruthy();
  });

  it('payBalance échec provider -> BAD_REQUEST', async () => {
    const { mockProvider } = await import('@/modules/payments/domain/providers');
    const [t] = await db.insert(travelers).values({ email: `pb2-${stamp}@test.com`, locale: 'en' }).returning({ id: travelers.id });
    const [due] = await db.insert(reservations).values({
      reservationNumber: `ATL-2027-E${stamp.slice(-4).toUpperCase()}`,
      travelerId: t.id, tripId: TRIP, departureId: DEP, status: 'balance_due',
      currency: 'EUR', baseAmount: 100000, totalAmount: 100000, amountPaid: 20000, amountDue: 80000,
    }).returning({ id: reservations.id });
    const spy = vi.spyOn(mockProvider, 'createCheckoutSession').mockRejectedValueOnce(new Error('down'));
    const ctx = { locals: {}, request: { headers: new Headers(), url: 'http://localhost:4321/en/booking-confirmed' }, clientAddress: '10.8.8.9' } as never;
    await expect(payBal({ reservationId: due.id, travelerEmail: `pb2-${stamp}@test.com` }, ctx)).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    spy.mockRestore();
  });
});
