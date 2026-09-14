---
name: atlaselle-testing
description: Atlaselle QA (Vitest, Playwright, Pa11y AAA, Lighthouse). Use when writing tests, fixing flakes, or touching CI, coverage, a11y, performance budgets. Covers test, QA, E2E, accessibilité, performance, Playwright, Vitest.
metadata:
  author: atlaselle-repo
  version: "1.0"
---

# Atlaselle Testing — pyramide et gates

Docs : `docs/testing/` (8 guides), `docs/lighthouse.md`. État réel : `docs/ETAT-REEL.md §3`. Génériques : `vitest`, `playwright-best-practices`, `accessibility`.

## 1. Pyramide et commandes

- Unit (`tests/unit/`, ~83 fichiers, Node, alias `@`, `@i18n`…) : `pnpm test`. Seuils `vitest.config.ts` : statements 80, branches 75, functions 75, lines 80. Rapport JSON `tests/reports/vitest-results.json`.
- Intégration (`tests/integration/`, 15 fichiers, PostgreSQL requis) : mêmes commandes.
- E2E (`tests/e2e/`, 6 specs : app, auth, blog, cms-admin, services, services-lifecycle) : `pnpm test:e2e` (Chromium + Firefox + WebKit). Pattern robuste obligatoire : `Promise.all([page.waitForURL(…), click])` + `waitForLoadState('networkidle')`, navigations `waitUntil: networkidle`, timeouts 30 s (fini les `test.skip(webkit)`).
- A11y/perf : `pnpm a11y` (orchestrateur `tests/a11y/run.cjs`). Pa11y `.pa11yci.cjs` : **WCAG2AAA**, `ignore: color-contrast` (axe-core ne résout pas OKLCH — paires AAA vérifiées manuellement), 60 URLs. LHCI `lighthouserc.cjs` : gates **≥ 0.9** (perf/a11y/best-practices/seo), 32 publiques + 8 auth + 20 admin, batches séparés (pas de headers par URL).

## 2. Règles i18n/SEO des tests

URLs AR en **ASCII** dans `.pa11yci.cjs`/`lighthouserc.cjs` (jamais de slug arabe). Tables de tests étendues aux **4 locales** (voir `i18n-routes`/`i18n-switch`/`i18n-urls` comme modèles). QA E2E voyage : scénario complet EN/FR/AR/ES + RTL visuel AR.

## 3. Robustesse voyage (TODO §26.5, à tester)

Dernière place × 2 acheteuses (`DEPARTURE_SOLD_OUT`), expiration hold, retry paiement, webhook dupliqué (= 1 paiement, 1 réservation, 1 confirmation), annulation + remboursement, verrouillage optimiste admin.

## 4. CI (`.github/workflows/ci.yml` + CodeQL + Dependabot)

Lint & check → unit/integration (PG16) → E2E 3 navigateurs → a11y-perf → build. Rapports uploadés (7 jours). Ne jamais merger rouge. Compteurs docs obsolètes interdits — recompter (`docs/ETAT-REEL.md §6`).

## 5. Anti-patterns

Test qui dépend de l'ordre · fixture non seedée · E2E sans `networkidle` · slug arabe en dur · seuil coverage baissé pour faire passer · composant UI testé via Container API expérimentale (P4 assumé, voir `gaps.md`).
