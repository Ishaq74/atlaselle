import { defineConfig, devices } from '@playwright/test';

/**
 * Port du serveur E2E, surchargeable pour isoler plusieurs « voies » (lanes) sur
 * une même machine : chaque voie a son port, sa base et son dossier de rapports.
 * Sans variable, le comportement est strictement inchangé (4322).
 */
const PORT = Number(process.env.E2E_PORT ?? 4322);
const BASE_URL = `http://localhost:${PORT}`;

/**
 * Reporter conditionnel.
 *
 * Par défaut : html + json, comportement historique — les helpers de rapport
 * (`tests/helpers/playwright-report.cjs`) lisent `tests/reports/playwright-results.json`.
 *
 * `E2E_BLOB=1` : un rapport `blob` par voie, à fusionner ensuite avec
 * `playwright merge-reports` (config : `playwright.merge.config.ts`). C'est le mode
 * utilisé par la matrice CI, où chaque navigateur tourne dans son propre job :
 * aucun job ne peut écrire le rapport final, donc chacun produit son blob et un
 * job de fusion reconstitue le rapport unique.
 */
const blobMode = process.env.E2E_BLOB === '1';
const laneName = process.env.E2E_LANE ?? process.env.E2E_PROJECT ?? 'all';
// Un sous-répertoire PAR VOIE est indispensable : le reporter blob vide son
// outputDir au démarrage. Avec un dossier partagé, la voie 2 effacerait le
// rapport de la voie 1 et la fusion serait silencieusement incomplète.
// (En CI chaque navigateur est un job distinct, donc le problème n'y apparaît pas —
// c'est en local, avec plusieurs voies, qu'il mordrait.)
const blobDir = process.env.E2E_BLOB_DIR ?? 'tests/reports/qa/playwright/blob';

/**
 * Le build est normalement refait par le webServer (`pnpm run build && node
 * scripts/e2e-server.mjs`) : c'est la garantie que `dist/` correspond au code
 * testé. `E2E_SKIP_BUILD=1` permet de le sauter quand le pipeline a déjà
 * construit juste avant — au prix d'un risque de `dist/` périmé, donc à
 * n'utiliser que dans ce cas de figure.
 */
const serverCommand =
  process.env.E2E_SKIP_BUILD === '1'
    ? 'node scripts/e2e-server.mjs'
    : 'pnpm run build && node scripts/e2e-server.mjs';

export default defineConfig({
  globalSetup: './tests/e2e/global-setup.ts',
  globalTeardown: './tests/e2e/global-teardown.ts',
  testDir: 'tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  // Retry flaky runs: 2 in CI (matches CI job), 1 locally.
  retries: process.env.CI ? 2 : 1,
  // A single Node SSR preview server backs ALL projects (chromium/firefox/webkit).
  // Running workers in parallel across 3 browsers overloads that server and causes
  // intermittent `SSL connect error` / `NS_ERROR_CONNECTION_REFUSED` / "Sign-in
  // failed". Sequential execution (1 worker) keeps the server responsive and makes
  // E2E deterministic — this is Playwright's own CI recommendation for SSR apps.
  // CI already runs with 1; we mirror it locally for the same stability guarantee.
  workers: 1,
  reporter: blobMode
    ? [
        ['blob', { outputDir: `${blobDir}/${laneName}`, fileName: 'report.zip' }],
        ['list'],
      ]
    : [
        // open:'never' so the HTML reporter does NOT spawn a blocking server on
        // port 9323 waiting for Ctrl+C — it would hang the whole `pnpm qa` pipeline.
        ['html', { outputFolder: 'tests/reports/playwright', open: 'never' }],
        ['json', { outputFile: 'tests/reports/playwright-results.json' }],
      ],
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
{
  name: 'firefox',
  use: {
    ...devices['Desktop Firefox'],
    launchOptions: {
      firefoxUserPrefs: {
        'datareporting.policy.dataSubmissionEnabled': false,
        'toolkit.telemetry.enabled': false,
        'app.normandy.enabled': false,        // coupe Nimbus/remote experiments
        'services.settings.server': '',        // coupe le polling remote-settings
      },
    },
  },
},
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
  ],
  webServer: {
    // scripts/e2e-server.mjs spawns the astro CLI DIRECTLY
    // (`node node_modules/astro/bin/astro.mjs preview ...`) instead of going
    // through the pnpm script chain. Root cause: Astro >= 7.2 auto-detects
    // "agentic" terminals (am-i-vibing) and forks `astro preview` into a
    // DETACHED background daemon unless ASTRO_PREVIEW_BACKGROUND is set — and
    // that variable does not reliably reach astro through the pnpm shim
    // (`pnpm preview`), so the webServer process "exited early" while an
    // orphaned daemon kept port 4322. The script forces the env var straight
    // into the child process and pre-cleans stale locks/listeners.
    // See the header comment in scripts/e2e-server.mjs for the full analysis.
    command: serverCommand,
    url: BASE_URL,
    // Always start a FRESH server built from the current source. Reusing a
    // pre-existing preview (e.g. one started manually in another terminal)
    // is unsafe: it may serve a stale build (so E2E would not exercise the
    // latest code) and a long-lived dev preview tends to become unstable under
    // the E2E request load, producing intermittent `SSL connect error` /
    // `NS_ERROR_CONNECTION_REFUSED`. CI already uses false; we mirror it locally
    // for the same determinism. Ensure port 4322 is free before running.
    reuseExistingServer: false,
    timeout: 180_000,
    env: {
      NODE_ENV: 'test',
      // Le serveur doit écouter sur le port de la voie, pas sur 4322 par défaut.
      E2E_PORT: String(PORT),
      // Lets API endpoints rate-limit per real client IP (E2E specs send
      // unique X-Forwarded-For values to isolate their buckets).
      TRUST_PROXY: 'true',
      // Kept as belt-and-suspenders documentation of the official opt-out,
      // but the effective enforcement happens inside scripts/e2e-server.mjs,
      // which forces ASTRO_PREVIEW_BACKGROUND='0' directly into the spawned
      // astro child process (this env block does not reliably cross the pnpm
      // shim chain on Windows).
      ASTRO_PREVIEW_BACKGROUND: '0',
    },
  },
});
