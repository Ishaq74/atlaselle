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

import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { getDrizzle } from '@database/drizzle';
import { insertTestTrip } from '../helpers/trip-factory';
import { invalidateCache } from '@database/cache';
import { trips, tripTranslations, tripRevisions } from '@database/schemas/trips.schema';
import { departures } from '@database/schemas/departures.schema';
import { travelers } from '@database/schemas/travelers.schema';
import { emailDeliveries } from '@database/schemas/email-voyage.schema';
import { outboxEvents } from '@database/schemas/outbox.schema';
import { user } from '@database/schemas';
import {
  createTrip, submitTripForReview, approveTrip, publishTrip, unpublishTrip,
  archiveTrip, restoreTrip, restoreTripRevision, updateTrip, upsertTripTranslation,
} from '@/actions/voyage/trips';
import { createDeparture, updateDeparture, setDepartureStatus, assertDepartureExists } from '@/actions/voyage/departures';
import { upsertItineraryDayTranslation } from '@/actions/voyage/itinerary';
import { upsertFaqTranslation, linkFaqToTrip, unlinkFaqFromTrip } from '@/actions/voyage/faq';
import { createTripContent, upsertTripContentTranslation } from '@/actions/voyage/contents';
import { retryEmailDelivery } from '@/actions/voyage/email';
import { getTestHelpers } from '../helpers/auth';
import { purgeOutboxForTrips } from '../helpers/voyage';

const H = (a: unknown) => (a as never as { handler: Function }).handler as Function;
const submitReview = H(submitTripForReview);
const approve = H(approveTrip);
const publish = H(publishTrip);
const unpublish = H(unpublishTrip);
const archive = H(archiveTrip);
const restore = H(restoreTrip);
const restoreRev = H(restoreTripRevision);
const update = H(updateTrip);
const upsertTr = H(upsertTripTranslation);
const mkTrip = H(createTrip);
const mkDep = H(createDeparture);
const updDep = H(updateDeparture);
const setStatus = H(setDepartureStatus);
const upsertDayTr = H(upsertItineraryDayTranslation);
const upsertFaqTr = H(upsertFaqTranslation);
const linkFaq = H(linkFaqToTrip);
const unlinkFaq = H(unlinkFaqFromTrip);
const mkContent = H(createTripContent);
const upsertContentTr = H(upsertTripContentTranslation);
const retryEmail = H(retryEmailDelivery);

const db = getDrizzle();
const stamp = Date.now().toString(36);
const TRIP = `test-a3-trip-${stamp}`;

const adminCtx = (userId: string) =>
  ({
    locals: { user: { id: userId, role: 'admin', email: 'admin@test.com', banned: false } },
    request: { headers: new Headers(), url: 'http://localhost:4321/en/admin/trips' },
    clientAddress: '127.0.0.1',
  }) as never;

async function cleanup() {
  const trs0 = await db.select({ id: travelers.id, email: travelers.email }).from(travelers).catch(() => [] as { id: string; email: string }[]);
  await purgeOutboxForTrips(
    db,
    [TRIP],
    trs0.filter((t) => t.email.includes(stamp)).map((t) => t.id),
  ).catch(() => {});
  await db.delete(tripRevisions).where(eq(tripRevisions.tripId, TRIP)).catch(() => {});
  await db.delete(tripTranslations).where(eq(tripTranslations.tripId, TRIP)).catch(() => {});
  await db.delete(departures).where(eq(departures.tripId, TRIP)).catch(() => {});
  await db.delete(trips).where(eq(trips.id, TRIP)).catch(() => {});
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
  // Hero attaché dès le draft : la chaîne draft->...->published exige
  // hero_media_id (contrainte trips_hero_ck) au moment de l'UPDATE publish.
  await insertTestTrip(db, {
    id: TRIP, status: 'draft', countryCode: 'FR', defaultCurrency: 'EUR',
    durationDays: 4, durationNights: 3, groupMin: 1, groupMax: 5, difficulty: 'easy', difficultyLevel: 1,
  });
});

afterAll(cleanup);

describe('trips actions — transitions, restore, update, upsert', () => {
  let adminId: string;
  let helpers: Awaited<ReturnType<typeof getTestHelpers>>;

  beforeAll(async () => {
    helpers = await getTestHelpers();
    const u = helpers.createUser({ email: `a3-admin-${stamp}@test.com`, name: 'A3', emailVerified: true });
    const saved = await helpers.saveUser(u);
    adminId = saved.id;
    await db.update(user).set({ role: 'admin' }).where(eq(user.id, adminId));
  });

  afterAll(async () => {
    await helpers.deleteUser(adminId).catch(() => {});
  });

  it('createTrip happy + groupMax<groupMin -> BAD_REQUEST', async () => {
    await expect(mkTrip({ countryCode: 'FR', durationDays: 4, durationNights: 3, groupMin: 5, groupMax: 2 }, adminCtx(adminId))).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    const { id } = (await mkTrip({ countryCode: 'FR', durationDays: 4, durationNights: 3, groupMin: 1, groupMax: 5 }, adminCtx(adminId))) as { id: string };
    await db.delete(trips).where(eq(trips.id, id));
  });

  it('chaîne complète draft->review->approved->published(unpublished, publishedAt)->archived->restored', async () => {
    await submitReview({ id: TRIP }, adminCtx(adminId));
    await approve({ id: TRIP }, adminCtx(adminId));
    await publish({ id: TRIP }, adminCtx(adminId));
    const [pub] = await db.select().from(trips).where(eq(trips.id, TRIP)).limit(1);
    expect(pub.status).toBe('published');
    expect(pub.publishedAt).not.toBeNull();
    await unpublish({ id: TRIP }, adminCtx(adminId));
    await archive({ id: TRIP }, adminCtx(adminId));
    await restore({ id: TRIP }, adminCtx(adminId));
    const [rest] = await db.select().from(trips).where(eq(trips.id, TRIP)).limit(1);
    expect(rest.status).toBe('unpublished');
    const revs = await db.select().from(tripRevisions).where(eq(tripRevisions.tripId, TRIP));
    expect(revs.length).toBeGreaterThanOrEqual(5);
    expect(JSON.parse(revs[0].snapshot)).toHaveProperty('status');
  });

  it('transition illégale et révision inconnue', async () => {
    const { id } = (await mkTrip({ countryCode: 'FR', durationDays: 4, durationNights: 3, groupMin: 1, groupMax: 5 }, adminCtx(adminId))) as { id: string };
    await expect(publish({ id }, adminCtx(adminId))).rejects.toBeDefined();
    await db.delete(tripRevisions).where(eq(tripRevisions.tripId, id)).catch(() => {});
    await db.delete(trips).where(eq(trips.id, id));
    await expect(restoreRev({ id: randomUUID() }, adminCtx(adminId))).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('restoreTripRevision happy', async () => {
    const revs = await db.select().from(tripRevisions).where(eq(tripRevisions.tripId, TRIP));
    await restoreRev({ id: revs[0].id }, adminCtx(adminId));
    const [row] = await db.select().from(trips).where(eq(trips.id, TRIP)).limit(1);
    expect(row).toBeDefined();
  });

  it('updateTrip bypass null, patch vide -> BAD_REQUEST, groupMin/Max, succès', async () => {
    await update({ id: TRIP, expectedUpdatedAt: null, difficulty: 'easy' }, adminCtx(adminId));
    await expect(update({ id: TRIP }, adminCtx(adminId))).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    await expect(update({ id: TRIP, groupMin: 5, groupMax: 2 }, adminCtx(adminId))).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    await expect(
      update({ id: TRIP, expectedUpdatedAt: new Date('2020-01-01T00:00:00.000Z').toISOString(), difficulty: 'easy' }, adminCtx(adminId)),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
    await update({ id: TRIP, groupMin: 2 }, adminCtx(adminId));
    const [row] = await db.select().from(trips).where(eq(trips.id, TRIP)).limit(1);
    expect(row.groupMin).toBe(2);
  });

  it('upsertTripTranslation CONFLICT, 2e upsert, bypass null', async () => {
    const base = { tripId: TRIP, locale: 'fr', slug: `a3-${stamp}`, title: 'T', summary: 'S', overview: 'O' };
    await upsertTr({ ...base, expectedUpdatedAt: null }, adminCtx(adminId));
    await expect(upsertTr({ ...base, title: 'T2', expectedUpdatedAt: new Date('2020-01-01T00:00:00.000Z').toISOString() }, adminCtx(adminId))).rejects.toMatchObject({ code: 'CONFLICT' });
    await upsertTr({ ...base, title: 'T2' }, adminCtx(adminId));
    const [row] = await db.select().from(tripTranslations).where(eq(tripTranslations.tripId, TRIP)).limit(1);
    expect(row.title).toBe('T2');
  });
});

describe('departures actions — dates partielles, statuts, exists', () => {
  let adminId: string;
  let helpers: Awaited<ReturnType<typeof getTestHelpers>>;
  let depId: string;

  beforeAll(async () => {
    helpers = await getTestHelpers();
    const u = helpers.createUser({ email: `a3-dep-${stamp}@test.com`, name: 'A3D', emailVerified: true });
    const saved = await helpers.saveUser(u);
    adminId = saved.id;
    await db.update(user).set({ role: 'admin' }).where(eq(user.id, adminId));
    const created = (await mkDep({
      tripId: TRIP, startDate: new Date('2027-06-01T00:00:00.000Z'), endDate: new Date('2027-06-08T00:00:00.000Z'),
      capacityMin: 1, capacityMax: 5, priceAmount: 50000,
    }, adminCtx(adminId))) as { id: string };
    depId = created.id;
  });

  afterAll(async () => {
    await helpers.deleteUser(adminId).catch(() => {});
  });

  it('create refuse capacityMax < capacityMin', async () => {
    await expect(mkDep({
      tripId: TRIP, startDate: new Date('2027-06-01T00:00:00.000Z'), endDate: new Date('2027-06-08T00:00:00.000Z'),
      capacityMin: 5, capacityMax: 2, priceAmount: 50000,
    }, adminCtx(adminId))).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  it('update inversion partielle startDate, bypass null, patch vide, NOT_FOUND, succès', async () => {
    await expect(updDep({ id: depId, startDate: new Date('2027-07-01T00:00:00.000Z') }, adminCtx(adminId))).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    await expect(updDep({ id: depId }, adminCtx(adminId))).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    await expect(updDep({ id: randomUUID(), capacityMax: 9 }, adminCtx(adminId))).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await updDep({ id: depId, expectedUpdatedAt: null, capacityMax: 6 }, adminCtx(adminId));
    const [row] = await db.select().from(departures).where(eq(departures.id, depId)).limit(1);
    expect(row.capacityMax).toBe(6);
  });

  it('setStatus draft->open->limited/waitlist/open->cancelled + NOT_FOUND + illégal', async () => {
    await setStatus({ id: depId, to: 'open' }, adminCtx(adminId));
    await setStatus({ id: depId, to: 'limited' }, adminCtx(adminId));
    await setStatus({ id: depId, to: 'waitlist' }, adminCtx(adminId));
    await setStatus({ id: depId, to: 'open' }, adminCtx(adminId));
    await setStatus({ id: depId, to: 'cancelled' }, adminCtx(adminId));
    await expect(setStatus({ id: randomUUID(), to: 'open' }, adminCtx(adminId))).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(setStatus({ id: depId, to: 'open' }, adminCtx(adminId))).rejects.toBeDefined();
  });

  it('assertDepartureExists happy + NOT_FOUND', async () => {
    expect((await assertDepartureExists(depId)).id).toBe(depId);
    await expect(assertDepartureExists(randomUUID())).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});

describe('itinerary/faq/contents/email — branches restantes', () => {
  let adminId: string;
  let helpers: Awaited<ReturnType<typeof getTestHelpers>>;

  beforeAll(async () => {
    helpers = await getTestHelpers();
    const u = helpers.createUser({ email: `a3-misc-${stamp}@test.com`, name: 'A3M', emailVerified: true });
    const saved = await helpers.saveUser(u);
    adminId = saved.id;
    await db.update(user).set({ role: 'admin' }).where(eq(user.id, adminId));
  });

  afterAll(async () => {
    await helpers.deleteUser(adminId).catch(() => {});
  });

  it('contenu : NOT_FOUND trip, iconKey ignoré inclusion, 2e upsert, bypass null', async () => {
    await expect(mkContent({ tripId: 'no-trip', kind: 'highlight', sortOrder: 0 }, adminCtx(adminId))).rejects.toBeDefined();
    const inc = (await mkContent({ tripId: TRIP, kind: 'inclusion', sortOrder: 0, iconKey: 'star' }, adminCtx(adminId))) as { id: string };
    await upsertContentTr({ kind: 'inclusion', id: inc.id, locale: 'en', text: 'v1', expectedUpdatedAt: null }, adminCtx(adminId));
    await upsertContentTr({ kind: 'inclusion', id: inc.id, locale: 'en', text: 'v2' }, adminCtx(adminId));
  });

  it('faq : upsert CONFLICT, link trip inconnu, unlink non-lié', async () => {
    const { mkFaqId } = await (async () => {
      const { createFaq } = await import('@/actions/voyage/faq');
      const mk = H(createFaq);
      const faq = (await mk({ locale: 'fr', question: 'Q?', answer: 'R.' }, adminCtx(adminId))) as { id: string };
      return { mkFaqId: faq.id };
    })();
    await upsertFaqTr({ faqId: mkFaqId, locale: 'fr', question: 'Q2', answer: 'R2' }, adminCtx(adminId));
    await upsertFaqTr({ faqId: mkFaqId, locale: 'en', question: 'Q?', answer: 'A.', expectedUpdatedAt: null }, adminCtx(adminId));
    await expect(
      upsertFaqTr({ faqId: mkFaqId, locale: 'fr', question: 'Qx', answer: 'Rx', expectedUpdatedAt: new Date('2020-01-01T00:00:00.000Z').toISOString() }, adminCtx(adminId)),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
    await expect(linkFaq({ tripId: 'no-trip', faqId: mkFaqId }, adminCtx(adminId))).rejects.toBeDefined();
    await unlinkFaq({ tripId: TRIP, faqId: mkFaqId }, adminCtx(adminId));
  });

  it('itinerary : upsert expectedUpdatedAt CONFLICT + 2e upsert + patch vide', async () => {
    const { createItineraryDay, updateItineraryDay } = await import('@/actions/voyage/itinerary');
    const mk = H(createItineraryDay);
    const upd = H(updateItineraryDay);
    const day = (await mk({ tripId: TRIP, dayNumber: 1, location: 'X' }, adminCtx(adminId))) as { id: string };
    await expect(upd({ id: day.id }, adminCtx(adminId))).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    await upsertDayTr({ dayId: day.id, locale: 'fr', title: 'J1' }, adminCtx(adminId));
    await expect(
      upsertDayTr({ dayId: day.id, locale: 'fr', title: 'Jx', expectedUpdatedAt: new Date('2020-01-01T00:00:00.000Z').toISOString() }, adminCtx(adminId)),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
    await upsertDayTr({ dayId: day.id, locale: 'fr', title: 'J1b' }, adminCtx(adminId));
  });

  it('email : reset champs + payload outbox', async () => {
    const [t] = await db.insert(travelers).values({ email: `em-${stamp}@test.com`, locale: 'en' }).returning({ id: travelers.id });
    const [d] = await db.insert(emailDeliveries).values({
      templateKey: 'application_received', locale: 'en', toEmail: `em-${stamp}@test.com`,
      travelerId: t.id, status: 'failed', attempts: 3, lastError: 'boom', scheduledAt: new Date('2020-01-01'),
    }).returning({ id: emailDeliveries.id });
    await retryEmail({ id: d.id }, adminCtx(adminId));
    const [row] = await db.select().from(emailDeliveries).where(eq(emailDeliveries.id, d.id)).limit(1);
    expect(row.attempts).toBe(0);
    expect(row.lastError).toBeNull();
    expect(row.scheduledAt.getTime()).toBeGreaterThan(new Date('2024-01-01').getTime());
    const events = await db.select().from(outboxEvents).where(eq(outboxEvents.aggregateId, d.id));
    expect(events.some((e) => e.eventType === 'email.retry_requested' && (e.payload as { templateKey?: string }).templateKey === 'application_received')).toBe(true);
  });
});
