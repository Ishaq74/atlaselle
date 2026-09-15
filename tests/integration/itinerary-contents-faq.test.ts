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
import { trips } from '@database/schemas/trips.schema';
import { itineraryDays, itineraryDayTranslations } from '@database/schemas/itinerary.schema';
import {
  tripHighlights, tripHighlightTranslations, tripInclusions, tripInclusionTranslations,
  tripExclusions, tripExclusionTranslations, faqs, faqTranslations, tripFaqs,
} from '@database/schemas/trips.schema';
import { user } from '@database/schemas';
import { createItineraryDay, updateItineraryDay, deleteItineraryDay, upsertItineraryDayTranslation } from '@/actions/voyage/itinerary';
import { createTripContent, deleteTripContent, upsertTripContentTranslation } from '@/actions/voyage/contents';
import { createFaq, upsertFaqTranslation, deleteFaq, linkFaqToTrip, unlinkFaqFromTrip } from '@/actions/voyage/faq';
import { loadAdminItinerary } from '@/modules/itinerary/loaders/admin-itinerary.loader';
import { loadAdminContents, loadAdminTripFaqs } from '@/modules/trips/loaders/admin-contents.loader';
import { getTestHelpers } from '../helpers/auth';

const createDay = (createItineraryDay as any).handler as (i: any, c: any) => Promise<any>;
const updateDay = (updateItineraryDay as any).handler as (i: any, c: any) => Promise<any>;
const deleteDay = (deleteItineraryDay as any).handler as (i: any, c: any) => Promise<any>;
const upsertDayTr = (upsertItineraryDayTranslation as any).handler as (i: any, c: any) => Promise<any>;
const createContent = (createTripContent as any).handler as (i: any, c: any) => Promise<any>;
const deleteContent = (deleteTripContent as any).handler as (i: any, c: any) => Promise<any>;
const upsertContentTr = (upsertTripContentTranslation as any).handler as (i: any, c: any) => Promise<any>;
const mkFaq = (createFaq as any).handler as (i: any, c: any) => Promise<any>;
const upsertFaqTr = (upsertFaqTranslation as any).handler as (i: any, c: any) => Promise<any>;
const delFaq = (deleteFaq as any).handler as (i: any, c: any) => Promise<any>;
const linkFaq = (linkFaqToTrip as any).handler as (i: any, c: any) => Promise<any>;
const unlinkFaq = (unlinkFaqFromTrip as any).handler as (i: any, c: any) => Promise<any>;

const db = getDrizzle();
const stamp = Date.now().toString(36);
const TRIP_ID = `test-content-trip-${stamp}`;

const adminCtx = (userId: string) => ({
  locals: { user: { id: userId, role: 'admin', email: 'admin@test.com', banned: false } },
  request: { headers: new Headers(), url: 'http://localhost:4321/en/admin/trips' },
  clientAddress: '127.0.0.1',
}) as any;

async function cleanup() {
  const days = await db.select({ id: itineraryDays.id }).from(itineraryDays).where(eq(itineraryDays.tripId, TRIP_ID));
  for (const d of days) {
    await db.delete(itineraryDayTranslations).where(eq(itineraryDayTranslations.dayId, d.id));
    await db.delete(itineraryDays).where(eq(itineraryDays.id, d.id));
  }
  const hls = await db.select({ id: tripHighlights.id }).from(tripHighlights).where(eq(tripHighlights.tripId, TRIP_ID));
  for (const h of hls) {
    await db.delete(tripHighlightTranslations).where(eq(tripHighlightTranslations.highlightId, h.id));
    await db.delete(tripHighlights).where(eq(tripHighlights.id, h.id));
  }
  const incs = await db.select({ id: tripInclusions.id }).from(tripInclusions).where(eq(tripInclusions.tripId, TRIP_ID));
  for (const i of incs) {
    await db.delete(tripInclusionTranslations).where(eq(tripInclusionTranslations.inclusionId, i.id));
    await db.delete(tripInclusions).where(eq(tripInclusions.id, i.id));
  }
  const excs = await db.select({ id: tripExclusions.id }).from(tripExclusions).where(eq(tripExclusions.tripId, TRIP_ID));
  for (const e of excs) {
    await db.delete(tripExclusionTranslations).where(eq(tripExclusionTranslations.exclusionId, e.id));
    await db.delete(tripExclusions).where(eq(tripExclusions.id, e.id));
  }
  const links = await db.select().from(tripFaqs).where(eq(tripFaqs.tripId, TRIP_ID));
  for (const l of links) {
    await db.delete(faqTranslations).where(eq(faqTranslations.faqId, l.faqId));
    await db.delete(faqs).where(eq(faqs.id, l.faqId));
    await db.delete(tripFaqs).where(eq(tripFaqs.tripId, TRIP_ID));
  }
  await db.delete(trips).where(eq(trips.id, TRIP_ID));
  invalidateCache();
}

describe('Itinerary, contents and FAQ admin (real DB)', () => {
  let adminId: string;
  let helpers: Awaited<ReturnType<typeof getTestHelpers>>;

  beforeAll(async () => {
    helpers = await getTestHelpers();
    const u = helpers.createUser({ email: `content-admin-${stamp}@test.com`, name: 'Content Admin', emailVerified: true });
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

  it('creates, translates, locks and deletes itinerary days', async () => {
    const created = await createDay({ tripId: TRIP_ID, dayNumber: 1, location: 'Testville' }, adminCtx(adminId));
    expect(created.id).toBeTypeOf('string');
    await expect(createDay({ tripId: TRIP_ID, dayNumber: 1 }, adminCtx(adminId))).rejects.toMatchObject({ code: 'CONFLICT' });

    await upsertDayTr({ dayId: created.id, locale: 'fr', title: 'Jour 1', morning: 'Matin' }, adminCtx(adminId));
    const days = await loadAdminItinerary(TRIP_ID);
    expect(days).toHaveLength(1);
    expect(days[0].translations).toHaveLength(1);

    const [row] = await db.select().from(itineraryDays).where(eq(itineraryDays.id, created.id));
    await expect(
      updateDay({ id: created.id, expectedUpdatedAt: new Date('2020-01-01T00:00:00.000Z').toISOString(), location: 'X' }, adminCtx(adminId)),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
    await updateDay({ id: created.id, expectedUpdatedAt: row.updatedAt.toISOString(), location: 'Newville' }, adminCtx(adminId));

    await deleteDay({ id: created.id }, adminCtx(adminId));
    expect(await loadAdminItinerary(TRIP_ID)).toHaveLength(0);
  });

  it('manages highlights, inclusions and exclusions with validation', async () => {
    const hl = await createContent({ tripId: TRIP_ID, kind: 'highlight', sortOrder: 0 }, adminCtx(adminId));
    await upsertContentTr({ kind: 'highlight', id: hl.id, locale: 'fr', title: 'Superbe', description: 'Vraiment' }, adminCtx(adminId));
    await expect(upsertContentTr({ kind: 'highlight', id: hl.id, locale: 'fr', description: 'Sans titre' }, adminCtx(adminId))).rejects.toMatchObject({ code: 'BAD_REQUEST' });

    const inc = await createContent({ tripId: TRIP_ID, kind: 'inclusion', sortOrder: 0 }, adminCtx(adminId));
    await upsertContentTr({ kind: 'inclusion', id: inc.id, locale: 'en', text: 'Breakfast included' }, adminCtx(adminId));
    await expect(upsertContentTr({ kind: 'inclusion', id: inc.id, locale: 'en' }, adminCtx(adminId))).rejects.toMatchObject({ code: 'BAD_REQUEST' });

    const contents = await loadAdminContents(TRIP_ID);
    expect(contents.highlights).toHaveLength(1);
    expect(contents.inclusions).toHaveLength(1);

    await deleteContent({ kind: 'highlight', id: hl.id }, adminCtx(adminId));
    expect((await loadAdminContents(TRIP_ID)).highlights).toHaveLength(0);
  });

  it('creates, translates, links and unlinks FAQs', async () => {
    const created = await mkFaq({ tripId: TRIP_ID, locale: 'fr', question: 'Q ?', answer: 'R.' }, adminCtx(adminId));
    const faqs = await loadAdminTripFaqs(TRIP_ID);
    expect(faqs.linked).toHaveLength(1);

    await upsertFaqTr({ faqId: created.id, locale: 'en', question: 'Q?', answer: 'A.' }, adminCtx(adminId));
    await unlinkFaq({ tripId: TRIP_ID, faqId: created.id }, adminCtx(adminId));
    expect((await loadAdminTripFaqs(TRIP_ID)).linked).toHaveLength(0);
    await linkFaq({ tripId: TRIP_ID, faqId: created.id }, adminCtx(adminId));
    expect((await loadAdminTripFaqs(TRIP_ID)).linked).toHaveLength(1);
    await delFaq({ id: created.id }, adminCtx(adminId));
    expect((await loadAdminTripFaqs(TRIP_ID)).linked).toHaveLength(0);
  });
});
