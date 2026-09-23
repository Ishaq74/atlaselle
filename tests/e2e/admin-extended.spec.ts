import { randomUUID } from 'node:crypto';
import { test, expect } from '@playwright/test';
import { SEED_EMAIL, SEED_PASSWORD } from './global-setup';

/**
 * E2E tests for admin surfaces NOT covered by admin-pages.spec.ts /
 * cms-admin.spec.ts / voyage.spec.ts:
 *   - /fr/admin (dashboard home)
 *   - /fr/admin/trips (+ moderation queue, + edit form with a real fixture)
 *   - /fr/admin/payments
 *   - /fr/admin/applications/[id] and /fr/admin/reservations/[id] 404 handling
 */

const BASE_URL = 'http://localhost:4322';

/** Signs in the seeded admin via the auth API and returns a storage state. */
async function adminState(browser: import('@playwright/test').Browser) {
  const context = await browser.newContext();
  const response = await context.request.post(`${BASE_URL}/api/auth/sign-in/email`, {
    headers: { 'content-type': 'application/json', Origin: BASE_URL },
    data: { email: SEED_EMAIL, password: SEED_PASSWORD },
  });
  if (response.status() !== 200) {
    throw new Error(`Seed admin login failed (${response.status()})`);
  }
  const state = await context.storageState();
  await context.close();
  return state;
}

test.describe('Admin — dashboard home', () => {
  test('admin index loads after sign-in', async ({ browser }) => {
    const context = await browser.newContext({ storageState: await adminState(browser) });
    const page = await context.newPage();
    const response = await page.goto('/fr/admin', { waitUntil: 'networkidle' });
    expect(response?.status()).toBe(200);
    await context.close();
  });

  test('admin index redirects anonymous users to sign-in', async ({ page }) => {
    await page.goto('/fr/admin', { waitUntil: 'networkidle' });
    await expect(page).toHaveURL(/connexion|sign-in/);
  });
});

test.describe('Admin — trips management', () => {
  test('trips list loads (FR)', async ({ browser }) => {
    const context = await browser.newContext({ storageState: await adminState(browser) });
    const page = await context.newPage();
    const response = await page.goto('/fr/admin/trips', { waitUntil: 'networkidle' });
    expect(response?.status()).toBe(200);
    await context.close();
  });

  test('trips moderation queue loads (FR)', async ({ browser }) => {
    const context = await browser.newContext({ storageState: await adminState(browser) });
    const page = await context.newPage();
    const response = await page.goto('/fr/admin/trips/moderation', { waitUntil: 'networkidle' });
    expect(response?.status()).toBe(200);
    await context.close();
  });

  test('trip edit page loads with a real fixture trip', async ({ browser }) => {
    const { getDrizzle } = await import('../../src/database/drizzle');
    const { trips, tripTranslations } = await import('../../src/database/schemas/trips.schema');
    const { mediaFiles } = await import('../../src/database/schemas/media.schema');
    const { insertTestTrip } = await import('../helpers/trip-factory');
    const { eq, like } = await import('drizzle-orm');

    const db = getDrizzle();
    const tripId = `e2e-admin-trip-${randomUUID().slice(0, 8)}`;
    await insertTestTrip(db, {
      id: tripId,
      status: 'draft',
      countryCode: 'FR',
      defaultCurrency: 'EUR',
      durationDays: 3,
      durationNights: 2,
      groupMin: 2,
      groupMax: 6,
      difficulty: 'easy',
      difficultyLevel: 1,
    });
    await db.insert(tripTranslations).values({
      id: `${tripId}-fr`,
      tripId,
      locale: 'fr',
      slug: tripId,
      title: 'E2E Admin Trip',
      summary: 'Résumé E2E',
      overview: 'Aperçu E2E',
      localeVisible: false,
    });

    try {
      const context = await browser.newContext({ storageState: await adminState(browser) });
      const page = await context.newPage();
      const response = await page.goto(`/fr/admin/trips/${tripId}`, { waitUntil: 'networkidle' });
      expect(response?.status()).toBe(200);
      await context.close();
    } finally {
      await db.delete(tripTranslations).where(eq(tripTranslations.tripId, tripId)).catch(() => {});
      await db.delete(trips).where(eq(trips.id, tripId)).catch(() => {});
      await db.delete(mediaFiles).where(like(mediaFiles.id, 'test-media-%')).catch(() => {});
    }
  });

  test('trip edit page 404s on unknown id', async ({ browser }) => {
    const context = await browser.newContext({ storageState: await adminState(browser) });
    const page = await context.newPage();
    const response = await page.goto(`/fr/admin/trips/${randomUUID()}`, { waitUntil: 'networkidle' });
    expect(response?.status()).toBe(404);
    await context.close();
  });
});

test.describe('Admin — payments', () => {
  test('payments list loads (FR)', async ({ browser }) => {
    const context = await browser.newContext({ storageState: await adminState(browser) });
    const page = await context.newPage();
    const response = await page.goto('/fr/admin/payments', { waitUntil: 'networkidle' });
    expect(response?.status()).toBe(200);
    await context.close();
  });

  test('payments list redirects anonymous users to sign-in', async ({ page }) => {
    await page.goto('/fr/admin/payments', { waitUntil: 'networkidle' });
    await expect(page).toHaveURL(/connexion|sign-in/);
  });
});

test.describe('Admin — detail pages 404 handling', () => {
  test('application detail 404s on unknown id', async ({ browser }) => {
    const context = await browser.newContext({ storageState: await adminState(browser) });
    const page = await context.newPage();
    const response = await page.goto(`/fr/admin/applications/${randomUUID()}`, {
      waitUntil: 'networkidle',
    });
    expect(response?.status()).toBe(404);
    await context.close();
  });

  test('reservation detail 404s on unknown id', async ({ browser }) => {
    const context = await browser.newContext({ storageState: await adminState(browser) });
    const page = await context.newPage();
    const response = await page.goto(`/fr/admin/reservations/${randomUUID()}`, {
      waitUntil: 'networkidle',
    });
    expect(response?.status()).toBe(404);
    await context.close();
  });
});
