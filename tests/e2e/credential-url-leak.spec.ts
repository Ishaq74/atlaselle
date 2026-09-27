import { test, expect } from '@playwright/test';
import type { Browser, Page, Request } from '@playwright/test';
import { SEED_EMAIL, SEED_PASSWORD, SEED_NAME } from './global-setup';

/**
 * INVARIANT A — no credential ever reaches a URL.
 *
 * ## Why this file exists
 *
 * On the 23/09/2026 Playwright run, 34 failures shared one root cause. The CSP
 * carried `upgrade-insecure-requests`, WebKit rewrote every `/_astro/*`
 * subresource to `https://`, the E2E server only listens on plain HTTP, so no
 * script loaded. `SignInPage`/`SignUpPage` had no `method`/`action`, so the
 * HTML default (`method="get"`, target = current URL) applied and the browser
 * natively serialised every named control into the query string. The traces of
 * that run record the exact shape (tests/reports/e2e-full.txt):
 *
 *   navigated to "http://localhost:4322/fr/auth/connexion?email=e2e-seed%40test.com&password=E2eTest1234%21"
 *   navigated to "http://localhost:4322/fr/auth/inscription?name=E2E+Tester&username=e2etester1790012863243&email=e2e-1790012862494-ny6ho7%40test.com&password=E2eTest1234%21"
 *
 * No existing test observed `page.url()` after a submission and no quality
 * gate reacted. `tests/e2e/auth.spec.ts` and `tests/e2e/auth-account.spec.ts`
 * already exercise the keyboard and the mouse; they are NOT duplicated here.
 * What was missing is the observation itself. This spec supplies it:
 *
 *   1. the final URL after a real submission, on every project;
 *   2. the submitted request — method, target, query string, body, Referer;
 *   3. every request emitted during the flow, documents included;
 *   4. the no-JavaScript submission, which IS the 23/09 failure mode.
 *
 * ## What is asserted, and what is deliberately NOT asserted
 *
 * The password legitimately transits in the POST body — that is the whole
 * point of `method="post"`. Asserting its absence from the body would forbid
 * the fix. The invariant is about transports that end up in a URL: the path,
 * the query string, the Referer handed to the next navigation, and the final
 * location. Non-vacuity is provided by the converse: the credentials ARE
 * asserted to be present in the body of the credential POST, and the
 * credential POST is asserted to exist.
 */

/**
 * The `application/x-www-form-urlencoded` serialiser of a native form
 * submission — byte for byte what the browser used on 23/09 and what it still
 * uses when the credentials POST has no JS (see the last describe block).
 *
 * `encodeURIComponent` is NOT equivalent and would make the reproduction a
 * decoration: it leaves `!` and `'` unescaped, while the urlencoded serialiser
 * escapes them (`E2eTest1234%21`, not `E2eTest1234!`). Only the ASCII
 * alphanumerics and `* - . _` survive unescaped, and a space becomes `+`.
 */
function formUrlEncodeComponent(value: string): string {
  let out = '';
  for (const char of value) {
    if (/[A-Za-z0-9*\-._]/.test(char)) {
      out += char;
    } else if (char === ' ') {
      out += '+';
    } else {
      for (const byte of new TextEncoder().encode(char)) {
        out += `%${byte.toString(16).toUpperCase().padStart(2, '0')}`;
      }
    }
  }
  return out;
}

/** Serialises a whole urlencoded payload, in insertion order. */
function formUrlEncode(pairs: ReadonlyArray<readonly [string, string]>): string {
  return pairs
    .map(([name, value]) => `${formUrlEncodeComponent(name)}=${formUrlEncodeComponent(value)}`)
    .join('&');
}

/**
 * Parameter names that must never appear in a URL. Deliberately wider than the
 * `email`/`password` of the observed leak: `name` and `username` were in that
 * same query string, and a credential is a credential whatever its field name.
 * The list is only ever applied to URLs observed inside the sign-in / sign-up
 * flows, where none of these names is ever legitimately carried by a query
 * string.
 */
const SENSITIVE_PARAM_RE =
  /^(?:e[-_]?mail|mail|username|user|login|name|full[-_]?name|legal[-_]?name|password|passwd|pwd|pass|current[-_]?password|new[-_]?password|confirm[-_]?password|old[-_]?password|token|access[-_]?token|refresh[-_]?token|secret|otp)$/i;

const CREDENTIAL_FIELDS = ['email', 'password'] as const;
const SIGN_UP_FIELDS = ['name', 'username', 'email', 'password'] as const;

function decodeSafely(value: string): string {
  try {
    return decodeURIComponent(value.replace(/\+/g, ' '));
  } catch {
    // A malformed escape is itself a red flag: surface the raw name.
    return value;
  }
}

/** Offending parameter names carried by `rawUrl`, decoded and lower-cased. */
function sensitiveParamsIn(rawUrl: string): string[] {
  const queryStart = rawUrl.indexOf('?');
  if (queryStart === -1) return [];
  // The fragment is never sent to a server but still shows up in `page.url()`
  // and `location.href`, so it is scanned too.
  const query = rawUrl.slice(queryStart + 1).split('#')[0];
  if (query.length === 0) return [];
  return query
    .split('&')
    .map((pair) => {
      const eq = pair.indexOf('=');
      return eq === -1 ? pair : pair.slice(0, eq);
    })
    .map(decodeSafely)
    .map((name) => name.trim().toLowerCase())
    .filter((name) => SENSITIVE_PARAM_RE.test(name));
}

/** Every request emitted from now on, documents included. */
function recordRequests(page: Page): Request[] {
  const seen: Request[] = [];
  page.on('request', (request) => seen.push(request));
  return seen;
}

/**
 * Whether `body` really carries `field=value`.
 *
 * The transport differs per path and the test must not care: the scripted
 * submission sends JSON (`authClient.signIn.email`), the no-JavaScript
 * submission sends `application/x-www-form-urlencoded`. Both are decoded here
 * and compared on the DECODED value, so a test can never pass by matching an
 * escape sequence instead of the credential.
 */
function bodyCarries(body: string | null, field: string, value: string): boolean {
  const raw = (body ?? '').trim();
  if (raw.length === 0) return false;
  if (raw.startsWith('{')) {
    try {
      return (JSON.parse(raw) as Record<string, unknown>)[field] === value;
    } catch {
      return false;
    }
  }
  return new URLSearchParams(raw).get(field) === value;
}

/** Requests that really carried the given identity, i.e. the auth POST(s). */
function credentialPosts(
  requests: readonly Request[],
  endpoint: string,
  expected: Readonly<Record<string, string>>,
): Request[] {
  const required = Object.entries(expected);
  return requests.filter((request) => {
    if (request.method() !== 'POST') return false;
    if (new URL(request.url()).pathname !== endpoint) return false;
    const body = request.postData();
    return required.every(([field, value]) => bodyCarries(body, field, value));
  });
}

/** Request URLs that violate the invariant, with the offending names. */
function offenders(requests: readonly Request[]): Array<{ url: string; offending: string[] }> {
  return requests
    .map((request) => ({ url: request.url(), offending: sensitiveParamsIn(request.url()) }))
    .filter((entry) => entry.offending.length > 0);
}

/**
 * `allHeaders()` (not `headers()`): the latter omits headers Playwright
 * considers sensitive, `referer` among them. The Referer contract is part of
 * the invariant, so it has to be read from the complete set.
 */
async function refererOf(request: Request): Promise<string> {
  const all = await request.allHeaders();
  return all['referer'] ?? all['referrer'] ?? '';
}

const SIGN_IN_PATH = '/fr/auth/connexion';
const SIGN_IN_ENDPOINT = '/api/auth/sign-in/email';
const SIGN_UP_PATH = '/fr/auth/inscription';
const SIGN_UP_ENDPOINT = '/api/auth/sign-up/email';

/** The exact URL the 23/09 traces recorded, rebuilt from the seeded identity. */
const FAULTY_SIGN_IN_URL = `${SIGN_IN_PATH}?${formUrlEncode([
  ['email', SEED_EMAIL],
  ['password', SEED_PASSWORD],
])}`;

test.describe('Invariant A — credentials never reach a URL (scripted path)', () => {
  test('sign-in submission keeps email and password out of the final URL', async ({ page }) => {
    test.setTimeout(90_000);

    const requests = recordRequests(page);

    await page.goto(SIGN_IN_PATH, { waitUntil: 'networkidle' });
    // Baseline: the page we are about to submit from is already clean.
    expect(sensitiveParamsIn(page.url())).toEqual([]);

    await page.locator('input[name="email"]').fill(SEED_EMAIL);
    await page.locator('input[name="password"]').fill(SEED_PASSWORD);

    // The click is what triggers the navigation; the wait never runs ahead of it.
    await Promise.all([
      page.waitForURL(/tableau-de-bord|dashboard/, { timeout: 30_000 }),
      page.locator('button[type="submit"]').first().click(),
    ]);
    await page.waitForLoadState('networkidle');

    // ── 1. The final URL: the exact 23/09 string, refused ─────────────
    expect(FAULTY_SIGN_IN_URL, 'the reproduction must match the 23/09 traces').toBe(
      '/fr/auth/connexion?email=e2e-seed%40test.com&password=E2eTest1234%21',
    );
    expect(page.url()).not.toBe(FAULTY_SIGN_IN_URL);
    expect(sensitiveParamsIn(page.url())).toEqual([]);

    // Same check from inside the document: `page.url()` and `location.href`
    // can diverge after a client-side redirect.
    const inPage = await page.evaluate(() => ({
      href: window.location.href,
      referrer: document.referrer,
    }));
    expect(sensitiveParamsIn(inPage.href)).toEqual([]);
    expect(sensitiveParamsIn(inPage.referrer)).toEqual([]);

    // ── 2. The submission itself: POST + explicit action, no query ─────
    const posts = credentialPosts(requests, SIGN_IN_ENDPOINT, { email: SEED_EMAIL, password: SEED_PASSWORD });
    expect(posts.length, 'the credentials must really have been submitted').toBeGreaterThan(0);
    for (const post of posts) {
      expect(new URL(post.url()).search).toBe('');
      // Non-vacuity: the password IS in the body. Forbidden in the URL,
      // required in the body — asserting either absence is the wrong gate.
      expect(
        bodyCarries(post.postData(), 'password', SEED_PASSWORD),
        'the credential POST must carry the password in its body',
      ).toBe(true);
      expect(sensitiveParamsIn(post.url())).toEqual([]);
    }

    // ── 3. The Referer handed to the next navigation ───────────────────
    const nextNavigation = requests.filter(
      (request) =>
        request.isNavigationRequest() &&
        new URL(request.url()).pathname.includes('/auth/tableau-de-bord'),
    );
    expect(nextNavigation.length, 'the post-submit navigation must be observable').toBeGreaterThan(0);
    for (const navigation of nextNavigation) {
      expect(navigation.url()).not.toBe(FAULTY_SIGN_IN_URL);
      const referer = await refererOf(navigation);
      expect(referer, 'the next navigation must carry a Referer to be checkable').toContain(SIGN_IN_PATH);
      expect(sensitiveParamsIn(referer)).toEqual([]);
    }

    // ── 4. Nothing emitted during the flow carries a sensitive param ───
    expect(offenders(requests)).toEqual([]);
  });

  test('sign-up submission keeps name, username, email and password out of the URL', async ({ page }) => {
    test.setTimeout(90_000);

    const requests = recordRequests(page);
    const freshEmail = `e2e-inva-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@test.com`;

    await page.goto(SIGN_UP_PATH, { waitUntil: 'networkidle' });
    expect(sensitiveParamsIn(page.url())).toEqual([]);

    await page.locator('input[name="name"]').fill(SEED_NAME);
    // `username` is part of the 23/09 leak (`…&username=e2etester…&…`) and is
    // a validated field server-side, so leaving it empty would abort the flow
    // before any URL could be observed.
    const username = `e2etester${Date.now()}`;
    await page.locator('input[name="username"]').fill(username);
    await page.locator('input[name="email"]').fill(freshEmail);
    await page.locator('input[name="password"]').fill(SEED_PASSWORD);

    // ── 1. The exact 23/09 sign-up string is recognised and refused ────
    const faultyUrl = `${SIGN_UP_PATH}?${formUrlEncode([
      ['name', SEED_NAME],
      ['username', username],
      ['email', freshEmail],
      ['password', SEED_PASSWORD],
    ])}`;
    // `name` holds a space and `password` holds `!`: the browser sent `+` and
    // `%21`, where `encodeURIComponent` would have sent `%20` and a bare `!`.
    // That difference is the proof this reproduces a native form submission
    // and not a hand-written string.
    expect(faultyUrl).toContain('name=E2E+Seed+User');
    expect(faultyUrl).toContain('password=E2eTest1234%21');
    expect(sensitiveParamsIn(faultyUrl)).toEqual(
      expect.arrayContaining(['name', 'username', 'email', 'password']),
    );

    await Promise.all([
      page.waitForURL(/connexion|sign-in/, { timeout: 30_000 }),
      page.locator('button[type="submit"]').first().click(),
    ]);
    await page.waitForLoadState('networkidle');

    expect(page.url()).not.toBe(faultyUrl);
    expect(sensitiveParamsIn(page.url())).toEqual([]);

    const inPage = await page.evaluate(() => ({
      href: window.location.href,
      referrer: document.referrer,
    }));
    expect(sensitiveParamsIn(inPage.href)).toEqual([]);
    expect(sensitiveParamsIn(inPage.referrer)).toEqual([]);

    // ── 2. The submission itself ───────────────────────────────────────
    const posts = credentialPosts(requests, SIGN_UP_ENDPOINT, { email: freshEmail, password: SEED_PASSWORD });
    expect(posts.length, 'the credentials must really have been submitted').toBeGreaterThan(0);
    for (const post of posts) {
      expect(new URL(post.url()).search).toBe('');
      expect(bodyCarries(post.postData(), 'email', freshEmail)).toBe(true);
      expect(bodyCarries(post.postData(), 'name', SEED_NAME)).toBe(true);
      expect(sensitiveParamsIn(post.url())).toEqual([]);
    }

    // ── 3. The Referer handed to the next navigation ───────────────────
    const nextNavigation = requests.filter(
      (request) => request.isNavigationRequest() && /connexion|sign-in/.test(new URL(request.url()).pathname),
    );
    expect(nextNavigation.length, 'the post-submit navigation must be observable').toBeGreaterThan(0);
    for (const navigation of nextNavigation) {
      const referer = await refererOf(navigation);
      expect(sensitiveParamsIn(referer)).toEqual([]);
    }

    // ── 4. Nothing emitted during the flow ─────────────────────────────
    expect(offenders(requests)).toEqual([]);
  });
});

test.describe('Invariant A — structural barriers (hold without JavaScript)', () => {
  const forms = [
    {
      label: 'sign-in',
      path: SIGN_IN_PATH,
      formId: '#sign-in-form',
      endpoint: SIGN_IN_ENDPOINT,
      fields: CREDENTIAL_FIELDS,
    },
    {
      label: 'sign-up',
      path: SIGN_UP_PATH,
      formId: '#sign-up-form',
      endpoint: SIGN_UP_ENDPOINT,
      fields: SIGN_UP_FIELDS,
    },
  ] as const;

  for (const { label, path, formId, endpoint, fields } of forms) {
    test(`${label} form declares method="post" and an explicit same-origin action`, async ({ page }) => {
      await page.goto(path, { waitUntil: 'networkidle' });

      const form = page.locator(formId);
      await expect(form).toHaveCount(1);

      // The HTML default is method="get" to the current URL: exactly the leak.
      await expect(form).toHaveAttribute('method', 'post');
      const action = await form.getAttribute('action');
      expect(action, `${label} form must declare an explicit action`).toBe(endpoint);
      // An off-origin action is a credential exfiltration channel even on POST.
      expect(new URL(action ?? '', page.url()).origin).toBe(new URL(page.url()).origin);

      // The identity controls the product actually renders live inside it.
      for (const field of fields) {
        await expect(
          form.locator(`[name="${field}"]`),
          `${label} form must expose [name="${field}"]`,
        ).toHaveCount(1);
      }
    });
  }

  test('no identity form on the auth pages falls back to GET-to-current-URL', async ({ page }) => {
    for (const path of [SIGN_IN_PATH, SIGN_UP_PATH]) {
      await page.goto(path, { waitUntil: 'networkidle' });

      const unsafe = await page.evaluate(() => {
        const sensitive = /^(?:e[-_]?mail|mail|username|name|password|passwd|pwd)$/i;
        const findings: string[] = [];
        for (const form of Array.from(document.querySelectorAll('form'))) {
          const names = Array.from(form.querySelectorAll('[name]'))
            .map((el) => (el as HTMLInputElement).name)
            .filter((name) => sensitive.test(name));
          if (names.length === 0) continue;
          const method = (form.getAttribute('method') ?? 'get').toLowerCase();
          const action = form.getAttribute('action') ?? '';
          if (method === 'get' || action.trim() === '') {
            findings.push(
              `${form.id || form.getAttribute('name') || '(anonymous form)'} method=${method} action="${action}"`,
            );
          }
        }
        return findings;
      });

      expect(unsafe, `forms carrying identity data must not fall back to GET: ${unsafe.join(' | ')}`).toEqual([]);
    }
  });
});

test.describe('Invariant A — no-JavaScript submission (the 23/09 failure mode)', () => {
  test('blocked scripts do not serialise the credentials into the query string', async ({ browser }: { browser: Browser }) => {
    // On 23/09 the CSP upgrade made every `/_astro/*` subresource unreachable
    // and the browser performed a *native* submission. Disabling script
    // execution takes that same path deterministically, on every project.
    test.setTimeout(90_000);

    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    const requests = recordRequests(page);

    try {
      await page.goto(SIGN_IN_PATH, { waitUntil: 'networkidle' });
      await page.locator('input[name="email"]').fill(SEED_EMAIL);
      await page.locator('input[name="password"]').fill(SEED_PASSWORD);

      await Promise.all([
        page.waitForURL(/\/api\/auth\/sign-in\/email/, { timeout: 30_000 }),
        page.locator('button[type="submit"]').first().click(),
      ]);
      await page.waitForLoadState('networkidle');

      // The browser ends up on the DECLARED POST action — proof that the
      // credentials were addressed to the endpoint, not to a query string.
      expect(new URL(page.url()).pathname).toBe(SIGN_IN_ENDPOINT);
      expect(page.url()).not.toBe(FAULTY_SIGN_IN_URL);
      expect(sensitiveParamsIn(page.url())).toEqual([]);

      const posts = credentialPosts(requests, SIGN_IN_ENDPOINT, { email: SEED_EMAIL, password: SEED_PASSWORD });
      expect(posts.length, 'the native submission must really have carried the credentials').toBeGreaterThan(0);
      for (const post of posts) {
        expect(new URL(post.url()).search).toBe('');
        expect(bodyCarries(post.postData(), 'email', SEED_EMAIL)).toBe(true);
        expect(bodyCarries(post.postData(), 'password', SEED_PASSWORD)).toBe(true);
        const referer = await refererOf(post);
        expect(referer, 'the submission must carry a Referer to be checkable').toContain(SIGN_IN_PATH);
        expect(sensitiveParamsIn(referer)).toEqual([]);
      }

      expect(offenders(requests)).toEqual([]);
    } finally {
      await context.close();
    }
  });
});
