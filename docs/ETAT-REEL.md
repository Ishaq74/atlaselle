# ETAT-REEL — Source de vérité temps réel (2026-09-15, branche feat/voyage-core)

> Règle : `package.json` + `src/` + configs racine font foi sur toute doc.
> `README*.md` = générés par `pnpm readme:generate` (`readme-builder/`) — ne jamais les éditer à la main, corriger le générateur.
> `TODO.md` = trajectoire datée, pas état temps réel.
> `docs/audits/*` = snapshots archivés, pas vérité.
> Régénération : recompter via les commandes listées §6 et mettre à jour la date + les chiffres.

## 0. Cœur voyage — livré (branche feat/voyage-core, 2026-09-15)

- Schémas : `trips (+traductions, highlights, inclusions, exclusions, faq)`, `itinerary`, `departures (+seat_holds)`, `travelers`, `applications (+décisions, événements, notes)`, `reservations (+snapshots)`, `payments (+checkout_sessions)`, `policies`, `outbox`, `email-voyage`. Migrations `0010_voyage_core`, `0011_email_delivery_reservation`. Seeds `41 → 47` (3 voyages × 4 langues, 3 départs ouverts, 25 jours itinéraire, FAQ, contenus, policies provisoires non publiées).
- Domaine pur + testé : transitions d'état, pricing (centimes), dispo (holds 30 min, `FOR UPDATE`, concurrence prouvée), email travelers, outbox worker (`SKIP LOCKED`), providers paiement (mock + Stripe fetch, sans SDK).
- Tunnel complet prouvé en intégration (mock) : approbation → checkout (TTL 7 j) → hold → snapshot → paiement → webhook idempotent → confirmation → hold converti → refund.
- Pages : `/[lang]/trips` (liste + filtres), `/[lang]/trips/[slug]`, `/[lang]/apply/[trip]` (vrai formulaire), `/[lang]/checkout/[session]`, `/[lang]/booking-confirmed`, `/api/payments/webhook|mock-callback`, `/api/cron/voyage`, `/api/analytics`. Admin : `/[lang]/admin/trips` (liste + fiche, transitions, départs).
- Emails : 12 templates × 4 langues + worker + rappels (solde J-7, pré J-14, post J+3, dédupliqués).
- Build `pnpm build` VERT. Tests : **140 fichiers, 1462 tests, 100 % verts** (baseline 2026-09-14 : 15 fichiers / 44 tests en échec — tous réparés ou requalifiés single-tenant). `pnpm check` : **0 erreur** (baseline : 178). Lint : **0 erreur** (21 warnings préexistants).
- Scope org coupé (TODO §30.3) : pas de plugin organization, pas de routes `/organizations/`, tests org supprimés/réécrits (`auth-org`, `admin-roles`, specs e2e blog/services).
- Reste : runs navigateurs/E2E en CI (spec `voyage.spec.ts` écrit, non exécuté en local — Playwright mis en pause), pa11y/lhci à relancer, allowlist CSP Stripe, contenus ES/AR à relire par natifs, validation juridique des policies, checklist prod §34, merge de la branche.

## 1. Versions (vérifié `package.json`)

- Astro `7.3.1`, `@astrojs/node` `11.1.5`, output `server`, adapter `standalone` (`astro.config.mjs:10,66`).
- Node `>=22.12.0`, pnpm `>=10`, PostgreSQL `16`.
- better-auth `^1.7.4`, Drizzle ORM `^0.45.2`, Tailwind `^4.3.3`, Vitest `^4.1.11`, Playwright `^1.63.0`.
- i18n Astro : locales `fr,en,es,ar`, `defaultLocale: en`, `prefixDefaultLocale: true` (`astro.config.mjs:36-43`).
- Sécurité : `security.checkOrigin: true`, `security.csp` présent (`astro.config.mjs:73-89`). Headers complémentaires dans `src/middleware.ts:62-72`. Allowlist Stripe.js à ajouter avec le module payments. `requestId` manquant (TODO §18.1 restant vrai).

## 2. i18n (vérifié `src/i18n/`)

- `LOCALES = fr,en,es,ar`, `DEFAULT_LOCALE = en`, `RTL_LOCALES = [ar]` (`src/i18n/config.ts:3-6`).
- `src/i18n/routes.ts` existe (152 lignes) + `tests/unit/i18n-routes.test.ts` : `TRIP_LIST_SEGMENT`, `APPLY_SEGMENT`, `FAQ/TERMS/PRIVACY/ABOUT/CONTACT_SEGMENT`, `TRIP_SLUGS` 3 voyages, helpers `getTripPath/getApplyPath/resolveTripSlug`.
- Traductions : `src/i18n/{fr,en,es,ar}/` (about, auth, common, contact, home) + `src/i18n/blog/{fr,en,es,ar}.ts`.
- `pageRoutes` CMS (`common.ts`) : fr `a-propos/contact/mentions-legales`, en `about/contact/legal-notice`, es `acerca-de/contacto/aviso-legal`, ar `about/contact/legal-notice` (ASCII acté 2026-09-14, même que EN).
- Auth routes AR = EN (`sign-in`, `sign-up`, `dashboard`, `admin`, `forgot-password`, `reset-password`, `verify-email`, `profile`, `organizations`). Contenu arabe, URLs ASCII.

## 3. Comptes réels (2026-09-14)

- `src/components/atoms/` : 48 dossiers.
- `src/database/schemas/` : 11 fichiers (audit-log, auth, blog, consent, media, navigation, page, page-version, services, services-engagement, site). Migrations `0000 → 0009`.
- `src/database/data/` : 63 fichiers seed.
- `src/actions/` : 46 fichiers TS (admin/blog/services). Pas de `actions/org/`.
- `tests/unit/` : 81 fichiers. `tests/integration/` : 15 fichiers. `tests/e2e/` : 6 specs (`app, auth, blog, cms-admin, services, services-lifecycle`) + `global-setup/teardown` × 3 navigateurs.
- Seuils coverage `vitest.config.ts:59-64` : statements 80, branches 75, functions 75, lines 80.
- `src/smtp/templates/` : 7 fichiers dont 5 templates (`verify-email, reset-password, delete-account, contact-form, blog-newsletter`) + `layout, i18n`. Pas de `organization-invitation.ts`.
- Dead-letter : `logs/email-dead-letter-*.jsonl` racine (pas `src/smtp/logs/`).
- `src/components/pages/org/` : existe mais VIDE (pages org supprimées). `ProfilePage.astro` existe.
- Routage : unique `src/pages/[lang]/` (index, a-propos, contact, faq, terms, [slug], admin/, apply/, auth/, blog/, services/, trips/). Plus de `src/pages/fr/`, `src/pages/ar/`. `booking-quote.ts` supprimé. Sitemaps org supprimés.
- A11y : `.pa11yci.cjs` standard `WCAG2AAA`, `ignore: color-contrast` (axe-core ne résout pas OKLCH). `lighthouserc.cjs` gates ≥ 0.9 × 4 catégories, 32 URLs publiques + 8 auth + 20 admin.

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
# comptes
(Get-ChildItem src/components/atoms -Directory).Count
(Get-ChildItem src/database/schemas -File).Count
(Get-ChildItem src/database/data -File).Count
(Get-ChildItem src/actions -Recurse -File -Filter *.ts).Count
(Get-ChildItem tests/unit -File).Count; (Get-ChildItem tests/integration -File).Count; (Get-ChildItem tests/e2e -File -Filter *.spec.ts).Count
Get-ChildItem src/smtp/templates -File | Select-Object -ExpandProperty Name
Get-ChildItem src/components/pages/org -Force
Test-Path src/pages/fr; Test-Path src/pages/ar; Test-Path src/pages/api/booking-quote.ts
Select-String -Path src/i18n/config.ts -Pattern 'DEFAULT_LOCALE|RTL_LOCALES'
Select-String -Path src/layouts/BaseLayout.astro -Pattern 'x-default'
```

## 7. Ce qui reste vrai dans TODO.md

Socle existant (auth, DB, médias, SMTP, audit, CMS, blog, services isolé, admin, tests, CI). Gaps réels : schémas/services voyage (Trip, Departure, Itinerary, Pricing, Availability, Traveler, Application, Reservation, Payment, SeatHold), 11 modules `src/modules/<domain>/`, loaders `loadTripPage/loadAdmin*`, checkout, webhook Stripe idempotent, templates email voyage 12×4, outbox/jobs, migrations 0010→0015, seeds 41→46, tests voyage + concurrence, `requestId`, sanitisation bidi, allowlist Stripe CSP.
