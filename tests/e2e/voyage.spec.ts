import { test, expect } from '@playwright/test';
import { SEED_EMAIL, SEED_PASSWORD } from './global-setup';

/**
 * E2E voyage — liste, fiche (URLs localisées), RTL arabe, candidature,
 * SEO (canonical/hreflang) et admin trips. Fixtures DB propres au spec
 * (la CI ne seed pas) ; nettoyage en afterAll.
 */

const stamp = Date.now().toString(36);
const TRIP_ID = `e2e-trip-${stamp}`;
const SLUG_EN = `e2e-trip-${stamp}`;
const SLUG_FR = `voyage-e2e-${stamp}`;

async function db() {
  const { getDrizzle } = await import('../../src/database/drizzle');
  return getDrizzle();
}

test.beforeAll(async () => {
  const database = await db();
  const { eq, inArray } = await import('drizzle-orm');
  const { tripTranslations } = await import('../../src/database/schemas/trips.schema');
  const { departures } = await import('../../src/database/schemas/departures.schema');
  // Nettoyage défensif d'un run interrompu : la candidature utilise désormais
  // SEED_EMAIL (fixe) — un traveler résiduel non vérifié bloquerait le submit
  // via APPLICATION_EMAIL_CONFLICT (le stamp des trips change à chaque run,
  // l'afterAll ne peut pas rattraper les fixtures d'un run précédent).
  const { applications, applicationDecisions, applicationEvents } = await import('../../src/database/schemas/applications.schema');
  const { travelers } = await import('../../src/database/schemas/travelers.schema');
  const { outboxEvents } = await import('../../src/database/schemas/outbox.schema');
  const { reservations } = await import('../../src/database/schemas/reservations.schema');
  const { payments } = await import('../../src/database/schemas/payments.schema');
  const staleTravelers = await database.select({ id: travelers.id }).from(travelers).where(eq(travelers.email, SEED_EMAIL));
  for (const t of staleTravelers) {
    const staleReservations = await database.select({ id: reservations.id }).from(reservations).where(eq(reservations.travelerId, t.id));
    if (staleReservations.length > 0) {
      const staleReservationIds = staleReservations.map((reservation) => reservation.id);
      await database.delete(payments).where(inArray(payments.reservationId, staleReservationIds));
      await database.delete(reservations).where(inArray(reservations.id, staleReservationIds));
    }
    const staleApps = await database.select({ id: applications.id }).from(applications).where(eq(applications.travelerId, t.id));
    for (const a of staleApps) {
      await database.delete(applicationDecisions).where(eq(applicationDecisions.applicationId, a.id));
      await database.delete(applicationEvents).where(eq(applicationEvents.applicationId, a.id));
      await database.delete(outboxEvents).where(eq(outboxEvents.aggregateId, a.id));
      await database.delete(applications).where(eq(applications.id, a.id));
    }
    await database.delete(travelers).where(eq(travelers.id, t.id));
  }
  // trips_hero_ck: a published trip MUST have a hero media â€” the factory
  // inserts a test media automatically (and records it for cleanup).
  const { insertTestTrip } = await import('../helpers/trip-factory');
  await insertTestTrip(database, {
    id: TRIP_ID, status: 'published', countryCode: 'FR', defaultCurrency: 'EUR',
    durationDays: 4, durationNights: 3, groupMin: 2, groupMax: 8,
    difficulty: 'easy', difficultyLevel: 2, publishedAt: new Date(),
  });
  await database.insert(tripTranslations).values([
    { id: `e2e-tr-en-${stamp}`, tripId: TRIP_ID, locale: 'en', slug: SLUG_EN, title: 'E2E Trip', summary: 'Summary', overview: 'Overview', localeVisible: true },
    { id: `e2e-tr-fr-${stamp}`, tripId: TRIP_ID, locale: 'fr', slug: SLUG_FR, title: 'Voyage E2E', summary: 'Résumé', overview: 'Aperçu', localeVisible: true },
  ]);
  await database.insert(departures).values({
    id: `e2e-dep-${stamp}`, tripId: TRIP_ID,
    startDate: new Date('2027-11-01T08:00:00.000Z'), endDate: new Date('2027-11-04T18:00:00.000Z'),
    status: 'open', capacityMin: 2, capacityMax: 8, priceAmount: 100000, currency: 'EUR', pricingRules: {},
    bookingDeadline: new Date('2027-10-15T23:59:00.000Z'),
  });
});

test.afterAll(async () => {
  const database = await db();
  const { eq, inArray } = await import('drizzle-orm');
  const { trips, tripTranslations } = await import('../../src/database/schemas/trips.schema');
  const { departures } = await import('../../src/database/schemas/departures.schema');
  const { applications, applicationDecisions, applicationEvents } = await import('../../src/database/schemas/applications.schema');
  const { travelers } = await import('../../src/database/schemas/travelers.schema');
  const { reservations } = await import('../../src/database/schemas/reservations.schema');
  const { payments } = await import('../../src/database/schemas/payments.schema');
  const { outboxEvents } = await import('../../src/database/schemas/outbox.schema');
  const { invalidateCache } = await import('../../src/database/cache');
  const tripReservations = await database.select({ id: reservations.id }).from(reservations).where(eq(reservations.tripId, TRIP_ID));
  if (tripReservations.length > 0) {
    const reservationIds = tripReservations.map((reservation) => reservation.id);
    await database.delete(payments).where(inArray(payments.reservationId, reservationIds));
    await database.delete(reservations).where(inArray(reservations.id, reservationIds));
  }
  const apps = await database.select({ id: applications.id, travelerId: applications.travelerId }).from(applications).where(eq(applications.tripId, TRIP_ID));
  for (const a of apps) {
    await database.delete(applicationDecisions).where(eq(applicationDecisions.applicationId, a.id));
    await database.delete(applicationEvents).where(eq(applicationEvents.applicationId, a.id));
    await database.delete(outboxEvents).where(eq(outboxEvents.aggregateId, a.id));
    await database.delete(applications).where(eq(applications.id, a.id));
    await database.delete(travelers).where(eq(travelers.id, a.travelerId));
  }
  await database.delete(tripTranslations).where(eq(tripTranslations.tripId, TRIP_ID));
  await database.delete(departures).where(eq(departures.tripId, TRIP_ID));
  const tripRow = await database.select({ heroMediaId: trips.heroMediaId }).from(trips).where(eq(trips.id, TRIP_ID));
  await database.delete(trips).where(eq(trips.id, TRIP_ID));
  const { mediaFiles } = await import('../../src/database/schemas/media.schema');
  if (tripRow[0]?.heroMediaId) {
    await database.delete(mediaFiles).where(eq(mediaFiles.id, tripRow[0].heroMediaId)).catch(() => {});
  }
  invalidateCache();
});

async function signInAsAdmin(page: import('@playwright/test').Page) {
  await page.goto('/en/auth/sign-in', { waitUntil: 'networkidle' });
  await page.locator('input[name="email"]').fill(SEED_EMAIL);
  await page.locator('input[name="password"]').fill(SEED_PASSWORD);
  const submitBtn = page.locator('button[type="submit"], form button').first();
  await Promise.all([
    page.waitForURL(/dashboard/, { timeout: 30000 }),
    submitBtn.click(),
  ]);
  await page.waitForLoadState('networkidle');
}

test.describe('Voyage public — liste et fiche', () => {
  test('list loads in EN and FR (localized segment rewritten)', async ({ page }) => {
    for (const url of ['/en/trips', '/fr/voyages']) {
      const response = await page.goto(url, { waitUntil: 'networkidle' });
      expect(response?.status()).toBe(200);
    }
    await expect(page.locator('h1')).toContainText(/Voyages|Trips|journeys/i);
  });

  test('list loads in ES and AR with ASCII slugs', async ({ page }) => {
    for (const url of ['/es/viajes', '/ar/trips']) {
      const response = await page.goto(url, { waitUntil: 'networkidle' });
      expect(response?.status()).toBe(200);
    }
    const canonical = await page.locator('link[rel="canonical"]').getAttribute('href');
    expect(canonical).toContain('/ar/trips');
  });

  test('detail loads via canonical localized URLs with SEO tags', async ({ page }) => {
    const response = await page.goto(`/fr/voyages/${SLUG_FR}`, { waitUntil: 'networkidle' });
    expect(response?.status()).toBe(200);
    await expect(page.locator('h1').first()).toContainText('Voyage E2E');
    const canonical = await page.locator('link[rel="canonical"]').getAttribute('href');
    expect(canonical).toContain(`/fr/voyages/${SLUG_FR}`);
    const alternates = await page.locator('link[rel="alternate"][hreflang]').count();
    expect(alternates).toBeGreaterThanOrEqual(3);
  });

  test('unknown trip slug renders 404', async ({ page }) => {
    const response = await page.goto('/en/trips/does-not-exist-xyz', { waitUntil: 'networkidle' });
    expect(response?.status()).toBe(404);
  });
});

test.describe('Voyage — rareté marketing (≤ 2 places)', () => {
  // Fixtures dédiées : capacité 4, 2 réservations confirmées → remaining = 2
  // (SCARCITY_THRESHOLD exact). Le public ne voit JAMAIS le ratio X/Y : il ne
  // voit que le bandeau d'urgence. L'admin conserve son compteur de gestion.
  const SC_TRIP = `sc-trip-${stamp}`;
  const SC_SLUG = `sc-trip-${stamp}`;
  const SC_DEP = `sc-dep-${stamp}`;
  const RES_NUM_PREFIX = `ATL-2028-S${stamp.slice(-4).toUpperCase()}`;

  test.beforeAll(async () => {
    const database = await db();
    const { tripTranslations } = await import('../../src/database/schemas/trips.schema');
    const { departures } = await import('../../src/database/schemas/departures.schema');
    const { travelers } = await import('../../src/database/schemas/travelers.schema');
    const { reservations } = await import('../../src/database/schemas/reservations.schema');
    const { insertTestTrip } = await import('../helpers/trip-factory');
    // trips_hero_ck : publié ⇒ média héros obligatoire — la factory l'insère
    // (voir afterAll du describe racine pour le nettoyage ciblé du média).
    await insertTestTrip(database, {
      id: SC_TRIP, status: 'published', countryCode: 'FR', defaultCurrency: 'EUR',
      durationDays: 4, durationNights: 3, groupMin: 2, groupMax: 4,
      difficulty: 'easy', difficultyLevel: 2, publishedAt: new Date(),
    });
    await database.insert(tripTranslations).values({
      id: `sc-tr-en-${stamp}`, tripId: SC_TRIP, locale: 'en', slug: SC_SLUG,
      title: 'Scarcity Trip', summary: 'S', overview: 'O', localeVisible: true,
    });
    await database.insert(departures).values({
      id: SC_DEP, tripId: SC_TRIP,
      startDate: new Date('2028-01-10T08:00:00.000Z'), endDate: new Date('2028-01-13T18:00:00.000Z'),
      status: 'open', capacityMin: 2, capacityMax: 4, priceAmount: 100000, currency: 'EUR', pricingRules: {},
    });
    for (const [i, email] of [`sc-a-${stamp}@test.com`, `sc-b-${stamp}@test.com`].entries()) {
      const [t] = await database.insert(travelers).values({ email, locale: 'en' }).returning({ id: travelers.id });
      await database.insert(reservations).values({
        reservationNumber: `${RES_NUM_PREFIX}${i}`,
        travelerId: t.id, tripId: SC_TRIP, departureId: SC_DEP, status: 'confirmed',
        currency: 'EUR', baseAmount: 100000, totalAmount: 100000, amountPaid: 100000, amountDue: 0,
      });
    }
    const { invalidateCache } = await import('../../src/database/cache');
    invalidateCache();
  });

  test.afterAll(async () => {
    const database = await db();
    const { eq, inArray } = await import('drizzle-orm');
    const { trips, tripTranslations } = await import('../../src/database/schemas/trips.schema');
    const { departures } = await import('../../src/database/schemas/departures.schema');
    const { travelers } = await import('../../src/database/schemas/travelers.schema');
    const { reservations } = await import('../../src/database/schemas/reservations.schema');
    const { mediaFiles } = await import('../../src/database/schemas/media.schema');
    const { invalidateCache } = await import('../../src/database/cache');
    await database.delete(reservations).where(eq(reservations.tripId, SC_TRIP));
    await database.delete(travelers).where(inArray(travelers.email, [`sc-a-${stamp}@test.com`, `sc-b-${stamp}@test.com`]));
    await database.delete(departures).where(eq(departures.tripId, SC_TRIP));
    const tripRow = await database.select({ heroMediaId: trips.heroMediaId }).from(trips).where(eq(trips.id, SC_TRIP));
    await database.delete(tripTranslations).where(eq(tripTranslations.tripId, SC_TRIP));
    await database.delete(trips).where(eq(trips.id, SC_TRIP));
    if (tripRow[0]?.heroMediaId) {
      await database.delete(mediaFiles).where(eq(mediaFiles.id, tripRow[0].heroMediaId)).catch(() => {});
    }
    invalidateCache();
  });

  test('visitor sees the urgency banner, never a counter', async ({ page }) => {
    const response = await page.goto(`/en/trips/${SC_SLUG}`, { waitUntil: 'networkidle' });
    expect(response?.status()).toBe(200);
    await expect(page.getByText('Only 2 spots left!')).toBeVisible();
    // Deux garde-fous : aucun <progress> rendu, aucun label « Places remaining ».
    await expect(page.locator('progress')).toHaveCount(0);
    await expect(page.getByText('Places remaining')).toHaveCount(0);
  });

  test('listing card turns the status pill into the scarcity signal', async ({ page }) => {
    await page.goto('/en/trips', { waitUntil: 'networkidle' });
    await expect(page.getByText('Only 2 spots left!').first()).toBeVisible();
  });

  test('admin keeps the exact counter alongside the banner', async ({ page }) => {
    await signInAsAdmin(page);
    await page.goto(`/en/trips/${SC_SLUG}`, { waitUntil: 'networkidle' });
    // L'admin voit les deux : le bandeau (vue client) et le ratio exact.
    await expect(page.getByText('Only 2 spots left!')).toBeVisible();
    await expect(page.locator('progress')).toHaveCount(1);
    await expect(page.getByText('Places remaining')).toBeVisible();
  });
});

test.describe('Voyage — arabe RTL', () => {
  test('arabic page has dir="rtl" and arabic content', async ({ page }) => {
    await page.goto('/ar/', { waitUntil: 'networkidle' });
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.locator('html')).toHaveAttribute('lang', 'ar');
  });
});

test.describe('Voyage — candidature', () => {
  // Compte vérifié exigé inconditionnellement (2026-09-21) : les anonymes sont
  // redirigés 302 vers sign-in avec ?next= vers l'URL de candidature.
  test('anonymous visitor is redirected to sign-in with ?next=', async ({ page }) => {
    await page.goto(`/en/apply/${SLUG_EN}`, { waitUntil: 'networkidle' });
    await expect(page).toHaveURL(/\/en\/auth\/sign-in\?next=/);
  });

  test('authenticated flow submits an application', async ({ page }) => {
    // Astro action round-trip + DB writes under the 1-worker E2E server can
    // exceed the default 30 s — give this business flow more headroom.
    test.setTimeout(90000);
    await signInAsAdmin(page);
    const response = await page.goto(`/en/apply/${SLUG_EN}`, { waitUntil: 'networkidle' });
    expect(response?.status()).toBe(200);
    // Email pré-rempli readonly depuis la session (doit matcher le compte connecté).
    await expect(page.locator('input[name="email"]')).toHaveValue(SEED_EMAIL);
    await expect(page.locator('input[name="email"]')).toHaveAttribute('readonly', '');
    await page.locator('input[name="legalName"]').fill('E2E Candidate');
    await page.locator('input[name="activityAcknowledgement"]').check();
    await page.locator('input[name="consent"]').check();
    await page.locator('input[name="termsAccepted"]').check();
    const submitBtn = page.locator('form [type="submit"], form button').last();
    await Promise.all([
      page.waitForResponse((r) => r.url().includes('/_astro/actions/') && r.ok(), { timeout: 30000 }).catch(() => null),
      submitBtn.click(),
    ]);
    await page.waitForURL(/\/en\/booking-confirmed\?session_id=/, { timeout: 60000 });
    await expect(page.locator('h1')).toHaveText('Booking confirmed');
  });
});

test.describe('Voyage — admin trips', () => {
  test('unauthenticated user is redirected', async ({ page }) => {
    await page.goto('/en/admin/trips', { waitUntil: 'networkidle' });
    await expect(page).toHaveURL(/sign-in|connexion|dashboard/);
  });

  test('admin trips list loads', async ({ page }) => {
    await signInAsAdmin(page);
    const response = await page.goto('/en/admin/trips', { waitUntil: 'networkidle' });
    expect(response?.status()).toBe(200);
    await expect(page.locator('h1')).toContainText(/Trips/i);
  });

  test('admin applications, reservations, payments and emails load', async ({ page }) => {
    await signInAsAdmin(page);
    for (const url of ['/en/admin/applications', '/en/admin/reservations', '/en/admin/payments', '/en/admin/travelers', '/en/admin/emails', '/en/admin/policies']) {
      const response = await page.goto(url, { waitUntil: 'networkidle' });
      expect(response?.status()).toBe(200);
    }
    await expect(page.locator('h1')).toContainText(/Policies|Emails/i);
  });
});

test.describe('Voyage — early bird (paiement intégral anticipé)', () => {
  // Fixtures dédiées : intervention early bird % + fenêtre mois + intégral.
  // La fenêtre (4 mois avant 2027-06-01 → 2027-02-01) reste active à tout run
  // raisonnable ; le test admin vérifie le round-trip des champs dédiés.
  const EB_TRIP = `eb-trip-${stamp}`;
  const EB_SLUG = `eb-trip-${stamp}`;
  const EB_DEP = `eb-dep-${stamp}`;

  test.beforeAll(async () => {
    const database = await db();
    const { tripTranslations } = await import('../../src/database/schemas/trips.schema');
    const { departures } = await import('../../src/database/schemas/departures.schema');
    const { insertTestTrip } = await import('../helpers/trip-factory');
    await insertTestTrip(database, {
      id: EB_TRIP, status: 'published', countryCode: 'FR', defaultCurrency: 'EUR',
      durationDays: 4, durationNights: 3, groupMin: 1, groupMax: 4,
      difficulty: 'easy', difficultyLevel: 2, publishedAt: new Date(),
    });
    await database.insert(tripTranslations).values({
      id: `eb-tr-en-${stamp}`, tripId: EB_TRIP, locale: 'en', slug: EB_SLUG,
      title: 'Early Bird Trip', summary: 'S', overview: 'O', localeVisible: true,
    });
    await database.insert(departures).values({
      id: EB_DEP, tripId: EB_TRIP,
      startDate: new Date('2027-06-01T08:00:00.000Z'), endDate: new Date('2027-06-04T18:00:00.000Z'),
      status: 'open', capacityMin: 1, capacityMax: 4, priceAmount: 100000, currency: 'EUR',
      pricingRules: { earlyBirdPercent: 10, earlyBirdMonths: 4, earlyBirdFullPayment: true },
    });
    const { invalidateCache } = await import('../../src/database/cache');
    invalidateCache();
  });

  test.afterAll(async () => {
    const database = await db();
    const { eq } = await import('drizzle-orm');
    const { trips, tripTranslations } = await import('../../src/database/schemas/trips.schema');
    const { departures } = await import('../../src/database/schemas/departures.schema');
    const { mediaFiles } = await import('../../src/database/schemas/media.schema');
    const { invalidateCache } = await import('../../src/database/cache');
    await database.delete(departures).where(eq(departures.tripId, EB_TRIP));
    const tripRow = await database.select({ heroMediaId: trips.heroMediaId }).from(trips).where(eq(trips.id, EB_TRIP));
    if (tripRow[0]?.heroMediaId) {
      await database.delete(mediaFiles).where(eq(mediaFiles.id, tripRow[0].heroMediaId)).catch(() => {});
    }
    await database.delete(tripTranslations).where(eq(tripTranslations.tripId, EB_TRIP));
    await database.delete(trips).where(eq(trips.id, EB_TRIP));
    invalidateCache();
  });

  test('detail card shows the early bird banner with full payment wording', async ({ page }) => {
    const response = await page.goto(`/en/trips/${EB_SLUG}`, { waitUntil: 'networkidle' });
    expect(response?.status()).toBe(200);
    await expect(page.getByText(/Early bird −/i)).toBeVisible();
    // Paiement intégral : l'acompte devient la totalité, le solde disparaît.
    await expect(page.getByText('Full payment at booking')).toBeVisible();
    await expect(page.getByText('Deposit on booking')).toHaveCount(0);
    await expect(page.getByText('Balance due before')).toHaveCount(0);
  });

  test('admin dedicated fields persist early bird rules (round-trip)', async ({ page }) => {
    test.setTimeout(90000);
    await signInAsAdmin(page);
    const response = await page.goto(`/en/admin/trips/${EB_TRIP}`, { waitUntil: 'networkidle' });
    expect(response?.status()).toBe(200);
    const details = page.locator(`[data-departure-id="${EB_DEP}"]`);
    await details.locator('summary').click();
    const form = details.locator('[data-departure-edit]');
    await form.locator('input[name="earlyBirdEnabled"]').check();
    await form.locator('select[name="earlyBirdKind"]').selectOption('percent');
    await form.locator('input[name="earlyBirdPercent"]').fill('15');
    await Promise.all([
      page.waitForResponse((r) => r.url().includes('/_astro/actions/') && r.ok(), { timeout: 30000 }).catch(() => null),
      form.locator('button[type="submit"]').first().click(),
    ]);
    // Reload client-side après succès : on rouvre et on lit la valeur persistée.
    await page.waitForLoadState('networkidle');
    const details2 = page.locator(`[data-departure-id="${EB_DEP}"]`);
    await details2.locator('summary').click();
    await expect(details2.locator('input[name="earlyBirdEnabled"]')).toBeChecked();
    await expect(details2.locator('input[name="earlyBirdPercent"]')).toHaveValue('15');
  });
});
