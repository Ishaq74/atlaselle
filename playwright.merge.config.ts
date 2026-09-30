import { defineConfig } from '@playwright/test';

/**
 * Config utilisée UNIQUEMENT par `playwright merge-reports`.
 *
 * Chaque voie (job CI par navigateur, ou lane locale) produit un rapport `blob`.
 * Aucun job individuel ne peut écrire le rapport final — ils tournent en
 * parallèle sur des machines distinctes. Ce job de fusion reconstitue un
 * rapport unique à partir de tous les blobs.
 *
 * Elle ne doit contenir QUE `reporter` : ni `globalSetup`/`globalTeardown`
 * (ils ne sont pas rejoués à la fusion), ni `webServer` (inutile), ni `projects`
 * (les blobs portent déjà leurs propres projets).
 *
 * Les chemins de sortie sont volontairement identiques à ceux de
 * `playwright.config.ts` : `tests/helpers/playwright-report.cjs` et
 * `qa-report.cjs` lisent ces fichiers, donc aucun script de rapport n'a à changer.
 */
export default defineConfig({
  reporter: [
    ['html', { outputFolder: 'tests/reports/playwright', open: 'never' }],
    ['json', { outputFile: 'tests/reports/playwright-results.json' }],
  ],
});
