import { expect, type Page } from '@playwright/test';

/**
 * Confirme le dialogue d'action destructrice du back-office.
 *
 * Les écrans d'admin passent par `confirmAdminAction` (`@/core/admin`) avant
 * tout archivage, suppression ou modération : un `<dialog>` natif avec
 * `[data-admin-confirm-submit]` / `[data-admin-confirm-cancel]`. Un clic sur
 * le bouton de la ligne ouvre donc ce dialogue et n'exécute l'action qu'après
 * validation — sans cette étape, le statut attendu n'arrive jamais.
 *
 * L'apparition du dialogue est attendue, pas supposée : un écran qui n'en
 * ouvre pas (parce qu'une confirmation a été retirée par erreur) échoue ici,
 * sur un message lisible, au lieu d'échouer plus loin sur un timeout opaque.
 */
export async function confirmAdminAction(page: Page): Promise<void> {
  const submit = page.locator('dialog [data-admin-confirm-submit]');
  await expect(submit, 'the destructive action must ask for confirmation').toBeVisible();
  await submit.click();
  await expect(submit, 'the confirmation dialog must close once accepted').toHaveCount(0);
}

/** Variante annulation : le dialogue doit se fermer sans exécuter d'action. */
export async function cancelAdminAction(page: Page): Promise<void> {
  const cancel = page.locator('dialog [data-admin-confirm-cancel]');
  await expect(cancel, 'the destructive action must ask for confirmation').toBeVisible();
  await cancel.click();
  await expect(cancel).toHaveCount(0);
}
