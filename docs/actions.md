# Actions & API Endpoints

> **Fichiers** : `src/actions/` (Astro Actions), `src/pages/api/` (API Routes)  
> **Pattern** : Astro 7.3.1 `defineAction()` + API Routes classiques

---

## Table des matières

1. [Architecture](#1-architecture)
2. [Astro Actions (admin CMS)](#2-astro-actions-admin-cms)
3. [API Endpoints](#3-api-endpoints)
4. [Helpers partagés](#4-helpers-partagés)
5. [Ajouter une action](#5-ajouter-une-action)

---

## 1. Architecture

```text
src/
├── actions/
│   ├── index.ts           # Export centralisé → server { ... } (142 exports)
│   ├── admin/             # 14 fichiers : socle CMS générique
│   │   ├── _helpers.ts    # assertAdmin, assertPermission (RBAC), adminRateLimit, auditAdmin
│   │   ├── site.ts        # updateSiteSettings, upsertSiteSettings
│   │   ├── social.ts      # CRUD liens sociaux + reorder
│   │   ├── contact.ts     # updateContactInfo
│   │   ├── hours.ts       # updateOpeningHours
│   │   ├── menus.ts       # CRUD menus navigation
│   │   ├── navigation.ts  # CRUD items navigation + reorder (assertPermission RBAC)
│   │   ├── pages.ts       # CRUD pages + publish/schedule/bulk/clone/lock (17 exports)
│   │   ├── sections.ts    # CRUD sections + reorder
│   │   ├── theme.ts       # CRUD thèmes
│   │   ├── consent.ts     # updateConsentSettings
│   │   ├── media.ts       # dossiers + fichiers médias (9 exports)
│   │   ├── roles.ts       # rôles org + member roles (5 exports)
│   │   └── versions.ts    # versions de pages (3 exports)
│   ├── blog/              # 19 fichiers : actions du module blog
│   │   ├── index.ts       # barrel de ré-export
│   │   ├── _helpers.ts, bulk.ts, post.ts, lifecycle.ts
│   │   ├── category.ts, tag.ts, comment.ts, review.ts
│   │   ├── reaction.ts, moderation.ts, notification.ts
│   │   ├── link.ts, internal-link.ts, check-links.ts
│   │   ├── gallery.ts, view.ts, profile.ts, subscription.ts
│   └── services/          # 13 fichiers : actions du module services
│       ├── _helpers.ts, service.ts, lifecycle.ts
│       ├── engagement.ts, availability.ts, reactions.ts
│       ├── notification.ts, views.ts, attributes.ts
│       └── taxonomy.ts, moderation.ts, media.ts, internal-link.ts
└── pages/api/             # 14 fichiers
    ├── auth/[...all].ts   # Handler better-auth (catch-all)
    ├── health.ts           # GET — health check (401 sans token/loopback)
    ├── contact.ts          # POST — formulaire de contact public
    ├── upload.ts           # POST — upload fichier
    ├── export-data.ts      # GET — export données RGPD (audit logs limités à 1000)
    ├── audit-export.ts
    ├── content-export.ts
    ├── content-import.ts
    ├── media.ts
    ├── preview.ts
    ├── search.ts
    ├── blog/newsletter/confirm.ts
    ├── blog/newsletter/unsubscribe.ts
    └── cron/publish.ts
```

---

## 2. Astro Actions (admin CMS)

Toutes les actions admin utilisent `defineAction()` d'Astro 7.3.1 avec validation Zod et protection CSRF implicite.

### Liste complète (142 exports dans `src/actions/index.ts`)

Le `server` exporté par `src/actions/index.ts` contient **142 actions** : **42** dont le nom contient `Blog` (`*Blog*`), **40** contenant `Service` (`*Service*`), **4** `bulk*` (`bulkPublishPages`, `bulkArchivePages`, `bulkRestorePages`, `bulkDeletePages` dans `admin/pages.ts`) et **56** autres (socle : site, social, contact, hours, menus, navigation, pages, sections, theme, consent, media, versions, roles — y compris `addGalleryMedia`, `removeGalleryMedia` et `updateUserProfile`, issus du barrel blog mais sans préfixe `Blog`).

| Module | Actions | Fichier |
| :-- | :-- | :-- |
| **Site** | `updateSiteSettings`, `upsertSiteSettings` | `admin/site.ts` |
| **Social** | `createSocialLink`, `updateSocialLink`, `deleteSocialLink`, `reorderSocialLinks` | `admin/social.ts` |
| **Contact** | `updateContactInfo` | `admin/contact.ts` |
| **Horaires** | `updateOpeningHours` | `admin/hours.ts` |
| **Menus** | `createNavigationMenu`, `updateNavigationMenu`, `deleteNavigationMenu` | `admin/menus.ts` |
| **Navigation** | `createNavigationItem`, `updateNavigationItem`, `deleteNavigationItem`, `reorderNavigationItems` | `admin/navigation.ts` |
| **Pages** | `createPage`, `updatePage`, `deletePage`, `publishPage`, `schedulePage`, `unschedulePage`, `scheduleUnpublishPage`, `unscheduleUnpublishPage`, `restoreFromTrash`, `permanentlyDeletePage`, `bulkPublishPages`, `bulkArchivePages`, `bulkRestorePages`, `bulkDeletePages`, `clonePage`, `lockPage`, `unlockPage` (17) | `admin/pages.ts` |
| **Sections** | `createSection`, `updateSection`, `deleteSection`, `reorderSections` | `admin/sections.ts` |
| **Thème** | `createTheme`, `updateTheme`, `deleteTheme` | `admin/theme.ts` |
| **Consentement** | `updateConsentSettings` | `admin/consent.ts` |
| **Médias** | `createMediaFolder`, `updateMediaFolder`, `deleteMediaFolder`, `uploadMediaFile`, `renameMediaFile`, `moveMediaFile`, `deleteMediaFile`, `upsertMediaFileAlt`, `deleteMediaFileAlt` (9) | `admin/media.ts` |
| **Versions** | `createPageVersion`, `listPageVersions`, `restorePageVersion` | `admin/versions.ts` |
| **Rôles** | `listOrgRoles`, `createOrgRole`, `updateOrgRole`, `deleteOrgRole`, `updateMemberRole` | `admin/roles.ts` |
| **Blog** | 42 exports `*Blog*` (+ `addGalleryMedia`, `removeGalleryMedia`, `updateUserProfile`) | `blog/` (19 fichiers, barrel `blog/index.ts`) |
| **Services** | 40 exports `*Service*` | `services/` (13 fichiers) |

### Pattern standard

Chaque action suit le même pattern :

```typescript
export const createNavigationItem = defineAction({
  input: z.object({ /* schema Zod */ }),
  handler: async (input, context) => {
    // 1. Auth + permission RBAC
    const user = await assertPermission(context, { navigation: ["update"] });

    // 2. Rate limit
    adminRateLimit(context, user.id, "nav");

    // 3. Logique métier (Drizzle)
    const db = getDrizzle();
    const [created] = await db.insert(table).values(input).returning();

    // 4. Audit
    auditAdmin(context, user.id, 'NAVIGATION_ITEM_CREATE', {
      resource: 'navigation_item',
      resourceId: created.id,
    });

    // 5. Invalidation cache
    invalidateCache("nav:");

    return created;
  },
});
```

### Validation des URLs

Les champs URL dans les actions sont validés avec restriction de protocole :

| Champ | Protocoles autorisés |
| :-- | :-- |
| Navigation `url` | `http://`, `https://`, `/`, `#`, `mailto:` |
| Site `logoLight/logoDark/favicon/ogImage` | `http://`, `https://`, `/` |
| Contact `mapUrl` | `http://`, `https://` (via `z.url()` + refine) |

---

## 3. API Endpoints

### `POST /api/auth/[...all]`

Handler catch-all better-auth. Gère tous les endpoints d'authentification (sign-in, sign-up, session, etc.).

```typescript
export const ALL: APIRoute = async (ctx) => auth.handler(ctx.request);
```

### `POST /api/upload`

Upload de fichier avec validation complète.

| Étape | Détail |
| :-- | :-- |
| Auth | Session requise |
| Rate limit | 10 req/60s par IP |
| Validation | Type MIME (magic bytes), taille ≤2 MB, fichier non vide |
| Cleanup | Suppression ancien fichier via `oldUrl` (restreint au type) |
| Audit | `FILE_UPLOAD` loggé |
| Retour | `{ url: "/uploads/images/..." }` (201) |

### `GET /api/export-data`

Export RGPD des données utilisateur au format JSON.

| Étape | Détail |
| :-- | :-- |
| Auth | Session requise |
| Rate limit | 5 req/60s par userId |
| Données | user, accounts, sessions, memberships, invitations, audit logs (`.limit(1000)` + `_warning` « Audit logs truncated to 1000 entries. Contact support for full export. » si tronqué) |
| Retour | JSON avec `Content-Disposition: attachment` |

### `GET /api/health`

Health check — vérifie la DB, le SMTP et l'accès disque `public/uploads`.

| Étape | Détail |
| :-- | :-- |
| Auth | **401** `{ error: "Unauthorized" }` sans `HEALTH_TOKEN` (Bearer) ; si `HEALTH_TOKEN` n'est pas configuré, seules les requêtes loopback directes (sans `x-forwarded-for`) sont autorisées |
| Réponse 200/503 | `{ status: "ok"\|"degraded", version, uptime, timestamp, db: { ok }, smtp: { ok, provider }, disk: { uploadsWritable }, cache: { size, hits, misses } }` (503 si DB, SMTP ou disque KO ; `status: "error"` en cas d'exception) |
| Cache | `Cache-Control: no-store` |

### `POST /api/contact`

Soumission du formulaire de contact public. Envoie un email au destinataire configuré via SMTP.

| Étape | Détail |
| :-- | :-- |
| Auth | Aucune (endpoint public) |
| Rate limit | 3 req/5min par IP |
| Validation | Zod schema (firstName, lastName, email, phone, reason, message, urgent, locale) |
| Sanitization | `sanitizeHtml()` sur les champs texte |
| Template | `contact-form` (voir `src/smtp/templates/contact-form.ts`) |
| Audit | `CONTACT_FORM_SUBMIT` loggé |
| Retour | `{ success: true }` (200) |

### `GET /sitemap-cms.xml`

Sitemap XML dynamique des pages CMS, du blog et des services. Génère les URLs pour chaque locale.

| Étape | Détail |
| :-- | :-- |
| Auth | Aucune (endpoint public) |
| Données | `getPagesList()` + `pageRoutes` (i18n) + `getBlogCategories` / `getBlogTags` / `getBlogPosts` + `getServices` / `getServiceCategories` / `getServiceTags`, par locale |
| Retour | XML `sitemap/0.9` avec `Cache-Control: public, max-age=3600` |

---

## 4. Helpers partagés

**Fichier** : `src/actions/admin/_helpers.ts`

### `assertAdmin(context): User`

Vérifie que l'utilisateur est connecté et a le rôle `admin`. Lève une `ActionError` sinon :

- `UNAUTHORIZED` si non connecté
- `FORBIDDEN` si non admin

### `assertPermission(context, permissions): Promise<User>`

Contrôle d'accès RBAC utilisé par les actions (ex. `await assertPermission(context, { navigation: ["update"] })` dans `admin/navigation.ts`). Vérifie la session, rejette les comptes suspendus (`banned`), puis délègue à `auth.api.userHasPermission` avec le rôle de l'utilisateur. Lève une `ActionError` :

- `UNAUTHORIZED` si non connecté
- `FORBIDDEN` si compte suspendu ou permissions insuffisantes

### `adminRateLimit(context, userId, scope, opts?)`

Applique un rate limit par userId et scope. Lève `TOO_MANY_REQUESTS` si dépassé.

| Paramètre | Défaut |
| :-- | :-- |
| `window` | 60s |
| `max` | 30 |
| `scope` | Nom du domaine (`nav`, `site`, `pages`, etc.) |

### `auditAdmin(context, userId, action, opts?)`

Enregistre un événement d'audit de manière non-bloquante (`void`). Extrait automatiquement l'IP et le User-Agent des headers de la requête.

### Bootstrap des modules — `src/lib/cms/bootstrap.ts`

`src/lib/cms/bootstrap.ts` ré-exporte `bootstrapModules` depuis `@/core/modules/bootstrap`. Le middleware (`src/middleware.ts`) l'appelle à chaque requête avant tout traitement, ce qui enregistre les modules blog/services, leurs définitions de recherche et leurs resolvers de liens internes.

### Helpers admin data — `src/lib/auth-data.ts`

Fonctions de lecture pour les pages admin (SSR loaders). Chaque fonction vérifie la session et le rôle `admin` avant d'accéder aux données.

| Fonction | Description |
| :-- | :-- |
| `fetchAdminUsers(headers, opts?)` | Liste paginée des utilisateurs (via better-auth API) |
| `fetchAdminOrgs(headers, opts?)` | Liste paginée des organisations |
| `fetchAdminAuditLogs(headers, page?, perPage?)` | Journal d'audit paginé (JOIN user pour noms) |
| `fetchAdminStats(headers)` | Stats dashboard : totalUsers, totalOrgs, recentSignups |
| `fetchOrgData(headers, orgSlug)` | Données complètes d'une organisation (avec vérification membership) |

---

## 5. Ajouter une action

1. **Créer le fichier** dans `src/actions/admin/` (ou ajouter à un fichier existant)

2. **Définir le schema Zod** avec validation stricte :

   ```typescript
   const input = z.object({
     name: z.string().min(1).max(200),
     url: z.string().max(500)
       .refine((v) => !v || /^(https?:\/\/|\/)/.test(v), "URL invalide")
       .nullable().optional(),
   });
   ```

3. **Implémenter le handler** avec le pattern standard (assertPermission RBAC → rate limit → DB → audit → cache invalidation)

4. **Exporter** dans `src/actions/index.ts` :

   ```typescript
   import { myAction } from './admin/myModule';
   export const server = {
     // ...existing
     myAction,
   };
   ```

5. **Ajouter l'AuditAction** dans `src/lib/audit.ts` si nécessaire

6. **Tester** : ajouter des tests dans `tests/integration/cms-admin.test.ts`
