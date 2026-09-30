import { test, expect } from '@playwright/test';
import { SEED_EMAIL, SEED_PASSWORD } from './global-setup';
import { BASE_URL, HOST_HEADER, E2E_PORT } from '../helpers/e2e-env';

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
  /**
   * INVARIANT C — the health check refuses an unauthenticated caller.
   *
   * The previous version of this test accepted `200 | 503` and read the probe
   * payload (`status`, `db`, `uptime`) from an anonymous response. Both halves
   * are now wrong, and the reason matters:
   *
   *  - the payload is produced AFTER the authorization test, so an anonymous
   *    caller now always gets `401 {error:'Unauthorized'}` and never a body to
   *    inspect;
   *  - the old test used to pass *because the caller sent no proxy header*.
   *    That proves nothing: the absence of a header is chosen by the caller,
   *    and a published port is not a loopback. Trusting the absence of a header
   *    as proof of locality is precisely the reasoning that must not decide
   *    access, so the gate below demands an explicit token and asserts the
   *    refusal unconditionally.
   *
   * `Cache-Control: no-store` is still asserted: the error body goes through
   * the same `jsonResponse()` helper, so the no-store contract is unchanged.
   * The *authorized* payload (`status`/`db`/`uptime`) is deliberately NOT
   * asserted here — HEALTH_TOKEN is not set in the E2E environment, so there is
   * no token to present and no honest way to reach that branch from a test.
   */
  test('GET /api/health without a token is refused with 401 (no payload leaked)', async ({ request }) => {
    const response = await request.get('/api/health', { headers: uniqueIpHeaders() });
    expect(response.status()).toBe(401);

    const headers = response.headers();
    expect(headers['content-type']).toContain('application/json');
    expect(headers['cache-control']).toContain('no-store');
    // The refusal must not advertise the probe payload.
    expect(Object.keys(await response.json()).sort()).toEqual(['error']);
  });

  test('GET /api/health rejects a wrong bearer token', async ({ request }) => {
    const response = await request.get('/api/health', {
      headers: { ...uniqueIpHeaders(), Authorization: 'Bearer e2e-not-the-health-token' },
    });
    expect(response.status()).toBe(401);
  });

  test('GET /api/health rejects a non-bearer authorization header', async ({ request }) => {
    const response = await request.get('/api/health', {
      headers: { ...uniqueIpHeaders(), Authorization: 'Basic ZTNlLXNlZWRAdGVzdC5jb20=' },
    });
    expect(response.status()).toBe(401);
  });

  test('GET /api/health rejects a proxied request without token', async ({ request }) => {
    const response = await request.get('/api/health', {
      headers: { 'X-Forwarded-For': '203.0.113.10' },
    });
    expect(response.status()).toBe(401);
  });

  test('GET /api/health stays 401 when a full set of forged proxy headers claims loopback', async ({ request }) => {
    // The whole point: a caller that *claims* to be local must get the same
    // answer as one that claims nothing. A spoofed 127.0.0.1 in X-Forwarded-For
    // and X-Real-IP, plus a forwarded host/proto/port triple, buys nothing.
    const response = await request.get('/api/health', {
      headers: {
        ...uniqueIpHeaders(),
        'X-Forwarded-For': '127.0.0.1',
        'X-Real-IP': '127.0.0.1',
        'X-Forwarded-Host': HOST_HEADER,
        'X-Forwarded-Proto': 'https',
        'X-Forwarded-Port': String(E2E_PORT),
        Forwarded: 'for=127.0.0.1;host=localhost;proto=https',
      },
    });
    expect(response.status()).toBe(401);
    expect(Object.keys(await response.json()).sort()).toEqual(['error']);
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

  /**
   * INVARIANT D — the search limiter is not compartmented by the proxy
   * address. Behind a reverse proxy, `clientAddress` is the proxy's address for
   * every single request, so a limiter keyed on the socket address would put
   * all users in one bucket: one user exhausts `/api/search` for everyone.
   * `src/pages/api/search.ts` keys on `extractIp(request.headers, clientAddress)`,
   * which honours `X-Forwarded-For` when `TRUST_PROXY=true` (set in the
   * playwright webServer env).
   *
   * The proof is symmetrical and non-vacuous: A is driven until its own
   * compartment is actually refused (asserted, so a silently-raised `max` can
   * never leave the rest of the test passing on nothing), B must still be
   * served, and A must still be refused.
   */
  test('search rate-limit compartments are per forwarded client IP, not per proxy', async ({ request }) => {
    test.setTimeout(180_000);

    // Both addresses are drawn from the TEST-NET blocks and are unique per
    // execution: a fixed literal would inherit the fixed window (60 s) left
    // behind by a previous run and could start already refused, which would
    // make this test's cost depend on when it last ran.
    const runTag = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
    const a = 1 + (parseInt(runTag.slice(-2), 36) % 250);
    const b = 1 + (parseInt(runTag.slice(-4, -2) || '1', 36) % 250);
    const IP_A = `198.51.100.${a}`;
    const IP_B = `203.0.113.${b === a ? (b % 250) + 1 : b}`;
    const query = '/api/search?q=voyage&locale=fr';
    // `Cache-Control: no-cache` on the request: the response is
    // `public, max-age=60`, and this test must exercise the limiter on every
    // single call, never a cached body.
    const headersA = { 'X-Forwarded-For': IP_A, 'Cache-Control': 'no-cache' };
    const headersB = { 'X-Forwarded-For': IP_B, 'Cache-Control': 'no-cache' };

    // ── A's compartment is exhausted ─────────────────────────────────
    const MAX_PROBES = 100;
    let probes = 0;
    let exhausted = false;
    let limitedBody: unknown = null;
    for (; probes < MAX_PROBES; probes += 1) {
      const response = await request.get(query, { headers: headersA });
      if (response.status() === 429) {
        exhausted = true;
        limitedBody = await response.json();
        break;
      }
      expect(
        response.status(),
        `IP A probe #${probes + 1} must be served normally, got ${response.status()}`,
      ).toBe(200);
    }
    // The only non-vacuity gate that matters: A must actually have been
    // refused. HOW MANY probes it took is an implementation detail of the
    // product's `max` and of the state of the fixed window, so it is reported
    // rather than asserted.
    expect(
      exhausted,
      `IP A (${IP_A}) was never rate-limited after ${MAX_PROBES} requests — the isolation assertions below would be vacuous`,
    ).toBe(true);
    expect(limitedBody).toMatchObject({ error: 'RATE_LIMITED' });

    // ── B lives in another compartment ───────────────────────────────
    for (let call = 1; call <= 3; call += 1) {
      const response = await request.get(query, { headers: headersB });
      expect(response.status(), `IP B (${IP_B}) call #${call} must not inherit IP A's refusal`).toBe(200);
      const body = await response.json();
      expect(body.query).toBe('voyage');
      expect(body.locale).toBe('fr');
      expect(Array.isArray(body.results)).toBe(true);
    }

    // ── A is still refused: the refusal is a compartment, not a blip ──
    const again = await request.get(query, { headers: headersA });
    expect(again.status()).toBe(429);
    expect(again.headers()['retry-after'], 'a refusal must tell the caller when to come back').toBeTruthy();
    expect(await again.json()).toMatchObject({ error: 'RATE_LIMITED' });
  });
});

test.describe('API — analytics', () => {
  test('POST /api/analytics rejects invalid payload', async ({ request }) => {
    const response = await request.post('/api/analytics', {
      headers: { 'Content-Type': 'application/json', Origin: BASE_URL, ...uniqueIpHeaders() },
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
      headers: { 'Content-Type': 'application/json', Origin: BASE_URL },
      data: { email: SEED_EMAIL, password: 'wrong-password-999' },
    });
    expect(response.status()).toBe(401);
  });

  test('POST /api/auth/sign-up/email rejects weak password', async ({ request }) => {
    const response = await request.post('/api/auth/sign-up/email', {
      headers: { 'Content-Type': 'application/json', Origin: BASE_URL, ...uniqueIpHeaders() },
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
      headers: { 'Content-Type': 'application/json', Origin: BASE_URL },
      data: { email: SEED_EMAIL, password: SEED_PASSWORD },
    });
    expect(signIn.status()).toBe(200);

    const session = await request.get('/api/auth/get-session');
    expect(session.status()).toBe(200);
    const body = await session.json();
    expect(body?.user?.email).toBe(SEED_EMAIL);
  });
});
