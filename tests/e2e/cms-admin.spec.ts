import { test, expect } from '@playwright/test';
import { SEED_EMAIL, SEED_PASSWORD } from './global-setup';

/**
 * E2E tests for CMS admin pages (site, navigation, theme).
 *
 * The seed user is set as admin in global-setup.ts so these pages
 * are accessible after sign-in.
 */

/**
 * Sign in as admin seed user — reliable across browsers.
 *
 * The bare `catch {}` this used to have was the single reason 7 security-class
 * errors on the 23/09 run were unreadable: it discarded the `waitForURL`
 * timeout, including the log line that showed the page had navigated to
 * `…/auth/connexion?email=…&password=…` (the credential leak), and replaced it
 * with "Sign-in failed after 2 attempts". The original error is now attached as
 * `cause`, and the second attempt reports which state was observed, so the
 * report names the failure instead of paraphrasing it.
 */
async function signInAsAdmin(page: import('@playwright/test').Page) {
  const MAX_ATTEMPTS = 2;
  let lastCause: unknown;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    await page.goto('/fr/auth/connexion', { waitUntil: 'networkidle' });
    await page.locator('input[name="email"]').fill(SEED_EMAIL);
    await page.locator('input[name="password"]').fill(SEED_PASSWORD);
    const submitBtn = page.locator('button[type="submit"], form button').first();
    try {
      await Promise.all([
        page.waitForURL(/tableau-de-bord|dashboard/, { timeout: 30_000 }),
        submitBtn.click(),
      ]);
      await page.waitForLoadState('networkidle');
      return;
    } catch (cause) {
      lastCause = cause;
    }
  }

  // `page.url()` est synchrone : le `await` n'avait aucun effet sur le type
  // (ts80007) et rien n'attendait. Le message d'échec doit lire l'URL réellement
  // observée, donc la valeur est conservée telle quelle.
  const observed = page.url();
  throw new Error(
    `Sign-in failed after ${MAX_ATTEMPTS} attempts. ` +
      `Last observed URL: ${observed}. ` +
      `A credential-bearing URL here means the sign-in form fell back to a GET submission.`,
    { cause: lastCause },
  );
}

// ─── Admin access guard ─────────────────────────────────────────────

test.describe('CMS Admin access', () => {
  test('unauthenticated user is redirected from admin pages', async ({ page }) => {
    await page.goto('/fr/admin/site');
    await expect(page).toHaveURL(/connexion|sign-in/);
  });
});

// ─── Site settings page ─────────────────────────────────────────────

test.describe('CMS Site settings page', () => {
  test.beforeEach(async ({ page }) => {
    await signInAsAdmin(page);
  });

  test('site page loads successfully', async ({ page }) => {
    const response = await page.goto('/fr/admin/site');
    expect(response?.ok()).toBeTruthy();
    expect(response?.status()).toBe(200);
  });

  test('site page contains settings form', async ({ page }) => {
    await page.goto('/fr/admin/site');
    // Forms are inside JS-activated tab panels — verify they exist in the DOM
    await expect(page.locator('form').first()).toBeAttached({ timeout: 10000 });
  });

  test('site page has tabs for settings and hours', async ({ page }) => {
    await page.goto('/fr/admin/site');
    // Look for tab-like elements with role or data-attributes
    const tabs = page.locator('[role="tab"], [data-tab], button:has-text("Heures"), button:has-text("Contact"), button:has-text("Social"), a[role="tab"]');
    const count = await tabs.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });
});

// ─── Navigation page ────────────────────────────────────────────────

test.describe('CMS Navigation page', () => {
  test.beforeEach(async ({ page }) => {
    await signInAsAdmin(page);
  });

  test('navigation page loads successfully', async ({ page }) => {
    const response = await page.goto('/fr/admin/navigation');
    expect(response?.ok()).toBeTruthy();
    expect(response?.status()).toBe(200);
  });

  test('navigation page contains management UI', async ({ page }) => {
    await page.goto('/fr/admin/navigation');
    // Navigation uses JS-driven inline editing, not traditional forms
    await expect(page.locator('#cms-nav-data').first()).toBeVisible({ timeout: 10000 });
  });
});

// ─── Theme page ─────────────────────────────────────────────────────

test.describe('CMS Theme page', () => {
  test.beforeEach(async ({ page }) => {
    await signInAsAdmin(page);
  });

  test('theme page loads successfully', async ({ page }) => {
    const response = await page.goto('/fr/admin/theme');
    expect(response?.ok()).toBeTruthy();
    expect(response?.status()).toBe(200);
  });

  test('theme page contains form', async ({ page }) => {
    await page.goto('/fr/admin/theme');
    await expect(page.locator('form').first()).toBeVisible({ timeout: 10000 });
  });
});
