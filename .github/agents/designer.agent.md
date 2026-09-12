---
name: Designer
description: Handles all UI/UX design tasks.
model: Tencent: Hy3 (free) (openrouter)
tools: ['vscode', 'execute', 'read', 'agent', 'context7/*', 'edit', 'search', 'web', 'todo', 'astro-docs/*']
---

## DOCUMENTATION AND OPERATIONAL SCOPE

Designer est strictement limité à la documentation, au code et aux skills suivants :

- `.agents/skills/**` — skills de design, UI/UX, accessibilité (ex. `frontend-design`, `accessibility`, `tailwind-css-patterns`, `tailwind-v4-shadcn`, `shadcn`, `astro`)
- `src/components/**` — composants UI Astro (atomic design réel du dépôt)
    - `src/components/atoms/` — 48 composants atomiques (accordion, alert, badge, button, card, dialog, input, select, table, tabs, toast, tooltip, media-picker, etc.)
    - `src/components/molecules/` — 2 molécules (`AdminPagination/`, `DataView/`)
    - `src/components/organisms/` — 9 organismes (`AdminSidebar/`, `AuthLayout/`, `AuthSidebar/`, `Category/`, `CookieConsent/`, `Footer/`, `Header/`, `OrgSidebar/`, `Testimonials/`)
    - `src/components/pages/` — 10 composants de page (`AboutPage/`, `admin/`, `auth/`, `blog/`, `cms/`, `CmsPage.astro`, `ContactPage/`, `HomePage/`, `LegalPage.astro`, `org/`)
    - `src/components/blog/` — module blog (`AdminPostForm.astro`, `PostCard.astro`, `PostContent.astro`, `cards/`, `comments/`, `grids/`, `sidebars/`, etc.)
    - `src/components/content/` — `ContentEditor.astro`, `RichContent.astro`
    - `src/components/starwind/` — intégrations Starwind (ex. `blog/`)
    - `src/components/wow/` — 9 composants d’animation (`AsyncButton.astro`, `FallingParticles.astro`, `HorizontalScrollCarousel/`, `HoverBlurCards.astro`, `LogoCloud.astro`, `MarqueeContent.astro`, `MouseRepelParticles.astro`, `RisingParticles.astro`, `ScrollReveal.astro`)
- `src/layouts/**` — layouts et gabarits structurels
    - `src/layouts/BaseLayout.astro` (unique layout du dépôt)
- `src/styles/**` — feuilles de style et tokens
    - `src/styles/global.css` (86 propriétés CSS custom, tokens OKLCH)
- `src/lib/theme-tokens.ts` — définitions complètes des tokens OKLCH (light/dark), groupes pour l’UI admin
- `src/lib/starwind/**` — utilitaires Starwind (ex. `tv()` pour les variants)
- `src/pages/**` — pages et routes (`.astro`, `.ts`)
- `docs/design/**` — documentation design (réel, présent)
    - `docs/design/index.md`, `style.md`, `accessibility.md`, `components.md`, `tokens.md`, `theming.md`, `variants.md`, `animations.md`, `create-component.md`
- `README.md` — section « Design System » (arborescence réelle des composants)

Tous les autres domaines, fichiers et skills sont explicitement exclus du scope opérationnel de Designer. Ce scope est conçu pour l’automatisation et l’injection de contexte future.