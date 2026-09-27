# ETAT-REEL — Source de vérité temps réel (2026-09-26)

> Règle : `package.json` + `src/` + configs racine font foi sur toute doc.
> `README*.md` = générés par `pnpm readme:generate` (`readme-builder/`) — ne jamais les éditer à la main, corriger le générateur.
> `TODO.md` = trajectoire datée, pas état temps réel.
> `docs/audits/*` = snapshots archivés, pas vérité.
> Régénération : recompter via les commandes listées §6 et mettre à jour la date + les chiffres.

## 0 bis. Livraison sécurité — origine, en-têtes, sonde, formulaires (2026-09-26)

État mesuré, adossé au code et au framework. Détail dans [security.md](security.md).

- **CSP** : `upgrade-insecure-requests` **retirée** de `security.csp.directives`. Elle était émise inconditionnellement et, sur une origine HTTP, son seul effet était de faire réécrire les sous-ressources par WebKit — donc d'empêcher tout script de se charger sur un serveur d'écoute en clair. Elle était redondante sur HTTPS (`'self'` ne résout que vers HTTPS ; les listes explicites ne nomment que des origines HTTPS). `block-all-mixed-content` n'est **pas** une directive autorisée par Astro et ne la remplace pas. **9 directives** restent, dans l'ordre de `astro.config.mjs`.
- **`security.allowedDomains`** ajouté, dérivé de `SITE_URL` (même variable que `site` et l'index de sitemap), **nom d'hôte seul** — jamais protocole, jamais port. Le protocole est volontairement non épinglé (comparé au protocole du socket, `http:` derrière un proxy TLS → épingler ferait échouer la validation et l'adresse client vaudrait le proxy sur toutes les requêtes) ; le port volontairement non épinglé (comparé par égalité de chaîne à `X-Forwarded-Port`, et le port d'une URL par défaut est vide). Rejet → **repli silencieux** sur l'hôte du socket ; l'application journalise désormais l'événement (`INFRA_PROXY_HEADER_REJECTED`), ce qui le rend diagnosticable.
- **En-têtes de sécurité** : point d'application **unique** (`applySecurityHeaders`, appelé après `runRequestChain`). Les trois sorties qui court-circuitaient — 404 de locale invalide, 301 de canonicalisation, 503 de session — repartaient **sans aucun en-tête**. La 301 est **construite** et non obtenue via `Response.redirect()` : les en-têtes d'une réponse de redirection portent le guard `immutable` et `headers.set()` y lève, ce qui ferait échouer toute la chaîne.
- **Sonde `GET /api/health`** : l'absence d'en-tête de proxy n'est plus traitée comme une preuve d'appel local (elle est décidée par l'appelant ; un port exposé n'est pas un loopback). Accès conditionné à un jeton présenté, sinon 401 ; la branche d'erreur 503 applique la même règle. Comparaison par `timingSafeEqual()` sur des empreintes SHA-256 de longueur fixe. **Conséquence opérationnelle** : la sonde porte le jeton dès qu'un proxy est présent sur le réseau.
- **Recherche** : la limite de `GET /api/search` passe de `clientAddress` seul à `extractIp(request.headers, clientAddress) ?? "unknown"`. Derrière un proxy, `clientAddress` est l'adresse du proxy pour toutes les requêtes : tous les visiteurs partageaient un compartiment et la recherche devenait inaccessible par saturation pour tous. Repli global conservé.
- **Audit** : `INFRA_PROXY_HEADER_REJECTED` ajoutée à l'union `AuditAction`. Total **179** actions.
- **`SITE_URL` fail-closed** : 5 conditions de rejet (absente/vide, invalide, protocole non http(s), `http:` sur hôte non local, porteur d'un chemin) font échouer le chargement de la config. **3 replis silencieux** vers une origine locale supprimés. Le fichier d'environnement local **n'est pas consulté** pour cette variable, ni au build ni dans la suite : elle doit être dans l'environnement du processus (`vitest.config.ts` impose le même contrat que `astro.config.mjs`).
- **CI** : chaque job sert une origine locale correspondant au port qu'il écoute réellement — `lint-and-check`/`unit-tests`/`a11y-perf` sur `:4321`, `e2e-tests` sur `:4322` (`e2e-server.mjs`), `SITE_URL` et `BETTER_AUTH_URL` épinglées ensemble. Deux jobs avaient des origines divergentes, dont aucune n'était celle testée. Le job `deploy` garde l'origine publique et refuse explicitement de produire un artefact figé sur une origine locale, **avant et après** le build.
- **Contrat `checkOrigin` corrigé** : le framework ne contrôle que les types de contenu de formulaire (`application/x-www-form-urlencoded`, `multipart/form-data`, `text/plain`). Une requête **JSON est autorisée quelle que soit son origine** — donc `checkOrigin` ne protège **ni** `/api/auth/*` **ni** `/_actions/*`. Ces surfaces reposent sur la session serveur et la politique `SameSite` des cookies. (Source : `node_modules/astro/dist/core/app/origin-check.js`.)
- **Formulaires** : **60** balises `<form>` dans `src/**/*.astro` (38 fichiers), après retrait des commentaires. Répartition en trois groupes disjoints : **47 balises durcies** (méthode non GET **et** `action` explicite) sur **27 fichiers**, **12 balises `method="get"`** conformes par conception (recherche et filtrage, aucun champ d'identité), **1 balise `method="dialog"`** sans objet (elle ferme une boîte de dialogue, ne produit ni navigation ni requête). Sur les 47 durcies : **7** pointent vers un vrai point d'entrée serveur ; **40** n'ont **aucun** traitement serveur de repli (aucune page `.astro` n'exporte de `POST`) : une soumission sans JavaScript y est rejetée avant toute mutation — manque fonctionnel assumé, pas une garantie d'expérience sans JavaScript. **60 balises source ≠ 62 formulaires rendus** : 4 balises sont dans une boucle `LOCALES.map()` (4 locales) et 10 dans des boucles pilotées par les données. Détail et table par fichier : [security.md](security.md) §11.
- **Titre de niveau 1 des pages de contenu** : chaque section rédactionnelle (`text`, `custom`) passe son corps par `renderEditorialHtml()`, qui **rétrograde au rendu** tout `<h1>` en `<h2>` — la page expose déjà le sien via `CmsPage.astro:17`. La correction est au rendu et **pas** dans `sanitizeHtml()`, parce que ce filtre est partagé avec les articles de blog où ce niveau doit rester autorisé : `ALLOWED_TAGS` contient donc toujours `h1`, volontairement. L'avertissement de référencement de `validatePageSeo()` sur le doublon a été **supprimé** : devenu faux, il retirait 10 points à une page valide. Verrous : `tests/unit/demote-level-one-headings.test.ts`, `tests/unit/seo.test.ts`.
- **Région de retour d'information** (`[lang]/apply/[trip].astro`) : le nœud `<output data-form-message>` est **hors** du `<form>` et reçoit les deux canaux. Le chemin de succès remplaçait le contenu du formulaire et détruisait ce nœud, qui recevait pourtant les messages d'erreur.
- **Ligne d'origine** : `tests/unit/voyage/middleware.test.ts` asserte les valeurs exactes des en-têtes sur la `Response` réellement produite. `tests/unit/middleware-timeout.test.ts` **n'importe pas** le middleware et asserte des littéraux locaux — dont un `max-age` HSTS à `31536000` qui diverge des `63072000` du produit : il ne mesure rien et ne doit pas être cité comme couverture. Correction rapportée, non appliquée.

## 0. Cœur voyage — livré (branche feat/voyage-core, 2026-09-16)

- Schémas : `trips (+traductions, highlights, inclusions, exclusions, faq)`, `itinerary`, `departures (+seat_holds)`, `travelers`, `applications (+décisions, événements, notes)`, `reservations (+snapshots)`, `payments (+checkout_sessions)`, `policies`, `outbox`, `email-voyage`. Migrations `0010_voyage_core`, `0011_email_delivery_reservation`. Seeds `41 → 47` (3 voyages × 4 langues, 3 départs ouverts, 25 jours itinéraire, FAQ, contenus, policies provisoires non publiées).
- Domaine pur + testé : transitions d'état, pricing (centimes), dispo (holds 30 min, `FOR UPDATE`, concurrence prouvée), email travelers, outbox worker (`SKIP LOCKED`), providers paiement (mock + Stripe fetch, sans SDK).
- Tunnel complet prouvé en intégration (mock) : approbation → checkout (TTL 7 j) → hold → snapshot → paiement → webhook idempotent → confirmation → hold converti → refund.
- Pages : `/[lang]/trips` (liste + filtres), `/[lang]/trips/[slug]`, `/[lang]/apply/[trip]` (vrai formulaire), `/[lang]/checkout/[session]`, `/[lang]/booking-confirmed`, `/api/payments/webhook|mock-callback`, `/api/cron/voyage`, `/api/analytics`. Admin : `/[lang]/admin/trips` (liste + fiche, transitions, départs).
- Emails : 12 templates × 4 langues + worker + rappels (solde J-7, pré J-14, post J+3, dédupliqués).
- Build `pnpm build` VERT. Tests : **174 fichiers (129 unit + 45 integration), 1 907 tests, 100 % verts**. `pnpm check` : 0 erreur. Lint : 0 erreur. E2E : **28 specs**, 269 blocs de test, × 3 navigateurs. Périmètre voyage : 96,4 % stmts / 88,0 % branches / 93,9 % foncs / 97,7 % lignes (seuils repo 80/75/75/80 dépassés ; gate global rouge préexistant = territoire CMS/blog).
- Correctifs sessions : 500 page apply (`TRIP_SLUGS` vs ids DB), patch vide → `BAD_REQUEST` (×3 actions), `sortOrder` ignoré (×4 loaders), `percent` non-acompte rejeté, `__idempotency` hors body Stripe, plafond anti-sur-remboursement, relances solde 0 € filtrées, retry collision numéro (unwrap `cause`), early-bird daté + remises groupe, FAQ orpheline, webhook 500-pour-retry, callback locale repli `en`, cron isolé par job, filtres admin indulgents (8 loaders), dead-letter avec message, contrôles bidi stripés, sitemap/hreflang conformes §7.5 (locales masquées exclues, acompte recalculé), déduplication candidatures (contrainte partielle + `APPLICATION_DUPLICATE`, migration 0014), orphelins tunnel nettoyés, verrou anti-double-remboursement, sessions expirées au cancel, rétention outbox/sessions/holds, flake blog-actions (tri indéfini) réparé, consentement CGV prouvé serveur, locales majuscules 301, middleware/guards/core-utils/seeds/templates/cache/sanitize/bidi/rate-limit testés.
- Scope org coupé (TODO §30.3) : pas de plugin organization, pas de routes `/organizations/`, tests org supprimés/réécrits (`auth-org`, `admin-roles`, specs e2e blog/services).
- Reste : pa11y/lhci à relancer, contenus ES/AR à relire par natifs, validation juridique des policies, checklist prod §34, **traitement serveur de repli pour les 40 formulaires qui n'en ont pas** (§0 bis), `vars.SITE_URL` et `vars.BETTER_AUTH_URL` à définir dans les réglages du dépôt pour que le job `deploy` passe ses gardes.
- **Résolu depuis 2026-09-16** : allowlist CSP Stripe (intégrée à `connect-src` / `frame-src` / `scriptDirective.resources`), `requestId` (UUID entrant validé, sinon régénéré, posé en `X-Request-Id`), migrations 0010→0015 / seeds 41→46 / 11 modules voyage / checkout / webhook idempotent / outbox (livrés — voir §0), runs E2E en CI (28 specs exécutées par le job `e2e-tests`).

## 1. Versions (vérifié `package.json`)

- Astro `7.3.1`, `@astrojs/node` `11.1.5`, output `server`, adapter `standalone` (`astro.config.mjs:10,66`).
- Node `>=22.12.0`, pnpm `>=10`, PostgreSQL `16`.
- better-auth `^1.7.4`, Drizzle ORM `^0.45.2`, Tailwind `^4.3.3`, Vitest `^4.1.11`, Playwright `^1.63.0`.
- Nodemailer `^9.1.1`, Sharp `^0.35.4` (audit prod : 8 vulnérabilités → 1 restante `esbuild` niché `drizzle-kit`, sans exposition réseau — pas d'override pour ne pas risquer la toolchain de migrations).
- i18n Astro : locales `fr,en,es,ar`, `defaultLocale: en`, `prefixDefaultLocale: true` (`astro.config.mjs:36-43`).
- Sécurité : `security.checkOrigin: true`, `security.allowedDomains: [{ hostname: siteUrl.hostname }]`, `security.csp.directives` = **9 directives** — allowlist Stripe.js **déjà intégrée** à `connect-src` (`https://api.stripe.com`) et `frame-src` (`https://js.stripe.com`, `https://hooks.stripe.com`) ; `scriptDirective.resources = ["'self'", 'https://js.stripe.com']`. `upgrade-insecure-requests` **retirée** (§0 bis). En-têtes complémentaires : **10** dans `src/middleware.ts` (9 `SECURITY_HEADERS` + `X-Request-Id`), posés par **point d'application unique** après la chaîne de requête. `site`, `security.allowedDomains` et `customSitemaps` dérivent tous de `SITE_URL`, fail-closed.
- `requestId` : **présent**. `context.locals.requestId` n'accepte qu'un `x-request-id` entrant au format UUID, sinon régénère ; il est posé en en-tête `X-Request-Id`. TODO §18.1 **résolu**.

## 2. i18n (vérifié `src/i18n/`)

- `LOCALES = fr,en,es,ar`, `DEFAULT_LOCALE = en`, `RTL_LOCALES = [ar]` (`src/i18n/config.ts:3-6`).
- `src/i18n/routes.ts` existe (152 lignes) + `tests/unit/i18n-routes.test.ts` : `TRIP_LIST_SEGMENT`, `APPLY_SEGMENT`, `FAQ/TERMS/PRIVACY/ABOUT/CONTACT_SEGMENT`, `TRIP_SLUGS` 3 voyages, helpers `getTripPath/getApplyPath/resolveTripSlug`.
- Traductions : `src/i18n/{fr,en,es,ar}/` (about, auth, common, contact, home) + `src/i18n/blog/{fr,en,es,ar}.ts`.
- `pageRoutes` CMS (`common.ts`) : fr `a-propos/contact/mentions-legales`, en `about/contact/legal-notice`, es `acerca-de/contacto/aviso-legal`, ar `about/contact/legal-notice` (ASCII acté 2026-09-14, même que EN).
- Auth routes AR = EN (`sign-in`, `sign-up`, `dashboard`, `admin`, `forgot-password`, `reset-password`, `verify-email`, `profile`, `organizations`). Contenu arabe, URLs ASCII.

## 3. Comptes réels (2026-09-14)

- `src/components/atoms/` : 48 dossiers.
- `src/database/schemas/` : 21 fichiers. Migrations SQL : `0000_tranquil_toad`, `0001_steady_meteorite`, `0002_trip_engagement` (3 fichiers, alignés sur `meta/_journal.json`).
- `src/database/data/` : 87 fichiers seed.
- `src/actions/` : 62 fichiers TS. Pas de `actions/org/`.
- `src/modules/` : 14 domaines.
- `tests/unit/` : **129** fichiers. `tests/integration/` : **45** fichiers. `tests/e2e/` : **28** specs (269 blocs `test()`) + `global-setup/teardown` × 3 navigateurs. **Total Vitest : 174 fichiers, 1 907 tests.**
- Seuils coverage `vitest.config.ts` : statements 80, branches 75, functions 75, lines 80.
- `src/smtp/templates/` : 8 fichiers — 6 templates (`verify-email, reset-password, delete-account, contact-form, blog-newsletter, voyage`) + `layout, i18n`. Pas de `organization-invitation.ts`.
- Dead-letter : `logs/email-dead-letter-*.jsonl` racine (pas `src/smtp/logs/`).
- `src/components/pages/org/` : **n'existe plus** (`Test-Path` → `False`). `ProfilePage.astro` existe.
- Routage : unique `src/pages/[lang]/` (index, a-propos, contact, faq, terms, [slug], admin/, apply/, auth/, blog/, services/, trips/). Plus de `src/pages/fr/`, `src/pages/ar/`. `booking-quote.ts` supprimé. Sitemaps org supprimés.
- A11y : `.pa11yci.cjs` standard `WCAG2AAA`, `ignore: color-contrast` (axe-core ne résout pas OKLCH). `lighthouserc.cjs` gates ≥ 0.9 × 4 catégories, 32 URLs publiques + 8 auth + 20 admin.
- Audit : **179** actions dans l'union `AuditAction`, dont `INFRA_PROXY_HEADER_REJECTED`. Aucune action `ORG_*` (plugin retiré).
- CSP : **9** directives, `upgrade-insecure-requests` **retirée**.
- Formulaires : **60** balises `<form>` dans `src/**/*.astro` (38 fichiers) — **47 durcies** (méthode non GET + `action` explicite) sur 27 fichiers, **12 `method="get"`** conformes par conception, **1 `method="dialog"`** sans objet. 60 balises source pour 62 formulaires rendus (4 balises dans une boucle `LOCALES.map()`).
- `SITE_URL` : fail-closed, 5 conditions de rejet, 3 replis silencieux supprimés, non lisible depuis `.env`.

## 4. Chemins canoniques

- Pages : `src/pages/[lang]/…`, jamais `src/pages/fr|en|es|ar/`.
- Layout : `src/layouts/BaseLayout.astro` (pose `dir`, canonical, hreflang).
- Styles : `src/styles/global.css` unique.
- SMTP entrée : `src/smtp/send.ts` (pas de `index.ts`). Env : `src/smtp/env.ts`.
- Loaders : `src/database/loaders/` (page, site, blog, media, navigation, consent, …).
- Contrats admin : `src/core/admin/resource-contract.ts`, `filter-contract.ts`. Locks : `src/core/locks/`.
- Configs racine : `.pa11yci.cjs`, `lighthouserc.cjs`, `astro.config.mjs`, `vitest.config.ts`, `playwright.config.ts`.

## 5. Décisions i18n/SEO actées (2026-09-14) — slugs structurels ASCII + canonique parfait

Recherche SEO/usage (Google Search Central URL structure + John Mueller + Yoast + guide Arabic SEO 2026) :
- Google crawle/indexe l'arabe ET le latin ; mots translittérés explicitement acceptés ; `href` en percent-encoding pour le non-ASCII.
- Usage réel : URLs arabes → `%D9%85…` illisibles au partage (preuve : `tests/reports/pa11y-report.txt` : `/ar/%D9%85%D9%86…`), CTR faible (Yoast), 404 par variantes alef/hamza et confusions kāf/yā arabes vs farsi (Istizada), casse trackers/sociaux.
- Pratique monde réel : fonctionnel en latin même en UI arabe (Google, Facebook, Airbnb, Booking : `/ar/...` + slugs EN) ; contenu 100 % arabe.
- Bénéfice mot-clé-en-URL négligeable pour about/contact/auth (pages fonctionnelles, pas contenu).

Règle : **AR structurel = EN ASCII partout** (`about`, `contact`, `legal-notice`, `sign-in`, `dashboard`, `trips`, `apply`, …). Voyages : slugs EN translittérés (déjà). Contenu/titres/meta/og : arabe intégral. FR/ES : segments traduits latins. Site pas en prod → pas de 301.

### 5.1 Canonique (les deux voies servent — VOULU)
- Pages universelles statiques conservées (`a-propos`, `contact`, `faq`, `terms`) + `[slug].astro` dynamique.
- Canonique = slug localisé (`pageRoutes`/`routes.ts`) : `a-propos.astro`/`contact.astro` passent `canonicalPath` + `alternateUrls` ; accès non-canoniques (`/en/a-propos`) consolident via cross-canonical (pas de redirect, les deux servent).
- `faq`/`terms` : slugs universels, canonique = soi + alternates 4 locales. `terms` (résumé) distinct des légales CMS détaillées (`mentions-legales`, …).
- `trips/[slug]` + `apply/[trip]` : `canonicalPath` = `tripUrl`/`getApplyPath` + alternates (apply les avait manquants — ajoutés).
- `BaseLayout` : prop `canonicalPath`, hreflang en URLs **absolues** (exigence Google), `x-default` = `en` (décision actée, corrigé 2026-09-14, était `fr`).
- Middleware : rewrite `voyages/viajes → trips`, `candidature/postulacion → apply` (`resolveLocalizedRoute()` pure dans `routes.ts`, testée). Sans ça, les URLs canoniques FR/ES et les liens du switcher menaient en 404 (routes physiques en segments fixes). Segments nus (`/fr/voyages`, liste) : pas de page → 404 volontaire (liste à créer, TODO).
- Sélecteur de langue (TODO §7.6) : `mapStaticSlugPath()` pure dans `i18n/utils.ts` (testée `i18n-switch.test.ts`) — about/contact/legal/auth/terms/faq mappés sur la page équivalente via les mêmes sources que les pages (zéro dérive) ; repli `getRelativeLocaleUrl`, jamais de contenu d'une autre langue. Corrige : `/fr/auth/connexion` → `/en/auth/sign-in` (était 404 silencieux), `/terms` universel (était `/es/terminos` et `/fr/conditions` en 404 via `getTermsPath`).
- Fallback nav `BaseLayout` (si menus DB vides) : URLs existantes uniquement (`/{lang}/terms`, `/es/viajes/sicilia-malta`).

### 5.2 Limites connues (pas de 404, à traiter plus tard)
- `TERMS_SEGMENT`/`PRIVACY_SEGMENT` localisés (`/fr/conditions`, `/es/terminos`, privacy) : aucune page — futurs (TODO). Ne pas lier.
- Contenu ES manquant : `trips.ts`, `faq.astro`, `terms.astro`, `apply` retombent en EN (fallback existant, à traduire).
- Tags blog AR en arabe (`blog/ar.ts` routes.tags) : slugs de détail non mappés par le switcher (repli relatif).
- `pnpm check` : ~177 erreurs et `pnpm lint` : 4 erreurs préexistantes (blog/services/org/auth — hors périmètre, ne pas imputer aux skills i18n).

Divergences restantes :
1. ~~Slugs AR~~ ✅ RÉSOLU 2026-09-14 (ASCII partout).
2. ~~Pages universelles vs `[slug]`~~ ✅ VOULU, ne pas dédupliquer (2026-09-14) : statiques conservées en soi + `[slug]` sert aussi, consolidation par cross-canonical.
3. ~~x-default~~ ✅ RÉSOLU 2026-09-14 (`en`).
4. **Comptes docs** : tout chiffre `741 tests / 34 E2E / 86 tokens / 47+ composants` dans une doc = obsolète, utiliser §3 ci-dessus.

## 6. Régénération (commandes)

```powershell
# versions
Select-String -Path package.json -Pattern '"astro"|"@astrojs/node"|"better-auth"|"drizzle-orm"|"vitest"|"@playwright/test"'
# comptes src
(Get-ChildItem src/components/atoms -Directory).Count
(Get-ChildItem src/database/schemas -File).Count
(Get-ChildItem src/database/data -File).Count
(Get-ChildItem src/actions -Recurse -File -Filter *.ts).Count
(Get-ChildItem src/modules -Directory).Count
Get-ChildItem src/smtp/templates -File | Select-Object -ExpandProperty Name
Test-Path src/components/pages/org
Test-Path src/pages/fr; Test-Path src/pages/ar; Test-Path src/pages/api/booking-quote.ts
# tests : RECURSIF (unit/ et integration/ contiennent des sous-dossiers)
(Get-ChildItem tests/unit -Recurse -File -Filter *.test.ts).Count
(Get-ChildItem tests/integration -Recurse -File -Filter *.test.ts).Count
(Get-ChildItem tests/e2e -File -Filter *.spec.ts).Count
# actions d'audit
((Get-Content src/lib/audit.ts -Raw) -split 'export interface AuditEventInput')[0] |
  Select-String -AllMatches -Pattern '"[A-Z][A-Z0-9_]*"' | ForEach-Object { $_.Matches.Count }
# CSP : nombre de directives (9 attendu)
([regex]::Matches(((Get-Content astro.config.mjs -Raw) -split 'directives:')[1], '"[^"]+"')[0].Value).Count
# formulaires : borne haute (63 = 60 balises + 3 faux positifs en commentaires)
(Get-ChildItem src -Recurse -File -Filter *.astro | Select-String -Pattern '<form' -AllMatches).Count
# -> 60 apres retrait des commentaires ; la methode exacte est dans security.md §11
# en-têtes du middleware
(Select-String -Path src/middleware.ts -Pattern "^\s*'" ).Count
# i18n / SEO
Select-String -Path src/i18n/config.ts -Pattern 'DEFAULT_LOCALE|RTL_LOCALES'
Select-String -Path src/layouts/BaseLayout.astro -Pattern 'x-default'
```

> Les compteurs de tests de cette section utilisent `-Recurse` : `tests/unit/` et `tests/integration/` contiennent des sous-dossiers (`blog/`, `cms/`, `database/`, `services/`, `voyage/`), et un comptage non récursif sous-estime fortement. C'est l'origine de plusieurs compteurs périmés de ce document.

## 7. Ce qui reste vrai dans TODO.md

Socle existant (auth, DB, médias, SMTP, audit, CMS, blog, services, admin, tests, CI) et cœur voyage livré (§0). Gaps réels au 2026-09-26 : **traitement serveur de repli pour 40 des 47 balises durcies** (§0 bis), `vars.SITE_URL` / `vars.BETTER_AUTH_URL` non définies dans les réglages GitHub (le job `deploy` échouerait sur sa garde 1), lintéraux locaux divergents dans `tests/unit/middleware-timeout.test.ts` (§0 bis), contenus ES/AR à relire par natifs, validation juridique des policies, checklist prod §34, livraison vers un hébergeur (placeholder).
