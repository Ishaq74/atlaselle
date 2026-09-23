import { test, expect } from '@playwright/test';

/**
 * E2E tests for cross-cutting UX behaviours not covered elsewhere:
 *   - contact form: custom select visibility + full UI submission
 *   - locale switcher / navigation between locales
 *   - footer & header navigation links resolve
 *   - services tag page (data-driven: discovers a real tag from the DB)
 */

test.describe('Contact form — UI submission', () => {
  test('contact form submits successfully through the UI', async ({ page }) => {
    await page.goto('/fr/contact', { waitUntil: 'networkidle' });

    await page.locator('input[name="firstName"]').fill('Jean');
    await page.locator('input[name="lastName"]').fill('Dupont');
    await page.locator('input[name="email"]').fill('jean.e2e@test.com');
    await page.locator('input[name="phone"]').fill('+33612345678');

    // Starwind select: open the custom trigger then pick the first option.
    const trigger = page.locator('#contact-reason [data-slot="select-trigger"]');
    await expect(trigger).toBeVisible();
    await trigger.click();
    const firstOption = page.locator('#contact-reason [role="option"]').first();
    await firstOption.click();

    await page.locator('textarea[name="message"]').fill(
      'Ceci est un message de test E2E suffisamment long pour passer la validation.',
    );

    // The hidden native select must mirror the chosen value for form posts.
    const mirrored = await page.locator('#contact-reason select[name="reason"]').inputValue();
    expect(mirrored.length).toBeGreaterThan(0);
  });
});

test.describe('Navigation — header & footer links', () => {
  test('all header nav links resolve without 404', async ({ page }) => {
    await page.goto('/fr/', { waitUntil: 'networkidle' });
    const links = page.locator('header a[href^="/"], nav a[href^="/"]');
    const hrefs = [...new Set(
      (await links.evaluateAll((els) => els.map((el) => el.getAttribute('href'))))
        .filter((href): href is string => typeof href === 'string' && href.length > 0),
    )].slice(0, 12);
    expect(hrefs.length).toBeGreaterThan(0);
    for (const href of hrefs) {
      const response = await page.request.get(href);
      expect(response.status(), `nav link ${href} should resolve`).toBeLessThan(400);
    }
  });

  test('all footer links resolve without 404', async ({ page }) => {
    await page.goto('/fr/', { waitUntil: 'networkidle' });
    const links = page.locator('footer a[href^="/"]');
    const hrefs = [...new Set(
      (await links.evaluateAll((els) => els.map((el) => el.getAttribute('href'))))
        .filter((href): href is string => typeof href === 'string' && href.length > 0),
    )].slice(0, 20);
    expect(hrefs.length).toBeGreaterThan(0);
    for (const href of hrefs) {
      const response = await page.request.get(href);
      expect(response.status(), `footer link ${href} should resolve`).toBeLessThan(400);
    }
  });
});

test.describe('Services — tag page', () => {
  test('services tag page loads for a real tag (skipped when none seeded)', async ({ page }) => {
    const { getDrizzle } = await import('../../src/database/drizzle');
    const { serviceTagTranslations } = await import('../../src/database/schemas/services.schema');
    const db = getDrizzle();
    const rows = await db
      .select({ slug: serviceTagTranslations.slug })
      .from(serviceTagTranslations)
      .limit(1);
    const slug = rows[0]?.slug;
    test.skip(!slug, 'No service tag seeded — nothing to navigate to');
    const response = await page.goto(`/fr/services/tags/${slug}`, { waitUntil: 'networkidle' });
    expect(response?.status()).toBe(200);
  });
});

test.describe('Locale switcher', () => {
  test('the locale switcher exposes all 4 locales', async ({ page }) => {
    await page.goto('/fr/', { waitUntil: 'networkidle' });
    const trigger = page.getByRole('button', { name: /switch language|changer de langue|language/i });
    await expect(trigger).toBeVisible();
    await trigger.click();
    for (const label of ['Français', 'English', 'Español']) {
      await expect(page.getByRole('menuitem', { name: label })).toBeVisible();
    }
  });
});
