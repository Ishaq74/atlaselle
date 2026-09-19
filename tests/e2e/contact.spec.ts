import { test, expect } from '@playwright/test';

/**
 * E2E tests for the contact page and API.
 * Covers page rendering, form submission, validation errors, and rate limiting.
 */

const BASE_URL = 'http://localhost:4322';

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
    await expect(page.locator('input[name="reason"]')).toBeVisible();
    await expect(page.locator('textarea[name="message"]')).toBeVisible();
  });
});

test.describe('Contact API', () => {
  test('POST /api/contact submits a valid form', async ({ request }) => {
    const response = await request.post(`${BASE_URL}/api/contact`, {
      headers: { 'Content-Type': 'application/json', 'Origin': BASE_URL },
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
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.ok).toBeTruthy();
  });

  test('POST /api/contact rejects missing required fields', async ({ request }) => {
    const response = await request.post(`${BASE_URL}/api/contact`, {
      headers: { 'Content-Type': 'application/json', 'Origin': BASE_URL },
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
      headers: { 'Content-Type': 'application/json', 'Origin': BASE_URL },
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
    const responses = await Promise.all(
      Array.from({ length: 5 }, () =>
        request.post(`${BASE_URL}/api/contact`, {
          headers: { 'Content-Type': 'application/json', 'Origin': BASE_URL },
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
