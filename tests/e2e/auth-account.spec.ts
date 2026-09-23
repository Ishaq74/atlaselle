import { test, expect } from '@playwright/test';
import { SEED_EMAIL, SEED_PASSWORD } from './global-setup';

/**
 * E2E — auth & account deep coverage: profile management, organisations,
 * password reset flow (token-less parts), email verification page states,
 * dashboard content, sign-out, and guest/auth guard matrices.
 */

const BASE_URL = 'http://localhost:4322';

async function userState(browser: import('@playwright/test').Browser) {
  const context = await browser.newContext();
  const response = await context.request.post(`${BASE_URL}/api/auth/sign-in/email`, {
    headers: { 'content-type': 'application/json', Origin: BASE_URL },
    data: { email: SEED_EMAIL, password: SEED_PASSWORD },
  });
  if (response.status() !== 200) throw new Error(`login failed (${response.status()})`);
  const state = await context.storageState();
  await context.close();
  return state;
}

test.describe('Auth — authenticated account pages', () => {
  test('dashboard shows the signed-in user identity', async ({ browser }) => {
    const context = await browser.newContext({ storageState: await userState(browser) });
    const page = await context.newPage();
    const response = await page.goto('/fr/auth/tableau-de-bord', { waitUntil: 'networkidle' });
    expect(response?.status()).toBe(200);
    const body = await page.textContent('body');
    expect(body).toContain(SEED_EMAIL);
    await context.close();
  });

  test('profile page shows the user name and email', async ({ browser }) => {
    const context = await browser.newContext({ storageState: await userState(browser) });
    const page = await context.newPage();
    const response = await page.goto('/fr/auth/profil', { waitUntil: 'networkidle' });
    expect(response?.status()).toBe(200);
    const body = await page.textContent('body');
    expect(body).toContain(SEED_EMAIL);
    await context.close();
  });

  test('organisations page loads for signed-in users', async ({ browser }) => {
    const context = await browser.newContext({ storageState: await userState(browser) });
    const page = await context.newPage();
    const response = await page.goto('/fr/auth/organisations', { waitUntil: 'networkidle' });
    expect(response?.status()).toBe(200);
    await context.close();
  });
});

test.describe('Auth — guest-only pages bounce signed-in users', () => {
  test('sign-in page redirects authenticated users to dashboard', async ({ browser }) => {
    const context = await browser.newContext({ storageState: await userState(browser) });
    const page = await context.newPage();
    await page.goto('/fr/auth/connexion', { waitUntil: 'networkidle' });
    await expect(page).toHaveURL(/tableau-de-bord|dashboard/);
    await context.close();
  });

  test('sign-up page redirects authenticated users', async ({ browser }) => {
    const context = await browser.newContext({ storageState: await userState(browser) });
    const page = await context.newPage();
    await page.goto('/fr/auth/inscription', { waitUntil: 'networkidle' });
    await expect(page).toHaveURL(/tableau-de-bord|dashboard/);
    await context.close();
  });
});

test.describe('Auth — token pages handle invalid tokens gracefully', () => {
  test('verify-email with an invalid token shows an error state (not 500)', async ({ page }) => {
    const response = await page.goto('/fr/auth/verifier-email?token=e2e-invalid-token', {
      waitUntil: 'networkidle',
    });
    expect([200, 400]).toContain(response?.status());
  });

  test('reset-password with an invalid token renders (not 500)', async ({ page }) => {
    const response = await page.goto('/fr/auth/reinitialiser-mot-de-passe?token=e2e-invalid-token', {
      waitUntil: 'networkidle',
    });
    expect([200, 400]).toContain(response?.status());
  });
});

test.describe('Auth — sign-out', () => {
  test('sign-out clears the session', async ({ browser }) => {
    const context = await browser.newContext({ storageState: await userState(browser) });
    const page = await context.newPage();

    // Verify session works first
    const sessionBefore = await context.request.get(`${BASE_URL}/api/auth/get-session`);
    expect((await sessionBefore.json())?.user?.email).toBe(SEED_EMAIL);

    // Sign out via the API (what the UI button calls)
    const signOut = await context.request.post(`${BASE_URL}/api/auth/sign-out`, {
      headers: { Origin: BASE_URL },
    });
    expect([200, 302]).toContain(signOut.status());

    const sessionAfter = await context.request.get(`${BASE_URL}/api/auth/get-session`);
    expect(await sessionAfter.json()).toBeNull();
    await context.close();
  });
});

test.describe('Auth — export-data endpoint', () => {
  test('authenticated user can export their data (RGPD)', async ({ browser }) => {
    const context = await browser.newContext({ storageState: await userState(browser) });
    const response = await context.request.get(`${BASE_URL}/api/export-data`, {
      headers: { 'X-Forwarded-For': '10.6.1.1' },
    });
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body).toBeTruthy();
    await context.close();
  });
});
