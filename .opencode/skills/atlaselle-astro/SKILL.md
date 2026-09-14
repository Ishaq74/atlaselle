---
name: atlaselle-astro
description: Atlaselle Astro 7.3.1 SSR patterns ([lang] routing, BaseLayout, middleware, universal pages). Use when creating pages, layouts, endpoints, middleware, or touching routing, SSR, islands, redirects. Covers page Astro, layout, middleware, routage, redirection.
metadata:
  author: atlaselle-repo
  version: "1.0"
---

# Atlaselle Astro natif — patterns obligatoires

Stack : Astro `7.3.1`, `@astrojs/node` `11.1.5` standalone, `output: server` (`astro.config.mjs`). Pas de React, pas de SPA, pas de CMS externe (TODO §29).

## 1. Routage `[lang]` unique

- Toute page publique ET admin sous `src/pages/[lang]/...`. Jamais de dossier `fr|en|es|ar` en dur.
- `src/pages/index.astro` = redirect locale. `404.astro`, `500.astro` existent.
- Pages universelles conservées (`a-propos`, `contact`, `faq`, `terms` — VOULU, `docs/ETAT-REEL.md §5.1`) + `[slug].astro` dynamique (pageRoutes + CMS + hreflang). Les deux servent, consolidation par cross-canonical.
- `src/middleware.ts` : garde locale (404 si `[lang]` invalide) → rewrite segments localisés → session (timeout 5 s → 503) → headers sécurité. Ne pose jamais `dir` (layout s'en charge).

## 2. BaseLayout (`src/layouts/BaseLayout.astro`)

Props : `title?`, `description?`, `alternateUrls?` (chemins relatifs), **`canonicalPath?`** (slug localisé, défaut = pathname), `ogImage?`, `ogType?`, `jsonLd?`.
Le layout pose : `<html lang dir>`, canonical absolu, hreflang absolus + `x-default = en`, OG/Twitter, JSON-LD (via `safeJsonLd`), theme CSS. Fallback nav si menus DB vides (URLs existantes uniquement).
Règle : chaque page localisée passe `canonicalPath` + `alternateUrls` (voir `[slug].astro:56-71` comme modèle). Extraire les gros objets/littéraux en frontmatter, jamais d'appels à virgules multiples inline dans les attributs JSX (casse le parser Astro).

## 3. Couches (TODO §3.2, strict)

UI (`pages/`, `components/`, `layouts/`) → Actions/loaders → Domain services → Repositories/Drizzle.
**Interdits** : Drizzle dans une page/composant · HTML dans une action · règle métier (prix, capacité, workflow) dans l'UI · secret/`.env` dans Git.
Pages : composition + appel service/loader uniquement. Logique dans `src/modules/*/domain/`.

## 4. Formulaires, endpoints, islands

- Mutations = Astro Actions typées + Zod (voir `atlaselle-actions`). Endpoints `src/pages/api/` = webhooks, recherche, exports, cron — avec rate-limit (voir `atlaselle-security`).
- JS client minimal : islands `client:load/idle` uniquement si nécessaire, `prefers-reduced-motion` respecté, images `loading=lazy` sauf hero.

## 5. Config (`astro.config.mjs`)

`i18n` (default `en`, `prefixDefaultLocale`), `security.checkOrigin: true`, `security.csp` (allowlist Stripe à ajouter avec payments), `sitemap` via `sitemap-cms.xml.ts`. `SITE_URL` requis en prod.

## 6. Checklist

- `pnpm check` (zéro erreur sur les fichiers touchés — la dette blog/services/org préexistante ne doit pas augmenter), `pnpm lint`, page rendue dans les 4 locales, canonical + hreflang vérifiés, pas de JS client ajouté sans besoin.
