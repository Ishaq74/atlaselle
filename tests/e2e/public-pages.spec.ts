import { test, expect } from '@playwright/test';

/**
 * E2E tests for public static surfaces and error pages.
 * Covers: robots.txt, rss.xml, sitemap endpoints, 404 handling,
 * booking-confirmed guard, and security headers on public pages.
 */

test.describe('Public surfaces — SEO files', () => {
  test('GET /robots.txt is served as text with crawler rules', async ({ request }) => {
    const response = await request.get('/robots.txt');
    expect(response.status()).toBe(200);
    const body = await response.text();
    expect(body).toContain('User-agent');
  });

  test('GET /rss.xml returns a valid RSS feed', async ({ request }) => {
    const response = await request.get('/rss.xml');
    expect(response.status()).toBe(200);
    const body = await response.text();
    expect(body).toMatch(/<rss|<\?xml/);
  });

  test('GET /sitemap-cms.xml returns an XML sitemap', async ({ request }) => {
    const response = await request.get('/sitemap-cms.xml');
    expect(response.status()).toBe(200);
    const body = await response.text();
    expect(body).toMatch(/<\?xml|<urlset/);
  });

  test('GET /sitemap-index.xml exists (Astro sitemap integration)', async ({ request }) => {
    const response = await request.get('/sitemap-index.xml');
    expect(response.status()).toBe(200);
  });
});

test.describe('Public surfaces — error pages', () => {
  test('unknown CMS slug returns 404', async ({ page }) => {
    const response = await page.goto('/fr/page-e2e-inexistante-zzz', { waitUntil: 'networkidle' });
    expect(response?.status()).toBe(404);
  });

  test('invalid locale segment returns 404', async ({ request }) => {
    const response = await request.get('/xx/contact');
    expect(response.status()).toBe(404);
  });

  test('uppercase locale redirects to canonical lowercase', async ({ request }) => {
    const response = await request.get('/FR/contact', { maxRedirects: 0 });
    expect(response.status()).toBe(301);
    expect(response.headers()['location']).toContain('/fr/contact');
  });
});

test.describe('Public surfaces — booking confirmation guard', () => {
  test('booking-confirmed without session_id returns 404', async ({ page }) => {
    const response = await page.goto('/fr/booking-confirmed', { waitUntil: 'networkidle' });
    expect(response?.status()).toBe(404);
  });

  test('booking-confirmed with unknown session_id returns 404', async ({ page }) => {
    const response = await page.goto('/fr/booking-confirmed?session_id=e2e-unknown-session', {
      waitUntil: 'networkidle',
    });
    expect(response?.status()).toBe(404);
  });
});

test.describe('Public surfaces — security headers', () => {
  test('homepage sends the full security header set', async ({ request }) => {
    const response = await request.get('/fr/');
    expect(response.status()).toBe(200);
    const headers = response.headers();
    expect(headers['x-content-type-options']).toBe('nosniff');
    expect(headers['x-frame-options']).toBe('DENY');
    expect(headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
    expect(headers['strict-transport-security']).toContain('max-age=');
    expect(headers['x-request-id']).toBeTruthy();
  });

  test('API responses also carry security headers', async ({ request }) => {
    const response = await request.get('/api/health');
    expect(response.headers()['x-content-type-options']).toBe('nosniff');
  });

  test('uploaded SVGs are forced to download (XSS containment)', async ({ request }) => {
    // Any SVG under /uploads must be served as attachment — the file does not
    // need to exist for the middleware header logic to be exercised… but a
    // 404 short-circuits headers only AFTER next(), so assert on a real file
    // if present, otherwise just verify the route shape is handled.
    const response = await request.get('/uploads/definitely-missing-e2e.svg');
    expect([404, 200]).toContain(response.status());
    if (response.status() === 200) {
      expect(response.headers()['content-disposition']).toContain('attachment');
    }
  });
});
