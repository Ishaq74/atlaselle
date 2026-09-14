---
name: atlaselle-ui
description: Atlaselle design system (Starwind atoms, tokens, RTL, dark mode). Use when building components, pages UI, forms, or touching styles, themes, accessibility visuals. Covers composant, design, style, thème, RTL, formulaire.
metadata:
  author: atlaselle-repo
  version: "1.0"
---

# Atlaselle UI — Starwind + tokens (pas de shadcn CLI, pas de React)

## 1. Sources

- Atomes : `src/components/atoms/` (**48 dossiers**, Starwind = port Astro de shadcn — ne JAMAIS lancer `shadcn add/init` ni copier de composant React/Vite).
- `molecules/` (3), `organisms/` (Header, Footer, `AdminFormShell`, `MediaPicker`, `CookieConsent`…), `pages/` (composants de page), `blog/`, `services/`, `content/`, `wow/` (animations).
- Tokens : `src/styles/global.css` (fichier unique — pas de `globals.css` ni `design-tokens.css`), config `starwind.config.json`. Spec : `docs/design/` (`tokens.md`, `components.md`, `variants.md`, `create-component.md`, `theming.md`).

## 2. Règles

- Toujours composer depuis les atomes (jamais de `<button>`/`<input>` brut recréé, jamais de Button admin maison).
- Styles via tokens + Tailwind 4. Dark mode via tokens (pas de ThemeProvider React).
- **RTL arabe** : propriétés logiques CSS uniquement (`margin-inline-start`, pas `margin-left`), isolation bidi (`<bdi>`/`unicode-bidi: isolate`) pour prix/dates/emails dans une page RTL, chiffres 0-9, ordre de tabulation logique, `dir` posé par le layout.
- Accessibilité : HTML sémantique, labels `for`/`id`, erreurs liées (`aria-invalid`/`aria-describedby`), contraste, focus visible, `alt` obligatoire (vide si décoratif). Cible Pa11y WCAG2AAA non strict (voir `atlaselle-testing`).

## 3. Formulaires admin

`AdminFormShell` + sections/tabs/footer/dirty-guard (`src/components/organisms/AdminFormShell.astro`). Flux : UI → payload typé → Action → permission → validation → service → transaction → révision → audit → invalidation cache (TODO §16.4).

## 4. Anti-patterns

Nouveau composant qui duplique un atome · CSS en propriétés physiques · texte arabe avec prix non isolé · JS client pour ce que HTML+CSS font · dépendance UI ajoutée sans arbitrage (TODO §29).

## 5. Checklist

- Rendu FR/EN/ES/AR vérifié (miroir RTL), `pnpm a11y:pa11y`, tokens utilisés (pas de couleur en dur), `docs/design/create-component.md` suivi pour tout nouvel atome.
