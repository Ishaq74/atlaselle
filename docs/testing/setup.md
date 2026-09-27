# Testing — Configuration & Setup

> Retour à l'[index](index.md)

---

## Arborescence des tests

```text
tests/
├── unit/                              # 129 fichiers — tests Vitest
├── integration/                       # 45 fichiers — tests Vitest + PostgreSQL
├── e2e/                               # 28 specs + 2 hooks — scénarios Playwright
├── a11y/                              # 5 scripts — seed, orchestration, LHCI helpers
└── helpers/                           # auth helper + générateurs de rapports

Rapports (gitignored) :
└── tests/reports/                     # JSON + TXT + HTML pour Vitest, Playwright, Pa11y, Lighthouse

Configs racine :
├── .pa11yci.cjs                       # Pa11y-ci (60 URLs : 32 publiques + 8 auth + 20 admin, WCAG2AAA non strict — ignore color-contrast)
├── lighthouserc.cjs                   # Lighthouse CI (32 URLs publiques collectées, + 8 auth + 20 admin via batches, gates ≥0.9)
├── vitest.config.ts                   # Vitest (unit + integration, 7 alias, coverage 80/75/75/80) — fail-closed sur SITE_URL
└── playwright.config.ts               # Playwright (Chromium + Firefox + WebKit, baseURL 4322, workers:1)

TOTAL VALIDÉ :
- 202 fichiers de test (`129 unit + 45 integration + 28 e2e`)
- 1 907 tests Vitest, 100 % verts
- 269 blocs de test E2E (× 3 navigateurs)
- 120 audits a11y/perf (`60 Pa11y + 60 Lighthouse`)
- 28 URLs de sitemap hors contenu (déterministe) — voir index.md
```

> Compteurs recomptés à partir de `tests/**`. Le seuil `SITE_URL` est une **variable d'environnement du processus**, pas une entrée de `.env` : voir [security.md](../security.md) §10.

---

## Vitest — Configuration

**Fichier** : `vitest.config.ts`

```ts
import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

const SITE_URL_ENV = 'SITE_URL';

function resolveTestSiteOrigin(): string {
  const raw = process.env[SITE_URL_ENV];
  if (typeof raw !== 'string' || raw.trim() === '') {
    throw new Error(
      `[VITEST] ${SITE_URL_ENV} is required but is not set (received: ${raw === undefined ? 'undefined' : 'an empty string'}). ` +
      `Astro freezes it into import.meta.env.SITE (as \`site\`), and src/pages/sitemap-cms.xml.ts refuses to publish without it, so the suite cannot ` +
      `run against a guessed origin. Set ${SITE_URL_ENV} to the public origin of the site (e.g. ${SITE_URL_ENV}="https://example.com"), or to an explicit ` +
      `loopback origin (e.g. ${SITE_URL_ENV}="http://localhost:4321") for local development. astro.config.mjs enforces the same contract for builds.`
    );
  }

  const value = raw.trim();
  let parsed: URL;
  try { parsed = new URL(value); }
  catch { throw new Error(`[VITEST] ${SITE_URL_ENV} is invalid: "${value}". …`); }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') throw new Error(`… unsupported protocol …`);
  if (parsed.pathname !== '/') throw new Error(`… must be a bare origin without a path …`);

  return parsed.origin;
}

const siteOrigin = resolveTestSiteOrigin();   // ← évalue AU CHARGEMENT du module

export default defineConfig({
  resolve: {
    alias: {
      '@': resolve(import.meta.dirname, 'src'),
      '@i18n': resolve(import.meta.dirname, 'src/i18n'),
      '@components': resolve(import.meta.dirname, 'src/components'),
      '@lib': resolve(import.meta.dirname, 'src/lib'),
      '@database': resolve(import.meta.dirname, 'src/database'),
      '@smtp': resolve(import.meta.dirname, 'src/smtp'),
      '@media': resolve(import.meta.dirname, 'src/media'),
    },
  },
  test: {
    include: ['tests/unit/**/*.test.ts', 'tests/integration/**/*.test.ts'],
    environment: 'node',
    globalSetup: ['./tests/helpers/voyage-global-setup.ts'],
    env: {
      NODE_ENV: 'test',
      SITE: siteOrigin,   // la constante qu'Astro gèlerait depuis `site`
    },
    testTimeout: 15_000,
    reporters: ['default', 'json'],
    outputFile: {
      json: 'tests/reports/vitest-results.json',
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary'],
      reportsDirectory: 'tests/reports/coverage',
      include: ['src/**/*.ts'],
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
| `globalSetup` | `./tests/helpers/voyage-global-setup.ts` | Amorçage DB commun aux tests de voyage |
| `env.NODE_ENV` | `'test'` | Désactive l'envoi d'emails SMTP (dynamic import skip) |
| `env.SITE` | `resolveTestSiteOrigin()` | La valeur qu'Astro gèlerait depuis `site` ; l'unique injection correcte pour `src/pages/sitemap-cms.xml.ts` |
| `testTimeout` | `15_000` | 15 s max par test (tests DB peuvent être lents) |
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
    // ⚠️ aucun `timeout` ici : voir « Le délai d'exécution n'est pas dans la config »
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox',  use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit',   use: { ...devices['Desktop Safari'] } },
  ],
  webServer: {
    command: 'pnpm run build && node scripts/e2e-server.mjs',
    url: 'http://localhost:4322',
    reuseExistingServer: false,   // toujours un serveur frais buildé du code courant
    timeout: 180_000,              // ⚠️ délai de DÉMARRAGE du serveur, pas d'exécution d'un test
    env: {
      NODE_ENV: 'test',
      TRUST_PROXY: 'true',                    // rate limit par IP réelle côté API
      ASTRO_PREVIEW_BACKGROUND: '0',          // belt-and-suspenders ; le forçage effectif est dans e2e-server.mjs
    },
  },
});
```

### Points clés — Playwright

| Config | Valeur | Rôle |
| :-- | :-- | :-- |
| `globalSetup` | `global-setup.ts` | Seed un user vérifié avant les tests |
| `globalTeardown` | `global-teardown.ts` | Supprime le user après les tests |
| `testDir` | `tests/e2e` | 28 fichiers `*.spec.ts` sont découverts |
| `fullyParallel` | `true` | Tests parallèles en local |
| `workers` | `1` toujours | Séquentiel local + CI pour stabilité (un seul serveur SSR) |
| `retries` | `2` en CI, `1` en local | Un retry local reste activé pour absorber les faux positifs transitoires |
| `use.baseURL` | `http://localhost:4322` | Port réellement écouté par `scripts/e2e-server.mjs` |
| `webServer.command` | `pnpm run build && node scripts/e2e-server.mjs` | Build + serveur SSR Astro frais. Le script lance le CLI Astro **directement**, sans la chaîne de scripts pnpm, pour que `ASTRO_PREVIEW_BACKGROUND` atteigne réellement l'enfant |
| `webServer.env` | `{ NODE_ENV: 'test', TRUST_PROXY: 'true', ASTRO_PREVIEW_BACKGROUND: '0' }` | **`NODE_ENV`** désactive SMTP dans le serveur ; **`TRUST_PROXY`** est requis par les specs E2E, qui envoient des `X-Forwarded-For` uniques pour isoler leurs compartiments de rate limit |
| `webServer.timeout` | `180_000` | **Délai de démarrage du serveur web**, pas d'exécution d'un test |
| `reuseExistingServer` | `false` | Toujours un serveur frais (pas de build périmé) |
| `reporter` | `[['html', { open: 'never', … }], ['json', …]]` | `open: 'never'` pour ne pas bloquer `pnpm qa` + JSON pour génération de rapports |

### Le délai d'exécution n'est pas dans la configuration — à ne pas inventer

**`playwright.config.ts` ne déclare aucun délai d'exécution.** Il n'y a :

- **ni** `timeout` au niveau racine ;
- **ni** `timeout` dans `use` ;
- **ni** `timeout` dans l'un des trois `projects` ;
- **ni** `expect.timeout`.

Le **seul** `timeout` du fichier est `webServer.timeout: 180_000`, qui borne le **démarrage du serveur** (build + `astro preview` + première réponse sur `http://localhost:4322`). Le confondre avec un délai de test est une erreur : `180_000` ne gouverne aucune exécution de test.

Le délai d'exécution effectif est donc **celui par défaut de Playwright, soit 30 secondes**, parce que la configuration ne le surcharge pas.

| Portée | Origine de la valeur |
| :-- | :-- |
| `test.setTimeout(n)` dans un spec | Local au test ou au `describe` qui l'appelle |
| `waitForURL(…, { timeout: n })`, `expect(…).toBeVisible({ timeout: n })` | Local à l'assertion ; c'est la forme utilisée par les specs du dépôt |
| **délai d'exécution par défaut** | **30 000 ms — défaut de Playwright, non redéclaré ici** |

> **Pourquoi un délai global serait un défaut de conception.** Un test long qui perd son `test.setTimeout()` retombe silencieusement sur 30 s : le délai régresse d'un facteur 3 sans qu'aucune configuration ne change et sans qu'aucune erreur ne le signale. C'est exactement le défaut qui a été corrigé dans `tests/e2e/credential-url-leak.spec.ts`, où trois tests portent explicitement `test.setTimeout(90_000)` — lignes **191** (soumission de connexion), **258** (soumission d'inscription) et **408** (soumission sans JavaScript) — parce qu'ils remplissent des formulaires, attendent une navigation, puis observent la requête émise.
>
> **Règle** : tout test E2E qui dépasse 30 s doit porter son `test.setTimeout()` **localement**. Ne pas introduire un délai global ou par projet dans `playwright.config.ts` pour « couvrir » un test : cela masquerait le test qui a perdu le sien, et le rendrait invisible au prochain qui le supprimera.

> **Les autres `test.setTimeout()` du dépôt**, tous locaux, pour contexte : `api-endpoints.spec.ts:132` → `180_000` ; `auth.spec.ts:63` → `60_000` ; `blog-review-rating-a11y.spec.ts:176` → `120_000` ; `blog.spec.ts:350` → `90_000` ; `voyage.spec.ts:156` → `90_000`. Aucune de ces valeurs ne vient de `playwright.config.ts`.

---

## Variables d'environnement

### `SITE_URL` — obligatoire, dans l'environnement du processus, et pas lisible depuis `.env`

`vitest.config.ts` **et** `astro.config.mjs` sont tous deux **fail-closed** sur `SITE_URL`. Sans elle, ni la suite ni le build ne démarrent :

```
Error: [VITEST] SITE_URL is required but is not set (received: undefined). …
Error: [ASTRO]  SITE_URL is required but is not set (received: undefined). …
```

Cinq conditions de rejet, **identiques** dans les deux fichiers : absente ou vide, invalide pour `new URL()`, protocole autre que `http:`/`https:`, `http:` sur un hôte **non local**, porteur d'un chemin.

#### Les deux commandes que le message d'erreur réclame

Le message d'erreur dit explicitement *« for builds »* et *« for local development »*. Voici donc, sans ambiguïté, comment lancer chacune :

| Cible | Commande | Origine attendue |
| :-- | :-- | :-- |
| **Build** | `pnpm build` (= `astro build`) | origine publique **ou** origine loopback explicite |
| **Suite de tests** | `pnpm test` (= `vitest run`) | origine publique **ou** origine loopback explicite |
| Suite + couverture | `pnpm test -- --coverage` | idem |
| Type-check | `pnpm check` (= `astro check`) | idem — `astro check` charge aussi la config |
| E2E | `pnpm test:e2e` | `http://localhost:4322`, voir ci-dessous |

```bash
# ── bash / zsh ────────────────────────────────────────────────────────────
# build
SITE_URL="https://example.com" pnpm build

# suite de tests
SITE_URL="http://localhost:4321" pnpm test
```

```powershell
# ── Windows PowerShell ───────────────────────────────────────────────────
# build
$env:SITE_URL = "https://example.com"; pnpm build

# suite de tests
$env:SITE_URL = "http://localhost:4321"; pnpm test
```

En E2E, l'origine servie est `http://localhost:4322` : `SITE_URL="http://localhost:4322" pnpm test:e2e`.

#### Pourquoi c'est fail-closed

`import.meta.env.SITE` n'est pas une lecture d'exécution. Astro gèle l'entrée `site` d'`astro.config.mjs` dedans **au build**. Vitest n'exécute aucun plugin Astro, donc rien ne gèle `site` et `import.meta.env.SITE` vaut `undefined` pour tout module testé — ce qui fait lever `src/pages/sitemap-cms.xml.ts` à chaque appel. La seule injection correcte est donc la **même** variable que celle du build, produisant la chaîne exacte qu'Astro gèlerait. Il n'y a **ni repli localhost ni seconde constante**, délibérément.

#### Pourquoi `.env` ne suffit pas

Ni `astro.config.mjs` ni `vitest.config.ts` ne consultent un fichier d'environnement local pour cette variable : les deux la lisent via `process.env` **au moment où leur module est évalué**, c'est-à-dire avant que le chargeur de configuration d'Astro ne puisse charger un `.env`. La ligne `SITE_URL=` de `.env.example` — et donc de `.env` — est donc **inopérante pour le build et pour les tests**. C'est un changeur de contrat pour tout développeur local : une variable qui vivait dans `.env` doit désormais être exportée dans l'environnement du processus.

`http:` est accepté **sur un hôte loopback uniquement** (`localhost`, `*.localhost`, `::1`, `127.0.0.0/8`). En production, l'origine doit être `https:` sur un hôte non local.

> `vitest.config.ts` est le miroir d'`astro.config.mjs` : toute règle que la config Astro gagne et qui change la valeur gelée (protocole, origine nue) doit être répercutée ici. Le flux de sitemap, lui, ne se replie plus : il lit `import.meta.env.SITE` et **lève** si la constante est absente. Voir [security.md](../security.md) §10.

### En local — deux emplacements, et ils ne se valent pas

```bash
# ── .env : lu par l'application et par Vite ──────────────────────────────
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

```bash
# ── environnement du processus : OBLIGATOIRE pour SITE_URL ───────────────
# build   : SITE_URL="https://example.com"           pnpm build
# tests   : SITE_URL="http://localhost:4321"         pnpm test
# e2e     : SITE_URL="http://localhost:4322"         pnpm test:e2e
```

> **La ligne `SITE_URL=` de `.env` et de `.env.example` est inerte pour le build et pour les tests.** `astro.config.mjs` et `vitest.config.ts` lisent `process.env` au moment où leur module est évalué, donc **avant** tout chargement de `.env`. Un développeur qui suit `cp .env.example .env` puis `pnpm build` sans exporter la variable obtient un échec de chargement de configuration, pas un build. C'est le changement de contrat le plus visible de ce lot ; il est explicite parce qu'il affecte tout le monde.
>
> Trois autres lecteurs de `process.env.SITE_URL` existent en cours d'exécution, et **eux** tolèrent le silence — c'est pourquoi la variable reste dans `.env.example` : `src/middleware.ts:64` (`configuredSiteHost()`, qui retourne `null` sans elle), `src/modules/email-voyage/domain/voyage-email-worker.ts:70` (repli `http://localhost:4321`) et `src/lib/newsletter/blog-newsletter-service.ts:82` (`?.trim()`, origine d'environnement ignorée si absente). Aucun de ces trois lecteurs ne fait échouer quoi que ce soit : c'est précisément pourquoi le durcissement porte sur la **configuration**, là où l'absence est une erreur d'infrastructure et non un choix. Voir [security.md](../security.md) §10 pour la liste des trois replis supprimés.

### En CI

`ci.yml` épingle `SITE_URL` et `BETTER_AUTH_URL` par job, au port que le job sert réellement. Voir [ci.md](ci.md) § « Une job, une origine servie ».

```bash
# unit-tests, a11y-perf
SITE_URL=http://localhost:4321
BETTER_AUTH_URL=http://localhost:4321

# e2e-tests  (e2e-server.mjs écoute sur 4322)
SITE_URL=http://localhost:4322
BETTER_AUTH_URL=http://localhost:4322
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
