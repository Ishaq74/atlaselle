---
name: atlaselle-i18n
description: Atlaselle 4-locale system (fr/en/es/ar). Use when adding translated strings, slugs, routes, emails, or touching LanguageSwitcher, hreflang, RTL, or any locale-dependent URL. Covers i18n, traduction, slug, langue, locale.
metadata:
  author: atlaselle-repo
  version: "1.0"
---

# Atlaselle i18n (4 langues) — règles non négociables

Vérité temps réel : `docs/ETAT-REEL.md §2+§5` + `src/i18n/`. Spec : `TODO.md §7`.

## 1. Constantes (ne jamais inventer)

- `src/i18n/config.ts` : `LOCALES = fr,en,es,ar`, `DEFAULT_LOCALE = 'en'`, `RTL_LOCALES = [ar]`.
- `src/i18n/routes.ts` : **référence unique des segments** (`TRIP_LIST_SEGMENT`, `APPLY_SEGMENT`, `FAQ/TERMS/PRIVACY/ABOUT/CONTACT_SEGMENT`, `TRIP_SLUGS`, helpers `getTripPath/getApplyPath/resolveTripSlug/getTripsBasePath/isTripDetailPath`, `resolveLocalizedRoute` pour le middleware). Ne jamais recopier un segment en dur dans une page, un composant ou un test.
- `src/i18n/{fr,en,es,ar}/common.ts` → `pageRoutes` (about/contact/legal). `src/i18n/{locale}/auth.ts` → `routes` (9 AuthPageId). `src/i18n/blog/{locale}.ts` → `routes.blog/tags`.
- Traductions : `src/i18n/{fr,en,es,ar}/{about,auth,common,contact,home}.ts`, toutes typées `satisfies` (clé manquante = erreur TS/CI).

## 2. AR = ASCII (décision actée, SEO + usage)

Segments structurels AR = anglais (`ar/about`, `ar/contact`, `ar/legal-notice`, `ar/sign-in`, `ar/trips`, `ar/apply`), slugs voyage AR = slug EN. Contenu/titres/meta/og : arabe intégral. FR/ES : segments traduits latins. Ne jamais remettre de slug arabe en URL.

## 3. Routage et équivalences

- Dossiers `src/pages/fr|en|es|ar` **interdits**. Tout vit sous `src/pages/[lang]/`.
- `resolveLocalizedRoute()` (`routes.ts`) + `src/middleware.ts` : rewrite `voyages/viajes → trips`, `candidature/postulacion → apply`. Segments nus (`/fr/voyages`) = 404 volontaire (pas de page liste).
- `mapStaticSlugPath()` (`src/i18n/utils.ts`) : page équivalente about/contact/legal/auth + universels `terms`/`faq`, mêmes sources que les pages (zéro dérive). Repli : page parente, jamais de contenu d'une autre langue.
- `LanguageSwitcher.astro` : trips/apply via `TRIP_SLUGS`, structurel via `mapStaticSlugPath`, sinon `getRelativeLocaleUrl`. Toute nouvelle zone localisée DOIT y être ajoutée.

## 4. SEO multilingue (voir `atlaselle-seo`)

`BaseLayout` : `canonicalPath` (slug localisé), `alternateUrls` (chemins relatifs, absolutisés par le layout), `x-default = en`. Locale non `localeVisible` = pas de hreflang, pas de sitemap.

## 5. Anti-patterns

Créer un dossier de langue en dur · slug AR en arabe · segment recopié hors `routes.ts` · clé traduite dans 1–3 locales seulement · afficher du FR sous une étiquette AR · lier `TERMS/PRIVACY_SEGMENT` localisés (`/fr/conditions`, `/es/terminos` : aucune page, futurs).

## 6. Checklist / tests

- `pnpm vitest run tests/unit/i18n-routes.test.ts tests/unit/i18n-switch.test.ts tests/unit/i18n-urls.test.ts tests/unit/i18n-translations.test.ts` — étendre les tables aux 4 locales pour toute nouvelle zone.
- Vérifier pa11y/lhci : URLs AR en ASCII (`.pa11yci.cjs`, `lighthouserc.cjs` générés depuis les mêmes slugs).
