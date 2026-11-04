import { test, expect, type Page } from '@playwright/test';
import { SEED_EMAIL, SEED_PASSWORD } from './global-setup';

/**
 * E2E parcours réservation automatisé (inscription, liste d'attente, acompte, solde).
 * Navigateur réel pour la candidature, le checkout et le paiement du solde (provider
 * mock) ; DB pour les autres voyageurs et pour simuler le temps ; cron appelé en HTTP.
 * Fixtures propres au spec, nettoyées en afterAll.
 */

const stamp = Date.now().toString(36);
const TRIP_ID = `e2e-wl-trip-${stamp}`;
const SLUG = `e2e-wl-trip-${stamp}`;
const DEP_OPEN = `e2e-wl-open-${stamp}`;
const DEP_FULL = `e2e-wl-full-${stamp}`;
const DEP_EXPIRE = `e2e-wl-expire-${stamp}`;
const OTHER_EMAIL = `e2e-wl-other-${stamp}@test.com`;
const FIRST_EMAIL = `e2e-wl-first-${stamp}@test.com`;
const DAY = 86_400_000;

async function db() {
  const { getDrizzle } = await import('../../src/database/drizzle');
  return getDrizzle();
}

async function schemas() {
  return {
    ...(await import('../../src/database/schemas/trips.schema')),
    ...(await import('../../src/database/schemas/departures.schema')),
    ...(await import('../../src/database/schemas/applications.schema')),
    ...(await import('../../src/database/schemas/travelers.schema')),
    ...(await import('../../src/database/schemas/reservations.schema')),
    ...(await import('../../src/database/schemas/payments.schema')),
    ...(await import('../../src/database/schemas/waitlist.schema')),
    ...(await import('../../src/database/schemas/outbox.schema')),
    ...(await import('../../src/database/schemas/email-voyage.schema')),
  };
}

async function purgeSeedTravelerFixtures() {
  // Un run interrompu laisse des dossiers du compte seed (email fixe) sur d'anciens trips e2e.
  const database = await db();
  const { eq, inArray, like, and } = await import('drizzle-orm');
  const s = await schemas();
  const stale = await database.select({ id: s.applications.id }).from(s.applications).where(like(s.applications.tripId, 'e2e-wl-trip-%'));
  const ids = stale.map((a) => a.id);
  if (ids.length === 0) return;
  const resIds = (await database.select({ id: s.reservations.id }).from(s.reservations).where(inArray(s.reservations.applicationId, ids))).map((r) => r.id);
  if (resIds.length) {
    await database.delete(s.emailDeliveries).where(inArray(s.emailDeliveries.reservationId, resIds));
    await database.delete(s.payments).where(inArray(s.payments.reservationId, resIds));
    await database.delete(s.checkoutSessions).where(inArray(s.checkoutSessions.reservationId, resIds));
    await database.delete(s.reservations).where(inArray(s.reservations.id, resIds));
  }
  void and; void eq;
}

async function cleanup() {
  const database = await db();
  const { eq, inArray } = await import('drizzle-orm');
  const s = await schemas();
  const { invalidateCache } = await import('../../src/database/cache');
  const reservations = await database.select({ id: s.reservations.id, travelerId: s.reservations.travelerId }).from(s.reservations).where(eq(s.reservations.tripId, TRIP_ID));
  const resIds = reservations.map((r) => r.id);
  const apps = await database.select({ id: s.applications.id, travelerId: s.applications.travelerId }).from(s.applications).where(eq(s.applications.tripId, TRIP_ID));
  const appIds = apps.map((a) => a.id);
  const travelerIds = [...new Set([...reservations.map((r) => r.travelerId), ...apps.map((a) => a.travelerId)])];
  const aggregateIds = [...resIds, ...appIds];
  if (resIds.length) {
    const pays = await database.select({ id: s.payments.id }).from(s.payments).where(inArray(s.payments.reservationId, resIds));
    aggregateIds.push(...pays.map((p) => p.id));
    await database.delete(s.emailDeliveries).where(inArray(s.emailDeliveries.reservationId, resIds));
    await database.delete(s.payments).where(inArray(s.payments.reservationId, resIds));
  }
  if (appIds.length) {
    const cs = await database.select({ id: s.checkoutSessions.id }).from(s.checkoutSessions).where(inArray(s.checkoutSessions.applicationId, appIds));
    aggregateIds.push(...cs.map((c) => c.id));
    await database.delete(s.checkoutSessions).where(inArray(s.checkoutSessions.applicationId, appIds));
    await database.delete(s.applicationDecisions).where(inArray(s.applicationDecisions.applicationId, appIds));
    await database.delete(s.applicationEvents).where(inArray(s.applicationEvents.applicationId, appIds));
  }
  if (aggregateIds.length) await database.delete(s.outboxEvents).where(inArray(s.outboxEvents.aggregateId, aggregateIds));
  const depIds = (await database.select({ id: s.departures.id }).from(s.departures).where(eq(s.departures.tripId, TRIP_ID))).map((d) => d.id);
  if (depIds.length) await database.delete(s.seatHolds).where(inArray(s.seatHolds.departureId, depIds));
  if (resIds.length) {
    await database.delete(s.reservationPriceSnapshots).where(inArray(s.reservationPriceSnapshots.reservationId, resIds));
    await database.delete(s.reservations).where(inArray(s.reservations.id, resIds));
  }
  if (appIds.length) await database.delete(s.applications).where(inArray(s.applications.id, appIds));
  await database.delete(s.tripTranslations).where(eq(s.tripTranslations.tripId, TRIP_ID));
  await database.delete(s.departures).where(eq(s.departures.tripId, TRIP_ID));
  const [trip] = await database.select({ heroMediaId: s.trips.heroMediaId }).from(s.trips).where(eq(s.trips.id, TRIP_ID));
  await database.delete(s.trips).where(eq(s.trips.id, TRIP_ID));
  const { mediaFiles } = await import('../../src/database/schemas/media.schema');
  if (trip?.heroMediaId) await database.delete(mediaFiles).where(eq(mediaFiles.id, trip.heroMediaId)).catch(() => {});
  // Les voyageurs du compte seed sont conservés ; seuls les voyageurs de fixture sont supprimés.
  const fixtureTravelers = await database.select({ id: s.travelers.id }).from(s.travelers).where(inArray(s.travelers.email, [OTHER_EMAIL, FIRST_EMAIL]));
  const removable = fixtureTravelers.map((t) => t.id);
  if (removable.length) await database.delete(s.travelers).where(inArray(s.travelers.id, removable));
  void travelerIds;
  invalidateCache();
}

async function mkTraveler(email: string) {
  const database = await db();
  const s = await schemas();
  const [t] = await database.insert(s.travelers).values({ email, legalName: email.split('@')[0], locale: 'en' }).returning({ id: s.travelers.id });
  return t!.id;
}

// Réservation confirmée d'un autre voyageur : occupe la place d'un départ.
async function mkConfirmedReservation(departureId: string, travelerId: string, tag: string) {
  const database = await db();
  const s = await schemas();
  const [r] = await database.insert(s.reservations).values({
    reservationNumber: `ATL-2027-E${tag}${stamp.slice(-3).toUpperCase()}`.slice(0, 15),
    travelerId, tripId: TRIP_ID, departureId, status: 'confirmed',
    currency: 'EUR', baseAmount: 100000, totalAmount: 100000, amountPaid: 20000, amountDue: 80000,
    confirmedAt: new Date(), balanceDueDate: new Date('2027-09-01T00:00:00.000Z'),
  }).returning({ id: s.reservations.id });
  return r!.id;
}

async function runCron(request: import('@playwright/test').APIRequestContext) {
  const secret = process.env.CRON_SECRET;
  const res = await request.post('/api/cron/voyage', secret ? { headers: { Authorization: `Bearer ${secret}` } } : {});
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body.errors).toEqual({});
  return body as Record<string, unknown>;
}

async function signIn(page: Page) {
  await page.goto('/en/auth/sign-in', { waitUntil: 'networkidle' });
  await page.locator('input[name="email"]').fill(SEED_EMAIL);
  await page.locator('input[name="password"]').fill(SEED_PASSWORD);
  await Promise.all([
    page.waitForURL(/dashboard/, { timeout: 30000 }),
    page.locator('button[type="submit"], form button').first().click(),
  ]);
  await page.waitForLoadState('networkidle');
}

async function applyViaUi(page: Page, departureId: string) {
  await page.goto(`/en/apply/${SLUG}`, { waitUntil: 'networkidle' });
  await page.locator('select[name="departureId"]').selectOption(departureId);
  await page.locator('input[name="legalName"]').fill('E2E Candidate');
  await page.locator('input[name="activityAcknowledgement"]').check();
  await page.locator('input[name="consent"]').check();
  await page.locator('input[name="termsAccepted"]').check();
  await page.locator('form [type="submit"], form button').last().click();
}

async function seedApplicationOn(departureId: string) {
  const database = await db();
  const { eq, and, desc } = await import('drizzle-orm');
  const s = await schemas();
  const [traveler] = await database.select({ id: s.travelers.id }).from(s.travelers).where(eq(s.travelers.email, SEED_EMAIL));
  const [app] = await database.select().from(s.applications)
    .where(and(eq(s.applications.travelerId, traveler!.id), eq(s.applications.departureId, departureId)))
    .orderBy(desc(s.applications.createdAt)).limit(1);
  return app!;
}

async function waitlistEntry(applicationId: string) {
  const database = await db();
  const { eq } = await import('drizzle-orm');
  const s = await schemas();
  const [entry] = await database.select().from(s.waitlistEntries).where(eq(s.waitlistEntries.applicationId, applicationId));
  return entry;
}

async function payCheckoutInBrowser(page: Page, checkoutSessionId: string) {
  await page.goto(`/en/checkout/${checkoutSessionId}`, { waitUntil: 'networkidle' });
  await page.locator('input[name="travelerEmail"]').fill(SEED_EMAIL);
  await page.locator('input[name="terms"]').check();
  await page.locator('[data-checkout-form] button[type="submit"]').click();
  await page.waitForURL(/\/en\/booking-confirmed\?session_id=/, { timeout: 60000 });
}

test.describe.configure({ mode: 'serial' });

test.describe('Voyage — inscription automatique, liste d’attente et soldes', () => {
  test.beforeAll(async () => {
    await purgeSeedTravelerFixtures();
    const database = await db();
    const s = await schemas();
    const { insertTestTrip } = await import('../helpers/trip-factory');
    await insertTestTrip(database, {
      id: TRIP_ID, status: 'published', countryCode: 'FR', defaultCurrency: 'EUR',
      durationDays: 4, durationNights: 3, groupMin: 1, groupMax: 8,
      difficulty: 'easy', difficultyLevel: 2, publishedAt: new Date(),
    });
    await database.insert(s.tripTranslations).values({
      id: `e2e-wl-tr-en-${stamp}`, tripId: TRIP_ID, locale: 'en', slug: SLUG,
      title: 'E2E Waitlist Trip', summary: 'Summary', overview: 'Overview', localeVisible: true,
    });
    const common = {
      tripId: TRIP_ID, status: 'open' as const, capacityMin: 1, priceAmount: 100000, currency: 'EUR',
      pricingRules: {}, depositType: 'percent' as const, depositPercent: 20,
      balanceDueDate: new Date('2027-09-01T00:00:00.000Z'),
      bookingDeadline: new Date('2027-10-15T23:59:00.000Z'),
      endDate: new Date('2027-11-04T18:00:00.000Z'),
    };
    await database.insert(s.departures).values([
      { ...common, id: DEP_OPEN, capacityMax: 8, startDate: new Date('2027-11-01T08:00:00.000Z') },
      { ...common, id: DEP_FULL, capacityMax: 1, startDate: new Date('2027-11-02T08:00:00.000Z') },
      { ...common, id: DEP_EXPIRE, capacityMax: 1, startDate: new Date('2027-11-03T08:00:00.000Z') },
    ]);
  });

  test.afterAll(cleanup);

  test('inscription → checkout → acompte payé → réservation confirmée, puis rappel J+2 et solde payé', async ({ page, request }) => {
    test.setTimeout(180000);
    await signIn(page);
    await applyViaUi(page, DEP_OPEN);
    await page.waitForURL(/\/en\/booking-confirmed\?session_id=/, { timeout: 60000 });
    await expect(page.locator('h1')).toHaveText('Booking confirmed');
    // acompte seul : réservation confirmée, solde restant affiché
    await expect(page.locator('form[data-balance-form]')).toBeVisible();

    const database = await db();
    const { eq } = await import('drizzle-orm');
    const s = await schemas();
    const app = await seedApplicationOn(DEP_OPEN);
    expect(app.status).toBe('approved');
    const [reservation] = await database.select().from(s.reservations).where(eq(s.reservations.applicationId, app.id));
    expect(reservation!.status).toBe('confirmed');
    expect(reservation!.amountPaid).toBe(20000);
    expect(reservation!.amountDue).toBe(80000);
    const holds = await database.select().from(s.seatHolds).where(eq(s.seatHolds.departureId, DEP_OPEN));
    expect(holds.every((h) => h.status === 'converted')).toBe(true);

    // Rappel J+2 : l'acompte date de 3 jours.
    await database.update(s.reservations).set({ confirmedAt: new Date(Date.now() - 3 * DAY) }).where(eq(s.reservations.id, reservation!.id));
    await runCron(request);
    const reminders = async () =>
      (await database.select().from(s.emailDeliveries).where(eq(s.emailDeliveries.reservationId, reservation!.id)))
        .filter((d) => d.templateKey === 'balance_reminder');
    const afterFirst = (await reminders()).length;
    expect(afterFirst).toBe(1);
    await runCron(request);
    expect((await reminders()).length).toBe(afterFirst);

    // Solde payé depuis la page de confirmation (lien des rappels).
    await page.locator('input[name="travelerEmail"]').fill(SEED_EMAIL);
    await page.locator('input[name="terms"]').check();
    await page.locator('[data-balance-form] button[type="submit"]').click();
    await page.waitForURL(/\/en\/booking-confirmed\?session_id=/, { timeout: 60000 });
    await expect.poll(async () => {
      const [r] = await database.select().from(s.reservations).where(eq(s.reservations.id, reservation!.id));
      return `${r!.status}:${r!.amountDue}`;
    }, { timeout: 30000 }).toBe('completed:0');

    // Plus aucun rappel une fois soldé.
    await runCron(request);
    expect((await reminders()).length).toBe(afterFirst);
  });

  test('départ complet → liste d’attente → annulation → proposition → acompte → confirmée', async ({ page, request }) => {
    test.setTimeout(180000);
    const database = await db();
    const { eq } = await import('drizzle-orm');
    const s = await schemas();
    const { cancelReservation } = await import('../../src/modules/reservations/domain/reservation-service');
    const otherReservation = await mkConfirmedReservation(DEP_FULL, await mkTraveler(OTHER_EMAIL), 'F');

    await signIn(page);
    await applyViaUi(page, DEP_FULL);
    await expect(page.locator('[data-form-message]')).toContainText('waiting list', { timeout: 30000 });
    const app = await seedApplicationOn(DEP_FULL);
    expect((await waitlistEntry(app.id))!.status).toBe('waiting');
    expect(await database.select().from(s.reservations).where(eq(s.reservations.applicationId, app.id))).toHaveLength(0);

    // Place réellement libérée → proposition au premier de la file.
    await cancelReservation(otherReservation);
    await runCron(request);
    const offered = await waitlistEntry(app.id);
    expect(offered!.status).toBe('offered');
    expect(offered!.expiresAt!.getTime() - Date.now()).toBeGreaterThan(47 * 3_600_000);
    const [checkout] = await database.select().from(s.checkoutSessions).where(eq(s.checkoutSessions.applicationId, app.id));
    expect(checkout!.status).toBe('open');

    await payCheckoutInBrowser(page, checkout!.id);
    await expect(page.locator('h1')).toHaveText('Booking confirmed');
    expect((await waitlistEntry(app.id))!.status).toBe('promoted');
    const [reservation] = await database.select().from(s.reservations).where(eq(s.reservations.applicationId, app.id));
    expect(reservation!.status).toBe('confirmed');
  });

  test('départ complet → proposition expirée → candidat suivant', async ({ page, request }) => {
    test.setTimeout(180000);
    const database = await db();
    const { eq } = await import('drizzle-orm');
    const s = await schemas();
    const { cancelReservation } = await import('../../src/modules/reservations/domain/reservation-service');
    const holder = await mkConfirmedReservation(DEP_EXPIRE, await mkTraveler(`e2e-wl-holder-${stamp}@test.com`), 'X');

    // Premier de la file : voyageur de fixture, inscrit avant le compte seed.
    const firstTraveler = await mkTraveler(FIRST_EMAIL);
    const [firstApp] = await database.insert(s.applications).values({
      travelerId: firstTraveler, tripId: TRIP_ID, departureId: DEP_EXPIRE, status: 'submitted',
      activityAcknowledgement: true, consent: true, submittedAt: new Date(Date.now() - DAY),
    }).returning({ id: s.applications.id });
    await database.insert(s.waitlistEntries).values({ applicationId: firstApp!.id, departureId: DEP_EXPIRE, joinedAt: new Date(Date.now() - DAY) });

    await signIn(page);
    await applyViaUi(page, DEP_EXPIRE);
    await expect(page.locator('[data-form-message]')).toContainText('waiting list', { timeout: 30000 });
    const app = await seedApplicationOn(DEP_EXPIRE);

    await cancelReservation(holder);
    await runCron(request);
    expect((await waitlistEntry(firstApp!.id))!.status).toBe('offered');
    expect((await waitlistEntry(app.id))!.status).toBe('waiting');

    // La proposition du premier expire : la place passe au suivant, sans doublon d'attribution.
    await database.update(s.waitlistEntries).set({ expiresAt: new Date(Date.now() - 1000) }).where(eq(s.waitlistEntries.applicationId, firstApp!.id));
    await runCron(request);
    expect((await waitlistEntry(firstApp!.id))!.status).toBe('expired');
    expect((await waitlistEntry(app.id))!.status).toBe('offered');
    const activeHolds = (await database.select().from(s.seatHolds).where(eq(s.seatHolds.departureId, DEP_EXPIRE))).filter((h) => h.status === 'active');
    expect(activeHolds).toHaveLength(1);
    expect(activeHolds[0]!.applicationId).toBe(app.id);

    // Le candidat suivant voit sa page de paiement et la proposition est visible côté admin.
    const [checkout] = await database.select().from(s.checkoutSessions).where(eq(s.checkoutSessions.applicationId, app.id));
    await page.goto(`/en/checkout/${checkout!.id}`, { waitUntil: 'networkidle' });
    await expect(page.locator('h1')).toHaveText('Checkout');
    await page.goto(`/en/admin/applications/${app.id}`, { waitUntil: 'networkidle' });
    await expect(page.getByText('Place offered').first()).toBeVisible();
  });
});
