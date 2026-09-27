import { test, expect } from '@playwright/test';

/**
 * INVARIANT B — the 404 and the 301 carry the security headers.
 *
 * ## Why this file exists
 *
 * `src/middleware.ts` applies the header set in ONE place, after the request
 * chain returns, so no early return can escape it:
 *
 *   const response = await runRequestChain(context, next, url);
 *   applySecurityHeaders(response, context.locals.requestId);
 *
 * `runRequestChain` returns early twice, before `next()` runs:
 *   - a `[lang]` segment matching /^[A-Za-z]{2}$/ that is not a configured
 *     locale → 404 (`/xx/…`);
 *   - the same segment in the wrong case → 301 to the canonical lowercase URL
 *     (`/FR/…`).
 * Both are unauthenticated, publicly reachable, and both are what a scanner
 * probes first. Before the lot they left with no header at all.
 *
 * `tests/e2e/public-pages.spec.ts:43-52` already asserts the STATUS and the
 * redirect TARGET of these two paths. It does not look at the headers, so the
 * assertions here complement it rather than duplicate it. The nine headers and
 * `X-Request-Id` come from `SECURITY_HEADERS` + `applySecurityHeaders` in
 * `src/middleware.ts`, which is the single source of truth for the list.
 */

/** The nine security headers, with the exact values the middleware pins. */
const REQUIRED_SECURITY_HEADERS: ReadonlyArray<readonly [string, string]> = [
  ['x-content-type-options', 'nosniff'],
  ['x-frame-options', 'DENY'],
  ['referrer-policy', 'strict-origin-when-cross-origin'],
  ['permissions-policy', 'camera=(), microphone=(), geolocation=()'],
  ['x-xss-protection', '0'],
  ['strict-transport-security', 'max-age=63072000; includeSubDomains; preload'],
  ['cross-origin-opener-policy', 'same-origin'],
  ['cross-origin-resource-policy', 'same-origin'],
  ['cross-origin-embedder-policy', 'credentialless'],
];

/** `newRequestId()` emits a v4 UUID; the middleware reuses it verbatim. */
const REQUEST_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function assertFullSecurityHeaderSet(headers: Record<string, string>, context: string): void {
  for (const [name, value] of REQUIRED_SECURITY_HEADERS) {
    expect(headers[name], `${context} must carry ${name}`).toBe(value);
  }
  expect(headers['x-request-id'], `${context} must carry X-Request-Id`).toBeTruthy();
  expect(headers['x-request-id']!, `${context} X-Request-Id must be a UUID`).toMatch(REQUEST_ID_RE);
}

test.describe('Invariant B — locale 404 carries the full security header set', () => {
  test('GET /xx/contact → 404 with all nine headers and X-Request-Id', async ({ request }) => {
    const response = await request.get('/xx/contact');
    expect(response.status()).toBe(404);
    assertFullSecurityHeaderSet(response.headers(), 'GET /xx/contact (404)');
  });

  test('GET /Xx/contact → 404 (mixed case, still an unknown locale) with the full header set', async ({ request }) => {
    // `Xx` matches /^[A-Za-z]{2}$/, so the locale guard claims the request,
    // lowercases it to `xx`, and 404s. The router is never reached — a
    // different branch from `/xx/`, and the header set must hold on both.
    const response = await request.get('/Xx/contact');
    expect(response.status()).toBe(404);
    assertFullSecurityHeaderSet(response.headers(), 'GET /Xx/contact (404)');
  });

  test('a deep path under an invalid locale is 404 and still headered', async ({ request }) => {
    const response = await request.get('/xx/admin/stats');
    expect(response.status()).toBe(404);
    assertFullSecurityHeaderSet(response.headers(), 'GET /xx/admin/stats (404)');
  });
});

test.describe('Invariant B — locale 301 carries the full security header set', () => {
  for (const [requested, canonical] of [
    ['/FR/contact', '/fr/contact'],
    ['/EN/', '/en/'],
  ] as const) {
    test(`GET ${requested} → 301 to ${canonical} with all nine headers and X-Request-Id`, async ({ request }) => {
      // maxRedirects: 0 is what makes the 301 itself observable. Following it
      // would only ever expose the 200, which is covered elsewhere.
      const response = await request.get(requested, { maxRedirects: 0 });
      expect(response.status()).toBe(301);

      const location = response.headers()['location'];
      expect(location, `${requested} must advertise a redirect target`).toBeTruthy();
      const target = new URL(location!);
      expect(target.pathname).toBe(canonical);
      // The query string must survive the canonicalisation, not be dropped.
      expect(target.search).toBe('');

      assertFullSecurityHeaderSet(response.headers(), `GET ${requested} (301)`);
    });
  }

  test('the 301 preserves the query string while canonicalising the locale', async ({ request }) => {
    const response = await request.get('/FR/contact?src=e2e&keep=1', { maxRedirects: 0 });
    expect(response.status()).toBe(301);
    const target = new URL(response.headers()['location']!);
    expect(target.pathname).toBe('/fr/contact');
    expect(target.searchParams.get('src')).toBe('e2e');
    expect(target.searchParams.get('keep')).toBe('1');
    assertFullSecurityHeaderSet(response.headers(), 'GET /FR/contact?src=e2e&keep=1 (301)');
  });

  test('the 301 emits a distinct X-Request-Id per response (correlation, not a constant)', async ({ request }) => {
    const first = await request.get('/FR/contact', { maxRedirects: 0 });
    const second = await request.get('/FR/contact', { maxRedirects: 0 });
    expect(first.status()).toBe(301);
    expect(second.status()).toBe(301);
    expect(first.headers()['x-request-id']).toBeTruthy();
    expect(second.headers()['x-request-id']).toBeTruthy();
    expect(first.headers()['x-request-id']).not.toBe(second.headers()['x-request-id']);
  });

  test('an inbound valid X-Request-Id is propagated verbatim on the 301', async ({ request }) => {
    // The contract is "a valid UUID is reused, anything else is regenerated"
    // (anti-poisoning). Asserting the reuse pins the correlation feature on
    // the early-return path, where it is easiest to forget.
    const inbound = '11111111-2222-3333-4444-555555555555';
    const response = await request.get('/FR/contact', {
      maxRedirects: 0,
      headers: { 'X-Request-Id': inbound },
    });
    expect(response.status()).toBe(301);
    expect(response.headers()['x-request-id']).toBe(inbound);
  });

  test('a malformed X-Request-Id is replaced, not echoed, on the 301', async ({ request }) => {
    const response = await request.get('/FR/contact', {
      maxRedirects: 0,
      headers: { 'X-Request-Id': 'not-a-uuid' },
    });
    expect(response.status()).toBe(301);
    expect(response.headers()['x-request-id']).not.toBe('not-a-uuid');
    expect(response.headers()['x-request-id']).toMatch(REQUEST_ID_RE);
  });
});
