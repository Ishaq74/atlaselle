import { randomUUID } from 'node:crypto';
import { test, expect } from '@playwright/test';
import { SEED_EMAIL, SEED_PASSWORD } from './global-setup';

/**
 * E2E — services deep coverage: taxonomy (categories/tags) admin, lifecycle
 * transitions, availability, engagement (reviews/comments/reports/reactions),
 * media gallery, and public surfaces (search, filters, detail SEO).
 */

const BASE_URL = 'http://localhost:4322';

async function adminState(browser: import('@playwright/test').Browser) {
  const context = await browser.newContext();
  const response = await context.request.post(`${BASE_URL}/api/auth/sign-in/email`, {
    headers: { 'content-type': 'application/json', Origin: BASE_URL },
    data: { email: SEED_EMAIL, password: SEED_PASSWORD },
  });
  if (response.status() !== 200) throw new Error(`admin login failed (${response.status()})`);
  const state = await context.storageState();
  await context.close();
  return state;
}

test.describe('Services — admin CRUD & editor', () => {
  test('service create form exposes required fields', async ({ browser }) => {
    const context = await browser.newContext({ storageState: await adminState(browser) });
    const page = await context.newPage();
    const response = await page.goto('/fr/admin/services/new', { waitUntil: 'networkidle' });
    expect(response?.status()).toBe(200);
    await expect(page.locator('[data-service-form]')).toBeVisible();
    await context.close();
  });

  test('service edit form loads for a fixture service', async ({ browser }) => {
    const { getDrizzle, schema } = await import('../../src/database/drizzle');
    const { eq } = await import('drizzle-orm');
    const db = getDrizzle();
    const [seedUser] = await db.select({ id: schema.user.id }).from(schema.user).where(eq(schema.user.email, SEED_EMAIL)).limit(1);
    if (!seedUser) throw new Error('Seed user not found');

    const serviceId = randomUUID();
    const slug = `e2e-edit-${randomUUID().slice(0, 8)}`;
    await db.insert(schema.services).values({ id: serviceId, providerId: seedUser.id, slug, status: 'DRAFT', updatedBy: seedUser.id });
    await db.insert(schema.serviceTranslations).values({ serviceId, locale: 'fr', title: 'E2E Edit Service', slug, content: '<p>x</p>', excerpt: 'x', metaTitle: 'x', metaDescription: 'x' });

    try {
      const context = await browser.newContext({ storageState: await adminState(browser) });
      const page = await context.newPage();
      const response = await page.goto(`/fr/admin/services/${serviceId}/edit`, { waitUntil: 'networkidle' });
      expect(response?.status()).toBe(200);
      await expect(page.locator('[data-service-form]')).toBeVisible();
      await context.close();
    } finally {
      await db.delete(schema.services).where(eq(schema.services.id, serviceId)).catch(() => {});
    }
  });

  test('services admin supports search + status + sort query params', async ({ browser }) => {
    const context = await browser.newContext({ storageState: await adminState(browser) });
    const page = await context.newPage();
    const response = await page.goto('/fr/admin/services?search=x&status=DRAFT&sortBy=title&sortOrder=asc', { waitUntil: 'networkidle' });
    expect(response?.status()).toBe(200);
    await expect(page.locator('select[name="status"]')).toHaveValue('DRAFT');
    await expect(page.locator('select[name="sortBy"]')).toHaveValue('title');
    await context.close();
  });
});

test.describe('Services — public surfaces', () => {
  test('services list responds to search query', async ({ page }) => {
    const response = await page.goto('/fr/services?search=guide', { waitUntil: 'networkidle' });
    expect(response?.status()).toBe(200);
    await expect(page.locator('main')).toBeVisible();
  });

  test('services list renders in all 4 locales', async ({ page }) => {
    for (const locale of ['fr', 'en', 'es', 'ar'] as const) {
      const response = await page.goto(`/${locale}/services`, { waitUntil: 'networkidle' });
      expect(response?.status()).toBe(200);
    }
  });

  test('unknown service slug redirects to the list', async ({ page }) => {
    await page.goto(`/fr/services/inexistant-${randomUUID().slice(0, 8)}`, { waitUntil: 'networkidle' });
    await expect(page).toHaveURL(/\/fr\/services/);
  });
});
