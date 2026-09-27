# Testing — Rapport & Index

> **Projet** : Atlaselle  
> **Stack** : Astro 7.3.1 + better-auth + Drizzle/PostgreSQL + Vitest + Playwright + Pa11y + Lighthouse  
> **Couverture globale** : **129 fichiers unit + 45 fichiers integration = 174 fichiers Vitest, 1 907 tests** · **28 specs e2e** (269 blocs de test × 3 navigateurs) · **60 URLs a11y** · **60 URLs Lighthouse** (32 + 8 + 20) · **28 URLs de sitemap** hors contenu · **5 générateurs de rapports**  
> **Dernière mise à jour** : 26/09/2026

> **Compteurs** : tous recomptés à partir des fichiers, jamais repris d'un autre document. Un compteur qui apparaît dans deux documents est un **défaut**, pas une recopie : chaque document porte le sien, et l'en-tête comme le corps de ce fichier disent la même chose. Historique des valeurs périmées, citées ici **pour mémoire et uniquement ici** : `102 / 15 fichiers`, `6 specs`, `165 fichiers`, `1 763 tests`, `128 fichiers unit`, `173 fichiers`, `1 861 tests`, `27 specs`, `404 blocs`. Aucune de ces valeurs ne doit réapparaître ailleurs.

---

## Table des matières

| Document | Contenu |
| :-- | :-- |
| [setup.md](setup.md) | Installation, configuration Vitest/Playwright, scripts, CI/CD |
| [unit.md](unit.md) | Tests unitaires — détail de chaque test, matrice de couverture |
| [integration.md](integration.md) | Tests d'intégration — better-auth testUtils, sessions, admin, orgs, audit, export |
| [e2e.md](e2e.md) | Tests E2E Playwright — pages publiques, guards, auth flow, global-setup |
| [a11y.md](a11y.md) | **Accessibilité & Performance** — Pa11y-ci (WCAG AAA) + Lighthouse CI |
| [ci.md](ci.md) | Pipeline GitHub Actions — 4 jobs qualité + deploy + summary |
| [gaps.md](gaps.md) | **Failles & manques** — tout ce qui reste à tester, par priorité |

---

## Résumé des résultats

### Par type de test

| Type | Fichiers | Tests | Status |
| :-- | --: | --: | :-- |
| Unit | **129** | — | ✅ |
| Integration | **45** | — | ✅ |
| **Vitest (total)** | **174** | **1 907** | ✅ 100 % verts |
| E2E (Playwright) | **28 specs** × 3 navigateurs | **269** blocs `test()` | ✅ Chromium + Firefox + WebKit |
| A11y — Pa11y-ci (WCAG2AAA non strict) | 1 config | **60 URLs** (32 publiques + 8 authentifiées + 20 admin) | ✅ |
| A11y — Lighthouse CI | 3 batches | **60 URLs** (32 + 8 + 20) | ✅ |
| Sitemap — `GET /sitemap-cms.xml` | 1 endpoint | **28 URLs** hors contenu | ✅ |

### Les 28 specs E2E

`actions-admin`, `actions-blog`, `actions-matrix`, `actions-services`, `actions-voyage`, `admin-extended`, `admin-pages`, `admin-trips-crud`, `api-endpoints`, `app`, `auth`, `auth-account`, `blog`, `blog-deep`, **`blog-review-rating-a11y`**, `cms-admin`, `cms-deep`, `contact`, **`credential-url-leak`**, **`error-paths-security`**, `guest-journeys`, `i18n-routes`, `public-pages`, `services`, `services-deep`, `services-lifecycle`, `ux-flows`, `voyage` — plus `global-setup.ts` et `global-teardown.ts`, qui ne sont pas des specs.

> **269 blocs `test()`** : décompte des déclarations `test(` et `test.skip(` dans `tests/e2e/*.spec.ts`. Les 111 `test.describe(` et les 26 crochets (`beforeEach`, `beforeAll`, `afterAll`) ne sont pas des tests et ne sont pas comptés. Chaque bloc est joué sur les 3 navigateurs.
>
> **`credential-url-leak.spec.ts`** porte l'invariant « les identifiants n'atteignent jamais une URL » : URL finale, `location.href`, `document.referrer`, requête soumise, cible, corps, Referer, et soumission **sans JavaScript**. Voir [security.md](../security.md) §11.
>
> **`error-paths-security.spec.ts`** couvre les sorties précoces du middleware et leurs en-têtes.
>
> **`blog-review-rating-a11y.spec.ts`** couvre la notation d'avis et le rendu du résumé accessible. Il porte le `test.setTimeout(120_000)` le plus long de la suite (`blog-review-rating-a11y.spec.ts:176`).

### Le nombre d'URL de sitemap — 28 hors contenu, plus le contenu

`src/pages/sitemap-cms.xml.ts` est un endpoint d'exécution (`prerender = false`) : son volume dépend de ce qui est en base. Seul le squelette est déterministe.

| Bloc | URLs | Dérivation |
| :-- | --: | :-- |
| Accueil | **4** | une par locale (`LOCALES`, 4 locales) |
| Routes communes | **12** | 4 locales × `Object.values(commonT.pageRoutes)` = 4 × 3 (`about`, `contact`, `legal`) |
| Listes blog / services / voyages | **12** | 4 locales × 3 (listing blog, listing services, base voyages) |
| **Squelette déterministe** | **28** | indépendant du contenu |
| Pages CMS, catégories/tags/articles de blog, catégories/tags/services, voyages | **variable** | une URL par enregistrement publié, par locale |

**Formule** : `URLs = 28 + (pages CMS + articles + catégories + tags + services + voyages) × 4 locales`.

> Ne pas citer un total de sitemap sans préciser qu'il dépend du contenu en base. **28** est le seul chiffre reproductible à partir du code ; c'est lui qui est employé dans les gates CI, où la seule présence de `dist/client/sitemap-index.xml` et son origine sont vérifiées (voir [security.md](../security.md) §10).

### Coverage v8 (seuils vitest.config.ts)

| Métrique | Résultat | Seuil | Status |
| :-- | --: | --: | :-- |
| Statements | 90.22% | 80% | ✅ |
| Branches | 80.70% | 75% | ✅ |
| Functions | 85.03% | 75% | ✅ |
| Lines | 90.76% | 80% | ✅ |

### Fichiers support

| Fichier | Rôle |
| :-- | :-- |
| `tests/helpers/auth.ts` | Helper partagé : `getTestHelpers()`, ré-exporte `auth` |
| `tests/e2e/global-setup.ts` | Seed un user vérifié admin avant les E2E |
| `tests/e2e/global-teardown.ts` | Supprime le seed user après les E2E |
| `tests/a11y/setup.ts` | Seed 2 users (normal + admin) + export cookies pour Pa11y/LHCI |
| `tests/a11y/run.cjs` | Orchestrateur : build + serveur + audits + teardown |
| `tests/a11y/lhci-authed.cjs` | Exécute LHCI pour les pages authentifiées/admin |
| `tests/a11y/lhci-rename.cjs` | Renomme les rapports LHCI en noms lisibles |
| `tests/helpers/vitest-report.cjs` | Génère `tests/reports/vitest-report.txt` depuis le JSON Vitest |
| `tests/helpers/playwright-report.cjs` | Génère `tests/reports/playwright-report.txt` depuis le JSON Playwright |
| `tests/helpers/lighthouse-report.cjs` | Génère `tests/reports/lighthouse-report.txt` (scores, CWV, audits échoués) |
| `.pa11yci.cjs` | Configuration Pa11y-ci (60 URLs, WCAG2AAA non strict, axe) |
| `lighthouserc.cjs` | Configuration Lighthouse CI (32 URLs publiques collectées + 8 + 20 via batches, ≥0.9 gates) |

### Par module source — Couverture v8

| Module | Stmts | Branches | Funcs | Lines | Détail |
| :-- | --: | --: | --: | --: | :-- |
| `src/actions/admin/` | 90.56% | 75.81% | 86.11% | 91.26% | 10 actions, 70+ tests unitaires |
| `src/lib/` | 92.15% | 89.88% | 90.00% | 94.11% | audit, rate-limit, sanitize, store, theme-tokens |
| `src/i18n/` | 100% | 100% | 100% | 100% | config + utils |
| `src/database/` | 89.69% | 79.06% | 95.00% | 89.41% | cache, env, schemas |
| `src/database/loaders/` | 88.67% | 86.36% | 66.66% | 87.23% | navigation.loader |
| `src/database/schemas/` | 77.52% | 100% | 67.21% | 75.00% | déclaratif Drizzle |
| `src/media/` | 92.22% | 80.95% | 100% | 94.04% | upload, delete, list |

---

## Matrice complète : Fonction → Test

### `src/lib/` — Services & Utilitaires

| Fonction | Fichier source | Type | Test | Status |
| :-- | :-- | :-- | :-- | :-- |
| `checkRateLimit(key, opts)` | `src/lib/rate-limit.ts` | Pure | `tests/unit/rate-limit.test.ts` | ✅ 10 tests |
| `extractIp(headers, clientAddress?)` | `src/lib/audit.ts` | Pure | `tests/unit/extract-ip.test.ts` | ✅ 19 tests |
| `logAuditEvent(input)` | `src/lib/audit.ts` | Side-effect (DB) | `tests/integration/audit.test.ts` (8) + `tests/unit/audit-fallback.test.ts` (1) | ✅ 9 tests |
| `INFRA_PROXY_HEADER_REJECTED` | `src/middleware.ts` | Effet de bord | `tests/unit/voyage/middleware-forwarded-audit.test.ts` | ✅ 21 tests |
| `onRequest` (garde locale, session, en-têtes) | `src/middleware.ts` | Middleware | `tests/unit/voyage/middleware.test.ts` | ✅ 17 tests |
| `GET /api/health` (authentification) | `src/pages/api/health.ts` | Endpoint | `tests/unit/api-health-auth.test.ts` | ✅ 21 tests |
| `auth` (instance) | `src/lib/auth.ts` | Config | `tests/integration/auth.test.ts` (11) + `auth-flow.test.ts` (5) + `auth-advanced.test.ts` (10) | ✅ 26 tests |
| `authClient` | `src/lib/auth-client.ts` | Client-side | — | ❌ Non testé directement (invariant Instead couvert par `tests/e2e/credential-url-leak.spec.ts`) |

### `src/i18n/` — Internationalisation

| Fonction | Fichier source | Type | Test | Status |
| :-- | :-- | :-- | :-- | :-- |
| `toLocale(value)` | `src/i18n/utils.ts` | Pure | `tests/unit/i18n-utils.test.ts` | ✅ 2 tests |
| `isRTL(locale)` | `src/i18n/utils.ts` | Pure | `tests/unit/i18n-utils.test.ts` | ✅ 2 tests |
| `getDirection(locale)` | `src/i18n/utils.ts` | Pure | `tests/unit/i18n-utils.test.ts` | ✅ 2 tests |
| `getCommonTranslations(locale)` | `src/i18n/utils.ts` | Async import | `tests/unit/i18n-urls.test.ts` | ✅ 4 tests (×4 locales) |
| `getAuthTranslations(locale)` | `src/i18n/utils.ts` | Async import | `tests/unit/i18n-urls.test.ts` | ✅ 4 tests (×4 locales) |
| `getHomeTranslations(locale)` | `src/i18n/utils.ts` | Async import | `tests/unit/i18n-translations.test.ts` | ✅ 4 tests (×4 locales) |
| `getAboutTranslations(locale)` | `src/i18n/utils.ts` | Async import | `tests/unit/i18n-translations.test.ts` | ✅ 4 tests (×4 locales) |
| `getContactTranslations(locale)` | `src/i18n/utils.ts` | Async import | `tests/unit/i18n-translations.test.ts` | ✅ 4 tests (×4 locales) |
| `getAuthUrl(locale, pageId, t)` | `src/i18n/utils.ts` | Pure | `tests/unit/i18n-urls.test.ts` | ✅ 4 tests (×4 locales) |
| `resolveAuthSlug(slug, t)` | `src/i18n/utils.ts` | Pure | `tests/unit/i18n-urls.test.ts` | ✅ 4+1 tests |
| `getPageUrl(locale, pageId, t)` | `src/i18n/utils.ts` | Pure | `tests/unit/i18n-urls.test.ts` | ✅ 2 tests (×2 locales) |
| `resolvePageSlug(slug, t)` | `src/i18n/utils.ts` | Pure | `tests/unit/i18n-urls.test.ts` | ✅ 2+1 tests |
| `LOCALES`, `DEFAULT_LOCALE`, etc. | `src/i18n/config.ts` | Constantes | Implicitement via tous les tests i18n | ⚠️ Implicite |

### `src/database/` — Base de données

| Fonction | Fichier source | Type | Test | Status |
| :-- | :-- | :-- | :-- | :-- |
| `getDrizzle()` | `src/database/drizzle.ts` | Singleton | `tests/integration/db-health.test.ts` | ✅ 1 test (singleton) |
| `checkConnection()` | `src/database/drizzle.ts` | Health check | `tests/integration/db-health.test.ts` | ✅ 1 test (ok + latency) |
| Raw SQL query | `src/database/drizzle.ts` | Connexion | `tests/integration/db-health.test.ts` | ✅ 1 test |
| `maskUrl(url)` | `src/database/env.ts` | Pure | `tests/unit/mask-utils.test.ts` | ✅ 3 tests |
| `dbNameFromUrl(url)` | `src/database/env.ts` | Pure | `tests/unit/mask-utils.test.ts` | ✅ 3 tests |
| `formatPgError(err)` | `src/database/commands/_utils.ts` | Pure | `tests/unit/cli-utils.test.ts` | ✅ 10 tests |
| ANSI helpers (`c.green`, `c.red`) | `src/database/commands/_utils.ts` | Pure | `tests/unit/cli-utils.test.ts` | ✅ 2 tests |
| Schema exports (8 tables) | `src/database/schemas.ts` | Exports | `tests/unit/schema-validation.test.ts` | ✅ 12 tests |
| CMS schemas (7 tables) | `src/database/schemas/site.schema.ts`, `navigation.schema.ts` | Déclaratif | `tests/unit/cms-schemas.test.ts` | ✅ 80 tests |
| CMS seed data (6 fichiers) | `src/database/data/03-08` | Données | `tests/unit/cms-seeds.test.ts` | ✅ 11 tests |
| CMS loaders | `src/database/loaders/site.loader.ts`, `navigation.loader.ts` | Async DB | Indirectement via E2E | ⚠️ Implicite |
| `getPgClient()` | `src/database/drizzle.ts` | Connexion | — | ❌ Non testé |
| `shutdownDb()` | `src/database/drizzle.ts` | Cleanup | — | ❌ Non testé |

### `src/actions/admin/` — Actions CMS

| Action | Fichier source | Test unitaire | Status |
| :-- | :-- | :-- | :-- |
| `upsertSiteSettings` / `updateSiteSettings` | `site.ts` | `tests/unit/admin-site.test.ts` (6) | ✅ |
| `createSocialLink` / `update` / `delete` / `reorder` | `social.ts` | `tests/unit/admin-social.test.ts` (9) | ✅ |
| `updateContactInfo` | `contact.ts` | `tests/unit/admin-contact.test.ts` (10) | ✅ |
| `updateOpeningHours` | `hours.ts` | `tests/unit/admin-hours.test.ts` (13) | ✅ |
| `createNavigationItem` / `update` / `delete` / `reorder` | `navigation.ts` | `tests/unit/admin-navigation-items.test.ts` (11) | ✅ |
| `createTheme` / `update` / `delete` | `theme.ts` | `tests/unit/admin-theme.test.ts` (10) | ✅ |
| `createPage` / `update` / `delete` / `publish` | `pages.ts` | `tests/unit/admin-pages.test.ts` (14) | ✅ |
| `createSection` / `update` / `delete` / `reorder` | `sections.ts` | `tests/unit/admin-sections.test.ts` (15) | ✅ |
| `createMenu` / `updateMenu` / `deleteMenu` | `menus.ts` | ⚠️ E2E only | ⚠️ |
| `assertAdmin` / `adminRateLimit` / `auditAdmin` | `_helpers.ts` | Couvert via toutes les actions ci-dessus | ✅ |

### `src/smtp/` — Emails (section unique)

| Fonction | Fichier source | Type | Test | Status |
| :-- | :-- | :-- | :-- | :-- |
| `maskApiKey(key)` | `src/smtp/env.ts` | Pure | `tests/unit/mask-utils.test.ts` | ✅ 4 tests |
| `sendEmail(payload)` | `src/smtp/send.ts` | Side-effect (réseau) | `tests/unit/send-email.test.ts` | ✅ 7 tests (mock + retry) |
| `getSmtpProvider()` | `src/smtp/env.ts` | Env reader | Indirectement via `send-email` | ⚠️ Implicite |
| `getSmtpFrom()` | `src/smtp/env.ts` | Env reader | `tests/unit/smtp-env.test.ts` | ✅ 3 tests |
| `checkSmtpConfig()` | `src/smtp/env.ts` | Health probe (sans réseau) | — | ❌ Non testé |
| `getNodemailerConfig()` | `src/smtp/env.ts` | Env reader | — | ❌ Non testé |
| Autres config providers | `src/smtp/env.ts` | Env readers | — | ❌ Non testé |

### `src/middleware.ts` — Middleware Astro (section unique)

| Fonction | Fichier source | Type | Test | Status |
| :-- | :-- | :-- | :-- | :-- |
| `onRequest` — garde locale 404 / 301, rewrite, session, timeout 503, SVG | `src/middleware.ts` | Middleware | `tests/unit/voyage/middleware.test.ts` (17) | ✅ Importe `onRequest` |
| `onRequest` — point d'application unique des 10 en-têtes, y compris sur les 3 sorties précoces | `src/middleware.ts` | Middleware | `tests/unit/voyage/middleware.test.ts` | ✅ Valeurs exactes lues sur la `Response` réellement produite |
| `onRequest` — 301 construite (en-têtes mutables) | `src/middleware.ts` | Middleware | `tests/unit/voyage/middleware.test.ts` | ✅ Verrou explicite |
| `onRequest` — `reportRejectedForwardedHeaders()` | `src/middleware.ts` | Middleware | `tests/unit/voyage/middleware-forwarded-audit.test.ts` (21) | ✅ Ligne d'audit observée à la frontière de persistance |
| `auth.api.getSession({ headers })` | `src/lib/auth.ts` | Intégration DB | `tests/integration/middleware.test.ts` (4) | ⚠️ Teste la dépendance better-auth, **pas** le middleware — ne l'importe pas |
| — | — | — | `tests/unit/middleware-timeout.test.ts` (6) | ❌ **Couverture illusoire** — n'importe pas le middleware, assert des littéraux locaux dont un `max-age` HSTS divergent du produit. Voir [middleware.md](../middleware.md) §Tests |
| `getDbEnv()` / `isProd()` / `isTest()` / `isLocal()` / `getDbUrl()` / `getPoolConfig()` | `src/database/env.ts` | Env readers | — | ❌ Non testé |
| Schemas (8 tables) | `src/database/schemas/` | Déclaratif | — | ❌ Non testé |
| CLI: `db.check`, `db.migrate`, etc. | `src/database/commands/` | Scripts | — | ❌ Non testé |
| `_utils.ts` helpers | `src/database/commands/_utils.ts` | Utilitaires | — | ❌ Non testé |

### `src/pages/api/` — Routes API

| Endpoint | Fichier source | Méthode | Test | Status |
| :-- | :-- | :-- | :-- | :-- |
| `/api/auth/[...all]` | `src/pages/api/auth/[...all].ts` | ALL | `tests/integration/auth.test.ts` + `auth-flow.test.ts` | ✅ 18 tests |
| `/api/upload` | `src/pages/api/upload.ts` | POST | `tests/unit/upload.test.ts` | ✅ Indirect (unit) |
| `/api/export-data` | `src/pages/api/export-data.ts` | GET | `tests/integration/export.test.ts` | ✅ 3 tests |

### `src/media/` — Upload & Fichiers

| Fonction | Fichier source | Type | Test | Status |
| :-- | :-- | :-- | :-- | :-- |
| `processUpload(file, opts)` | `src/media/upload.ts` | I/O (disque) | `tests/unit/upload.test.ts` | ✅ 5 tests |
| `deleteUpload(url)` | `src/media/delete.ts` | I/O (disque) | `tests/unit/upload.test.ts` | ✅ 2 tests |
| `UPLOAD_DIRS`, `ALLOWED_MIME_TYPES`, `DEFAULT_MAX_SIZE` | `src/media/types.ts` | Constantes | `tests/unit/upload.test.ts` | ✅ 3 tests |
| `UploadError` | `src/media/upload.ts` | Classe | `tests/unit/upload.test.ts` | ✅ Implicite |

### `src/components/pages/` — Pages Astro

| Composant | Test E2E | Test Container | Status |
| :-- | :-- | :-- | :-- |
| `SignInPage.astro` | ✅ Form + auth flow (app + auth.spec) | — | ✅ E2E |
| `SignUpPage.astro` | ✅ Form + submit (auth.spec) | — | ✅ E2E |
| `DashboardPage.astro` | ✅ Guard redirect + auth flow (auth.spec) | — | ✅ E2E |
| `AdminStatsPage.astro` | ✅ Guard redirect | — | ⚠️ Guard seul |
| `AdminUsersPage.astro` | ✅ Guard redirect | — | ⚠️ Guard seul |
| `AdminOrgsPage.astro` | ✅ Guard redirect | — | ⚠️ Guard seul |
| `AdminAuditPage.astro` | ✅ Guard redirect | — | ⚠️ Guard seul |
| `ProfilePage.astro` | ✅ Guard redirect | — | ⚠️ Guard seul |
| `OrgMembersPage.astro` | ✅ Guard redirect (auth.spec) | — | ⚠️ Guard seul |
| `OrgSettingsPage.astro` | ✅ Guard redirect | — | ⚠️ Guard seul |
| `ForgotPasswordPage.astro` | ✅ Form visible (auth.spec) | — | ⚠️ E2E seul |
| `ResetPasswordPage.astro` | ✅ Accessible sans auth (auth.spec) | — | ⚠️ E2E seul |
| `VerifyEmailPage.astro` | ✅ Accessible sans auth (auth.spec) | — | ⚠️ E2E seul |
| `HomePage.astro` | ✅ Homepage load + i18n | — | ✅ E2E |
| `LegalPage.astro` | ✅ Charge correctement (auth.spec) | — | ✅ E2E |
| `ContactPage.astro` | ✅ Charge correctement (auth.spec) | — | ✅ E2E |
| `AboutPage` sections | ✅ Charge correctement (auth.spec) | — | ✅ E2E |

---

## Score global

```text
 Vitest (unit + intégration) :  129 + 45 = 174 fichiers sur disque, 1 907 tests
 Coverage v8 :                  seuils 80/75/75/80 (vitest.config.ts)
 Playwright E2E :               28 specs, 269 blocs test() × 3 navigateurs
 Pa11y WCAG2AAA non strict :    60 URLs (32 publiques + 8 authentifiées + 20 admin)
 Lighthouse CI :                60 URLs (32 + 8 + 20) — configuration durcie pour CI (NO_NAVSTART corrigé)
 Sitemap :                      28 URLs hors contenu (déterministe) + contenu en base
```

> Les valeurs `102 + 15 fichiers` et `6 specs` qui figuraient dans ce bloc sont **périmées** et ne doivent pas y revenir : l'en-tête de ce document les déclare périmées, et les réemployer ici rendrait le document contradictoire avec lui-même. Les compteurs ci-dessus sont ceux de la section « Par type de test », recomptés depuis les fichiers.

> **Chemins critiques couverts** : auth (sign-up/sign-in/sign-out), admin CRUD (handlers + Zod validation), RGPD (export, suppression user), audit (hooks + insert), upload (validation, sécurité), i18n (URLs, slugs, translations), accessibilité (60 URLs Pa11y + 60 Lighthouse).

---

## Commandes — Référence rapide

### Pipeline complète (avec DB + serveur)

```bash
pnpm qa                       # Tout d'un coup : check → build → lint → test+coverage → e2e → a11y
```

### Pipeline hors-ligne (sans DB)

```bash
pnpm qa:offline               # check → build → lint → test+coverage + rapport
```

### Étapes individuelles

| Commande | Description | Pré-requis |
| :-- | :-- | :-- |
| `pnpm check` | Type-check Astro (astro check) | — |
| `pnpm build` | Build production SSR | — |
| `pnpm lint` | ESLint src/**/*.{js,ts,astro} | — |
| `pnpm test` | Vitest run | — |
| `pnpm test -- --coverage` | + coverage v8 | — |
| `pnpm test:watch` | Vitest en mode watch | — |
| `pnpm test:report` | Génère `tests/reports/vitest-report.txt` | Après `pnpm test` |
| `pnpm test:e2e` | Playwright (3 browsers, auto-preview) | DB + build |
| `pnpm test:e2e:ui` | Playwright UI mode | DB + build |
| `pnpm test:e2e:report` | Génère `tests/reports/playwright-report.txt` | Après `pnpm test:e2e` |
| `pnpm a11y` | **Orchestrateur complet** : build → preview → setup → pa11y → lighthouse → teardown | DB |
| `pnpm a11y:pa11y-only` | Pa11y uniquement (via orchestrateur) | DB |
| `pnpm a11y:lighthouse-only` | Lighthouse uniquement (via orchestrateur) | DB |
| `pnpm a11y:setup` | Seed users a11y + export cookies | DB + preview |
| `pnpm a11y:teardown` | Supprime les users a11y | DB |
| `pnpm a11y:pa11y` | Pa11y-ci brut (60 URLs) | Preview + cookies |
| `pnpm a11y:lighthouse` | LHCI autorun (32 pages publiques) | Preview |
| `pnpm a11y:lighthouse:authed` | LHCI pages auth (8) + admin (20) | Preview + cookies |
| `pnpm a11y:lighthouse:rename` | Renomme rapports LHCI | Après LHCI |
| `pnpm a11y:report` | Génère rapport texte Lighthouse | Après LHCI |

### Base de données

| Commande | Description |
| :-- | :-- |
| `pnpm db:check` | Vérifier connexion + lister tables/contraintes |
| `pnpm db:migrate` | Appliquer les migrations Drizzle |
| `pnpm db:generate` | Générer une nouvelle migration |
| `pnpm db:infra` | Appliquer indexes + triggers SQL |
| `pnpm db:seed` | Insérer les données de base |
| `pnpm db:reset` | Reset complet de la DB |
| `pnpm db:sync` | Sync schéma → DB (dev) |
| `pnpm db:compare` | Comparer schéma TS vs DB |
| `pnpm db:cleanup-audit` | Purger les anciens logs d'audit |

### SMTP

| Commande | Description |
| :-- | :-- |
| `pnpm smtp:check` | Vérifier la config SMTP |
| `pnpm logs:rotate` | Rotation des dead-letter logs |

---

## Rapports — Où trouver quoi

| Rapport | Emplacement | Généré par |
| :-- | :-- | :-- |
| Vitest JSON | `tests/reports/vitest-results.json` | `pnpm test` (auto) |
| Vitest texte | `tests/reports/vitest-report.txt` | `pnpm test:report` |
| Coverage JSON | `tests/reports/coverage/coverage-summary.json` | `pnpm test -- --coverage` |
| Playwright JSON | `tests/reports/playwright-results.json` | `pnpm test:e2e` (auto) |
| Playwright HTML | `tests/reports/playwright/` | `pnpm test:e2e` (auto) |
| Playwright texte | `tests/reports/playwright-report.txt` | `pnpm test:e2e:report` |
| Pa11y JSON | `tests/reports/pa11y-results.json` | `pnpm a11y` |
| Pa11y texte | `tests/reports/pa11y-report.txt` | `pnpm a11y` |
| Lighthouse HTML+JSON | `.lighthouseci/` → `tests/reports/lighthouse/` | `pnpm a11y` |
| Lighthouse texte | `tests/reports/lighthouse-report.txt` | `pnpm a11y:report` |

> **Tous les artifacts `tests/reports/*/` sont dans .gitignore**. Seuls les fichiers de config (*.cjs) et les tests sont commités.

### Flux des rapports — Comment ça marche

Le pipeline de rapports fonctionne en **2 étapes** :

1. **Étape auto** — Le runner de test génère un **JSON brut** automatiquement à chaque exécution.
2. **Étape manuelle** — Un script générateur (`tests/helpers/*-report.cjs`) lit le JSON et produit un **rapport `.txt`** lisible.

```md
pnpm test              →  tests/reports/vitest-results.json     (auto)
pnpm test:report       →  tests/reports/vitest-report.txt       (lit le JSON ci-dessus)

pnpm test:e2e          →  tests/reports/playwright-results.json  (auto)
                          tests/reports/playwright/               (HTML auto)
pnpm test:e2e:report   →  tests/reports/playwright-report.txt    (lit le JSON ci-dessus)

pnpm a11y              →  tests/reports/pa11y-results.json       (auto)
                          tests/reports/pa11y-report.txt          (auto via orchestrateur)
                          .lighthouseci/ → tests/reports/lighthouse/ (copie auto)
pnpm a11y:report       →  tests/reports/lighthouse-report.txt    (lit les JSON LHCI)
```

### 3 scénarios d'utilisation

| Scénario | Commande | Ce qui se passe |
| :-- | :-- | :-- |
| **QA offline** (sans DB) | `pnpm qa:offline` | check → build → lint → test+coverage → génère vitest-report.txt |
| **QA complète** (avec DB) | `pnpm qa` | Tout qa:offline + e2e + e2e-report + a11y (pa11y + lighthouse) |
| **Re-lire un rapport existant** | `pnpm test:report` / `pnpm test:e2e:report` / `pnpm a11y:report` | Re-génère le `.txt` à partir du dernier JSON sans relancer les tests |

### Où atterrit chaque artifact

```md
tests/reports/
├── vitest-results.json          ← JSON auto (pnpm test)
├── vitest-report.txt            ← Texte (pnpm test:report)
├── coverage/
│   └── coverage-summary.json    ← JSON auto (pnpm test -- --coverage)
├── playwright-results.json      ← JSON auto (pnpm test:e2e)
├── playwright/                  ← HTML auto (pnpm test:e2e)
├── playwright-report.txt        ← Texte (pnpm test:e2e:report)
├── pa11y-results.json           ← JSON auto (pnpm a11y)
├── pa11y-report.txt             ← Texte auto (pnpm a11y)
└── lighthouse/                  ← Copie HTML+JSON (pnpm a11y)
    └── lighthouse-report.txt    ← Texte (pnpm a11y:report)
```

> **En local** : tout est gitignored, les rapports restent sur votre machine.
> **En CI** : les rapports sont uploadés comme **artifacts GitHub Actions** (rétention 7 jours) et résumés dans le job `ci-summary`.

---

## CI/CD — GitHub Actions

### Workflow `ci.yml` — 6 jobs

```md
┌─────────────────────┐
│   lint-and-check    │  ESLint + astro check + pnpm audit
└──────┬──────────────┘
       │
       ▼
┌──────────────┐
│ unit-tests   │  Vitest unit + integration
└──┬───────┬───┘
   ▼       ▼
┌──────┐ ┌───────────┐
│ e2e  │ │ a11y-perf │  Pa11y (60) + Lighthouse (60)
│tests │ └───────────┘
└──┬───┘
   │ (avec a11y-perf)
   ▼
┌────────┐
│ deploy │  needs: [unit-tests, e2e-tests, a11y-perf] (main branch only)
└────────┘
       │
       ▼
┌────────────┐
│ ci-summary │  Résumé dans PR / commit
└────────────┘
```

### Workflow `codeql.yml` — SAST

- **Trigger** : push/PR main + cron lundi 06:00 UTC
- **Analyse** : JavaScript/TypeScript avec `security-extended`

### Dependabot

- **Fréquence** : hebdomadaire (lundi)
- **Groupes** : astro, auth, database, testing, tailwind
- **Limite** : 10 PRs max

---

## Arborescence des tests

```md
tests/
├── unit/                          # 129 fichiers sur disque (extraits ci-dessous)
│   ├── admin-contact.test.ts      # updateContactInfo (handler + Zod)
│   ├── admin-hours.test.ts        # updateOpeningHours (handler + Zod)
│   ├── admin-navigation-items.test.ts  # CRUD navigation
│   ├── admin-pages.test.ts        # CRUD pages + publish
│   ├── admin-sections.test.ts     # CRUD sections + reorder
│   ├── admin-site.test.ts         # upsert/update site settings
│   ├── admin-social.test.ts       # CRUD social links
│   ├── admin-theme.test.ts        # CRUD thèmes + activation
│   ├── cache.test.ts              # Cache mémoire + stats + shutdown
│   ├── navigation-loader.test.ts  # getMenu / getMenusList / getMenuMeta
│   ├── theme-tokens.test.ts       # OKLCH parser + CSS generation
│   ├── ... (voir dossier tests/unit/)
│
├── integration/                   # 45 fichiers sur disque (extraits ci-dessous)
│   ├── auth.test.ts               # Sign-up/sign-in/sessions
│   ├── auth-advanced.test.ts      # Ban/unban, rôles, password
│   ├── audit.test.ts              # Insertion audit_log
│   ├── middleware.test.ts         # getSession (4 cas headers) — n'importe PAS src/middleware.ts
│   ├── voyage-*.test.ts           # Tunnel complet (actions, loaders, pages, paiements, concurrence)
│   ├── ... (voir dossier tests/integration/)
│
├── e2e/                           # 28 specs × 3 browsers (269 blocs test())
│   ├── app.spec.ts                # Homepage, i18n, security headers
│   ├── auth.spec.ts               # Sign-up/sign-in, guards, session
│   ├── blog.spec.ts               # Blog + workflow (seed admin)
│   ├── blog-review-rating-a11y.spec.ts # Notation d'avis + résumé accessible
│   ├── cms-admin.spec.ts          # Admin pages (site, nav, theme)
│   ├── services.spec.ts           # Services public + admin (seed admin)
│   ├── services-lifecycle.spec.ts # Lifecycle services (seed admin)
│   ├── credential-url-leak.spec.ts    # Invariant : les identifiants n'atteignent jamais une URL
│   ├── error-paths-security.spec.ts   # Sorties précoces du middleware + en-têtes
│   ├── actions-*.spec.ts          # Matrice d'actions (admin, blog, services, voyage)
│   ├── admin-*.spec.ts            # Admin étendu, pages, trips CRUD
│   ├── guest-journeys.spec.ts     # Parcours visiteur
│   ├── i18n-routes.spec.ts        # Routage et redirections de locale
│   ├── public-pages.spec.ts       # Pages publiques
│   ├── ux-flows.spec.ts           # Parcours UX
│   ├── global-setup.ts            # Seed user vérifié admin (pas une spec)
│   └── global-teardown.ts         # Cleanup (pas une spec)
│
├── a11y/                          # Orchestration accessibilité
│   ├── run.cjs                    # Orchestrateur complet (build → audit → teardown)
│   ├── setup.ts                   # Seed users + cookies
│   ├── lhci-authed.cjs            # Lighthouse pages authentifiées
│   ├── lhci-rename.cjs            # Renommage rapports
│   └── lhci-report.cjs            # Générateur rapport LHCI
│
├── helpers/                       # Générateurs de rapports
│   ├── auth.ts                    # Helper auth partagé
│   ├── vitest-report.cjs          # JSON → texte Vitest
│   ├── playwright-report.cjs      # JSON → texte Playwright
│   └── lighthouse-report.cjs      # JSON → texte Lighthouse
│
└── reports/                       # ⚠️ Gitignored — artifacts générés
    ├── vitest-results.json
    ├── vitest-report.txt
    ├── coverage/
    ├── playwright-results.json
    ├── playwright/                # HTML report
    ├── playwright-report.txt
    ├── pa11y-results.json
    ├── pa11y-report.txt
    └── lighthouse/                # Copie des rapports LHCI
```

---

## Prochaines étapes

Voir **[gaps.md](gaps.md)** pour la liste des failles restantes par priorité.
