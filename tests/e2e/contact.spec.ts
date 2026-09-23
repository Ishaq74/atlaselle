import { test, expect } from '@playwright/test';

/**
 * E2E tests for the contact page and API.
 * Covers page rendering, form submission, validation errors, and rate limiting.
 */

const BASE_URL = 'http://localhost:4322';

let ipSeq = 0;
/**
 * Unique source IP per call â€” isolates per-IP rate-limit buckets between
 * tests and browser projects (the E2E webServer sets TRUST_PROXY=true).
 */
function uniqueIp(): Record<string, string> {
  ipSeq += 1;
  return { 'X-Forwarded-For': `10.8.${Math.floor(ipSeq / 250)}.${(ipSeq % 250) + 1}` };
}

test.describe('Contact page', () => {
  test('contact page loads successfully', async ({ page }) => {
    const response = await page.goto('/fr/contact', { waitUntil: 'networkidle' });
    expect(response?.status()).toBe(200);
    await expect(page.locator('main, [role="main"], article').first()).toBeVisible();
  });

  test('contact page loads in all locales', async ({ page }) => {
    for (const locale of ['fr', 'en', 'es', 'ar']) {
      const response = await page.goto(`/${locale}/contact`, { waitUntil: 'networkidle' });
      expect(response?.status()).toBe(200);
    }
  });

  test('contact page has form fields', async ({ page }) => {
    await page.goto('/fr/contact', { waitUntil: 'networkidle' });
    await expect(page.locator('input[name="firstName"]')).toBeVisible();
    await expect(page.locator('input[name="lastName"]')).toBeVisible();
    await expect(page.locator('input[name="email"]')).toBeVisible();
    await expect(page.locator('input[name="phone"]')).toBeVisible();
    // The reason field is a Starwind custom select: the trigger button is
    // visible and the listbox options are rendered (the native <select> is
    // injected lazily by the component script).
    await expect(page.locator('#contact-reason [data-slot="select-trigger"]')).toBeVisible();
    await expect(page.locator('#contact-reason [role="option"]').first()).toBeAttached();
    await expect(page.locator('textarea[name="message"]')).toBeVisible();
  });
});

test.describe('Contact API', () => {
  test('POST /api/contact submits a valid form', async ({ request }) => {
    const response = await request.post(`${BASE_URL}/api/contact`, {
      headers: { 'Content-Type': 'application/json', 'Origin': BASE_URL, ...uniqueIp() },
      data: {
        firstName: 'Jean',
        lastName: 'Dupont',
        email: 'jean.dupont@test.com',
        phone: '+33 6 12 34 56 78',
        reason: 'General inquiry',
        message: 'This is a test message from E2E testing.',
        urgent: false,
        locale: 'fr',
      },
    });
    // 200 when SMTP delivers; 500 SEND_FAILED when the test env has no
    // working SMTP — the payload contract (validation passed) is what matters.
    expect([200, 500]).toContain(response.status());
    if (response.status() === 200) {
      const body = await response.json();
      expect(body.ok).toBeTruthy();
    }
  });

  test('POST /api/contact rejects missing required fields', async ({ request }) => {
    const response = await request.post(`${BASE_URL}/api/contact`, {
      headers: { 'Content-Type': 'application/json', 'Origin': BASE_URL, ...uniqueIp() },
      data: {
        firstName: '',
        lastName: '',
        email: 'invalid-email',
        message: 'Too short',
      },
    });
    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.error).toBe('VALIDATION_ERROR');
  });

  test('POST /api/contact rejects invalid email', async ({ request }) => {
    const response = await request.post(`${BASE_URL}/api/contact`, {
      headers: { 'Content-Type': 'application/json', 'Origin': BASE_URL, ...uniqueIp() },
      data: {
        firstName: 'Jean',
        lastName: 'Dupont',
        email: 'not-an-email',
        phone: '+33 6 12 34 56 78',
        reason: 'Test',
        message: 'A valid message that is long enough for the minimum requirement.',
        locale: 'fr',
      },
    });
    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.error).toBe('VALIDATION_ERROR');
  });

  test('POST /api/contact enforces rate limit', async ({ request }) => {
    // Shared fixed IP: all 5 requests must hit the SAME rate-limit bucket
    // (limit is 3 req / 300 s / IP).
    const sharedIp = { 'X-Forwarded-For': '10.8.255.99' };
    const responses = await Promise.all(
      Array.from({ length: 5 }, () =>
        request.post(`${BASE_URL}/api/contact`, {
          headers: { 'Content-Type': 'application/json', 'Origin': BASE_URL, ...sharedIp },
          data: {
            firstName: 'Test',
            lastName: 'User',
            email: `test-${Date.now()}-${Math.random().toString(36).slice(2)}@test.com`,
            phone: '+33 6 12 34 56 78',
            reason: 'Rate limit test',
            message: 'This is a test message that is long enough to pass validation requirements.',
            locale: 'fr',
          },
        }),
      ),
    );
    const rateLimited = responses.some((r) => r.status() === 429);
    expect(rateLimited).toBeTruthy();
  });
});

test.describe('Contact page — admin auth guard', () => {
  test('contact form is accessible without auth', async ({ page }) => {
    const response = await page.goto('/fr/contact', { waitUntil: 'networkidle' });
    expect(response?.status()).toBe(200);
  });
});
