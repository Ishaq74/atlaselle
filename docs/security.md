# Sécurité

> **Projet** : Atlaselle  
> **Stack** : Astro 7.3.1 (SSR) + better-auth ^1.7.4 + Drizzle/PostgreSQL  
> **Objectif** : OWASP Top 10, WCAG AAA, sécurité multicouches

---

## Table des matières

1. [Architecture de sécurité](#1-architecture-de-sécurité)
2. [Authentification & sessions](#2-authentification--sessions)
3. [En-têtes de sécurité HTTP](#3-en-têtes-de-sécurité-http)
4. [Protection CSRF](#4-protection-csrf)
5. [Sanitisation & XSS](#5-sanitisation--xss)
6. [Rate limiting](#6-rate-limiting)
7. [Validation des uploads](#7-validation-des-uploads)
8. [Audit & journalisation](#8-audit--journalisation)
9. [Validation des entrées](#9-validation-des-entrées)
10. [Variables d'environnement](#10-variables-denvironnement)

---

## 1. Architecture de sécurité

```text
Requête HTTP
  │
  ├─ Middleware (src/middleware.ts)
  │   ├─ Session injection (auth.api.getSession, timeout 5s)
  │   ├─ SVG Content-Disposition (XSS prevention)
  │   └─ En-têtes de sécurité (HSTS, X-Frame-Options, etc.)
  │
  ├─ Guards (src/lib/auth-guards.ts)
  │   ├─ requireAuth() → redirige les guests vers /sign-in
  │   └─ requireAdmin() → redirige non-admins vers /dashboard
  │
  ├─ Rate limiting
  │   ├─ better-auth (100 req/60s global, `/sign-in/email`: 5/10s, `/sign-up/email` + `/forget-password`: 3/60s…) → auth endpoints
  │   └─ Custom (src/lib/rate-limit.ts) → admin actions, uploads, exports
  │
  ├─ Validation (Zod + Astro Actions)
  │   ├─ Input validation avec z.string(), z.email(), z.url()
  │   ├─ Protocol validation (http/https only, pas de javascript:)
  │   └─ Sanitisation HTML (DOMPurify, 500 KB max)
  │
  └─ Audit (src/lib/audit.ts)
      └─ ≈160 types d'événements → table audit_log PostgreSQL
```

---

## 2. Authentification & sessions

**Bibliothèque** : [better-auth](https://www.better-auth.com/) ^1.7.4

| Fonctionnalité | Détail |
| :-- | :-- |
| Stockage sessions | Cookies `httpOnly`, `secure`, signés |
| Hash mots de passe | scrypt par défaut (better-auth built-in, format `s:<hash>:<salt>`) — ni Argon2 ni bcrypt configurés |
| Vérification email | Flow email avec token, envoi via SMTP |
| Plugins actifs | `admin`, `organization`, `username` |
| Trusted origins | Validé via `BETTER_AUTH_URL` (protocole http/https vérifié ; `throw` **seulement** dans `sendInvitationEmail` organisation) |

### Guards d'accès

```typescript
// src/lib/auth-guards.ts
requireAuth(Astro)   // → user + locale + authT, ou redirect /sign-in
requireAdmin(Astro)  // → idem + vérifie user.role === 'admin'
```

### Actions admin

```typescript
// src/actions/admin/_helpers.ts
assertAdmin(context)              // throw UNAUTHORIZED, FORBIDDEN, ou FORBIDDEN si banni
adminRateLimit(context, userId)   // throw TOO_MANY_REQUESTS
auditAdmin(context, userId, action, opts)  // log non-bloquant
```

---

## 3. En-têtes de sécurité HTTP

Définis dans `src/middleware.ts` et appliqués à **toutes les réponses** :

| En-tête | Valeur | Protection |
| :-- | :-- | :-- |
| `X-Content-Type-Options` | `nosniff` | MIME sniffing |
| `X-Frame-Options` | `DENY` | Clickjacking |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Fuite de referer |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=()` | API device |
| `X-XSS-Protection` | `0` | Désactive filtre XSS legacy (peut causer des bugs) |
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains; preload` | Force HTTPS |
| `Cross-Origin-Opener-Policy` | `same-origin` | Isolation du contexte de navigation |
| `Cross-Origin-Resource-Policy` | `same-origin` | Restreint le chargement cross-origin des ressources |
| `Cross-Origin-Embedder-Policy` | `credentialless` | Isolation des embeds cross-origin |

### CSP (`astro.config.mjs`)

Directives Content-Security-Policy (`security.csp.directives`) : `default-src 'self'`, `img-src 'self' data: blob:`, `font-src 'self'`, `connect-src 'self' https://api.iconify.design`, `frame-src https://www.google.com https://www.youtube.com https://player.vimeo.com`, `frame-ancestors 'none'`, `base-uri 'self'`, `form-action 'self'`, `object-src 'none'`, `upgrade-insecure-requests` (hashes des scripts/styles gérés par Astro).

### SVG XSS Prevention

Les fichiers SVG uploadés (`/uploads/*.svg`) sont servis avec :

- `Content-Disposition: attachment` — force le téléchargement au lieu du rendu
- `Content-Type: image/svg+xml` — empêche l'interprétation HTML
- Détection case-insensitive (`.svg`, `.SVG`, `.Svg` — tous interceptés)

---

## 4. Protection CSRF

### Astro `security.checkOrigin` (framework-level)

Astro v5+ enables `checkOrigin: true` by default. This is explicitly set in `astro.config.mjs` for clarity:

```javascript
security: {
  checkOrigin: true,
}
```

**Fonctionnement** :

- Vérifie que l'en-tête `Origin` de la requête correspond à l'URL du serveur
- S'applique aux méthodes **POST, PATCH, DELETE, PUT** avec des Content-Type spécifiques (`application/x-www-form-urlencoded`, `multipart/form-data`, `text/plain`, `application/json`)
- Retourne **403 Forbidden** si l'origine ne correspond pas
- Protège automatiquement **tous les endpoints API** (`/api/contact`, `/api/upload`, `/api/export-data`, `/api/audit-export`, etc.) et **tous les Astro Actions** (`/_actions/*`)

**Endpoints couverts** :

| Endpoint | Méthode | Protection |
| :-- | :-- | :-- |
| `/api/contact` | POST | ✅ checkOrigin |
| `/api/upload` | POST | ✅ checkOrigin |
| `/api/content-import` | POST | ✅ checkOrigin |
| `/api/export-data` | GET | N/A (GET non-mutant) |
| `/api/audit-export` | GET | N/A (GET non-mutant) |
| `/api/content-export` | GET | N/A (GET non-mutant) |
| `/api/search` | GET | N/A (GET non-mutant) |
| `/api/media` | GET | N/A (GET non-mutant) |
| `/api/preview` | GET | N/A (GET non-mutant) |
| `/_actions/*` | POST | ✅ checkOrigin + Astro Actions built-in |
| `/api/auth/*` | POST | ✅ checkOrigin + better-auth SameSite cookies |

### Astro Actions (POST)

Les `defineAction()` d'Astro 7 incluent une protection CSRF implicite :

- Vérification automatique de l'origine de la requête (via `checkOrigin`)
- Les actions sont exposées comme endpoints publics (`/_actions/{name}`) — les mêmes vérifications d'autorisation que pour les endpoints API s'appliquent

### better-auth

- Cookie `__Secure-` avec `SameSite=Lax`
- Validation des trusted origins côté serveur

### Points d'attention

- Les requêtes GET **ne sont pas protégées** par CSRF — ne jamais faire d'action state-changing via GET
- Les endpoints GET authentifiés (`/api/export-data`, `/api/audit-export`) utilisent des vérifications de session + rate limiting comme protection complémentaire
- `checkOrigin` requiert que le navigateur envoie l'en-tête `Origin` — les clients API (curl, Postman) doivent le fournir explicitement

---

## 5. Sanitisation & XSS

### DOMPurify (`src/lib/sanitize.ts`)

```typescript
sanitizeHtml(dirty: unknown): string
```

| Paramètre | Détail |
| :-- | :-- |
| Tags autorisés | `p`, `b`, `i`, `u`, `strong`, `em`, `a`, `ul`, `ol`, `li`, `h1`–`h6`, `blockquote`, `img`, `br`, `hr`, `table`, `thead`, `tbody`, `tr`, `th`, `td`, `code`, `pre`, `span`, `div`, `figure`, `figcaption`, `sub`, `sup`, `mark`, `small` |
| Attributs autorisés | `href`, `src`, `alt`, `title`, `class`, `target`, `rel`, `width`, `height`, `colspan`, `rowspan`, `loading`, `id` (headings uniquement, valeur contrôlée), `data-internal-link` (liens `<a>` uniquement, valeur contrôlée) |
| Taille max | 500 000 caractères (≈500 KB) — au-delà, **throw** `Error` |
| Input non-string | Retourne `""` |
| URLs (`<a href>`) | `safeUrl()` — `http(s)://`, `mailto:`, `tel:`, `/chemin` uniquement |
| Embeds (`<iframe src>`) | `safeEmbedUrl()` — `https://` uniquement |
| JSON-LD | `safeJsonLd()` — échappe `<` en `\u003c` (anti-`</script>`) |
| Nouvel onglet | `rel="noopener noreferrer"` forcé sur `target="_blank"` (anti reverse-tabnabbing) |

### Auto-escaping Astro

Les expressions `{}` dans les templates `.astro` sont automatiquement échappées par le framework :

```astro
<span>{user.name}</span>  <!-- safe — auto-escaped -->
```

### Email templates

Les templates email (`src/smtp/templates/layout.ts`) utilisent une fonction `esc()` manuelle pour échapper les variables interpolées dans le HTML généré côté serveur.

---

## 6. Rate limiting

### Double couche

| Couche | Scope | Implémentation |
| :-- | :-- | :-- |
| **better-auth** (built-in) | Auth endpoints | 100 req/60s global + 7 `customRules` (voir ci-dessous) |
| **Custom** (`src/lib/rate-limit.ts`) | Admin actions, uploads, exports | Fixed-window in-memory via `getRateLimitStore()` pluggable |

### Règles better-auth (`src/lib/auth.ts`)

| Règle | Window | Max |
| :-- | --: | --: |
| Global | 60s | 100 |
| `/sign-in/email` | 10s | 5 |
| `/sign-up/email` | 60s | 3 |
| `/forget-password` | 60s | 3 |
| `/reset-password/*` | 60s | 5 |
| `/change-password` | 60s | 5 |
| `/delete-user/*` | 60s | 2 |
| `/organization/create` | 60s | 5 |

### Endpoints et limites custom

| Endpoint | Clé | Window | Max |
| :-- | :-- | --: | --: |
| `POST /api/upload` | `upload:{ip}` | 60s | 10 |
| `GET /api/export-data` | `export:{userId}` | 60s | 5 |
| `GET /api/content-export` | `content-export:{userId}` | 60s | 5 |
| `POST /api/content-import` | `content-import:{userId}` | 60s | 3 |
| `GET /api/audit-export` | `audit-export:{userId}` | 60s | 5 |
| `GET /api/search` | `search_<clientAddress>` | 60s | 60 |
| `POST /api/contact` | `contact:{ip}` (fallback global `contact:__global__`) | 300s | 3 (10 en global) |
| `GET /api/preview` | `preview:{userId}` (admin uniquement + audit `PAGE_PREVIEW`) | 60s | 30 |
| Admin actions (CMS) | `admin-{scope}:{userId}` | 60s | 30 |
| Blog actions | `blog-{scope}:{userId}` | 60s | 30 |

> **Limitation** : le store est en mémoire process-local (`MemoryRateLimitStore`, voir `src/lib/store.ts` — backend interchangeable via `setStores()`). En déploiement multi-instance, chaque nœud a son propre compteur. Migration Redis recommandée pour le scaling.
>
> **Garde-fous** (`src/lib/rate-limit.ts`) : `MAX_ENTRIES = 10000` — à capacité atteinte (après purge des expirées), rejet fail-closed ; jitter ±2s sur `resetAt` lors du refus pour empêcher le timing d'attaquant.

Voir [rate-limit.md](rate-limit.md) pour le détail de l'API.

---

## 7. Validation des uploads

**Fichier** : `src/media/upload.ts`

| Contrôle | Détail |
| :-- | :-- |
| Auth obligatoire | Session vérifiée |
| Rate limit | 10 uploads / 60s par IP |
| Type MIME | Magic bytes (pas l'extension) — JPEG, PNG, WebP, AVIF, ICO, SVG |
| Taille max | 2 MB par défaut ; SVG limité à 256 KB (sanitisation coûteuse) |
| Fichier vide | Rejeté (`file.size === 0`) |
| SVG | Sanitisé via DOMPurify avant écriture (rejeté si vide après sanitisation) |
| Nommage | `randomUUID()` + extension déduite du MIME — empêche les collisions et la prédiction |
| Variantes WebP | Générées via sharp (`quality: 80`) pour JPEG/PNG |
| Path traversal | Sous-dossier validé (`/^[a-zA-Z0-9_-]+(?:\/[a-zA-Z0-9_-]+)?$/`) ; `oldUrl` restreint au répertoire du type d'upload + regex 2 sous-dossiers (`^/uploads/[a-zA-Z0-9_-]+/[a-zA-Z0-9_-]+/[a-zA-Z0-9_-]+\.[a-zA-Z0-9]+$`) ; `deleteUpload()` vérifie `resolve().startsWith(uploadsRoot)` |
| Suppression ciblée | `oldUrl` restreint au répertoire du type d'upload (pas de suppression cross-type) |
| Messages d'erreur | Génériques — ne révèlent pas le type MIME détecté |

---

## 8. Audit & journalisation

≈160 types d'actions audités, incluant les tentatives échouées (`_FAILED`) pour les opérations d'authentification.

Voir [audit.md](audit.md) pour le détail complet.

### Logs d'échec auth

| Action | Événement loggé |
| :-- | :-- |
| `/sign-in/email` échoué | `SIGN_IN_FAILED` |
| `/sign-up/email` échoué | `SIGN_UP_FAILED` |
| `/change-password` échoué | `PASSWORD_CHANGE_FAILED` |
| `/reset-password` échoué | `PASSWORD_RESET_COMPLETE_FAILED` |

### Métadonnées d'audit

- Type validé (`typeof string`)
- Longueur limitée (≤255 caractères par valeur)
- Extraction IP : `x-forwarded-for` puis `x-real-ip` **seulement si `TRUST_PROXY === "true"`**, sinon `clientAddress` — validation IPv4/IPv6 via `isIP()`

---

## 8b. Isolation des tenants — blog (pas de bypass superuser)

**Comportement réel** (voir `src/actions/blog/_helpers.ts` → `hasBlogPermission` / `assertBlogPermission`) :

> Il n'y a **pas de bypass superuser** : même un utilisateur avec `role === "admin"` passe par la vérification RBAC. En contexte org (`isOrgContext`), la permission est vérifiée via `auth.api.hasPermission({ organizationId: tenant.organizationId, permissions })` ; hors contexte org, via `auth.api.userHasPermission({ userId, permissions })`. Un compte banni est rejeté avant toute vérification. L'appartenance au tenant est stricte : `assertPostInTenant` / `assertCategoryInTenant` / `assertTagInTenant` / `assertMediaInTenant` comparent `(ressource.organizationId ?? null) !== tenant.organizationId` et lèvent `FORBIDDEN` en cas de mismatch.

**Mitigations en place** :
- Toute action passe par `assertBlogPermission` (RBAC) + `blogRateLimit` + `auditBlog` (traçabilité).
- Les écritures sont auditées (`BLOG_POST_*`, `BLOG_COMMENT_*`, etc.) → détection a posteriori.

> Toute modification de ce modèle (ex. ajout d'un bypass admin global) doit être validée par le threat model et re-documentée ici.

---

## 9. Validation des entrées

### Zod schemas (Astro Actions)

Toutes les actions admin utilisent des schemas Zod stricts :

| Champ | Validation |
| :-- | :-- |
| URLs (navigation) | `http://`, `https://`, `/`, `#`, `mailto:` uniquement |
| URLs (site settings) | `http://`, `https://`, `/` uniquement |
| URLs (contact map) | `http://`, `https://` uniquement (via `z.url()` + refine) |
| Email | `z.email()` + max 254 chars |
| Coordonnées GPS | Regex décimal + bornes (`-90..90`, `-180..180`) |
| Pagination | `offset ≥ 0`, `1 ≤ limit ≤ 100` (bornes forcées côté serveur) |

### SQL Injection

- **Drizzle ORM** : requêtes paramétrées par défaut
- **CLI commands** : validation regex `^[a-zA-Z_][a-zA-Z0-9_]*$` pour les noms de tables/colonnes dans `db:compare` et `db:sync`

---

## 10. Variables d'environnement

| Variable | Usage | Sensible |
| :-- | :-- | :-- |
| `BETTER_AUTH_SECRET` | Signature des cookies / tokens | ✅ |
| `BETTER_AUTH_URL` | URL de base pour les liens d'invitation org (emails) | ⚠️ protocole http/https validé, `throw` si absente/invalide — **seulement** dans `sendInvitationEmail` organisation |
| `DATABASE_URL` | Connexion PostgreSQL | ✅ |
| `SMTP_FROM_EMAIL` | Adresse expéditeur | Non |
| `SMTP_FROM_NAME` | Nom expéditeur | Non |
| `BREVO_API_KEY` / `RESEND_API_KEY` | API keys SMTP | ✅ |
| `SMTP_HOST/PORT/USER/PASS` | Credentials Nodemailer | ✅ |

> **Règle** : jamais de secret dans le code source. Toutes les variables sensibles sont lues depuis `.env` (non versionné).
