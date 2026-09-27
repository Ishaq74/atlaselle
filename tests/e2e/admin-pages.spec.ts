import { test, expect } from '@playwright/test';
import { SEED_EMAIL, SEED_PASSWORD } from './global-setup';

/**
 * E2E tests for additional admin pages not covered by existing specs:
 * media, stats, roles, users, pages, audit, emails, policies, travelers.
 */

/**
 * Locales the site serves: `src/i18n/config.ts` → `LOCALES = ['fr','en','es','ar']`.
 */
const SITE_LOCALES = ['fr', 'en', 'es', 'ar'] as const;
type SiteLocale = (typeof SITE_LOCALES)[number];

/**
 * Text the admin stats page actually renders as its `<h1>`, per locale.
 *
 * Read from the sources, not assumed:
 *  - `src/components/pages/admin/AdminStatsPage.astro:26` renders the heading as
 *    `<h1 …>{ta.tabs.stats}</h1>`, where `ta` is the `admin` block of the
 *    authenticated translation set handed down by
 *    `src/pages/[lang]/admin/stats.astro:27`;
 *  - `ta.tabs.stats` is `admin.tabs.stats` in `src/i18n/<locale>/auth.ts`, line
 *    79 of each of the four files:
 *      fr → 'Statistiques' (src/i18n/fr/auth.ts:79)
 *      en → 'Statistics'   (src/i18n/en/auth.ts:79)
 *      es → 'Estadísticas' (src/i18n/es/auth.ts:79)
 *      ar → 'الإحصائيات' (src/i18n/ar/auth.ts:79)
 *
 * The matcher this replaces, `/Stats|Tableau de bord/i`, was unsatisfiable: no
 * locale renders the substring "Stats" — "Statistiques", "Statistics" and
 * "Estadísticas" do not contain it, and the Arabic heading contains no Latin
 * characters at all — so the test failed on all four locales even though the
 * defect it guards (an admin page exposing no level-1 heading) was already
 * fixed. These literals are the real rendered output, so the assertion keeps
 * its discriminating power: it still fails on a missing, empty, duplicated or
 * wrong-locale heading.
 */
const STATS_H1_BY_LOCALE: Record<SiteLocale, string> = {
  fr: 'Statistiques',
  en: 'Statistics',
  es: 'Estadísticas',
  ar: 'الإحصائيات',
};

/**
 * Sign in as the seeded admin.
 *
 * The failure this helper must never swallow again: on 23/09 the wait below
 * timed out for 30 s on EVERY test of this file, and the only diagnostic was
 * `waiting for navigation until "load"`. The actual page URL — which was
 * `…/auth/connexion?email=…&password=…`, the credential leak itself — appeared
 * nowhere in the report, so 34 failures across 3 projects were attributed to
 * "sign-in is flaky". Any failure is therefore re-thrown with the state that
 * explains it: the observed URL, the submitted form's method and action, and
 * the original error as `cause`.
 */
async function signInAsAdmin(page: import('@playwright/test').Page) {
  await page.goto('/fr/auth/connexion', { waitUntil: 'networkidle' });
  await page.locator('input[name="email"]').fill(SEED_EMAIL);
  await page.locator('input[name="password"]').fill(SEED_PASSWORD);

  const submitBtn = page.locator('button[type="submit"], form button').first();
  const submit = async () => {
    await Promise.all([
      page.waitForURL(/tableau-de-bord|dashboard/, { timeout: 30_000 }),
      submitBtn.click(),
    ]);
    await page.waitForLoadState('networkidle');
  };

  try {
    await submit();
  } catch (cause) {
    const diagnostics = await page
      .evaluate(() => {
        const form = document.querySelector('form');
        return {
          href: window.location.href,
          referrer: document.referrer,
          formMethod: form?.getAttribute('method') ?? null,
          formAction: form?.getAttribute('action') ?? null,
        };
      })
      .catch(() => null);
    throw new Error(
      `admin sign-in did not reach the dashboard. ` +
        `observed href: ${diagnostics?.href ?? page.url()}; ` +
        `referrer: ${diagnostics?.referrer ?? '<unavailable>'}; ` +
        `form method: ${diagnostics?.formMethod ?? '<unavailable>'}; ` +
        `form action: ${diagnostics?.formAction ?? '<unavailable>'}`,
      { cause },
    );
  }
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
    // This is the only test in the suite proving an admin page exposes a
    // level-1 heading, so the assertion must be exact, not indicative:
    // `toHaveText` with a string is a whole-string comparison (no substring, no
    // regex, no case folding), so it still fails if the h1 is removed, emptied,
    // duplicated, or left as another locale's fallback. A pattern broad enough
    // to accept the four locales would pass on any content and prove nothing.
    const heading = page.getByRole('heading', { level: 1 });
    await expect(heading).toHaveCount(1);
    await expect(heading).toHaveText(STATS_H1_BY_LOCALE.fr);
  });

  test('stats page exposes its own level-1 heading in each of the 4 locales', async ({ page }) => {
    // Per-locale proof: one pattern accepting all four headings would not show
    // that each of the four pages exposes its own h1 — a single page rendering
    // the wrong locale's string would still match. Each URL is therefore
    // asserted against the exact text its own translation file renders. FR is
    // re-checked here on purpose: this test is the per-locale coverage, the one
    // above stays the guard for the default-locale navigation path.
    for (const locale of SITE_LOCALES) {
      const url = `/${locale}/admin/stats`;
      const response = await page.goto(url, { waitUntil: 'networkidle' });
      expect(response?.status(), url).toBe(200);
      const heading = page.getByRole('heading', { level: 1 });
      await expect(heading, `${url} must expose exactly one level-1 heading`).toHaveCount(1);
      await expect(
        heading,
        `${url} must render admin.tabs.stats in ${locale}, not another locale's fallback`,
      ).toHaveText(STATS_H1_BY_LOCALE[locale]);
    }
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
    // `textContent()` returns a plain string and the matcher below is a regex:
    // `expect(string).toContain(regex)` is a TypeError in Playwright, not an
    // assertion failure, so this test could only ever "fail" for the wrong
    // reason. The DOM-backed text matcher is the supported equivalent.
    await expect(page.locator('body')).toContainText(/media|image|upload/i);
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
    // Same defect as the media test: a string received by a matcher that only
    // accepts a Locator. `toContainText` auto-retries, so this is strictly
    // stronger than a one-shot `textContent()` read.
    await expect(page.locator('body')).toContainText(/audit|journal|log/i);
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
