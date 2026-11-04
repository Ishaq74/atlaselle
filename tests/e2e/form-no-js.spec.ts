import { test, expect } from '@playwright/test';

/**
 * Formulaires publics sans JavaScript (docs/security.md §11, « repli serveur »).
 * Contexte `javaScriptEnabled: false` : seule la soumission native existe.
 * Vérifie le cycle POST → 303 → page d'origine + message flash, une seule fois.
 */
test.use({ javaScriptEnabled: false });

test.describe('Formulaire natif sans JavaScript', () => {
  test('newsletter : POST natif → 303 → message affiché puis consommé', async ({ page }) => {
    await page.goto('/fr/blog');
    const form = page.locator('#newsletter-form').first();
    await expect(form).toHaveAttribute('action', /\?_action=subscribeBlogNewsletter/);
    await form.locator('input[name="email"]').fill(`nojs-${Date.now()}@example.invalid`);

    const [response] = await Promise.all([
      page.waitForResponse((r) => r.request().method() === 'POST' && r.url().includes('_action=subscribeBlogNewsletter')),
      form.locator('button[type="submit"]').click(),
    ]);
    expect(response.status()).toBe(303);
    expect(response.headers()['location']).toBe('/fr/blog');

    await page.waitForURL(/\/fr\/blog$/);
    expect(page.url()).not.toContain('_action');
    const flash = page.locator('[data-form-flash]');
    await expect(flash).toBeVisible();
    await expect(flash.locator('[role="alert"], [role="status"]')).toHaveCount(1);

    await page.reload();
    await expect(page.locator('[data-form-flash]')).toHaveCount(0);
  });

  test('action inconnue : redirigée avec une erreur, aucune exécution', async ({ request }) => {
    const res = await request.post('/fr/blog?_action=doesNotExist', {
      form: { a: 'b' },
      maxRedirects: 0,
    });
    expect(res.status()).toBe(303);
    expect(res.headers()['location']).toBe('/fr/blog');
  });

  test('action privilégiée sans session : refusée proprement', async ({ request }) => {
    const res = await request.post('/fr/admin/site?_action=updateContactInfo', {
      form: { id: 'x' },
      maxRedirects: 0,
    });
    expect([303, 302, 401, 403]).toContain(res.status());
  });
});
