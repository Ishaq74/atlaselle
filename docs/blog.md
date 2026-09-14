# Module Blog

> **Fichiers** : `src/database/schemas/blog.schema.ts`, `src/database/loaders/blog.loader.ts`, `src/actions/blog/`, `src/components/blog/`, `src/components/pages/blog/`, `src/pages/[lang]/blog/`, `src/pages/[lang]/admin/blog/`, `src/i18n/blog/`, `src/lib/blog/`
> **Pattern** : Astro 7 SSR + Drizzle ORM + Astro Actions, multi-tenant (blog global **et** blog par organisation)

---

## Table des matières

1. [Architecture générale](#1-architecture-générale)
2. [Modèle de données](#2-modèle-de-données)
3. [Multi-tenant : blog global vs. blog d'organisation](#3-multi-tenant--blog-global-vs-blog-dorganisation)
4. [Routing public](#4-routing-public)
5. [Actions serveur](#5-actions-serveur)
6. [Loaders (lecture)](#6-loaders-lecture)
7. [RBAC & sécurité](#7-rbac--sécurité)
8. [SEO & découvrabilité](#8-seo--découvrabilité)
9. [i18n](#9-i18n)
10. [Tests](#10-tests)
11. [Fonctionnalités connues comme incomplètes](#11-fonctionnalités-connues-comme-incomplètes)
12. [Ajouter une fonctionnalité](#12-ajouter-une-fonctionnalité)
13. [Audit (clôture)](#13-audit-clôture)

---

## 1. Architecture générale

```text
src/
├── database/
│   ├── schemas/blog.schema.ts     # 24 tables Drizzle + relations
│   └── loaders/blog.loader.ts     # Lecture publique + admin, cache TTL (loaders batchés anti-N+1, voir §6)
├── actions/blog/
│   ├── _helpers.ts                 # assertBlogPermission, tenant guards, rate-limit, invalidateBlogCache() ciblée
│   ├── post.ts                     # create/update, lock/unlock, listRevisions
│   ├── lifecycle.ts                # publish/unpublish/archive/restore/duplicate + restoreBlogPostRevision
│   ├── bulk.ts                     # bulkBlogPostLifecycle (non exposé dans la ressource admin)
│   ├── gallery.ts / link.ts        # Galeries, liens manuels entre articles
│   ├── profile.ts                  # updateUserProfile (bio/website/twitter/linkedin)
│   ├── category.ts / tag.ts        # CRUD taxonomies (slugs localisés)
│   ├── comment.ts / review.ts      # Commentaires + avis (public + modération)
│   ├── reaction.ts                 # Réactions + favoris
│   ├── moderation.ts               # Signalements + file de modération
│   ├── view.ts                     # Comptage des vues (viewCount + stats)
│   ├── subscription.ts             # Newsletter (subscribe/confirm/unsubscribe)
│   ├── notification.ts             # Marquer les notifications comme lues
│   └── index.ts                    # Ré-export vers src/actions/index.ts
├── lib/blog/
│   ├── constants.ts                # Enums, valeurs par défaut, slugs réservés
│   ├── types.ts                    # Types dérivés du schéma Drizzle
│   ├── utils.ts                    # Construction d'URLs (buildBlogUrl, org inclus), extraits, TOC, reading time
│   ├── public-visibility.ts        # Prédicat publicBlogPostScope (PUBLISHED + publishedAt <= now)
│   └── validation.ts                # Schémas Zod (formulaires + filtres)
├── modules/blog/ + core/*          # Façade module (capabilities.ts + module.ts + index.ts) consommant les contrats src/core/*
├── components/blog/                # Composants "feature" (cartes, grids, sidebars dont NewsletterSidebar, formulaires…)
├── components/pages/blog/          # Templates de page complets (listing, post BlogPostPage.astro, auteur)
├── pages/[lang]/blog/               # Routes publiques (blog global : index.astro + [...slug].astro seuls)
├── pages/[lang]/admin/blog/          # Admin blog global
└── i18n/blog/{fr,en,es,ar}.ts        # Traductions (labels, admin, statuts, erreurs)
```

---

## 2. Modèle de données

24 tables dans `blog.schema.ts` (la 24e, `blog_subscribers`, est déclarée à `blog.schema.ts:471`) :

| Domaine | Tables |
| :-- | :-- |
| Articles | `blog_posts`, `blog_post_translations`, `blog_post_revisions`, `blog_post_locks` |
| Taxonomies | `blog_categories`, `blog_category_translations`, `blog_tags`, `blog_tag_translations`, `blog_post_categories`, `blog_post_tags` |
| Engagement | `blog_comments`, `blog_comment_moderations`, `blog_post_reviews`, `blog_post_review_helpful`, `blog_post_reactions`, `blog_post_favorites` |
| Modération | `blog_reports` |
| Médias | `blog_post_galleries`, `blog_post_gallery_media` |
| SEO & analytics | `blog_post_seo`, `blog_post_view_stats` |
| Autres | `blog_notifications`, `blog_post_links` |
| Newsletter | `blog_subscribers` (org-scoped, token unique, PENDING/CONFIRMED/UNSUBSCRIBED) |

Points clés :

- **`blog_posts`** porte les champs non traduisibles (statut, auteur, image à la une, compteurs, verrouillage). Une contrainte CHECK garantit `publishedAt IS NOT NULL` dès que `status = 'PUBLISHED'`.
- **`blog_post_translations`** porte tout le contenu localisé (titre, slug, contenu HTML sanitizé, meta SEO). Un post a une ligne par locale ; le slug est unique par `(postId, locale)`.
- Les **catégories et tags** ont eux aussi une table de traduction avec leur propre colonne `slug` (migration `0002`) : le slug public est **localisé**, avec repli sur le slug canonique de `blog_categories`/`blog_tags` pour les lignes historiques sans traduction.
- **Recherche plein texte** : `blog_post_translations.search_vector` (tsvector, GIN) est géré par trigger PostgreSQL (`src/database/infra/00-functions.sql` → `refresh_blog_post_search_vector()`), **pas** par Drizzle — mêmes conventions que `pages.search_vector`. Appliqué via `pnpm db:infra`.

---

## 3. Multi-tenant : blog global vs. blog d'organisation

Une seule table sert les deux cas : `organizationId = NULL` → blog global (accessible à `/​{lang}​/blog`), `organizationId = '<uuid>'` → blog d'une organisation (`/​{lang}​/organizations/​{slug}​/blog`).

> Aucune page `src/pages/[lang]/organizations/*` n'existe dans le dépôt : les URLs d'organisation sont uniquement construites par `buildBlogUrl()` (`src/lib/blog/utils.ts:19`) et listées par `src/pages/sitemap-blog-org.xml.ts:38`. Il n'y a donc pas de routes physiques `organizations/[slug]/blog/` ni `organizations/[slug]/admin/blog/`.

Toutes les actions passent par `resolveBlogTenant(input)` (`_helpers.ts`) puis vérifient l'appartenance de la ressource au tenant avec `assertPostInTenant` / `assertCategoryInTenant` / `assertTagInTenant` **avant** toute lecture/écriture — y compris côté page Astro pour les routes d'édition (404 si `post.organizationId !== tenant attendu`).

> ⚠️ Les identifiants d'organisation better-auth **ne sont pas des UUID** dans ce projet : ne jamais valider `organizationId` avec `z.string().uuid()` dans les schémas d'action blog.

---

## 4. Routing public

| Route | Gabarit |
| :-- | :-- |
| `/{lang}/blog` | Listing (`BlogListingPage.astro`) |
| `/{lang}/blog/{categorySlug}` | Listing filtré par catégorie |
| `/{lang}/blog/tags/{tagSlug}` (segment localisé) | Listing filtré par tag |
| `/{lang}/blog/{routes.author}/{username}` (segment localisé, ex. `/fr/blog/auteur/{username}`) | Profil auteur (`BlogAuthorPage.astro`) |
| `/{lang}/blog/{categorySlug}/{postSlug}` | Détail d'un article (`BlogPostPage.astro`) |
| `/{lang}/organizations/{orgSlug}/blog/...` | Mêmes gabarits, scope organisation (URL construite par `buildBlogUrl()`, sans page physique dédiée) |

Les anciennes URLs `/{lang}/blog/categories/{slug}` et les URLs d'article à un seul segment redirigent (301) vers la forme canonique dès qu'une catégorie existe pour l'article. Les segments `categories`/`tags` proviennent de `src/i18n/blog/*.ts` (`routes.categories`, `routes.tags`) et sont localisés (ex. arabe).

---

## 5. Actions serveur

| Fichier | Actions | Notes sécurité |
| :-- | :-- | :-- |
| `post.ts` | `createBlogPost`, `updateBlogPost`, `deleteBlogPost`, `lockBlogPost`, `unlockBlogPost`, `listBlogPostRevisions` | RBAC + rate-limit + verrou d'édition concurrente |
| `lifecycle.ts:32-35` | `publishBlogPost`, `unpublishBlogPost`, `archiveBlogPost`, `restoreBlogPost` (+ `deleteBlogPost`, `duplicateBlogPost`, `restoreBlogPostRevision`) | Transitions explicites validées, révision + audit + `invalidateBlogCache()` |
| `bulk.ts` | `bulkBlogPostLifecycle` (publish/archive/restore/delete groupés) | Vérifie tenant + locks, non exposé dans la ressource admin (`bulk:false`) |
| `category.ts` / `tag.ts` | CRUD taxonomies | Vérifie l'unicité du slug canonique **et** du slug localisé par tenant |
| `gallery.ts` | `createBlogGallery` / `updateBlogGallery` / `deleteBlogGallery` / `addGalleryMedia` / `removeGalleryMedia` | Ownership tenant vérifiée avant association média |
| `link.ts` | `createBlogLink` / `updateBlogLink` / `deleteBlogLink` | Liens manuels RELATED/PREVIOUS/NEXT/REFERENCE, anti self-link |
| `profile.ts` | `updateUserProfile` | Champs `bio` / `website` / `twitter` / `linkedin` |
| `comment.ts` | `createBlogComment` (public, invités autorisés), `moderateBlogComment` | `sanitizeHtml()` + rate-limit **IP** (`blogPublicRateLimit`, 5 / 5 min) |
| `review.ts` | `createBlogReview` (connecté uniquement), `moderateBlogReview`, `voteBlogReviewHelpful` | `sanitizeHtml()` + rate-limit **utilisateur** (10 / h) |
| `reaction.ts` | `toggleBlogReaction`, `toggleBlogFavorite` | Rate-limit utilisateur (60 / min) |
| `moderation.ts` | `createBlogReport` (public), `updateBlogReport`, `getBlogModerationQueue` | Rate-limit **IP** (10 / 10 min) |
| `view.ts` | `recordBlogPostView` | Appelée côté client (pas au SSR) ; dédoublonnée par IP+post sur 30 min via le rate-limiter |
| `notification.ts` | `markBlogNotificationRead`, `markAllBlogNotificationsRead` | Scopées à `context.locals.user.id` |

Toutes les actions publiques d'écriture (commentaires, avis, réactions, signalements, vues) sont **rate-limitées** — soit par utilisateur (`blogRateLimit`), soit par IP avec repli sur un seau global partagé si l'IP n'est pas résolvable (`blogPublicRateLimit`, même convention que `api/contact.ts`).

---

## 6. Loaders (lecture)

`src/database/loaders/blog.loader.ts` expose :

- **Cachées (TTL, `cached()`)** : `getBlogPosts`, `getBlogPostBySlug`, `getBlogCategories`, `getBlogCategoryBySlug`, `getBlogTags`, `getBlogTagBySlug`, `getBlogAuthorByUsername`, `getRelatedBlogPosts`.
- **Non cachées** (données changeantes / admin) : `getBlogComments`, `getBlogReviews`, `getBlogReviewStats`, `getBlogPostStats`, `getBlogPostForAdmin`, `getBlogPostsForAdmin`, `getBlogModerationQueue`, `getBlogNotifications`, `getUnreadBlogNotificationCount`.

`invalidateBlogCache()` (`_helpers.ts:91-92`) est appelée après chaque mutation blog — elle invalide de façon ciblée les sous-préfixes `blog:post:` / `blog:list:` / `blog:related:` / `blog:author:` / `blog:categories:` / `blog:category:` / `blog:tags:` / `blog:tag:` / `blog:slugs:` / `blog:link-targets:`, pas seulement la clé concernée.

`hydrateBlogPostListItems()` (`blog.loader.ts:65-78`) exécute 5 requêtes batchées pour toute la page (catégories, tags, nb commentaires, moyenne des avis, réactions) au lieu de 5 requêtes par article — pas de pattern N+1. Le cache TTL atténue le coût résiduel.

---

## 7. RBAC & sécurité

- Permissions dans `src/lib/permissions.ts` : ressources `blog`, `blogCategory`, `blogTag`, `blogComment`, `blogReview`, déclinées pour les rôles globaux (`admin`/`editor`/`user`) et les rôles d'organisation (`orgOwner`/`orgAdmin`/`orgMember`).
- Contenu HTML utilisateur (article, commentaire, avis) systématiquement passé par `sanitizeHtml()` (DOMPurify, allowlist définie dans `src/lib/sanitize.ts`) **avant** stockage.
- JSON-LD (schema.org `BlogPosting`/`BreadcrumbList`/`Blog`) échappé via `safeJsonLd()` avant `set:html` dans `BaseLayout.astro`, pour empêcher qu'un titre/contenu contenant littéralement `</script>` ne casse la balise et injecte du HTML arbitraire.
- Les liens de partage social (`ShareBar.astro`) s'ouvrent avec `target="_blank" rel="noopener noreferrer"`.

---

## 8. SEO & découvrabilité

- **Sitemap** (`src/pages/sitemap-cms.xml.ts`) : liste le blog global (listing, catégories, tags, tous les articles publiés) pour chaque locale. Les blogs d'organisation sont listés séparément par `src/pages/sitemap-blog-org.xml.ts` (et `src/pages/sitemap-services-org.xml.ts` pour les services).
- **RSS** (`src/pages/rss.xml.ts`) : agrège pages CMS + articles du blog global, triés par date de publication.
- **Recherche sitewide** (`src/pages/api/search.ts`) : `UNION ALL` entre `pages` + `blog_post` + `service`, re-classé par `ts_rank` commun. Retourne un champ `type: "page" | "blog_post" | "service"` et construit l'URL adaptée (`buildBlogPostUrl` pour le blog).
- Métadonnées par article : meta title/description, Open Graph, Twitter Card, JSON-LD `BlogPosting` + breadcrumb — générées dans les pages `[...slug].astro`.

---

## 9. i18n

`src/i18n/blog/{fr,en,es,ar}.ts` respectent tous la même forme (`satisfies BlogTranslations`, vérifié structurellement par TypeScript). Sections : `meta`, `routes`, `labels`, `admin` (dont `notificationTypes`, `reportReasons`, `taxonomy`, `moderationQueue`…), `statuses`, `errors`.

> Les composants clients (`<script>` Astro) n'ont pas accès aux variables du frontmatter serveur : les libellés traduits nécessaires au JS (toasts, erreurs) sont passés via des attributs `data-t-*` sur un élément du DOM, lus par `dataset` côté client (voir `CommentForm.astro`, `ReactionBar.astro`, `ShareBar.astro`, `AdminModerationQueue.astro` — ce dernier expose `feedbackT.genericError`/`feedbackT.saved` via `data-t-error`/`data-t-saved` — pour des exemples du pattern).

---

## 10. Tests

- **Unitaires** : `tests/unit/blog-*.test.ts` = 14 fichiers (helpers, post-actions, taxonomy-actions, engagement-actions, loader, lifecycle, gallery, link, profile, public-visibility, newsletter, validation…), plus `tests/unit/blog/` (ex. `status-transitions.test.ts`).
- **Intégration** : `tests/integration/blog-actions.test.ts`.
- **E2E** : `tests/e2e/blog.spec.ts` (parcours public + admin, multi-navigateur).
- **A11y/perf** : les URLs `/blog`, `/blog/{category}/{post}` et `/admin/blog` sont incluses dans `.pa11yci.cjs` et `lighthouserc.cjs` pour chaque locale.

Seeds disponibles : `pnpm db:seed` et `pnpm db:seed-media` (aucun script `seed-blog-demo` dans `package.json`).

---

## 11. Éditeur de contenu & liens internes

Le blog utilise un **éditeur de contenu réutilisable et découplé** (`src/components/content/`), conçu pour être réutilisé tel quel par de futurs modules (services, formations…). Le blog ne fournit que son *resolver* de liens internes + un `MediaPicker`.

### 11.1 Architecture découplée

| Couche | Fichier | Rôle |
| --- | --- | --- |
| Helpers purs | `src/lib/content/editor-helpers.ts` | `wrapSelection`, `prefixLines`, `insertAtCaret`, `buildImageToken`, `buildExternalLinkToken`, `buildInternalLinkToken`, `previewHtml`, `detectDeadInternalLinks`, `markDeadInternalLinks`. Aucune dépendance framework. |
| Registre de resolvers | `src/lib/content/internal-link-resolver.ts` | Pattern registry : `registerInternalLinkResolver` / `getInternalLinkResolver`. Interface `InternalLinkResolver { name, resolve, listValidTargets, search }`. Ctx = `{ locale, organizationId? }`. |
| Éditeur UI | `src/components/content/ContentEditor.astro` | Toolbar (gras/italique/titre/liste/lien/image) + preview + dialog lien interne/externe avec recherche. Props : `name`, `value`, `locale`, `organizationId`, `resolverName`, `mediaPickerId`, `label`, `required`, `rows`, `i18n`. |
| Rendu | `src/components/content/RichContent.astro` | Re-sanitize via `sanitizeHtml` (défense en profondeur) + marque les liens morts via `markDeadInternalLinks` si `validTargets` fourni. |
| Resolver blog | `src/lib/blog/blog-internal-link.ts` | `blogInternalLinkResolver` : `resolve` (slug→URL via `getBlogPostBySlug`/`buildBlogPostUrl`), `listValidTargets` (`getBlogPostSlugs`), `search` (titre ilike sur `blogPostTranslations`). |
| Actions | `src/actions/blog/internal-link.ts`, `src/actions/blog/check-links.ts` | `resolveBlogInternalLink` (resolve/search), `checkBlogPostLinks` (rapport liens morts). |

> Le contenu est stocké en **HTML sanitisé** (pas du markdown) — `post.ts` sanitisait déjà à l'écriture ; `RichContent` re-sanitise au rendu. Aucune faille XSS possible sur le contenu éditeur.

### 11.2 Insertion d'images

Le bouton image de `ContentEditor` ouvre le `MediaPicker` (`new CustomEvent('open')`) ; à la sélection (`media-select` → `{ url, alt, fileId }`) il insère un `<img src alt loading="lazy">` via `buildImageToken`. Le blog déclare 4 pickers dans `AdminPostForm.astro:59-62` (`blog-featured-picker`, `blog-og-picker`, `blog-content-picker` pour le corps, `blog-gallery-picker`).

### 11.3 Liens internes & détection des liens morts

- Les liens internes sont marqués `data-internal-link="<target>"` (slug du post) via `buildInternalLinkToken`.
- `checkBlogPostLinks` (action admin, onglet Liens de `AdminPostForm`, bouton « Vérifier les liens ») renvoie :
  - `deadExplicit` : liens manuels `blog_post_links` dont le post cible n'est plus `PUBLISHED`.
  - `deadInline` : `<a data-internal-link>` dans le corps dont la cible n'est plus dans `listValidTargets` (slug supprimé ou changé).
  - Audite `BLOG_LINK_CHECK`.
- Au rendu public, `BlogPostPage` calcule `validTargets = getBlogPostSlugs(organizationId, locale)` et les passe à `PostContent` → `RichContent`, qui ajoute `class="dead-link" data-dead-link="true"` aux liens cassés (CSS `.prose a.dead-link` : rouge, barré, `⚠`).

### 11.4 Réutiliser l'éditeur dans un autre module

1. Créer un `InternalLinkResolver` (ex. `serviceInternalLinkResolver`) et l'enregistrer (`registerInternalLinkResolver`) dans une action dédiée.
2. Ajouter une action `resolve<Module>InternalLink` (copier `internal-link.ts`).
3. Rendre `<ContentEditor resolverName="service" mediaPickerId="..." ... />` + un `<MediaPicker id="...">`.
4. Au rendu, passer `validTargets` (slugs existants) à `<RichContent>`.

---

## 12. Fonctionnalités connues comme incomplètes

_(Aucune fonctionnalité majeure du blog n'est connue comme incomplète à ce jour.)_

### Implémenté dans les dernières itérations

- **Newsletter** (`NewsletterSidebar.astro` + `src/actions/blog/subscription.ts`) : double opt-in complet. Table `blog_subscribers` (org-scoped, token unique, statut PENDING/CONFIRMED/UNSUBSCRIBED). Actions `subscribeBlogNewsletter` (IP rate-limit, email de confirmation), `confirmBlogSubscription` et `unsubscribeBlogNewsletter` (routes API `GET /api/blog/newsletter/confirm` et `/unsubscribe`). Templates email `blog-newsletter.ts` (fr/en/es/ar).
- **Éditeur de contenu réutilisable** : voir [§11](#11-éditeur-de-contenu--liens-internes). `ContentEditor`/`RichContent` découplés du blog, `internal-link-resolver.ts` (registry), insertion d'images via `MediaPicker`, dialog lien interne/externe avec recherche, détection + marquage des liens morts (`checkBlogPostLinks` + `markDeadInternalLinks`).
- **Galeries de post** (`blog_post_galleries` / `blog_post_gallery_media`) : UI admin dans `AdminPostForm.astro` (onglet Galeries) + actions `createBlogGallery` / `updateBlogGallery` / `deleteBlogGallery` / `addGalleryMedia` / `removeGalleryMedia`. Le rendu public reste dans `PostContent.astro`.
- **Liens manuels entre articles** (`blog_post_links` — RELATED/PREVIOUS/NEXT/REFERENCE) : actions `createBlogLink` / `updateBlogLink` / `deleteBlogLink` + loader `getBlogPostLinks`. UI admin dans `AdminPostForm.astro` (onglet Liens). Les « articles similaires » continuent d'utiliser le scoring automatique (`getRelatedBlogPosts`), indépendant de cette table.
- **Profil auteur** : champs `bio` / `website` / `twitter` / `linkedin` sur `user` + action `updateUserProfile` + rendu dans `BlogAuthorPage.astro`.
- **Cache** : invalidation ciblée via `invalidateBlogCache()` (sous-préfixes `blog:post:` / `blog:list:` / `blog:related:` / `blog:author:` / `blog:categories:` / `blog:category:` / `blog:tags:` / `blog:tag:` / `blog:slugs:` / `blog:link-targets:`) au lieu de vider aveuglément `blog:`.
- **Visibilité publique** : `publicBlogPostScope()` (`src/lib/blog/public-visibility.ts:20`) exige `status = 'PUBLISHED'` **et** `publishedAt <= now()` — les posts planifiés restent privés jusqu'à échéance.
- **Présentation** : composants `cards/` (`PostCard`, `PostCardGrid`, `PostCardHorizontal`), `grids/` (`PostGrid`), `sidebars/` (`CategorySidebar`, `TagSidebar`, `NewsletterSidebar`).

---

## 12. Ajouter une fonctionnalité

1. **Nouvelle colonne/table** → `blog.schema.ts`, puis `pnpm db:generate` + `pnpm db:migrate`. Pour un besoin purement SQL (trigger, index, fonction) sans ORM, préférer `src/database/infra/*.sql` + `pnpm db:infra` (voir le pattern `search_vector`).
2. **Nouvelle action** → fichier dédié dans `src/actions/blog/`, en réutilisant `assertBlogPermission`/`resolveBlogTenant`/`assertPostInTenant` de `_helpers.ts`. Rate-limiter systématiquement (`blogRateLimit` si authentifié, `blogPublicRateLimit` si accessible aux invités). Sanitizer tout contenu HTML utilisateur avant stockage. Exporter depuis `actions/blog/index.ts` **et** `actions/index.ts`.
3. **Nouveau champ de traduction** → ajouter la clé à l'interface `BlogTranslations` (`src/i18n/config.ts`) **et** aux 4 fichiers `src/i18n/blog/*.ts` dans le même mouvement (le typage `satisfies` échouera sinon à la compilation).
4. **Nouvelle page publique** → penser à l'ajouter à `sitemap-cms.xml.ts`, `rss.xml.ts` si pertinent, et à `.pa11yci.cjs`/`lighthouserc.cjs` pour rester couvert par les gates a11y/perf.

---

## 13. Audit (suivi)

> **Statut** : tranche P0 de durcissement en cours de validation — voir [`docs/blog/audit.md`](blog/audit.md):10-14. Ce document ne certifie pas une clôture et les anciens totaux de tests en ont été retirés.

Le suivi statique du module Blog (sécurité, performance/loaders, UX/composants, données/schéma, SEO/RSS, observabilité) est consigné dans **[`docs/blog/audit.md`](blog/audit.md)**, avec pour chaque finding : statut de résolution et preuve dans le code/tests. Toute nouvelle itération sur le blog doit y être reportée pour garder la traçabilité.
