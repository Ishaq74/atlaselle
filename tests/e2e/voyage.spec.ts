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
const EMAIL = `e2e-cand-${stamp}@test.com`;

async function db() {
  const { getDrizzle } = await import('../../src/database/drizzle');
  return getDrizzle();
}

test.beforeAll(async () => {
  const database = await db();
  const { trips, tripTranslations } = await import('../../src/database/schemas/trips.schema');
  const { departures } = await import('../../src/database/schemas/departures.schema');
  await database.insert(trips).values({
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
    bookingDeadline: new Date('2027-12-31T23:59:00.000Z'),
  });
});

test.afterAll(async () => {
  const database = await db();
  const { eq } = await import('drizzle-orm');
  const { trips, tripTranslations } = await import('../../src/database/schemas/trips.schema');
  const { departures } = await import('../../src/database/schemas/departures.schema');
  const { applications, applicationDecisions, applicationEvents } = await import('../../src/database/schemas/applications.schema');
  const { travelers } = await import('../../src/database/schemas/travelers.schema');
  const { outboxEvents } = await import('../../src/database/schemas/outbox.schema');
  const { invalidateCache } = await import('../../src/database/cache');
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
  await database.delete(trips).where(eq(trips.id, TRIP_ID));
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
    expect(alternates).toBeGreaterThanOrEqual(4);
  });

  test('unknown trip slug renders 404', async ({ page }) => {
    const response = await page.goto('/en/trips/does-not-exist-xyz', { waitUntil: 'networkidle' });
    expect(response?.status()).toBe(404);
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
  test('authenticated flow submits an application', async ({ page }) => {
    const response = await page.goto(`/en/apply/${SLUG_EN}`, { waitUntil: 'networkidle' });
    expect(response?.status()).toBe(200);
    await page.locator('input[name="legalName"]').fill('E2E Candidate');
    await page.locator('input[name="email"]').fill(EMAIL);
    await page.locator('input[name="activityAcknowledgement"]').check();
    await page.locator('input[name="consent"]').check();
    const submitBtn = page.locator('form [type="submit"], form button').last();
    await Promise.all([
      page.waitForResponse((r) => r.url().includes('/_astro/actions/') && r.ok(), { timeout: 30000 }).catch(() => null),
      submitBtn.click(),
    ]);
    await expect(page.locator('[data-form-message], section')).toContainText(/sent|envoyée|Application sent/i, { timeout: 30000 });
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
