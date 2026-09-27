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
    │       SITE_URL = http://localhost:4321          │
    │                                                 │
    ├── [2] unit-tests ──────────────────────────────┐│
    │       Vitest (unit + integration)               ││
    │       SITE_URL = BETTER_AUTH_URL = :4321        ││
    │       PostgreSQL 16 service container          ││
    │       Migrations + infra + seeds + tests       ││
    │                                                ├┤
    ├── [3] e2e-tests (needs: [lint-and-check, unit-tests]) ─┘│
    │       Playwright (28 specs x 3 browsers)        │
    │       SITE_URL = BETTER_AUTH_URL = :4322        │
    │       PostgreSQL 16 service container           │
    │       Build + e2e-server.mjs (PORT 4322)        │
    │                                                 │
    └── [4] a11y-perf (needs: [lint-and-check, unit-tests]) ─┘
            Pa11y-ci (WCAG2AAA non strict, 60 URLs)
            Lighthouse CI (60 URLs : 32 + 8 + 20, ≥0.9 gates)
            SITE_URL = BETTER_AUTH_URL = :4321
            PostgreSQL 16 service container
            Build + serve-compressed.mjs (défaut 4321)

  Puis : `deploy` (needs: [unit-tests, e2e-tests, a11y-perf], push sur `main` uniquement)
        + `ci-summary`.
```

### Une job, une origine servie — `SITE_URL` fail-closed

`astro.config.mjs` et `vitest.config.ts` sont tous deux **fail-closed** sur `SITE_URL` : variable absente, invalide, portant un chemin, ou en `http:` sur un hôte non local → **échec du chargement de la configuration**, avant tout travail. `astro.config.mjs` dérive de cette variable `site`, `security.allowedDomains` et l'index de sitemap ; Astro la gèle dans `import.meta.env.SITE`, que `src/pages/sitemap-cms.xml.ts` refuse de deviner.

| Job | `SITE_URL` | `BETTER_AUTH_URL` | Port réellement écouté | Justification |
| :-- | :-- | :-- | :-- | :-- |
| `lint-and-check` | `http://localhost:4321` | — | aucun | Le job ne démarre rien : l'origine est **inerte**, mais elle ne peut plus être vide (`astro check` charge la config) |
| `unit-tests` | `http://localhost:4321` | `http://localhost:4321` | aucun | La suite construit ses requêtes sur `http://localhost:4321` ; les deux variables sont épinglées ensemble |
| `e2e-tests` | `http://localhost:4322` | `http://localhost:4322` | **4322** | `scripts/e2e-server.mjs` : `PORT = 4322`, `HOST = 'localhost'` (constantes). `playwright.config.ts` `baseURL` et `webServer.url` valent `http://localhost:4322`, et `tests/e2e/api-endpoints.spec.ts` envoie `Origin: http://localhost:4322` |
| `a11y-perf` | `http://localhost:4321` | `http://localhost:4321` | **4321** | `pnpm preview` = `node scripts/serve-compressed.mjs` **sans** `HOST`/`PORT` dans ce job → défauts `0.0.0.0:4321`. `npx wait-on http://localhost:4321`, `.pa11yci.cjs` et `lighthouserc.cjs` (via `A11Y_BASE_URL`) et `tests/a11y/setup.ts` visent tous cette origine |
| `deploy` | `${{ vars.SITE_URL }}` | `${{ vars.BETTER_AUTH_URL }}` | — | Seul job à produire un artefact déployable : il garde l'**origine publique** |

> **Correction apportée** : deux jobs avaient des origines divergentes, dont **aucune n'était celle réellement testée**. `e2e-tests` portait `BETTER_AUTH_URL: http://localhost:4321` — le port de preview du job a11y — pendant que `SITE_URL` valait l'origine publique, alors que le serveur testé écoute sur 4322. `a11y-perf` et `unit-tests` pouvaient résoudre `SITE_URL` vers autre chose que la page auditée ou testée. Chaque job sert désormais une origine locale correspondant au port qu'il écoute réellement, `SITE_URL` et `BETTER_AUTH_URL` étant épinglées ensemble pour qu'un job ne puisse plus décrire deux origines différentes.
>
> `http:` est **accepté** par `astro.config.mjs` sur un hôte loopback uniquement — c'est ce qui rend ces valeurs locales légales. Les valeurs ne sont pas lues depuis un fichier `.env` : ni le chargeur de config d'Astro ni Vitest ne le consultent pour `SITE_URL`, qui doit être dans l'environnement du processus.

### Le job `deploy` refuse un artefact figé sur une origine locale

`deploy` est le seul job qui produit un artefact déployable, donc le seul à garder l'origine publique. Il est protégé par **deux gardes**, l'une **avant** le build, l'autre **après**.

**Garde 1 — `Guard - public origin is resolvable (fail-closed)`**, exécutée **avant** `pnpm build`. Échoue explicitement (`::error::` + `exit 1`) si :

| Condition | Raison du refus |
| :-- | :-- |
| `SITE_URL` vide | La variable de dépôt `vars.SITE_URL` s'expande en chaîne vide quand elle n'est pas définie — et elle a été observée vide dans `tests/reports/qa-full.log` |
| `SITE_URL` n'est pas une URL absolue | — |
| `SITE_URL` pointe sur un hôte loopback | *« A deployable artifact must never be frozen from a dev origin. »* |
| `SITE_URL` n'est pas en `https:` | — |
| `SITE_URL` porte un chemin | — |
| `BETTER_AUTH_URL` vide / non absolue / protocole autre que http(s) / portant un chemin | better-auth n'a pas d'URL de base pour construire les liens de vérification, de reset et d'invitation |

Aucune étape n'est exécutée avant ces vérifications : **rien n'est construit, aucun artefact n'est uploadé**.

**Garde 2 — `Guard - artifact is frozen on the public origin`**, exécutée **après** `pnpm build` :

1. exige que `dist/client/sitemap-index.xml` existe — sans lui, l'origine figée dans l'artefact est invérifiable, et l'upload est refusé ;
2. exige que cet index référence l'origine publique validée par la garde 1 ;
3. refuse tout `dist/client/sitemap*.xml` contenant une origine loopback (`localhost`, `127.x`, `0.0.0.0`, `[::1]`).

> La recherche de loopback est **volontairement limitée aux XML de sitemap générés**. `dist/server/chunks/` contient un repli de niveau source (`src/modules/email-voyage/domain/voyage-email-worker.ts` lit `process.env.SITE_URL ?? "http://localhost:4321"`), donc une recherche sur l'ensemble du bundle signalerait une origine de dev sur **tout** build de production légitime. Les fichiers `sitemap*.xml` sont générés depuis `site` seul.

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
  # Pas de serveur dans ce job : l'origine est inerte. Mais `npx astro check`
  # charge astro.config.mjs, qui est fail-closed, et ni le chargeur de config
  # d'Astro ni .env ne sont consultés avant cette évaluation. La variable de
  # dépôt vars.SITE_URL a été observée vide, ce qui ferait échouer le job au
  # chargement de la config. Valeur épinglée, donc plus jamais vide.
  SITE_URL: http://localhost:4321
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
  BETTER_AUTH_URL: http://localhost:4321
  SITE_URL: http://localhost:4321
  SMTP_PROVIDER: NODEMAILER
  SMTP_FROM_EMAIL: ci@test.local
  SMTP_HOST: localhost
```

> `vitest.config.ts` impose le même contrat fail-closed qu'`astro.config.mjs` : `src/pages/sitemap-cms.xml.ts` lit `import.meta.env.SITE` (gelé par Astro depuis `site`) et refuse de publier sans origine. `SITE_URL` doit donc être dans l'environnement du processus **avant** que Vitest n'évalue sa config. La suite conduit ses requêtes sur `http://localhost:4321` : `SITE_URL` et `BETTER_AUTH_URL` sont épinglées ensemble à cette origine, pour qu'aucune variable de dépôt ne puisse en laisser une vide et que les deux ne puissent plus décrire deux origines différentes dans un même job.

### Étapes

| Étape | Commande | Ce qu'elle fait |
| :-- | :-- | :-- |
| Checkout | `actions/checkout@v6` | Clone le repo |
| pnpm + Node | Setup toolchain | pnpm 10, Node 22 |
| Install | `pnpm install --frozen-lockfile` | Dépendances |
| Migrations | `pnpm db:migrate` | Applique les migrations sur la DB de test |
| Infra SQL | `pnpm db:infra` | Indexes et triggers |
| Seeds | `pnpm db:seed` | Données de test (idempotent, requis par l'intégration) |
| Vitest | `pnpm test -- --coverage` | Tests unit + intégration + coverage |
| Generate Report | `pnpm test:report` | Génère `tests/reports/vitest-report.txt` depuis le JSON |
| Artifact | `actions/upload-artifact@v7` | Upload `tests/reports/vitest-*` (7 jours) |

**Runtime estimé** : ~2 min

### Ce qui est testé

- **129 fichiers unitaires + 45 fichiers d'intégration** sur disque (auth, audit, export, middleware, DB health, CMS, navigation, contact, blog, services, voyage…) — **1 907 tests** au total
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
  BETTER_AUTH_URL: http://localhost:4322
  SITE_URL: http://localhost:4322
  SMTP_PROVIDER: NODEMAILER
  SMTP_FROM_EMAIL: ci@test.local
  SMTP_HOST: localhost
```

> **Port 4322, pas 4321.** Le serveur testé est `scripts/e2e-server.mjs`, lancé par `playwright.config.ts` (`webServer.command`) avec `HOST=localhost`, `PORT=4322`. `playwright.config.ts` `baseURL` et `webServer.url`, `tests/helpers/actions.ts` et chaque `tests/e2e/*.spec.ts` visent `http://localhost:4322`, et `tests/e2e/api-endpoints.spec.ts` envoie `Origin: http://localhost:4322` sur ses requêtes mutantes. Les deux variables sont donc épinglées à l'origine que ce job sert réellement. `BETTER_AUTH_URL` valait auparavant `http://localhost:4321` (le port de preview du job a11y) pendant que `SITE_URL` valait l'origine publique : deux origines dans un même job, dont aucune n'était celle sous test.

### Étapes — Job 3

| Étape | Commande | Ce qu'elle fait |
| :-- | :-- | :-- |
| Checkout | `actions/checkout@v6` | Clone le repo |
| pnpm + Node | Setup toolchain | pnpm 10, Node 22 |
| Install | `pnpm install --frozen-lockfile` | Dépendances |
| Playwright | `npx playwright install --with-deps chromium firefox webkit` | Installe les 3 navigateurs déclarés dans `playwright.config.ts` |
| Migrations | `pnpm db:migrate` | Migrations sur `atlaselle_e2e` |
| Infra SQL | `pnpm db:infra` | Indexes et triggers |
| Seeds | `pnpm db:seed` | Données de test (idempotent) |
| Build | `pnpm build` | Build Astro SSR complet |
| E2E | `pnpm test:e2e` | **28 specs** Playwright sur Chromium + Firefox + WebKit |
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
  SITE_URL: http://localhost:4321
  SMTP_PROVIDER: NODEMAILER
  SMTP_FROM_EMAIL: ci@test.local
  SMTP_HOST: localhost
```

> **Une job, une origine.** `pnpm preview` est `node scripts/serve-compressed.mjs` **sans** `HOST`/`PORT` dans ce job, donc il écoute sur ses défauts (`0.0.0.0:4321`). `npx wait-on http://localhost:4321` attend exactement cela ; `.pa11yci.cjs` et `lighthouserc.cjs` construisent leurs listes d'URL depuis `A11Y_BASE_URL` (défaut `http://localhost:4321`), et `tests/a11y/setup.ts` s'authentifie contre `BETTER_AUTH_URL`. `SITE_URL` et `BETTER_AUTH_URL` sont épinglées à cette même origine loopback. Auparavant, les deux pouvaient résoudre à autre chose (vide ou publique) **pour les pages mêmes que ce job audite**.

### Étapes — Job 4

| Étape | Commande | Ce qu'elle fait |
| :-- | :-- | :-- |
| Checkout | `actions/checkout@v6` | Clone le repo |
| pnpm + Node | Setup toolchain | pnpm 10, Node 22 |
| Install | `pnpm install --frozen-lockfile` | Dépendances |
| Chrome | `npx playwright install --with-deps chromium` | Installe Chromium (utilisé par Pa11y + LHCI) |
| Migrations | `pnpm db:migrate` | Applique les migrations |
| Infra SQL | `pnpm db:infra` | Indexes et triggers |
| Seeds | `pnpm db:seed` | Contenus de test (idempotent, requis par les pages auditées) |
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

## Job 5 : `deploy`

**Dépendances** : `needs: [unit-tests, e2e-tests, a11y-perf]`. Condition : `github.ref == 'refs/heads/main' && github.event_name == 'push'`.

### Variables d'environnement — Job 5

```yaml
env:
  SITE_URL: ${{ vars.SITE_URL }}          # origine PUBLIQUE
  BETTER_AUTH_SECRET: ${{ secrets.BETTER_AUTH_SECRET }}
  BETTER_AUTH_URL: ${{ vars.BETTER_AUTH_URL }}
```

> Seul job à produire un artefact déployable, donc seul job à garder l'**origine publique** : les autres ne font que servir et auditer un site local. Les deux gardes (§ « Une job, une origine servie ») transforment une variable de dépôt vide — GitHub l'expande en chaîne vide, et elle a été observée vide — en **échec nommé et explicite**, plutôt qu'en trace d'exécution au build, ou pire, en `dist/` dont les canoniques, sitemaps et emails portent une origine de dev.

### Étapes — Job 5

| Étape | Ce qu'elle fait |
| :-- | :-- |
| Checkout + pnpm + Node + Install | Toolchain |
| **Guard 1** — `public origin is resolvable (fail-closed)` | Refuse origine vide, non absolue, loopback, non-`https:`, ou portant un chemin ; refuse `BETTER_AUTH_URL` vide / invalide. **Avant** le build : rien n'est construit, rien n'est uploadé. |
| Production Build | `pnpm build` |
| **Guard 2** — `artifact is frozen on the public origin` | Exige `dist/client/sitemap-index.xml`, exige qu'il référence l'origine validée, refuse tout `sitemap*.xml` contenant une origine loopback. **Après** le build, avant l'upload. |
| Upload Build Artifact | `actions/upload-artifact@v7`, `dist/`, 14 jours |
| Deploy | **Placeholder commented** — la livraison vers un hébergeur reste à configurer |

---

## Résumé des compteurs CI

| Métrique | Valeur |
| :-- | :-- |
| Jobs | 6 (4 qualité + deploy + ci-summary) |
| Fichiers de tests Vitest | **129 unit + 45 integration = 174** sur disque |
| Tests Vitest | **1 907**, 100 % verts |
| Specs Playwright | **28** × 3 navigateurs |
| Tests E2E (blocs `test()`) | **269** blocs de test, joués sur les 3 navigateurs selon `playwright.config.ts` |
| URLs Pa11y | 60 (WCAG2AAA non strict) |
| URLs Lighthouse | 60 (32 public + 8 authed + 20 admin) |
| **Total validations CI** | **Vitest (1 907) + E2E (28 specs × 3 navigateurs) + 120 audits a11y/perf** |
| PostgreSQL | v16 (3 services : `atlaselle_test` ×2 + `atlaselle_e2e`) |
| Node | v22 |
| pnpm | v10 |
| Navigateur | Chromium (Playwright managed) |
| Rapports | Vitest (txt+JSON, 7j) + Playwright HTML+JSON (7j) + Lighthouse HTML (7j) + A11y Reports (7j) |
| Artefact de production | `dist/`, 14 j, **jamais** figé sur une origine loopback (Guard 2) |

> Les compteurs de fichiers et de tests sont recomptés à partir de `tests/**`, pas repris d'un autre document.

---

## Secrets & Variables GitHub

### Secrets (Settings → Secrets → Actions)

| Secret | Valeur | Usage |
| :-- | :-- | :-- |
| `BETTER_AUTH_SECRET` | Clé ≥32 caractères pour better-auth | Jobs 2, 3, 4, 5 |

### Variables de dépôt (Settings → Variables → Actions)

| Variable | Usage | Valeur attendue |
| :-- | :-- | :-- |
| `vars.SITE_URL` | **Job `deploy` uniquement** | Origine publique `https://`, sans chemin, **non loopback** |
| `vars.BETTER_AUTH_URL` | **Job `deploy` uniquement** | URL absolue `http(s)`, sans chemin |

### Variables épinglées dans `ci.yml` (aucune variable de dépôt)

| Variable | Valeur | Jobs | Raison |
| :-- | :-- | :-- | :-- |
| `SITE_URL` | `http://localhost:4321` | 1, 2, 4 | Origine inerte (job 1) ou origine réellement servie (jobs 2 et 4) |
| `SITE_URL` | `http://localhost:4322` | 3 | Port réellement écouté par `e2e-server.mjs` |
| `BETTER_AUTH_URL` | `http://localhost:4321` | 2, 4 | Idem `SITE_URL` |
| `BETTER_AUTH_URL` | `http://localhost:4322` | 3 | Idem `SITE_URL` |

### Valeurs non sensibles (hardcodées dans `ci.yml`)

| Variable | Source | Sensible ? |
| :-- | :-- | :-- |
| `DATABASE_URL_LOCAL` | Hardcodé dans `ci.yml` | Non (DB éphémère) |
| `DB_ENV` | `LOCAL` | Non |
| `NODE_ENV` | `test` | Non |
| `SMTP_PROVIDER` / `SMTP_FROM_EMAIL` / `SMTP_HOST` | Hardcodés | Non (SMTP ignoré en mode test) |

> **1 secret GitHub** et **2 variables de dépôt**, ces deux dernières **uniquement pour le job `deploy`**. Les quatre jobs de qualité n'utilisent aucune variable de dépôt pour leur origine : elle est épinglée dans `ci.yml` au port que le job sert réellement, précisément parce qu'une variable de dépôt a été observée vide et que les deux configs (`astro.config.mjs`, `vitest.config.ts`) sont fail-closed.

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
