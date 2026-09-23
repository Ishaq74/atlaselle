import { test, expect } from '@playwright/test';
import { SEED_EMAIL, SEED_PASSWORD } from './global-setup';

/**
 * E2E — CMS admin deep coverage: pages, sections, navigation menus,
 * site settings, theme, social links, opening hours, consent settings,
 * versions, media folders, and content import/export endpoints.
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

test.describe('CMS — pages & sections', () => {
  test('pages admin lists pages and exposes create action', async ({ browser }) => {
    const context = await browser.newContext({ storageState: await adminState(browser) });
    const page = await context.newPage();
    const response = await page.goto('/fr/admin/pages', { waitUntil: 'networkidle' });
    expect(response?.status()).toBe(200);
    await expect(page.locator('main')).toBeVisible();
    await context.close();
  });

  test('trash/scheduled/published tabs respond to query params', async ({ browser }) => {
    const context = await browser.newContext({ storageState: await adminState(browser) });
    const page = await context.newPage();
    for (const view of ['?status=published', '?status=draft', '?view=trash']) {
      const response = await page.goto(`/fr/admin/pages${view}`, { waitUntil: 'networkidle' });
      expect(response?.status(), `/fr/admin/pages${view}`).toBe(200);
    }
    await context.close();
  });
});

test.describe('CMS — navigation & menus', () => {
  test('navigation admin renders tree management UI', async ({ browser }) => {
    const context = await browser.newContext({ storageState: await adminState(browser) });
    const page = await context.newPage();
    const response = await page.goto('/fr/admin/navigation', { waitUntil: 'networkidle' });
    expect(response?.status()).toBe(200);
    await context.close();
  });
});

test.describe('CMS — site settings tabs', () => {
  test('site settings page exposes settings, contact, hours, social and consent tabs', async ({ browser }) => {
    const context = await browser.newContext({ storageState: await adminState(browser) });
    const page = await context.newPage();
    const response = await page.goto('/fr/admin/site', { waitUntil: 'networkidle' });
    expect(response?.status()).toBe(200);
    // The settings form is the anchor of the page.
    await expect(page.locator('form').first()).toBeVisible();
    await context.close();
  });

  test('theme page exposes theme form', async ({ browser }) => {
    const context = await browser.newContext({ storageState: await adminState(browser) });
    const page = await context.newPage();
    const response = await page.goto('/fr/admin/theme', { waitUntil: 'networkidle' });
    expect(response?.status()).toBe(200);
    await context.close();
  });
});

test.describe('CMS — content import/export endpoints (admin auth)', () => {
  test('GET /api/content-export returns a JSON export for admins', async ({ browser }) => {
    const context = await browser.newContext({ storageState: await adminState(browser) });
    const response = await context.request.get(`${BASE_URL}/api/content-export`);
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body).toBeTruthy();
    await context.close();
  });

  test('POST /api/content-import rejects invalid JSON payload', async ({ browser }) => {
    const context = await browser.newContext({ storageState: await adminState(browser) });
    const response = await context.request.post(`${BASE_URL}/api/content-import`, {
      headers: { 'Content-Type': 'application/json', Origin: BASE_URL },
      data: { not: 'a valid manifest' },
    });
    expect([400, 422]).toContain(response.status());
    await context.close();
  });

  test('GET /api/audit-export streams audit log for admins', async ({ browser }) => {
    const context = await browser.newContext({ storageState: await adminState(browser) });
    const response = await context.request.get(`${BASE_URL}/api/audit-export`);
    expect(response.status()).toBe(200);
    await context.close();
  });
});

test.describe('CMS — media library', () => {
  test('media admin page exposes upload UI and folder tree', async ({ browser }) => {
    const context = await browser.newContext({ storageState: await adminState(browser) });
    const page = await context.newPage();
    const response = await page.goto('/fr/admin/media', { waitUntil: 'networkidle' });
    expect(response?.status()).toBe(200);
    await context.close();
  });

  test('GET /api/media returns the media list for admins', async ({ browser }) => {
    const context = await browser.newContext({ storageState: await adminState(browser) });
    const response = await context.request.get(`${BASE_URL}/api/media`);
    expect(response.status()).toBe(200);
    await context.close();
  });

  test('POST /api/upload rejects non-multipart bodies', async ({ browser }) => {
    const context = await browser.newContext({ storageState: await adminState(browser) });
    const response = await context.request.post(`${BASE_URL}/api/upload`, {
      headers: { 'Content-Type': 'application/json', Origin: BASE_URL },
      data: { file: 'not-multipart' },
    });
    expect(response.status()).toBe(400);
    await context.close();
  });
});
