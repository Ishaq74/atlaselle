# Skills — Atlaselle

Règle mère : `package.json` + `src/` + configs racine font foi sur toute doc. Vérité temps réel : `docs/ETAT-REEL.md`. Spec : `TODO.md`. Ne jamais éditer `README*.md` (générés par `pnpm readme:generate`).

## Génériques conservés (portables, 9)

`accessibility`, `astro`, `better-auth-best-practices`, `drizzle-orm`, `email-and-password-best-practices`, `organization-best-practices` (charger à la demande : socle = `better-auth-best-practices`), `playwright-best-practices`, `seo` (lien cassé `core-web-vitals` réparé → voir `atlaselle-seo`), `vitest`.

## Retirés le 2026-09-14 (React, contredisent Astro 7 + Starwind)

- `tailwind-v4-shadcn` : prescriptif Vite+React (`ThemeProvider`, `vite.config`) — inapplicable, templates dangereux.
- `shadcn` : CLI React (`shadcn add/init`, registries) — le repo utilise Starwind (`src/components/atoms/`, 48 composants). Ajouter un composant = `docs/design/create-component.md` (voir `atlaselle-ui`).

## Repo — exhaustifs (14, couvrent toute la TODO)

| Skill | Quand | TODO |
|---|---|---|
| `atlaselle-i18n` | langues, slugs, traductions, switcher, RTL | §7 |
| `atlaselle-astro` | pages, layouts, middleware, routage, SSR | §3, §15, §23 |
| `atlaselle-ui` | composants, tokens, formulaires, RTL visuel | §5, §25 |
| `atlaselle-admin` | ressources, dashboards, rôles, révisions, locks | §16–17 |
| `atlaselle-actions` | mutations, loaders, DTO, erreurs, idempotence | §17, §23 |
| `atlaselle-db` | schémas, migrations, seeds, transactions | §21 |
| `atlaselle-auth` | sessions, guards, rôles, orgs | §17–18 |
| `atlaselle-email` | SMTP, templates, file, jobs email | §14 |
| `atlaselle-security` | headers, CSP, rate-limit, sanitize, RGPD | §18–19 |
| `atlaselle-testing` | unit/intégration/E2E, pa11y, lhci, CI | §26–27 |
| `atlaselle-seo` | canonical, hreflang, sitemaps, metadata | §7.8 |
| `atlaselle-media` | upload, validation, alts | §9 |
| `atlaselle-voyage` | cœur métier : 11 modules, prix, dispo, tunnel | §8–14, §31 |
| `atlaselle-observability` | audit, analytics, outbox, jobs, logs | §20, §27 |

Ordre d'implémentation du métier : voir `atlaselle-voyage` §5 (TODO §31). Pas de paiement avant Trip/Departure/Pricing/Availability/Application stabilisés.
