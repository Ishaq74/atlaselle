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
import { trips, tripTranslations, tripHighlights, tripHighlightTranslations, tripRevisions } from '@database/schemas/trips.schema';
import { departures } from '@database/schemas/departures.schema';
import { travelers } from '@database/schemas/travelers.schema';
import { applications, applicationDecisions, applicationEvents } from '@database/schemas/applications.schema';
import { reservations } from '@database/schemas/reservations.schema';
import { payments, checkoutSessions } from '@database/schemas/payments.schema';
import { emailDeliveries } from '@database/schemas/email-voyage.schema';
import { faqs, faqTranslations, tripFaqs } from '@database/schemas/trips.schema';
import { policyDocuments, policyVersions } from '@database/schemas/policies.schema';
import { loadAdminApplications, loadAdminApplication } from '@/modules/applications/loaders/admin-applications.loader';
import { loadAdminReservations, loadAdminReservation } from '@/modules/reservations/loaders/admin-reservations.loader';
import { loadAdminPayments } from '@/modules/payments/loaders/admin-payments.loader';
import { loadAdminTravelers } from '@/modules/travelers/loaders/admin-travelers.loader';
import { loadAdminDeliveries } from '@/modules/email-voyage/loaders/admin-email.loader';
import { loadAdminPolicies } from '@/modules/policies/loaders/admin-policies.loader';
import { loadAdminTripFaqs } from '@/modules/trips/loaders/admin-contents.loader';
import { loadAdminTrips, listTripRevisions } from '@/modules/trips/loaders/admin-trips.loader';
import { loadOpenDepartures } from '@/modules/departures/loaders/departure.loader';

const db = getDrizzle();
const stamp = Date.now().toString(36);
const TRIP = `test-l2-trip-${stamp}`;
const TRIP_BARE = `test-l2-bare-${stamp}`;

function expectSortedAsc(rows: { createdAt: Date }[]) {
  const times = rows.map((r) => new Date(r.createdAt).getTime());
  expect(times.every((t, i) => i === 0 || times[i - 1] <= t)).toBe(true);
}

function expectSortedDesc(rows: { createdAt: Date }[]) {
  const times = rows.map((r) => new Date(r.createdAt).getTime());
  expect(times.every((t, i) => i === 0 || times[i - 1] >= t)).toBe(true);
}

async function cleanup() {
  for (const tid of [TRIP, TRIP_BARE]) {
    const apps = await db.select({ id: applications.id }).from(applications).where(eq(applications.tripId, tid)).catch(() => [] as { id: string }[]);
    for (const a of apps) {
      await db.delete(applicationDecisions).where(eq(applicationDecisions.applicationId, a.id)).catch(() => {});
      await db.delete(applicationEvents).where(eq(applicationEvents.applicationId, a.id)).catch(() => {});
      await db.delete(checkoutSessions).where(eq(checkoutSessions.applicationId, a.id)).catch(() => {});
      await db.delete(applications).where(eq(applications.id, a.id)).catch(() => {});
    }
    const res = await db.select({ id: reservations.id }).from(reservations).where(eq(reservations.tripId, tid)).catch(() => [] as { id: string }[]);
    for (const r of res) {
      await db.delete(payments).where(eq(payments.reservationId, r.id)).catch(() => {});
      await db.delete(checkoutSessions).where(eq(checkoutSessions.reservationId, r.id)).catch(() => {});
      await db.delete(reservations).where(eq(reservations.id, r.id)).catch(() => {});
    }
    const hls = await db.select({ id: tripHighlights.id }).from(tripHighlights).where(eq(tripHighlights.tripId, tid)).catch(() => [] as { id: string }[]);
    for (const h of hls) {
      await db.delete(tripHighlightTranslations).where(eq(tripHighlightTranslations.highlightId, h.id)).catch(() => {});
      await db.delete(tripHighlights).where(eq(tripHighlights.id, h.id)).catch(() => {});
    }
    const links = await db.select().from(tripFaqs).where(eq(tripFaqs.tripId, tid)).catch(() => [] as { faqId: string }[]);
    for (const l of links) {
      await db.delete(faqTranslations).where(eq(faqTranslations.faqId, l.faqId)).catch(() => {});
      await db.delete(faqs).where(eq(faqs.id, l.faqId)).catch(() => {});
      await db.delete(tripFaqs).where(eq(tripFaqs.tripId, tid)).catch(() => {});
    }
    await db.delete(tripTranslations).where(eq(tripTranslations.tripId, tid)).catch(() => {});
    await db.delete(departures).where(eq(departures.tripId, tid)).catch(() => {});
    await db.delete(trips).where(eq(trips.id, tid)).catch(() => {});
  }
  const trs = await db.select({ id: travelers.id, email: travelers.email }).from(travelers).catch(() => [] as { id: string; email: string }[]);
  for (const t of trs) {
    if (t.email.includes(stamp)) {
      await db.delete(emailDeliveries).where(eq(emailDeliveries.travelerId, t.id)).catch(() => {});
      await db.delete(travelers).where(eq(travelers.id, t.id)).catch(() => {});
    }
  }
  invalidateCache();
}

beforeAll(async () => {
  await cleanup();
  await db.insert(trips).values([
    {
      id: TRIP, status: 'published', countryCode: 'FR', defaultCurrency: 'EUR',
      durationDays: 4, durationNights: 3, groupMin: 1, groupMax: 5, difficulty: 'easy', difficultyLevel: 1,
      publishedAt: new Date(),
    },
    {
      id: TRIP_BARE, status: 'published', countryCode: 'FR', defaultCurrency: 'EUR',
      durationDays: 4, durationNights: 3, groupMin: 1, groupMax: 5, difficulty: 'easy', difficultyLevel: 1,
      publishedAt: new Date(),
    },
  ]);
  await db.insert(tripTranslations).values({
    id: `l2-tr-${stamp}`, tripId: TRIP, locale: 'en', slug: `l2-${stamp}`,
    title: 'L2 Trip', summary: 'S', overview: 'O', localeVisible: true,
  });
  await db.insert(departures).values([
    {
      id: `l2-dep-open-${stamp}`, tripId: TRIP,
      startDate: new Date('2027-05-01T08:00:00.000Z'), endDate: new Date('2027-05-04T18:00:00.000Z'),
      status: 'open', capacityMin: 1, capacityMax: 5, priceAmount: 50000, currency: 'EUR', pricingRules: {},
    },
    {
      id: `l2-dep-lim-${stamp}`, tripId: TRIP,
      startDate: new Date('2027-04-01T08:00:00.000Z'), endDate: new Date('2027-04-04T18:00:00.000Z'),
      status: 'limited', capacityMin: 1, capacityMax: 5, priceAmount: 50000, currency: 'EUR', pricingRules: {},
    },
    {
      id: `l2-dep-wl-${stamp}`, tripId: TRIP,
      startDate: new Date('2027-06-01T08:00:00.000Z'), endDate: new Date('2027-06-04T18:00:00.000Z'),
      status: 'waitlist', capacityMin: 1, capacityMax: 5, priceAmount: 50000, currency: 'EUR', pricingRules: {},
    },
    {
      id: `l2-dep-closed-${stamp}`, tripId: TRIP,
      startDate: new Date('2027-03-01T08:00:00.000Z'), endDate: new Date('2027-03-04T18:00:00.000Z'),
      status: 'closed', capacityMin: 1, capacityMax: 5, priceAmount: 50000, currency: 'EUR', pricingRules: {},
    },
  ]);
});

afterAll(cleanup);

describe('loadAdminApplication détail', () => {
  it('null inconnu, traveler, decisions desc, events asc, checkouts limit 5', async () => {
    expect(await loadAdminApplication('00000000-0000-0000-0000-000000000000')).toBeNull();
    const [t] = await db.insert(travelers).values({ email: `l2app-${stamp}@test.com`, locale: 'en' }).returning({ id: travelers.id });
    const [a] = await db.insert(applications).values({
      travelerId: t.id, tripId: TRIP, departureId: `l2-dep-open-${stamp}`, status: 'submitted',
      activityAcknowledgement: true, consent: true, submittedAt: new Date(),
    }).returning({ id: applications.id });
    await db.insert(applicationDecisions).values([
      { applicationId: a.id, decision: 'contact_required', createdAt: new Date('2026-01-01') },
      { applicationId: a.id, decision: 'approved', createdAt: new Date('2026-02-01') },
    ]);
    await db.insert(applicationEvents).values([
      { applicationId: a.id, event: 'submitted', createdAt: new Date('2026-01-01') },
      { applicationId: a.id, event: 'created', createdAt: new Date('2025-12-01') },
    ]);
    for (let i = 0; i < 6; i++) {
      await db.insert(checkoutSessions).values({
        applicationId: a.id, departureId: `l2-dep-open-${stamp}`,
        expiresAt: new Date('2028-01-01'), createdAt: new Date(`2026-03-0${i + 1}T00:00:00.000Z`),
      });
    }
    const detail = await loadAdminApplication(a.id);
    expect(detail?.traveler?.id).toBe(t.id);
    expect(detail?.decisions.map((d) => d.decision)).toEqual(['approved', 'contact_required']);
    expect(detail?.events.map((e) => e.event)).toEqual(['created', 'submitted']);
    expect(detail?.checkouts).toHaveLength(5);
    // filtres liste : departureId, combinés, pagination, asc
    const byDep = await loadAdminApplications({ tripId: TRIP, departureId: `l2-dep-open-${stamp}` });
    expect(byDep.rows.every((r) => r.departureId === `l2-dep-open-${stamp}`)).toBe(true);
    const [tOld] = await db.insert(travelers).values({ email: `l2old-${stamp}@test.com`, locale: 'en' }).returning({ id: travelers.id });
    const [aOldRow] = await db.insert(applications).values({
      travelerId: tOld.id, tripId: TRIP, departureId: `l2-dep-open-${stamp}`, status: 'submitted',
      activityAcknowledgement: true, consent: true, submittedAt: new Date(),
      createdAt: new Date('2020-01-01T00:00:00.000Z'),
    }).returning({ id: applications.id });
    const aOld = aOldRow.id;
    const asc = await loadAdminApplications({ tripId: TRIP, sortOrder: 'asc', pageSize: '50' });
    const desc = await loadAdminApplications({ tripId: TRIP, sortOrder: 'desc', pageSize: '50' });
    expect(asc.rows[0].id).toBe(aOld);
    expect(desc.rows[desc.rows.length - 1].id).toBe(aOld);
    const p1 = await loadAdminApplications({ tripId: TRIP, page: '1', pageSize: '1' });
    expect(p1.rows).toHaveLength(1);
    expect(p1.meta.page).toBe(1);
  });
});

describe('loadAdminReservations filtres + détail', () => {
  it('status, pagination, asc/desc, montants, payments desc, tripTitle fallback', async () => {
    const [t] = await db.insert(travelers).values({ email: `l2res-${stamp}@test.com`, locale: 'en' }).returning({ id: travelers.id });
    const mk = async (status: 'awaiting_payment' | 'confirmed', n: string) => {
      const [r] = await db.insert(reservations).values({
        reservationNumber: `ATL-2027-L${n}${stamp.slice(-3).toUpperCase()}`,
        travelerId: t.id, tripId: TRIP, departureId: `l2-dep-open-${stamp}`, status,
        currency: 'EUR', baseAmount: 50000, totalAmount: 50000, amountPaid: 0, amountDue: 50000,
      }).returning({ id: reservations.id });
      return r.id;
    };
    const id1 = await mk('awaiting_payment', 'A');
    const id2 = await mk('confirmed', 'B');
    await db.update(reservations).set({ createdAt: new Date('2021-01-01T00:00:00.000Z') }).where(eq(reservations.id, id1));
    await db.update(reservations).set({ createdAt: new Date('2022-01-01T00:00:00.000Z') }).where(eq(reservations.id, id2));
    const filtered = await loadAdminReservations({ tripId: TRIP, status: 'confirmed' });
    expect(filtered.rows.every((r) => r.status === 'confirmed')).toBe(true);
    expect(filtered.rows.some((r) => r.id === id2)).toBe(true);
    const asc = await loadAdminReservations({ tripId: TRIP, sortOrder: 'asc', pageSize: '50' });
    const descR = await loadAdminReservations({ tripId: TRIP, sortOrder: 'desc', pageSize: '50' });
    expect(asc.rows.map((r) => r.id).indexOf(id1)).toBeLessThan(asc.rows.map((r) => r.id).indexOf(id2));
    expect(descR.rows.map((r) => r.id).indexOf(id2)).toBeLessThan(descR.rows.map((r) => r.id).indexOf(id1));
    expect(asc.meta.total).toBeGreaterThanOrEqual(2);
    const found = asc.rows.find((r) => r.id === id1)!;
    expect(found.amountPaid).toBe(0);
    expect(found.amountDue).toBe(50000);
    expect(found.currency).toBe('EUR');
    await db.insert(payments).values([
      { reservationId: id1, provider: 'mock', type: 'full_payment', status: 'created', amount: 50000, currency: 'EUR', idempotencyKey: `l2a-${stamp}`, createdAt: new Date('2026-01-01') },
      { reservationId: id1, provider: 'mock', type: 'full_payment', status: 'failed', amount: 50000, currency: 'EUR', idempotencyKey: `l2b-${stamp}`, createdAt: new Date('2026-02-01') },
    ]);
    const detail = await loadAdminReservation(id1);
    expect(detail?.payments.map((p) => p.status)).toEqual(['failed', 'created']);
    expect(detail?.tripTitle).toBe('L2 Trip');
    // fallback : voyage sans traduction -> tripId
    const [r3] = await db.insert(reservations).values({
      reservationNumber: `ATL-2027-LC${stamp.slice(-3).toUpperCase()}`,
      travelerId: t.id, tripId: TRIP_BARE, departureId: `l2-dep-open-${stamp}`, status: 'pending',
      currency: 'EUR', baseAmount: 1, totalAmount: 1, amountPaid: 0, amountDue: 1,
    }).returning({ id: reservations.id });
    expect((await loadAdminReservation(r3.id))?.tripTitle).toBe(TRIP_BARE);
    // booking.loader : même repli tripId quand aucune traduction
    const { loadBookingByProviderSession } = await import('@/modules/reservations/loaders/booking.loader');
    const [bareApp] = await db.insert(applications).values({
      travelerId: t.id, tripId: TRIP_BARE, departureId: `l2-dep-open-${stamp}`, status: 'submitted',
      activityAcknowledgement: true, consent: true, submittedAt: new Date(),
    }).returning({ id: applications.id });
    const [co] = await db.insert(checkoutSessions).values({
      applicationId: bareApp.id, departureId: `l2-dep-open-${stamp}`, reservationId: r3.id,
      providerSessionId: `prov-bare-${stamp}`, expiresAt: new Date('2028-01-01'),
    }).returning({ id: checkoutSessions.id });
    const booking = await loadBookingByProviderSession('en', `prov-bare-${stamp}`);
    expect(booking?.tripTitle).toBe(TRIP_BARE);
    await db.delete(checkoutSessions).where(eq(checkoutSessions.id, co.id));
    await db.delete(applications).where(eq(applications.id, bareApp.id));
    void id2;
  });
});

describe('loadAdminPayments + travelers + emails — filtres et tri', () => {
  it('payments status/type/combinés/asc-desc', async () => {
    const byStatus = await loadAdminPayments({ status: 'created' });
    expect(byStatus.rows.every((r) => r.status === 'created')).toBe(true);
    const byType = await loadAdminPayments({ type: 'full_payment' });
    expect(byType.rows.every((r) => r.type === 'full_payment')).toBe(true);
    const asc = await loadAdminPayments({ sortOrder: 'asc', pageSize: '100' });
    const desc = await loadAdminPayments({ sortOrder: 'desc', pageSize: '100' });
    expectSortedAsc(asc.rows);
    expectSortedDesc(desc.rows);
  });

  it('travelers legalName, 0 résultat, counts 0, RGPD-safe', async () => {
    const [t] = await db.insert(travelers).values({ email: `l2trav-${stamp}@test.com`, legalName: `Unique Legal ${stamp}`, locale: 'fr' }).returning({ id: travelers.id });
    const byName = await loadAdminTravelers({ search: `Unique Legal ${stamp}` });
    expect(byName.rows).toHaveLength(1);
    expect(byName.rows[0].applicationsCount).toBe(0);
    expect(byName.rows[0].reservationsCount).toBe(0);
    expect(byName.rows[0].locale).toBe('fr');
    expect(byName.rows[0]).not.toHaveProperty('phone');
    expect(byName.rows[0]).not.toHaveProperty('accessibilityNeeds');
    expect(byName.rows[0]).not.toHaveProperty('userId');
    expect(byName.rows[0].emailVerifiedAt).toBeNull();
    expect(await loadAdminTravelers({ search: `zzz-no-${stamp}` })).toMatchObject({ rows: [] });
    const asc = await loadAdminTravelers({ sortOrder: 'asc', pageSize: '100' });
    const desc = await loadAdminTravelers({ sortOrder: 'desc', pageSize: '100' });
    expectSortedAsc(asc.rows);
    expectSortedDesc(desc.rows);
    void t;
  });

  it('emails status/combinés/asc-desc', async () => {
    const [t] = await db.insert(travelers).values({ email: `l2mail-${stamp}@test.com`, locale: 'en' }).returning({ id: travelers.id });
    await db.insert(emailDeliveries).values([
      { templateKey: 'balance_due', locale: 'en', toEmail: `l2mail-${stamp}@test.com`, travelerId: t.id, status: 'sent', sentAt: new Date() },
      { templateKey: 'balance_due', locale: 'en', toEmail: `l2mail-${stamp}@test.com`, travelerId: t.id, status: 'failed', lastError: 'x' },
    ]);
    const failed = await loadAdminDeliveries({ templateKey: 'balance_due', status: 'failed' });
    expect(failed.rows.some((r) => r.toEmail === `l2mail-${stamp}@test.com`)).toBe(true);
    const asc = await loadAdminDeliveries({ templateKey: 'balance_due', sortOrder: 'asc' });
    const desc = await loadAdminDeliveries({ templateKey: 'balance_due', sortOrder: 'desc' });
    expectSortedAsc(asc.rows);
    expectSortedDesc(desc.rows);
    expect(asc.rows.some((r) => r.toEmail === `l2mail-${stamp}@test.com`)).toBe(true);
  });
});

describe('policies, contents, departures, trips-list — ordres et cas', () => {
  it('policies : versions desc, doc brouillon -> published null (doc propre)', async () => {
    const docs = await loadAdminPolicies();
    expect(docs.length).toBeGreaterThanOrEqual(1);
    for (const d of docs) {
      const versions = d.versions.map((v) => v.version);
      expect([...versions].sort((a, b) => b - a)).toEqual(versions);
      if (d.published !== null) expect(d.published.documentId).toBe(d.document.id);
    }
    const [doc] = await db.insert(policyDocuments).values({ type: 'privacy', locale: 'fr' }).returning({ id: policyDocuments.id });
    const empty = await loadAdminPolicies();
    const bare = empty.find((d) => d.document.id === doc.id)!;
    expect(bare.versions).toEqual([]);
    expect(bare.published).toBeNull();
    await db.insert(policyVersions).values({ documentId: doc.id, version: 1, title: 'Brouillon', content: 'C' });
    const after = await loadAdminPolicies();
    expect(after.find((d) => d.document.id === doc.id)?.published).toBeNull();
    await db.delete(policyDocuments).where(eq(policyDocuments.id, doc.id));
  });

  it('contents : highlights triés, FAQ orpheline exclue', async () => {
    const [h1] = await db.insert(tripHighlights).values({ tripId: TRIP, sortOrder: 5 }).returning({ id: tripHighlights.id });
    const [h2] = await db.insert(tripHighlights).values({ tripId: TRIP, sortOrder: 1 }).returning({ id: tripHighlights.id });
    await db.insert(tripHighlightTranslations).values([
      { highlightId: h1.id, locale: 'en', title: 'Second' },
      { highlightId: h2.id, locale: 'en', title: 'First' },
    ]);
    const { loadAdminContents: lac } = await import('@/modules/trips/loaders/admin-contents.loader');
    const contents = await lac(TRIP);
    expect(contents.highlights.map((h) => h.highlight.sortOrder)).toEqual([1, 5]);
    const [f] = await db.insert(faqs).values({}).returning({ id: faqs.id });
    await db.insert(faqTranslations).values({ faqId: f.id, locale: 'en', question: 'Orphan?', answer: 'Yes.' });
    const linked = await loadAdminTripFaqs(TRIP);
    expect(linked.linked.every((x) => x.faq.id !== f.id)).toBe(true);
    await db.delete(faqTranslations).where(eq(faqTranslations.faqId, f.id));
    await db.delete(faqs).where(eq(faqs.id, f.id));
  });

  it('departures : limited/waitlist inclus, closed exclu, ordre asc, champs', async () => {
    const open = await loadOpenDepartures(TRIP);
    expect(open.map((d) => d.id)).toEqual([`l2-dep-lim-${stamp}`, `l2-dep-open-${stamp}`, `l2-dep-wl-${stamp}`]);
    expect(open.every((d) => d.status !== 'closed')).toBe(true);
    const first = open[0];
    expect(first.priceAmount).toBe(50000);
    expect(first.startDate).toBeInstanceOf(Date);
    expect(first.endDate.getTime()).toBeGreaterThan(first.startDate.getTime());
  });

  it('admin-trip détail : départs triés par date', async () => {
    const { loadAdminTrip } = await import('@/modules/trips/loaders/admin-trips.loader');
    const detail = await loadAdminTrip(TRIP);
    expect(detail?.departures.map((d) => d.id)).toEqual([`l2-dep-closed-${stamp}`, `l2-dep-lim-${stamp}`, `l2-dep-open-${stamp}`, `l2-dep-wl-${stamp}`]);
  });

  it('admin-trips : departuresCount, tri daté déterministe, search, title null', async () => {
    const all = await loadAdminTrips({ pageSize: '100' });
    expect(all.rows.find((r) => r.id === TRIP)?.departuresCount).toBe(4);
    expect(all.rows.find((r) => r.id === TRIP_BARE)?.title).toBeNull();
    const t1 = `test-l2-sort1-${stamp}`;
    const t2 = `test-l2-sort2-${stamp}`;
    await db.insert(trips).values([
      {
        id: t1, status: 'draft', countryCode: 'FR', defaultCurrency: 'EUR',
        durationDays: 1, durationNights: 0, groupMin: 1, groupMax: 2,
        createdAt: new Date('2020-01-01T00:00:00.000Z'), updatedAt: new Date('2020-01-01T00:00:00.000Z'),
      },
      {
        id: t2, status: 'draft', countryCode: 'FR', defaultCurrency: 'EUR',
        durationDays: 1, durationNights: 0, groupMin: 1, groupMax: 2,
        createdAt: new Date('2025-01-01T00:00:00.000Z'), updatedAt: new Date('2025-06-01T00:00:00.000Z'),
      },
    ]);
    await db.insert(tripTranslations).values([
      { id: `s1-${stamp}`, tripId: t1, locale: 'en', slug: `sortslug-${stamp}-one`, title: 'Sort One', summary: 'S', overview: 'O', localeVisible: false },
      { id: `s2-${stamp}`, tripId: t2, locale: 'en', slug: `sortslug-${stamp}-two`, title: 'Sort Two', summary: 'S', overview: 'O', localeVisible: false },
    ]);
    const q = `sortslug-${stamp}`;
    expect((await loadAdminTrips({ search: q, sortBy: 'createdAt', sortOrder: 'asc' })).rows.map((r) => r.id)).toEqual([t1, t2]);
    expect((await loadAdminTrips({ search: q, sortBy: 'createdAt', sortOrder: 'desc' })).rows.map((r) => r.id)).toEqual([t2, t1]);
    expect((await loadAdminTrips({ search: q, sortBy: 'updatedAt', sortOrder: 'asc' })).rows.map((r) => r.id)).toEqual([t1, t2]);
    const upper = await loadAdminTrips({ countryCode: 'fr', pageSize: '100' });
    expect(upper.rows.every((r) => r.countryCode === 'FR')).toBe(true);
    await db.delete(tripTranslations).where(eq(tripTranslations.tripId, t1));
    await db.delete(tripTranslations).where(eq(tripTranslations.tripId, t2));
    await db.delete(trips).where(eq(trips.id, t1));
    await db.delete(trips).where(eq(trips.id, t2));
  });

  it('listTripRevisions : limite 10 + ordre desc', async () => {    for (let m = 1; m <= 12; m++) {
      await db.insert(tripRevisions).values({
        tripId: TRIP, snapshot: '{}', createdAt: new Date(`2026-${String(m).padStart(2, '0')}-15T00:00:00.000Z`),
      });
    }
    const revs = await listTripRevisions(TRIP);
    expect(revs).toHaveLength(10);
    expect(revs[0].createdAt.getTime()).toBeGreaterThan(revs[9].createdAt.getTime());
    await db.delete(tripRevisions).where(eq(tripRevisions.tripId, TRIP));
  });
});

describe('filtres URL malformés — jamais de 500 (repli défauts)', () => {
  const garbage = { status: 'bogus', page: 'abc', pageSize: '-5', sortOrder: 'sideways', sortBy: 'nope', search: 'x'.repeat(500) };

  it('les 6 loaders voyage ignorent le garbage', async () => {
    const trips = await loadAdminTrips({ ...garbage });
    expect(trips.meta.page).toBe(1);
    const apps = await loadAdminApplications({ ...garbage });
    expect(apps.meta.page).toBe(1);
    const res = await loadAdminReservations({ ...garbage });
    expect(res.meta.page).toBe(1);
    const pays = await loadAdminPayments({ ...garbage });
    expect(pays.meta.page).toBe(1);
    const travs = await loadAdminTravelers({ ...garbage });
    expect(travs.meta.page).toBe(1);
    const mails = await loadAdminDeliveries({ ...garbage });
    expect(mails.meta.page).toBe(1);
  });

  it('les loaders services ignorent le garbage', async () => {
    const { getServices } = await import('@/modules/services/loaders');
    const { getServiceAdminData } = await import('@/modules/services/admin/loader');
    const pub = await getServices({ status: 'bogus', page: 'abc', sortOrder: 'sideways' }, 'fr', true);
    expect(pub.page).toBe(1);
    const adm = await getServiceAdminData('fr', { status: 'bogus', page: 'abc' } as never);
    expect(adm.page).toBe(1);
  });
});
