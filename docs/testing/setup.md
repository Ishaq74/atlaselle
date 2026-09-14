# Testing — Configuration & Setup

> Retour à l'[index](index.md)

---

## Arborescence des tests

```text
tests/
├── unit/                              # 102 fichiers — tests Vitest
├── integration/                       # 15 fichiers — tests Vitest + PostgreSQL
├── e2e/                               # 6 specs + 2 hooks — scénarios Playwright (app, auth, blog, cms-admin, services, services-lifecycle)
├── a11y/                              # 5 scripts — seed, orchestration, LHCI helpers
└── helpers/                           # auth helper + générateurs de rapports

Rapports (gitignored) :
└── tests/reports/                     # JSON + TXT + HTML pour Vitest, Playwright, Pa11y, Lighthouse

Configs racine :
├── .pa11yci.cjs                       # Pa11y-ci (60 URLs : 32 publiques + 8 auth + 20 admin, WCAG2AAA non strict — ignore color-contrast)
├── lighthouserc.cjs                   # Lighthouse CI (32 URLs publiques collectées, + 8 auth + 20 admin via batches, gates ≥0.9)
├── vitest.config.ts                   # Vitest (unit + integration, 7 alias, coverage 80/75/75/80)
└── playwright.config.ts               # Playwright (Chromium + Firefox + WebKit, baseURL 4322, workers:1)

TOTAL VALIDÉ :
- 123 fichiers de test (`102 unit + 15 integration + 6 e2e`)
- 34+ scénarios E2E (×3 navigateurs)
- 120 audits a11y/perf (`60 Pa11y + 60 Lighthouse`)
```

---

## Vitest — Configuration

**Fichier** : `vitest.config.ts`

```ts
import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

export default defineConfig({
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@i18n': resolve(__dirname, 'src/i18n'),
      '@components': resolve(__dirname, 'src/components'),
      '@lib': resolve(__dirname, 'src/lib'),
      '@database': resolve(__dirname, 'src/database'),
      '@smtp': resolve(__dirname, 'src/smtp'),
      '@media': resolve(__dirname, 'src/media'),
    },
  },
  test: {
    include: ['tests/unit/**/*.test.ts', 'tests/integration/**/*.test.ts'],
    environment: 'node',
    env: { NODE_ENV: 'test' },
    testTimeout: 15_000,
    reporters: ['default', 'json'],
    outputFile: {
      json: 'tests/reports/vitest-results.json',
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary'],
      thresholds: { statements: 80, branches: 75, functions: 75, lines: 80 },
    },
  },
});
```

### Points clés

| Config | Valeur | Rôle |
| :-- | :-- | :-- |
| `include` | `tests/unit/**/*.test.ts`, `tests/integration/**/*.test.ts` | Sépare unit & integration dans le même runner |
| `environment` | `node` | Pas de JSDOM — tests backend purs |
| `env.NODE_ENV` | `'test'` | Désactive l'envoi d'emails SMTP (dynamic import skip) |
| `testTimeout` | `15_000` | 15s max par test (tests DB peuvent être lents) |
| `reporters` | `['default', 'json']` | Sortie console + JSON pour génération de rapports |
| `outputFile.json` | `tests/reports/vitest-results.json` | Fichier JSON utilisé par `vitest-report.cjs` |
| `alias` | 7 alias (dont `@components`) | Mêmes alias que `tsconfig.json` — nécessaire pour Vitest |
| `coverage.thresholds` | statements 80 / branches 75 / functions 75 / lines 80 | Gates v8 |

### Alias résolution

| Alias | Cible |
| :-- | :-- |
| `@/` | `src/` |
| `@i18n` | `src/i18n/` |
| `@components` | `src/components/` |
| `@lib` | `src/lib/` |
| `@database` | `src/database/` |
| `@smtp` | `src/smtp/` |
| `@media` | `src/media/` |

---

## Playwright — Configuration

**Fichier** : `playwright.config.ts`

```ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  globalSetup: './tests/e2e/global-setup.ts',
  globalTeardown: './tests/e2e/global-teardown.ts',
  testDir: 'tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1,
  workers: 1,   // toujours 1 (local + CI) — un seul serveur preview SSR pour les 3 browsers
  reporter: [
    ['html', { outputFolder: 'tests/reports/playwright', open: 'never' }],
    ['json', { outputFile: 'tests/reports/playwright-results.json' }],
  ],
  use: {
    baseURL: 'http://localhost:4322',
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox',  use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit',   use: { ...devices['Desktop Safari'] } },
  ],
  webServer: {
    command: 'pnpm run build && pnpm preview --host localhost --port 4322',
    url: 'http://localhost:4322',
    reuseExistingServer: false,   // toujours un serveur frais buildé du code courant
    timeout: 180_000,
    env: { NODE_ENV: 'test' },
  },
});
```

### Points clés — Playwright

| Config | Valeur | Rôle |
| :-- | :-- | :-- |
| `globalSetup` | `global-setup.ts` | Seed un user vérifié avant les tests |
| `globalTeardown` | `global-teardown.ts` | Supprime le user après les tests |
| `fullyParallel` | `true` | Tests parallèles en local |
| `workers` | `1` toujours | Séquentiel local + CI pour stabilité (un seul serveur SSR) |
| `retries` | `2` en CI, `1` en local | Un retry local reste activé pour absorber les faux positifs transitoires |
| `webServer.command` | `pnpm run build && pnpm preview --host localhost --port 4322` | Build + serveur SSR Astro frais |
| `webServer.env` | `{ NODE_ENV: 'test' }` | **Critique** — désactive SMTP dans le serveur |
| `webServer.timeout` | `180_000` | 180 s pour le build + démarrage |
| `reuseExistingServer` | `false` | Toujours un serveur frais (pas de build périmé) |
| `reporter` | `[['html', { open: 'never', ... }], ['json', ...]]` | `open: 'never'` pour ne pas bloquer `pnpm qa` + JSON pour génération de rapports |

---

## Variables d'environnement

### En local (`.env` ou export)

```bash
# Base de données
DATABASE_URL_LOCAL=postgresql://user:pass@localhost:5432/atlaselle_dev
DB_ENV=LOCAL

# Auth
BETTER_AUTH_SECRET=your-secret-key-minimum-32-chars
BETTER_AUTH_URL=http://localhost:4321

# SMTP (non requis pour les tests)
# BREVO_API_KEY=...        # NON chargé en mode test
# SMTP_PROVIDER=BREVO      # NON chargé en mode test
```

### En CI (automatique via `ci.yml`)

```bash
DATABASE_URL_LOCAL=postgresql://test:test@localhost:5432/atlaselle_test
DB_ENV=LOCAL
NODE_ENV=test
BETTER_AUTH_SECRET=ci-test-secret-key-minimum-32-chars!!
BETTER_AUTH_URL=http://localhost:4321
```

### Protection SMTP en mode test

Le fichier `src/lib/auth.ts` utilise un pattern de **dynamic import conditionnel** pour ne jamais charger le module SMTP en mode test :

```ts
const isTest = process.env.NODE_ENV === 'test';

// Au lieu d'un import statique :
// import { sendEmail } from "@smtp/send";   ← SUPPRIMÉ

// On utilise un import dynamique conditionnel :
if (!isTest) {
  import("@smtp/send")
    .then(m => m.sendEmail({ to, subject, html, text }))
    .catch(() => {});
}
```

**Pourquoi ?** Un `import` statique de `@smtp/send` charge `src/smtp/env.ts` qui exécute `requireEnv('BREVO_API_KEY')` au top-level — ce qui appelle `process.exit(1)` si la variable n'existe pas. Le dynamic import évite complètement le chargement du module.

---

## Commandes disponibles

```bash
# Tests unitaires + intégration (Vitest)
pnpm test                    # Tous les tests Vitest
pnpm test -- --watch         # Watch mode
pnpm test -- tests/unit/     # Seulement les unit
pnpm test -- tests/integration/  # Seulement les integration

# Tests E2E (Playwright)
pnpm test:e2e                # Tous les E2E
npx playwright test --headed # Mode debug avec navigateur visible
npx playwright test --ui     # Mode UI interactif
npx playwright show-report   # Rapport HTML

# Validation complète (séquentielle)
pnpm lint && npx astro check && pnpm build && pnpm test && pnpm test:e2e

# Accessibilité & Performance (Pa11y + Lighthouse)
pnpm a11y                    # Tout-en-un : build, serveur, audits, teardown
pnpm a11y:pa11y-only         # Pa11y seulement (avec orchestrateur)
pnpm a11y:lighthouse-only    # Lighthouse seulement (avec orchestrateur)

# Commandes individuelles a11y (serveur requis)
pnpm a11y:setup              # Seed users + export cookies
pnpm a11y:pa11y              # Pa11y-ci (60 URLs, WCAG2AAA non strict : ignore color-contrast)
pnpm a11y:lighthouse         # LHCI (32 URLs publiques)
pnpm a11y:lighthouse:authed  # LHCI (8 user + 20 admin URLs)
pnpm a11y:lighthouse:rename  # Renommer rapports LHCI
pnpm a11y:teardown           # Supprime users seed + cookies

# Génération de rapports texte
pnpm test:report             # Génère vitest-report.txt depuis vitest-results.json
pnpm test:e2e:report         # Génère playwright-report.txt depuis playwright-results.json
pnpm a11y:report             # Génère lighthouse-report.txt (scores, CWV, audits échoués)
pnpm a11y:lighthouse:report  # Rapport LHCI console (scores + CWV par page)
pnpm a11y:lighthouse:report:contrast  # Idem + détails échecs de contraste
```

---

## Utilitaires de test

### `tests/e2e/global-setup.ts`

- Exporte `SEED_EMAIL`, `SEED_PASSWORD`, `SEED_NAME` (utilisés dans `auth.spec.ts` et `cms-admin.spec.ts`)
- Set `process.env.NODE_ENV = 'test'` avant import de auth
- Crée et vérifie un user seed via `auth.api.signUpEmail()` + SQL update
- Force `emailVerified: true` et `role: 'admin'` pour permettre l'accès aux pages admin CMS

### `tests/e2e/global-teardown.ts`

- Supprime account → session → user pour le SEED_EMAIL
- Nettoyage complet pour éviter les conflits entre runs

### Mocks Vitest courants

| Module mocké | Fichier test | Ce qui est mocké |
| :-- | :-- | :-- |
| `@smtp/env` | `send-email.test.ts` | `getSmtpProvider()`, `getSmtpFrom()` |
| `@smtp/providers/brevo` | `send-email.test.ts` | `send()` |
| `@smtp/providers/resend` | `send-email.test.ts` | `send()` |
| `@smtp/providers/nodemailer` | `send-email.test.ts` | `send()` |
| `node:fs/promises` | `upload.test.ts` | Filesystem operations |
