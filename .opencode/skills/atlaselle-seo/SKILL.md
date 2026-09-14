---
name: atlaselle-seo
description: Atlaselle SEO (canonical, hreflang, sitemaps, structured data). Use when adding public pages, changing URLs/slugs, or touching canonical, hreflang, sitemap, robots, metadata. Covers SEO, canonique, hreflang, sitemap, métadonnées.
metadata:
  author: atlaselle-repo
  version: "1.0"
---

# Atlaselle SEO — canonique, hreflang, sitemaps

État : `docs/ETAT-REEL.md §5`, `docs/lighthouse.md`, `src/core/seo/`. Générique complémentaire : `seo`.

## 1. Règles (Google Search Central)

- `BaseLayout` : `canonicalPath` = slug localisé (défaut = pathname), **hreflang absolus** + `x-default = en`. Locale non publiée = pas de hreflang, pas de sitemap.
- Doublons assumés (statique + `[slug]`, `/fr/trips/*`) : cross-canonical vers le slug localisé, jamais de redirect qui casserait une voie voulue.
- `createSeoMetadata()` : alternates uniquement pour locales `localeVisible`.
- Sitemap : `sitemap-cms.xml.ts` (runtime) + `customSitemaps` dans `astro.config.mjs` (SSR : rien en auto-découverte). N'inclure que page × locale publiées et indexables.
- Preview/admin : `noindex`, hors cache public, hors sitemap. `robots.txt.ts`, `rss.xml.ts` existent.
- OG/Twitter + JSON-LD (`TouristTrip` sur fiches voyage, `WebPage` sur CMS) via `safeJsonLd`.

## 2. URLs

AR = ASCII (voir `atlaselle-i18n`). Mots lisibles + tirets, pas d'ID nus. `og:url` = canonique. Liens internes en percent-encoding si besoin (non-ASCII interdit en `href` brut).

## 3. Métadonnées par langue

`metaTitle`/`metaDescription`/alt hero/OG traduits et validés par langue avant publication (checklist TODO Annexe D). Contenu juridique validé par personne qualifiée **par langue**.

## 4. Anti-patterns

hreflang relatif · `x-default` hors `en` · page non traduite indexée · `noindex` oublié sur preview/admin · canonical vers 404 (ex : anciens segments localisés sans rewrite) · lier `/fr/conditions` ou `/es/terminos` (aucune page).

## 5. Checklist

LHCI SEO ≥ 0.9 (`pnpm a11y:lighthouse`), `pnpm a11y:lighthouse:report`, QA hreflang/canonical sur les 4 locales, sitemap validé, rapports `.lighthouseci/` (gitignored).
