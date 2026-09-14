# Testing — CI/CD (GitHub Actions)

> Retour à l'[index](index.md) · Voir aussi [setup](setup.md) · [a11y.md](a11y.md)

---

## Pipeline

**Fichier** : `.github/workflows/ci.yml`

```text
push/PR → main
    │
    ├── [1] lint-and-check ──────────────────────────┐
    │       Security Audit + ESLint + astro check     │
    │                                                 │
    ├── [2] unit-tests ──────────────────────────────┐│
    │       Vitest (unit + integration)               ││
    │       PostgreSQL 16 service container          ││
    │       Migrations + tests + coverage            ││
    │                                                ├┤
    ├── [3] e2e-tests (needs: [lint-and-check, unit-tests]) ─┘│
    │       Playwright (6 specs x 3 browsers)         │
    │       PostgreSQL 16 service container           │
    │       Build + preview + 3 navigateurs           │
    │                                                 │
    └── [4] a11y-perf (needs: [lint-and-check, unit-tests]) ─┘
            Pa11y-ci (WCAG2AAA non strict, 60 URLs)
            Lighthouse CI (60 URLs : 32 + 8 + 20, ≥0.9 gates)
            PostgreSQL 16 service container
            Build + preview + chromium

  Puis : `deploy` (needs: [unit-tests, e2e-tests, a11y-perf], push sur `main` uniquement) + `ci-summary`.
```

### Variable globale

```yaml
env:
  FORCE_JAVASCRIPT_ACTIONS_TO_NODE24: true
```

> Requise depuis mars 2025 pour forcer les actions JavaScript à tourner sur Node 24.

### Déclencheurs

- **push** sur `main`
- **pull_request** vers `main`

---

## Job 1 : `lint-and-check`

| Étape | Commande | Ce qu'elle vérifie |
| :-- | :-- | :-- |
| Checkout | `actions/checkout@v6` | Clone le repo |
| pnpm | `pnpm/action-setup@v5` (v10) | Installe pnpm |
| Node | `actions/setup-node@v6` (v22) | Installe Node avec cache pnpm |
| Install | `pnpm install --frozen-lockfile` | Installe les dépendances |
| Security Audit | `pnpm audit --prod --audit-level=moderate` | 0 vulnérabilités moderate/high/critical |
| ESLint | `pnpm lint` | 0 erreurs / 0 warnings |
| Astro Check | `npx astro check` | 0 erreurs / 0 warnings / 0 hints |

### Variables d'environnement — Job 1

```yaml
env:
  SITE_URL: ${{ vars.SITE_URL }}
```

**Runtime estimé** : ~1 min

---

## Job 2 : `unit-tests`

### Service PostgreSQL

```yaml
services:
  postgres:
    image: postgres:16
    env:
      POSTGRES_USER: test
      POSTGRES_PASSWORD: test
      POSTGRES_DB: atlaselle_test
    ports: ['5432:5432']
    options: >-
      --health-cmd pg_isready
      --health-interval 10s
      --health-timeout 5s
      --health-retries 5
```

### Variables d'environnement — Job 2

```yaml
env:
  DATABASE_URL_LOCAL: postgresql://test:test@localhost:5432/atlaselle_test
  DB_ENV: LOCAL
  NODE_ENV: test
  BETTER_AUTH_SECRET: ${{ secrets.BETTER_AUTH_SECRET }}
  BETTER_AUTH_URL: ${{ vars.BETTER_AUTH_URL }}
  SITE_URL: ${{ vars.SITE_URL }}
  SMTP_PROVIDER: NODEMAILER
  SMTP_FROM_EMAIL: ci@test.local
  SMTP_HOST: localhost
```

### Étapes

| Étape | Commande | Ce qu'elle fait |
| :-- | :-- | :-- |
| Checkout | `actions/checkout@v6` | Clone le repo |
| pnpm + Node | Setup toolchain | pnpm 10, Node 22 |
| Install | `pnpm install --frozen-lockfile` | Dépendances |
| Migrations | `pnpm db:migrate` | Applique les migrations sur la DB de test |
| Vitest | `pnpm test -- --coverage` | Tests unit + intégration + coverage |
| Generate Report | `pnpm test:report` | Génère `tests/reports/vitest-report.txt` depuis le JSON |
| Artifact | `actions/upload-artifact@v7` | Upload `tests/reports/vitest-*` (7 jours) |

**Runtime estimé** : ~2 min

### Ce qui est testé

- 102 fichiers unitaires + 15 fichiers d'intégration sur disque (auth, audit, export, middleware, org, DB health, CMS, navigation, contact, blog, services…)
- `NODE_ENV=test` → aucun email SMTP envoyé

---

## Job 3 : `e2e-tests`

**Dépendances** : attend que `lint-and-check` ET `unit-tests` soient OK.

### Service PostgreSQL — Job 3

```yaml
services:
  postgres:
    image: postgres:16
    env:
      POSTGRES_USER: test
      POSTGRES_PASSWORD: test
      POSTGRES_DB: atlaselle_e2e    # ← DB séparée pour E2E
    ports: ['5432:5432']
```

### Variables d'environnement — Job 3

```yaml
env:
  DATABASE_URL_LOCAL: postgresql://test:test@localhost:5432/atlaselle_e2e
  DB_ENV: LOCAL
  NODE_ENV: test
  BETTER_AUTH_SECRET: ${{ secrets.BETTER_AUTH_SECRET }}
  BETTER_AUTH_URL: http://localhost:4321
  SITE_URL: ${{ vars.SITE_URL }}
  SMTP_PROVIDER: NODEMAILER
  SMTP_FROM_EMAIL: ci@test.local
  SMTP_HOST: localhost
```

### Étapes — Job 3

| Étape | Commande | Ce qu'elle fait |
| :-- | :-- | :-- |
| Checkout | `actions/checkout@v6` | Clone le repo |
| pnpm + Node | Setup toolchain | pnpm 10, Node 22 |
| Install | `pnpm install --frozen-lockfile` | Dépendances |
| Playwright | `npx playwright install --with-deps chromium firefox webkit` | Installe les 3 navigateurs déclarés dans `playwright.config.ts` |
| Migrations | `pnpm db:migrate` | Migrations sur `atlaselle_e2e` |
| Build | `pnpm build` | Build Astro SSR complet |
| E2E | `pnpm test:e2e` | 6 specs Playwright sur Chromium + Firefox + WebKit |
| Generate Report | `pnpm test:e2e:report` | Génère `tests/reports/playwright-report.txt` depuis le JSON |
| Artifact | `actions/upload-artifact@v7` | Upload `tests/reports/playwright/` (7 jours) |

**Runtime estimé** : ~3-4 min

### Retries & Workers

- **Workers** : 1 toujours (séquentiel local + CI pour stabilité)
- **Retries** : 2 en CI (1 en local)
- **Artifact** : rapport HTML uploadé même si le job échoue (`if: ${{ !cancelled() }}`)

---

## Job 4 : `a11y-perf`

**Dépendances** : `needs: [lint-and-check, unit-tests]` (tourne après unit-tests, en parallèle avec `e2e-tests`).

### Service PostgreSQL — Job 4

```yaml
services:
  postgres:
    image: postgres:16
    env:
      POSTGRES_USER: test
      POSTGRES_PASSWORD: test
      POSTGRES_DB: atlaselle_test
    ports: ['5432:5432']
```

### Variables d'environnement — Job 4

```yaml
env:
  DATABASE_URL_LOCAL: postgresql://test:test@localhost:5432/atlaselle_test
  DB_ENV: LOCAL
  NODE_ENV: test
  BETTER_AUTH_SECRET: ${{ secrets.BETTER_AUTH_SECRET }}
  BETTER_AUTH_URL: http://localhost:4321
  SITE_URL: ${{ vars.SITE_URL }}
  SMTP_PROVIDER: NODEMAILER
  SMTP_FROM_EMAIL: ci@test.local
  SMTP_HOST: localhost
```

> Note : `BETTER_AUTH_URL` est hardcodé à `http://localhost:4321` car le serveur preview tourne sur la même machine CI.

### Étapes — Job 4

| Étape | Commande | Ce qu'elle fait |
| :-- | :-- | :-- |
| Checkout | `actions/checkout@v6` | Clone le repo |
| pnpm + Node | Setup toolchain | pnpm 10, Node 22 |
| Install | `pnpm install --frozen-lockfile` | Dépendances |
| Chrome | `npx playwright install --with-deps chromium` | Installe Chromium (utilisé par Pa11y + LHCI) |
| Migrations | `pnpm db:migrate` | Applique les migrations |
| Build | `pnpm build` | Build Astro SSR complet |
| Start Server | `pnpm preview &` | Lance le serveur en arrière-plan |
| Wait | `npx wait-on http://localhost:4321 --timeout 30000` | Attend que le serveur soit prêt |
| Setup | `pnpm a11y:setup` | Seed 2 users (normal + admin) + export cookies |
| Pa11y-ci | `pnpm a11y:pa11y` | **60 URLs** — WCAG2AAA non strict (ignore color-contrast), axe runner |
| LHCI Public | `pnpm a11y:lighthouse` | **32 URLs** publiques — ≥0.9 gates |
| LHCI Rename | `pnpm a11y:lighthouse:rename` | Renomme les rapports en noms lisibles |
| LHCI Authed | `pnpm a11y:lighthouse:authed` | **8 user + 20 admin URLs** — ≥0.9 gates |
| LHCI Rename | `pnpm a11y:lighthouse:rename` | Renomme les rapports authentifiés |
| Generate Report | `pnpm a11y:report` | Génère `tests/reports/lighthouse-report.txt` (scores, CWV, audits) |
| Teardown | `pnpm a11y:teardown` | Supprime les users seed (`if: always()`) |
| Artifact LHCI | `actions/upload-artifact@v7` | Upload `.lighthouseci/` (7 jours) |
| Artifact Reports | `actions/upload-artifact@v7` | Upload `tests/reports/` (7 jours) |

**Runtime estimé** : ~5-8 min

### Détails Pa11y-ci

- **Standard** : WCAG2AAA non strict (`ignore: ['color-contrast']` + `hideElements`)
- **Runner** : axe (plus fiable que default htmlcs)
- **URLs** : 60 (4 locales × 15 pages : homepage + about + contact + legal + blog + 3 auth + dashboard + profile + 5 admin)
- **Chrome** : détecte automatiquement le Chromium de Playwright

### Détails Lighthouse CI

- **Gates** : ≥ 0.9 sur performance, accessibility, best-practices, SEO
- **Preset** : desktop
- **Runs** : 1 par URL (CI, pas besoin de médiane)
- **3 batches** :
  1. Public (32 URLs) — pas de cookie
  2. Authenticated (8 URLs) — cookie user via fichier config temporaire
  3. Admin (20 URLs) — cookie admin via fichier config temporaire
- **Upload** : `temporary-public-storage` (liens publics dans les logs)
- **Rapports** : renommés en noms lisibles (`fr--home.html`, `ar--auth--sign-in.html`)

---

## Résumé des compteurs CI

| Métrique | Valeur |
| :-- | :-- |
| Jobs | 6 (4 qualité + deploy + summary) |
| Tests Vitest | 102 fichiers unit + 15 fichiers integ sur disque |
| Tests Playwright | 6 specs × 3 navigateurs |
| URLs Pa11y | 60 (WCAG2AAA non strict) |
| URLs Lighthouse | 60 (32 public + 8 authed + 20 admin) |
| **Total validations CI** | **Vitest + E2E (6 specs × 3) + 120 audits a11y/perf** |
| PostgreSQL | v16 (3 DBs : `atlaselle_test` ×2 + `atlaselle_e2e`) |
| Node | v22 |
| pnpm | v10 |
| Navigateur | Chromium (Playwright managed) |
| Rapports | Vitest (txt+JSON, 7j) + Playwright HTML+JSON (7j) + Lighthouse HTML (7j) + A11y Reports (7j) |

---

## Secrets & Variables GitHub

### Secrets (Settings → Secrets → Actions)

| Secret | Valeur | Usage |
| :-- | :-- | :-- |
| `BETTER_AUTH_SECRET` | Clé ≥32 caractères pour better-auth | Jobs 2, 3, 4 |

### Variables (Settings → Variables → Actions)

| Variable | Valeur | Usage |
| :-- | :-- | :-- |
| `BETTER_AUTH_URL` | `http://localhost:4321` | Job 2 uniquement |
| `SITE_URL` | `http://localhost:4321` | Jobs 1, 2, 3, 4 |

### Valeurs non sensibles (hardcodées dans ci.yml)

| Variable | Source | Sensible ? |
| :-- | :-- | :-- |
| `DATABASE_URL_LOCAL` | Hardcodé dans `ci.yml` | Non (DB éphémère) |
| `NODE_ENV` | `test` | Non |
| `SMTP_PROVIDER` / `SMTP_FROM_EMAIL` / `SMTP_HOST` | Hardcodés | Non (SMTP ignoré en mode test) |

> **1 secret GitHub** (`BETTER_AUTH_SECRET`) et **2 variables** (`BETTER_AUTH_URL`, `SITE_URL`) sont nécessaires. Les jobs preview (`e2e-tests`, `a11y-perf`) forcent néanmoins `BETTER_AUTH_URL=http://localhost:4321` pour rester cohérents avec le serveur lancé dans la CI.

---

## Flux d'exécution

```text
                lint-and-check (~1 min)
                       │
            ┌──────────┼──────────┐
            ▼                     ▼
    unit-tests (~2 min)    a11y-perf (~5 min)
            │                     │
            ▼                     │
    e2e-tests (~3 min)            │
            │                     │
            ▼                     ▼
         ✅ Done                ✅ Done
```

> `e2e-tests` dépend de `lint-and-check` + `unit-tests`.
> `a11y-perf` dépend uniquement de `lint-and-check` et tourne en parallèle avec `unit-tests` + `e2e-tests`.
