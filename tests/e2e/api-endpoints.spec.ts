import { test, expect } from '@playwright/test';
import { SEED_EMAIL, SEED_PASSWORD } from './global-setup';

/**
 * E2E smoke tests for ALL API endpoints.
 * Covers auth guards (401/403), validation (400), rate-limit headers (429),
 * and happy paths that do not require fixtures.
 *
 * NOTE: tests that must not pollute the shared IP rate-limit bucket send a
 * unique X-Forwarded-For (requires TRUST_PROXY=true in the webServer env).
 */

let ipSeq = 0;
/** Unique IP per call → isolates rate-limit buckets between tests/projects. */
function uniqueIpHeaders(): Record<string, string> {
  ipSeq += 1;
  return { 'X-Forwarded-For': `10.9.${Math.floor(ipSeq / 250)}.${(ipSeq % 250) + 1}` };
}

test.describe('API — health', () => {
  test('GET /api/health returns status payload (loopback allowed)', async ({ request }) => {
    const response = await request.get('/api/health');
    expect([200, 503]).toContain(response.status());
    const body = await response.json();
    expect(body).toHaveProperty('status');
    expect(body).toHaveProperty('db');
    expect(body).toHaveProperty('uptime');
    expect(response.headers()['cache-control']).toContain('no-store');
  });

  test('GET /api/health rejects proxied requests without token', async ({ request }) => {
    const response = await request.get('/api/health', {
      headers: { 'X-Forwarded-For': '203.0.113.10' },
    });
    expect(response.status()).toBe(401);
  });
});

test.describe('API — search', () => {
  test('GET /api/search rejects too-short query', async ({ request }) => {
    const response = await request.get('/api/search?q=a&locale=fr', { headers: uniqueIpHeaders() });
    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.error).toBe('QUERY_TOO_SHORT');
  });

  test('GET /api/search rejects invalid locale', async ({ request }) => {
    const response = await request.get('/api/search?q=voyage&locale=xx', { headers: uniqueIpHeaders() });
    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.error).toBe('INVALID_LOCALE');
  });

  test('GET /api/search returns results for a valid query', async ({ request }) => {
    const response = await request.get('/api/search?q=voyage&locale=fr', { headers: uniqueIpHeaders() });
    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toContain('application/json');
  });
});

test.describe('API — analytics', () => {
  test('POST /api/analytics rejects invalid payload', async ({ request }) => {
    const response = await request.post('/api/analytics', {
      headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:4322', ...uniqueIpHeaders() },
      data: {},
    });
    expect([400, 429]).toContain(response.status());
  });
});

test.describe('API — auth-guarded endpoints reject anonymous callers', () => {
  const guarded: Array<{ method: 'get' | 'post'; path: string; name: string }> = [
    { method: 'get', path: '/api/export-data', name: 'export-data' },
    { method: 'get', path: '/api/audit-export', name: 'audit-export' },
    { method: 'get', path: '/api/content-export', name: 'content-export' },
    { method: 'post', path: '/api/content-import', name: 'content-import' },
    { method: 'post', path: '/api/upload', name: 'upload' },
    { method: 'get', path: '/api/media', name: 'media' },
    { method: 'get', path: '/api/preview', name: 'preview' },
  ];

  for (const { method, path, name } of guarded) {
    test(`${method.toUpperCase()} ${path} → rejected unauthenticated`, async ({ request }) => {
      const response = await request[method](path, { headers: uniqueIpHeaders() });
      // 401 when the session guard fires first, 403 when the role guard does.
      expect([401, 403], `${name} must reject anonymous access`).toContain(response.status());
    });
  }
});

test.describe('API — cron endpoints require a token', () => {
  for (const path of ['/api/cron/publish', '/api/cron/voyage']) {
    test(`GET ${path} → rejected without token`, async ({ request }) => {
      const response = await request.get(path, { headers: uniqueIpHeaders() });
      // 404 when the endpoint is disabled (no CRON token configured), 401 otherwise.
      expect([401, 404], `${path} must reject tokenless access`).toContain(response.status());
    });
  }
});

test.describe('API — payments webhook', () => {
  test('POST /api/payments/webhook rejects unsigned payloads', async ({ request }) => {
    const response = await request.post('/api/payments/webhook', {
      headers: { 'Content-Type': 'application/json', ...uniqueIpHeaders() },
      data: { type: 'checkout.session.completed' },
    });
    // 400 = bad signature/payload, 404 = provider not configured for this env.
    expect([400, 404]).toContain(response.status());
  });
});

test.describe('API — blog newsletter', () => {
  test('GET /api/blog/newsletter/confirm rejects missing token', async ({ request }) => {
    const response = await request.get('/api/blog/newsletter/confirm', { headers: uniqueIpHeaders() });
    expect([400, 429]).toContain(response.status());
  });

  test('GET /api/blog/newsletter/unsubscribe rejects missing token', async ({ request }) => {
    const response = await request.get('/api/blog/newsletter/unsubscribe', { headers: uniqueIpHeaders() });
    expect([400, 429]).toContain(response.status());
  });
});

test.describe('API — auth endpoints (direct)', () => {
  test('POST /api/auth/sign-in/email rejects wrong password', async ({ request }) => {
    const response = await request.post('/api/auth/sign-in/email', {
      headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:4322' },
      data: { email: SEED_EMAIL, password: 'wrong-password-999' },
    });
    expect(response.status()).toBe(401);
  });

  test('POST /api/auth/sign-up/email rejects weak password', async ({ request }) => {
    const response = await request.post('/api/auth/sign-up/email', {
      headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:4322', ...uniqueIpHeaders() },
      data: { email: `e2e-weak-${Date.now()}@test.com`, password: '123', name: 'Weak' },
    });
    expect(response.status()).toBe(400);
  });

  test('GET /api/auth/get-session returns null without cookie', async ({ request }) => {
    const response = await request.get('/api/auth/get-session');
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body).toBeNull();
  });

  test('full API sign-in flow: sign-in then get-session', async ({ request }) => {
    const signIn = await request.post('/api/auth/sign-in/email', {
      headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:4322' },
      data: { email: SEED_EMAIL, password: SEED_PASSWORD },
    });
    expect(signIn.status()).toBe(200);

    const session = await request.get('/api/auth/get-session');
    expect(session.status()).toBe(200);
    const body = await session.json();
    expect(body?.user?.email).toBe(SEED_EMAIL);
  });
});
