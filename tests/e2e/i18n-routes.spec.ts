import { test, expect } from '@playwright/test';

/**
 * E2E tests for the localized route surface across all 4 locales (fr/en/es/ar).
 * Every URL asserted here is part of the public sitemap contract — a regression
 * on any of them breaks SEO, hreflang alternates and user-facing navigation.
 *
 * Segments intentionally come from src/i18n/routes.ts (single source of truth)
 * instead of being re-hardcoded here.
 */
import {
  ABOUT_SEGMENT,
  CONTACT_SEGMENT,
  TRIP_LIST_SEGMENT,
} from '../../src/i18n/routes';

const LOCALES = ['fr', 'en', 'es', 'ar'] as const;
type Locale = (typeof LOCALES)[number];

/** Proven by the pa11y surface audit — legal notice is a CMS-seeded page. */
const LEGAL_SEGMENT: Record<Locale, string> = {
  fr: 'mentions-legales',
  en: 'legal-notice',
  es: 'aviso-legal',
  ar: 'legal-notice',
};

const SIGN_IN_SEGMENT: Record<Locale, string> = {
  fr: 'connexion',
  en: 'sign-in',
  es: 'iniciar-sesion',
  ar: 'sign-in',
};

test.describe('i18n — homepage per locale', () => {
  for (const locale of LOCALES) {
    test(`/${locale}/ loads with correct lang attribute`, async ({ page }) => {
      const response = await page.goto(`/${locale}/`, { waitUntil: 'networkidle' });
      expect(response?.status()).toBe(200);
      await expect(page.locator('html')).toHaveAttribute('lang', locale);
    });
  }

  test('Arabic homepage is RTL', async ({ page }) => {
    await page.goto('/ar/', { waitUntil: 'networkidle' });
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  });

  test('non-Arabic homepages are LTR', async ({ page }) => {
    for (const locale of ['fr', 'en', 'es'] as const) {
      await page.goto(`/${locale}/`, { waitUntil: 'networkidle' });
      await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
    }
  });
});

test.describe('i18n — about page per locale', () => {
  for (const locale of LOCALES) {
    test(`/${locale}/${ABOUT_SEGMENT[locale]} loads`, async ({ page }) => {
      const response = await page.goto(`/${locale}/${ABOUT_SEGMENT[locale]}`, {
        waitUntil: 'networkidle',
      });
      expect(response?.status()).toBe(200);
    });
  }
});

test.describe('i18n — contact page per locale', () => {
  for (const locale of LOCALES) {
    test(`/${locale}/${CONTACT_SEGMENT[locale]} loads with form`, async ({ page }) => {
      const response = await page.goto(`/${locale}/${CONTACT_SEGMENT[locale]}`, {
        waitUntil: 'networkidle',
      });
      expect(response?.status()).toBe(200);
      await expect(page.locator('input[name="email"]')).toBeVisible();
    });
  }
});

test.describe('i18n — legal notice per locale', () => {
  for (const locale of LOCALES) {
    test(`/${locale}/${LEGAL_SEGMENT[locale]} loads`, async ({ page }) => {
      const response = await page.goto(`/${locale}/${LEGAL_SEGMENT[locale]}`, {
        waitUntil: 'networkidle',
      });
      expect(response?.status()).toBe(200);
    });
  }
});

test.describe('i18n — blog listing per locale', () => {
  for (const locale of LOCALES) {
    test(`/${locale}/blog loads`, async ({ page }) => {
      const response = await page.goto(`/${locale}/blog`, { waitUntil: 'networkidle' });
      expect(response?.status()).toBe(200);
    });
  }
});

test.describe('i18n — trips listing per locale (localized segment rewrite)', () => {
  for (const locale of LOCALES) {
    test(`/${locale}/${TRIP_LIST_SEGMENT[locale]} loads`, async ({ page }) => {
      const response = await page.goto(`/${locale}/${TRIP_LIST_SEGMENT[locale]}`, {
        waitUntil: 'networkidle',
      });
      expect(response?.status()).toBe(200);
      // The URL must STAY localized (middleware rewrite, not redirect).
      await expect(page).toHaveURL(new RegExp(`/${locale}/${TRIP_LIST_SEGMENT[locale]}`));
    });
  }
});

test.describe('i18n — sign-in page per locale', () => {
  for (const locale of LOCALES) {
    test(`/${locale}/auth/${SIGN_IN_SEGMENT[locale]} loads`, async ({ page }) => {
      const response = await page.goto(`/${locale}/auth/${SIGN_IN_SEGMENT[locale]}`, {
        waitUntil: 'networkidle',
      });
      expect(response?.status()).toBe(200);
    });
  }
});
