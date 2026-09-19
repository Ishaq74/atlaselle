import { test, expect } from '@playwright/test';
import { SEED_EMAIL, SEED_PASSWORD } from './global-setup';

/**
 * E2E tests for additional admin pages not covered by existing specs:
 * media, stats, roles, users, pages, audit, emails, policies, travelers.
 */

async function signInAsAdmin(page: import('@playwright/test').Page) {
  await page.goto('/fr/auth/connexion', { waitUntil: 'networkidle' });
  await page.locator('input[name="email"]').fill(SEED_EMAIL);
  await page.locator('input[name="password"]').fill(SEED_PASSWORD);
  const submitBtn = page.locator('button[type="submit"], form button').first();
  await Promise.all([
    page.waitForURL(/tableau-de-bord|dashboard/, { timeout: 30000 }),
    submitBtn.click(),
  ]);
  await page.waitForLoadState('networkidle');
}

test.describe('Admin pages — access guards', () => {
  test('unauthenticated user is redirected from admin pages', async ({ page }) => {
    const response = await page.goto('/fr/admin/stats', { waitUntil: 'networkidle' });
    expect(response?.status()).toBe(200);
    await expect(page).toHaveURL(/connexion|sign-in/);
  });
});

test.describe('Admin — Stats page', () => {
  test.beforeEach(async ({ page }) => {
    await signInAsAdmin(page);
  });

  test('stats page loads successfully', async ({ page }) => {
    const response = await page.goto('/fr/admin/stats', { waitUntil: 'networkidle' });
    expect(response?.ok()).toBeTruthy();
    expect(response?.status()).toBe(200);
  });

  test('stats page displays dashboard content', async ({ page }) => {
    await page.goto('/fr/admin/stats', { waitUntil: 'networkidle' });
    await expect(page.locator('h1')).toContainText(/Stats|Tableau de bord/i);
  });
});

test.describe('Admin — Media page', () => {
  test.beforeEach(async ({ page }) => {
    await signInAsAdmin(page);
  });

  test('media page loads successfully', async ({ page }) => {
    const response = await page.goto('/fr/admin/media', { waitUntil: 'networkidle' });
    expect(response?.ok()).toBeTruthy();
    expect(response?.status()).toBe(200);
  });

  test('media page has upload UI', async ({ page }) => {
    await page.goto('/fr/admin/media', { waitUntil: 'networkidle' });
    const body = await page.locator('body').textContent();
    expect(body).toContain(/media|image|upload/i);
  });
});

test.describe('Admin — Roles page', () => {
  test.beforeEach(async ({ page }) => {
    await signInAsAdmin(page);
  });

  test('roles page loads successfully', async ({ page }) => {
    const response = await page.goto('/fr/admin/roles', { waitUntil: 'networkidle' });
    expect(response?.ok()).toBeTruthy();
    expect(response?.status()).toBe(200);
  });
});

test.describe('Admin — Users page', () => {
  test.beforeEach(async ({ page }) => {
    await signInAsAdmin(page);
  });

  test('users page loads successfully', async ({ page }) => {
    const response = await page.goto('/fr/admin/users', { waitUntil: 'networkidle' });
    expect(response?.ok()).toBeTruthy();
    expect(response?.status()).toBe(200);
  });
});

test.describe('Admin — Pages page', () => {
  test.beforeEach(async ({ page }) => {
    await signInAsAdmin(page);
  });

  test('pages page loads successfully', async ({ page }) => {
    const response = await page.goto('/fr/admin/pages', { waitUntil: 'networkidle' });
    expect(response?.ok()).toBeTruthy();
    expect(response?.status()).toBe(200);
  });
});

test.describe('Admin — Audit log page', () => {
  test.beforeEach(async ({ page }) => {
    await signInAsAdmin(page);
  });

  test('audit page loads successfully', async ({ page }) => {
    const response = await page.goto('/fr/admin/audit', { waitUntil: 'networkidle' });
    expect(response?.ok()).toBeTruthy();
    expect(response?.status()).toBe(200);
  });

  test('audit page shows audit log table', async ({ page }) => {
    await page.goto('/fr/admin/audit', { waitUntil: 'networkidle' });
    const body = await page.locator('body').textContent();
    expect(body).toContain(/audit|journal|log/i);
  });
});

test.describe('Admin — Emails page', () => {
  test.beforeEach(async ({ page }) => {
    await signInAsAdmin(page);
  });

  test('emails page loads successfully', async ({ page }) => {
    const response = await page.goto('/fr/admin/emails', { waitUntil: 'networkidle' });
    expect(response?.ok()).toBeTruthy();
    expect(response?.status()).toBe(200);
  });
});

test.describe('Admin — Policies page', () => {
  test.beforeEach(async ({ page }) => {
    await signInAsAdmin(page);
  });

  test('policies page loads successfully', async ({ page }) => {
    const response = await page.goto('/fr/admin/policies', { waitUntil: 'networkidle' });
    expect(response?.ok()).toBeTruthy();
    expect(response?.status()).toBe(200);
  });
});

test.describe('Admin — Travelers page', () => {
  test.beforeEach(async ({ page }) => {
    await signInAsAdmin(page);
  });

  test('travelers page loads successfully', async ({ page }) => {
    const response = await page.goto('/fr/admin/travelers', { waitUntil: 'networkidle' });
    expect(response?.ok()).toBeTruthy();
    expect(response?.status()).toBe(200);
  });
});

test.describe('Admin — Applications page', () => {
  test.beforeEach(async ({ page }) => {
    await signInAsAdmin(page);
  });

  test('applications page loads successfully', async ({ page }) => {
    const response = await page.goto('/fr/admin/applications', { waitUntil: 'networkidle' });
    expect(response?.ok()).toBeTruthy();
    expect(response?.status()).toBe(200);
  });
});

test.describe('Admin — Reservations page', () => {
  test.beforeEach(async ({ page }) => {
    await signInAsAdmin(page);
  });

  test('reservations page loads successfully', async ({ page }) => {
    const response = await page.goto('/fr/admin/reservations', { waitUntil: 'networkidle' });
    expect(response?.ok()).toBeTruthy();
    expect(response?.status()).toBe(200);
  });
});

test.describe('Admin — Payments page', () => {
  test.beforeEach(async ({ page }) => {
    await signInAsAdmin(page);
  });

  test('payments page loads successfully', async ({ page }) => {
    const response = await page.goto('/fr/admin/payments', { waitUntil: 'networkidle' });
    expect(response?.ok()).toBeTruthy();
    expect(response?.status()).toBe(200);
  });
});

test.describe('Admin — Blog edit page', () => {
  test.beforeEach(async ({ page }) => {
    await signInAsAdmin(page);
  });

  test('blog new post page loads', async ({ page }) => {
    const response = await page.goto('/fr/admin/blog/new', { waitUntil: 'networkidle' });
    expect(response?.ok()).toBeTruthy();
    expect(response?.status()).toBe(200);
  });
});
