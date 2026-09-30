import { test, expect } from '@playwright/test';
import { SEED_EMAIL, SEED_PASSWORD } from './global-setup';

/**
 * Deux contrats d'interface du back-office, tous deux introduits avec la
 * refonte UI/UX et donc susceptibles d'être cassés en silence :
 *
 *   1. Le sélecteur de vue de `DataView` est le composant `Select` du design
 *      system (plus un `<select>` natif), et la vue choisie survit à un
 *      rechargement — la préférence est dans `localStorage`.
 *   2. Une action destructrice (archivage, suppression) ouvre le dialogue de
 *      `confirmAdminAction`, et l'annulation ne fait rien : c'est ce contrat
 *      qui rend l'action réversible, donc les tests E2E qui l'ignorent
 *      cliquent dans le vide.
 */

import { BASE_URL } from '../helpers/e2e-env';

async function adminState(browser: import('@playwright/test').Browser) {
  const context = await browser.newContext();
  const response = await context.request.post(`${BASE_URL}/api/auth/sign-in/email`, {
    headers: { 'content-type': 'application/json', Origin: BASE_URL },
    data: { email: SEED_EMAIL, password: SEED_PASSWORD },
  });
  if (response.status() !== 200) {
    throw new Error(`Seed admin login failed (${response.status()})`);
  }
  const state = await context.storageState();
  await context.close();
  return state;
}

test.describe('Admin UI contracts', () => {
  test('the view selector is the shared Select atom and the choice survives a reload', async ({ browser }) => {
    const state = await adminState(browser);
    const context = await browser.newContext({ storageState: state });
    const page = await context.newPage();

    try {
      await page.goto('/fr/admin/users', { waitUntil: 'networkidle' });

      // Le sélecteur est bien l'atome `Select` : pas de `<select>` natif à cet
      // endroit (les filtres de la barre d'outils, eux, restent des
      // `NativeSelect` : ils vivent dans un formulaire GET et doivent
      // fonctionner sans JavaScript).
      const container = page.locator('.data-view').first();
      await expect(container).toBeVisible();
      const modeSelect = container.locator('[data-slot="select"].data-view-mode');
      const trigger = modeSelect.locator('[data-slot="select-trigger"]');
      await expect(trigger, 'the view selector must be a Select trigger').toBeVisible();
      await expect(
        modeSelect.locator('[data-slot="native-select"]'),
        'the view selector must not fall back to a raw select',
      ).toHaveCount(0);

      // Les trois vues sont proposées (l'écran users rend list + table + cards).
      await trigger.click();
      const options = page.locator('[data-slot="select-item"]');
      await expect(options, 'list, table and cards must all be offered').toHaveCount(3);
      await options.filter({ hasText: /cartes|cards|tarjetas|بطاقات/i }).first().click();
      await expect(container).toHaveAttribute('data-mode', 'cards');
      await expect(container.locator('[data-view="cards"]')).toBeVisible();

      // La préférence est mémorisée : le rechargement ne doit pas retomber sur
      // le mode responsive (table sur desktop).
      await page.reload({ waitUntil: 'networkidle' });
      const reloaded = page.locator('.data-view').first();
      await expect(reloaded, 'the chosen view must survive a reload').toHaveAttribute('data-mode', 'cards');
    } finally {
      // Nettoyage DANS le finally, et sur la page ET le context : `localStorage`
      // survit à la fermeture d'un onglet et est partagé par toutes les pages du
      // worker. Sans cela, la préférence `cards` fuyait vers les suites suivantes
      // — `admin-trips-crud` héritait d'un mode qui masquait ses lignes, et
      // l'échec se lisait comme un bug de rendu alors que c'était une fuite
      // d'état entre tests.
      await page
        .evaluate(() => window.localStorage.removeItem('atlaselle:admin:data-view'))
        .catch(() => {
          /* la page peut déjà être fermée : sans conséquence */
        });
      await context.close();
    }
  });

  test('a destructive action asks for confirmation and cancelling changes nothing', async ({ browser }) => {
    const state = await adminState(browser);
    const context = await browser.newContext({ storageState: state });
    const page = await context.newPage();

    try {
      await page.goto('/fr/admin/pages', { waitUntil: 'networkidle' });
      const row = page.locator('tbody tr').filter({ has: page.locator('.page-delete-btn') }).first();
      await expect(row, 'the pages list must offer a destructive action').toBeVisible();
      const title = (await row.locator('td').nth(1).textContent())?.trim() ?? '';

      // Annuler ne doit rien exécuter : ni dialogue résiduel, ni changement de
      // la ligne (on relit son titre). Le chemin « confirmer » est couvert par
      // les specs services, qui suivent un service brouillon seedé et vérifient
      // la transition de statut qui suit la confirmation.
      await row.locator('.page-delete-btn').click();
      const dialog = page.locator('dialog[open]');
      await expect(dialog, 'a destructive action must open the confirmation dialog').toBeVisible();
      await dialog.locator('[data-admin-confirm-cancel]').click();
      await expect(dialog, 'cancelling must close the dialog').toHaveCount(0);

      await expect(
        page.locator('tbody tr').filter({ hasText: title }).first(),
        'cancelling must leave the row untouched',
      ).toBeVisible();
    } finally {
      await context.close();
    }
  });
});
