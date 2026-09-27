# Sécurité

> **Projet** : Atlaselle  
> **Stack** : Astro 7.3.1 (SSR) + better-auth ^1.7.4 + Drizzle/PostgreSQL  
> **Objectif** : OWASP Top 10, WCAG AAA, sécurité multicouches
>
> **Règle de rédaction** : toute affirmation de sécurité de ce document est adossée soit au code du dépôt, soit au code du framework dans `node_modules/astro/`. Ce qui n'est pas vérifiable n'est pas écrit. Les compteurs sont recomptés à partir des fichiers, jamais repris d'un autre document.

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
11. [Contrat des formulaires](#11-contrat-des-formulaires)

---

## 1. Architecture de sécurité

```text
Requête HTTP
  │
  ├─ security.allowedDomains (astro.config.mjs → Astro, amont)
  │   └─ validation des en-têtes de transfert de l'origine publique
  │
  ├─ security.checkOrigin (Astro, amont)
  │   └─ 403 sur soumission de formulaire intersite (contenus de formulaire seulement)
  │
  ├─ Middleware (src/middleware.ts)
  │   ├─ reportRejectedForwardedHeaders() → audit INFRA_PROXY_HEADER_REJECTED
  │   ├─ Request ID (UUID valide entrant, sinon régénéré)
  │   ├─ runRequestChain() : locale guard, rewrite localisé, session, SVG
  │   └─ applySecurityHeaders() → UNIQUE point d'application, après la chaîne
  │
  ├─ Guards (src/lib/auth-guards.ts)
  │   ├─ requireAuth() → redirige les guests vers /sign-in
  │   └─ requireAdmin() → redirige non-admins vers /dashboard
  │
  ├─ Rate limiting
  │   ├─ better-auth (100 req/60s global, `/sign-in/email`: 5/10s, `/sign-up/email` + `/forget-password`: 3/60s…) → auth endpoints
  │   └─ Custom (src/lib/rate-limit.ts) → admin actions, uploads, exports, search
  │
  ├─ Validation (Zod + Astro Actions)
  │   ├─ Input validation avec z.string(), z.email(), z.url()
  │   ├─ Protocol validation (http/https only, pas de javascript:)
  │   └─ Sanitisation HTML (DOMPurify, 500 KB max)
  │
  └─ Audit (src/lib/audit.ts)
      └─ 179 types d'événements → table audit_log PostgreSQL
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

Définis dans `src/middleware.ts` (`SECURITY_HEADERS`) et appliqués par `applySecurityHeaders()`, **appelé une seule fois** dans `onRequest` **après** le retour de `runRequestChain()` :

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

`X-Request-Id` est posé par la même fonction, depuis `context.locals.requestId`. **Dix en-têtes au total** : les neuf ci-dessus plus `X-Request-Id`.

### Point d'application unique

`onRequest` ne retourne jamais directement : il attend `runRequestChain()` puis appelle `applySecurityHeaders(response, requestId)` sur l'objet `Response` réellement produit, avant de le retourner.

Conséquence : **aucune sortie précoce ne peut court-circuiter l'application des en-têtes.** `runRequestChain()` comporte trois sorties qui court-circuitent `next()` :

| Sortie | Constatée dans | En-têtes appliqués |
| :-- | :-- | :-- |
| 404 de locale invalide (`/xx/trips`) | `runRequestChain()` | ✅ |
| 301 de canonicalisation de casse (`/EN/trips` → `/en/trips`) | `runRequestChain()` | ✅ |
| 503 de session indisponible (timeout 5 s) | `runRequestChain()` | ✅ |
| Rewrite localisé (`/fr/voyages/…` → `/fr/trips/…`) | `context.rewrite()` | ✅ |
| Réponse rendue par la route | `next()` | ✅ |

> **Historique** : l'application des en-têtes se faisait à l'intérieur de la chaîne, après `next()`. Les trois premières sorties repartaient donc **sans aucun en-tête de sécurité**. Le point d'application unique est la correction ; il est verrouillé par `tests/unit/voyage/middleware.test.ts` (bloc « en-têtes de sécurité sur les sorties précoces »).

### La 301 est construite, pas créée par `Response.redirect()`

**Correction contre-intuitive à connaître avant de modifier `src/middleware.ts`.**

La redirection de canonicalisation est écrite ainsi :

```typescript
// src/middleware.ts — runRequestChain()
const location = `${url.origin}/${lower}${url.pathname.slice(3)}${url.search}`;
return new Response(null, { status: 301, headers: { Location: location } });
```

et **non** `Response.redirect(location, 301)`.

Raison : `Response.redirect()` renvoie une `Response` dont les en-têtes portent le guard interne `immutable`. `headers.set()` sur une telle réponse **lève une `TypeError`**. Écrire les en-têtes de sécurité dessus ferait donc échouer le point d'application unique — et, par conséquent, **toute la suite de la chaîne** : le wrapper de `next()` laisserait remonter l'exception et la requête entière répondrait en erreur. La 301 doit rester une `Response` **construite**, sans corps et mutable.

Ce verrou est explicitement testé (`la réponse expose des en-têtes MUTABLES`).

> **Portée exacte de la mention « immuable » — à ne pas élargir.** Le guard `immutable` est une propriété des en-têtes d'une `Response` fabriquée par la plateforme (`Response.redirect()`, `Response.error()`). Il ne concerne **aucun** en-tête que le middleware écrit lui-même. Le `Location` de la 301 est posé sur une `Response` **construite** ; les dix en-têtes de sécurité et la protection SVG (`Content-Disposition`, `Content-Type`) sont posés sur la réponse rendue par `next()`. Tous ces en-têtes sont **mutables**, et le point d'application unique repose sur cette mutabilité. Écrire « les en-têtes sont immuables » sans désigner `Response.redirect()` serait faux.

### SVG XSS Prevention

Les fichiers SVG uploadés (`/uploads/*.svg`) sont servis avec :

- `Content-Disposition: attachment` — force le téléchargement au lieu du rendu
- `Content-Type: image/svg+xml` — empêche l'interprétation HTML
- Détection case-insensitive (`.svg`, `.SVG`, `.Svg` — tous interceptés)

### CSP (`astro.config.mjs`)

`security.csp.directives` contient **exactement neuf directives**, dans cet ordre :

1. `default-src 'self'`
2. `img-src 'self' data: blob:`
3. `font-src 'self'`
4. `connect-src 'self' https://api.iconify.design https://api.stripe.com`
5. `frame-src https://www.google.com https://www.youtube.com https://player.vimeo.com https://js.stripe.com https://hooks.stripe.com`
6. `frame-ancestors 'none'`
7. `base-uri 'self'`
8. `form-action 'self'`
9. `object-src 'none'`

> **Compteur** : neuf directives. `scriptDirective.resources` est une clé séparée (`["'self'", 'https://js.stripe.com']`) et ne compte pas dans les directives. Les hashes des scripts/styles inline sont gérés par Astro.

#### `upgrade-insecure-requests` a été retirée — ne pas la réintroduire

La directive **n'est plus émise**. Trois raisons, toutes vérifiées :

1. **Elle était émise inconditionnellement, y compris sur une origine HTTP.** Sur une origine en clair, son seul effet était de faire réécrire par WebKit les sous-ressources vers `https://`. Sur un serveur d'écoute en clair (ce que fait le job E2E, qui sert sur `http://localhost:4322`), **aucun script ne pouvait alors se charger** : les formulaires d'authentification, les listes déroulantes et les toasts restaient inertes. C'était une rupture fonctionnelle, pas un durcissement.
2. **Elle était redondante sur une origine HTTPS.** La source `'self'` ne résout que vers `https://` : aucune sous-ressource HTTP ne peut donc se charger. Et les listes explicites (`connect-src`, `frame-src`, `scriptDirective.resources`) ne nomment **que des origines HTTPS**. La directive n'ajoutait donc aucune restriction que les listes déjà présentes n'imposaient pas.
3. **`block-all-mixed-content` n'est pas une directive autorisée par Astro.** Elle ne doit pas la remplacer. Le mélange de contenu est déjà couvert par la règle HTTPS ci-dessus.

> **Corollaire de test** : `tests/e2e/credential-url-leak.spec.ts` reproduit le mode de défaillance du 23/09 (WebKit réécrivait les `/_astro/*.js`, le navigateur soumettait nativement) de façon déterministe, en lançant un contexte Playwright avec `javaScriptEnabled: false`. Ce test ne dépend donc plus de la directive.

### `security.allowedDomains` — validation des en-têtes de transfert

```javascript
// astro.config.mjs
allowedDomains: [{ hostname: siteUrl.hostname }],
```

Le motif dérive de **la même variable d'environnement** que `site` et que l'index de sitemap : `SITE_URL` (voir `resolveSiteUrl()` et §10). Il n'accepte **qu'un nom d'hôte** — jamais un protocole, jamais un port.

**Effet** : le framework valide les en-têtes de transfert de l'origine publique (`X-Forwarded-Host`, `X-Forwarded-Proto`) **avant** de les appliquer à l'URL de la requête.

#### Pourquoi le protocole n'est pas épinglé

La validation de l'hôte compare au **protocole du socket**. Derrière un proxy qui termine TLS, le socket est en `http:`. Épingler `protocol: 'https'` ferait échouer la validation, et l'adresse client vaudrait alors celle du proxy **sur toutes les requêtes** — ce qui casserait la piste d'audit et les six limites indexées sur IP.

#### Pourquoi le port n'est pas épinglé

Le port du motif est comparé par **égalité de chaîne** à l'en-tête `X-Forwarded-Port`. Or le port d'une URL par défaut est **vide** : `new URL("https://host:443").port === ""`. Tout port présent dans le motif ferait donc échouer silencieusement la validation des en-têtes transférés.

#### Comportement en cas de rejet, et journalisation

Le comportement par défaut du framework est **silencieux** : en cas d'échec de validation, l'application retombe sur l'hôte du socket, **sans erreur**.

L'application rend cet événement diagnosticable. `reportRejectedForwardedHeaders()` (`src/middleware.ts`) compare la valeur annoncée par le proxy à l'URL **effectivement résolue** — une valeur non appliquée est une valeur rejetée — et journalise un événement d'audit `INFRA_PROXY_HEADER_REJECTED` (voir [audit.md](audit.md) §Actions d'infrastructure).

| Champ | Contenu |
| :-- | :-- |
| `header` | `x-forwarded-host` ou `x-forwarded-proto` |
| `reason` | `not_applied` (valeur refusée) ou `malformed` (valeur non normalisable) |
| `forwardedValue` | Valeur refusée, purgée (`[^a-z0-9.:_-]` retiré) et bornée à 128 caractères ; `null` si `malformed` |
| `resolvedHost` / `resolvedProtocol` | Hôte et protocole réellement résolus |
| `configuredSiteHost` | Hôte attendu, dérivé de `SITE_URL` |
| `requestId` | Corrélation avec la requête |

Invariants du signalement, tenus par `tests/unit/voyage/middleware-forwarded-audit.test.ts` :

- **Un seul événement par requête**, tronqué au premier en-tête refusé (si les deux sont rejetés, seul `x-forwarded-host` est rapporté).
- **La valeur brute n'est jamais journalisée** : la ligne ne contient ni `authorization`, ni `cookie`, ni `x-api-key` (ces trois en-têtes ne sont pas des entrées de détection et ne sont jamais lus). L'ensemble des clés de métadonnées est fermé, ce qui rend cette affirmation structurelle.
- **Le journal n'est pas une condition d'accès** : la requête est servie normalement (200) même quand l'écriture d'audit échoue. L'échec est absorbé (`.catch(() => {})`) et le repli disque de `logAuditEvent` est emprunté.
- Le signalement précède la chaîne de requête : un rejet est journalisé **même sur une 404 de locale invalide**.
- Seule la **première** valeur d'un en-tête transféré multi-valeurs est significative ; un en-tête déjà appliqué ne produit rien.

---

## 4. Protection CSRF

### Astro `security.checkOrigin` (framework-level) — périmètre réel, à lire avant toute affirmation

`astro.config.mjs` déclare `security.checkOrigin: true` explicitement (Astro v5+ le vaut par défaut).

**Ce que le framework contrôle réellement** (source : `node_modules/astro/dist/core/app/origin-check.js`, fonction `isForbiddenCrossOriginRequest`) :

```javascript
const FORM_CONTENT_TYPES = [
  "application/x-www-form-urlencoded",
  "multipart/form-data",
  "text/plain"
];
const SAFE_METHODS = ["GET", "HEAD", "OPTIONS"];

function isForbiddenCrossOriginRequest(request, url, isPrerendered) {
  if (isPrerendered) return false;
  if (SAFE_METHODS.includes(request.method)) return false;
  const isSameOrigin = request.headers.get("origin") === url.origin;
  const hasContentType = request.headers.has("content-type");
  if (hasContentType) {
    const formLikeHeader = hasFormLikeHeader(request.headers.get("content-type"));
    return formLikeHeader && !isSameOrigin;   // ← JSON : jamais form-like
  }
  return !isSameOrigin;                       // ← pas de Content-Type : refusé si cross-origin
}
```

| Cas | Refusé par `checkOrigin` ? |
| :-- | :-- |
| `GET` / `HEAD` / `OPTIONS` | Non — méthodes sûres, court-circuit avant tout test |
| Route prérendue (`isPrerendered`) | Non — court-circuit |
| `POST` + `Content-Type: application/x-www-form-urlencoded`, cross-origin | **Oui**, 403 |
| `POST` + `Content-Type: multipart/form-data`, cross-origin | **Oui**, 403 |
| `POST` + `Content-Type: text/plain`, cross-origin | **Oui**, 403 |
| `POST` + `Content-Type: application/json`, **quelle que soit l'origine** | **Non** |
| `POST` + **aucun** `Content-Type`, cross-origin | **Oui**, 403 |

Réponse en cas de refus : **403** `Cross-site {method} form submissions are forbidden`.

> #### ⚠️ Correction d'un contrat que la documentation affirmait à tort
>
> L'ancienne version de ce document affirmait que `checkOrigin` couvrait « les Content-Type spécifiques (`application/x-www-form-urlencoded`, `multipart/form-data`, `text/plain`, `application/json`) », et qu'il protégeait « automatiquement **tous les endpoints API** et **tous les Astro Actions** ».
>
> **C'est faux.** `hasFormLikeHeader()` ne teste que les trois types de formulaire ; `application/json` n'en fait pas partie. Une requête JSON est donc **autorisée quelle que soit son origine**.
>
> **Conséquence réelle** : la protection contre les requêtes intersites sur les surfaces JSON — les points d'entrée d'authentification (`/api/auth/*`, qui consomment du JSON) et **toutes les actions du framework** (`/_actions/*`, également JSON) — **ne repose pas sur `checkOrigin`**. Elle repose sur :
> 1. la **session serveur** : l'action ou l'endpointAuth exige une session valide, et un cookies `SameSite` n'est pas joint par le navigateur à une requête intersite ;
> 2. la **politique de même origine des cookies** (`SameSite` de better-auth).
>
> Écrire que `checkOrigin` protège `/_actions/*` ou `/api/auth/*` serait donc une affirmation de sécurité non adossée au code. C'est exactement le type d'erreur que ce document s'interdit.

### Surfaces concernées — table corrigée

| Surface | Méthode | `checkOrigin` | Ce qui protège réellement |
| :-- | :-- | :-- | :-- |
| `/api/contact` | POST (JSON) | ❌ **Non** (JSON) | Session non requise (endpoint public) → **aucune protection CSRF par origine**. Le rate limit par IP et l'audit `CONTACT_FORM_SUBMIT` sont les seules barrières. |
| `/api/upload` | POST (multipart) | ✅ Oui, si form-like | Session serveur requise + `SameSite` |
| `/api/content-import` | POST (multipart) | ✅ Oui, si form-like | Session + RBAC admin + rate limit par `userId` |
| `/api/health` | GET | Non (méthode sûre) | Jeton `HEALTH_TOKEN` en `Authorization: Bearer` (voir §4 bis) |
| `/api/search` | GET | Non (méthode sûre) | Rate limit par identité réseau résolue |
| `/api/export-data` | GET | Non (méthode sûre) | Session + rate limit par `userId` |
| `/api/audit-export` | GET | Non (méthode sûre) | Session + rate limit par `userId` |
| `/api/content-export` | GET | Non (méthode sûre) | Session + rate limit par `userId` |
| `/api/media`, `/api/preview` | GET | Non (méthode sûre) | Session (+ admin pour `preview`) |
| `/_actions/*` | POST (JSON) | ❌ **Non** (JSON) | Session serveur + `SameSite` + RBAC par action |
| `/api/auth/*` | POST (JSON) | ❌ **Non** (JSON) | Cookies `SameSite` better-auth + rate limit dédié |

### Astro Actions (POST)

Les `defineAction()` d'Astro 7 s'exposent comme endpoints publics (`/_actions/{name}`).

`handleAction` (`node_modules/astro/dist/actions/handler.js`) appelle **exactement la même** `isForbiddenCrossOriginRequest` que le reste du site : les Actions ne bénéficient d'**aucun** contrôle d'origine supplémentaire.

**Fait mesuré** : `rg 'action=\{actions' src --glob "*.astro"` → **0 occurrence**. Aucun formulaire du projet n'utilise la soumission `action={actions.x}` (qui émettrait du `FormData` et serait donc couverte par `checkOrigin`). Les **47** balises durcies (§11) traitent toutes leur soumission en JavaScript via `preventDefault()` puis un appel RPC : `authClient.*` (better-auth), `actions.*` (Astro) ou `fetch` JSON. Ce sont des requêtes **JSON**.

Conséquence : **le contrôle d'origine du framework ne couvre aucune surface d'action de ce projet.** La barrière d'autorisation est le garde applicatif de l'action (`assertAdmin`, `assertVoyagePermission`, …) plus la session serveur et la politique `SameSite` des cookies. Voir §11 pour la barrière structurelle qui protège la *soumission native*.

### better-auth

- Cookies `httpOnly`, `secure`, signés, avec politique `SameSite`
- Validation des trusted origins côté serveur
- Rate limit dédié sur les endpoints d'authentification (7 `customRules`)

### Points d'attention

- **Les requêtes JSON intersites ne sont pas bloquées par le framework.** Sur toute surface JSON, la barrière est la session serveur et la politique `SameSite` des cookies. C'est un choix assumé, pas un oubli : ces surfaces exigent toutes une session, à l'exception de `/api/contact`.
- Les requêtes GET **ne sont pas protégées** par CSRF — ne jamais faire d'action state-changing via GET
- Les endpoints GET authentifiés utilisent des vérifications de session + rate limiting comme protection complémentaire
- `checkOrigin` compare l'en-tête `Origin` à `url.origin` — les clients API (curl, Postman) doivent fournir un `Origin` correct, ou omettre `Content-Type` pour être refusés

### 4 bis. Sonde de santé `GET /api/health` — accès par jeton

L'accès à la sonde est conditionné à un jeton présenté, sinon refusé. La règle s'applique **également à la branche d'erreur** : le corps nominal et le corps d'erreur 503 sont tous deux produits **après** le test d'autorisation.

| Cas | Réponse |
| :-- | :-- |
| `HEALTH_TOKEN` non configuré | **401** `{ "error": "Unauthorized" }` — pour **tout** appelant |
| `HEALTH_TOKEN` configuré mais vide | **401** — une variable présente mais vide n'est pas un jeton |
| Pas d'en-tête `Authorization` | **401**, corps minimal, **aucune** dépendance interrogée |
| Schéma ≠ `Bearer ` (ex. `Basic `, `bearer `) | **401** — le préfixe est une comparaison exacte |
| Jeton ≠ `HEALTH_TOKEN` | **401** |
| État dégradé (DB, SMTP ou disque KO) sans jeton | **401**, pas 503 — un état dégradé ne doit pas devenir une fuite pour un appelant non autorisé |
| Sonde en exception sans jeton | **401** |
| Jeton valide | **200** si tout est OK, **503** `degraded` sinon, **503** `error` si la sonde lève |

Corps nominaux (jeton valide) : `{ status, version, uptime, timestamp, db: { ok }, smtp: { ok, provider }, disk: { uploadsWritable }, cache: { size, hits, misses } }`. Corps d'erreur : `{ status: "error", version, uptime, timestamp, db: { ok: false }, smtp: { ok: false, provider: "unknown" }, disk: { uploadsWritable: false } }`. `Cache-Control: no-store` sur toutes les réponses.

> #### L'ancien mécanisme de preuve d'appel local est gone
>
> La version précédente traitait **l'absence d'en-tête de proxy comme une preuve d'appel local**. C'est faux : l'absence d'en-tête est **décidée par l'appelant**, et un port exposé n'est pas un loopback. Un `X-Forwarded-For: 127.0.0.1` forgé suffisait à obtenir le corps complet — qui exposait alors l'état de la base, le fournisseur d'envoi, l'état du disque, les statistiques de cache, la durée de fonctionnement et la version.
>
> La règle est maintenant : jeton configuré **et** présenté, sinon refus.

**Comparaison à temps constant.** `isAuthorized()` compare des **empreintes SHA-256 de longueur fixe** (32 octets) via `timingSafeEqual()`, jamais les chaînes brutes. Deux conséquences :

- La comparaison ne révèle pas la longueur du secret.
- Une collision de longueurs — cas où un jeton multi-octets présente le même nombre de caractères mais un nombre d'octets différent — **ne peut plus faire lever** `timingSafeEqual()`. Un jeton légitime non-ASCII reste accepté.

> **Conséquence opérationnelle** : la sonde doit porter le jeton **dès qu'un proxy est présent sur le réseau**. Une sonde de conteneur (Kubernetes, Docker) locale peut continuer à ne pas l'envoyer si le point d'entrée n'est pas exposé ; mais dès que le trafic traverse un proxy, l'absence de jeton vaut refus. L'absence de `HEALTH_TOKEN` est journalisée au chargement du module.

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

### `h1` reste autorisé dans l'assainisseur — décision structurante

**Le filtre d'assainissement autorise volontairement un titre de niveau 1 dans un article. Ne pas le neutraliser.**

`ALLOWED_TAGS` (`src/lib/sanitize.ts:3-10`) contient `"h1"`. C'est un choix, pas un oubli, et voici toute la chaîne de la décision :

1. `sanitizeHtml()` est **partagé** entre au moins deux surfaces aux besoins opposés : le corps d'un **article de blog**, où un `<h1>` est légitime, et le corps d'une **section de page CMS**, où il ne l'est pas.
2. Une page CMS expose **déjà** son propre titre de niveau 1 : `src/components/pages/CmsPage.astro:17` rend `<h1 id="cms-page-heading">`. Une section qui exposait en plus un `<h1>` faisait donc deux titres de niveau 1 sur la même page.
3. **La correction est faite au rendu, pas dans le filtre.** `src/components/pages/cms/SectionRenderer.astro` passe le corps des sections rédactionnelles — les types `text` (ligne 69) et `custom` (ligne 196) — par `renderEditorialHtml()`.
4. **Raison du choix de l'emplacement** : mettre `h1` en liste noire dans `ALLOWED_TAGS` aurait interdit le niveau 1 **aussi dans les articles de blog**, où il est correct. Une perte de capacité éditoriale sur une surface pour corriger un doublon sur une autre n'est pas un durcissement, c'est une régression. Le filtre est donc resté permissif, et la correction a été descendue là où le doublon apparaît.
5. Le blog n'est **pas** concerné : `src/components/content/RichContent.astro:24` appelle `sanitizeHtml()` directement, sans rétrogradation. Un article garde son `<h1>`.

```typescript
// src/components/pages/cms/demote-level-one-headings.ts
const TARGET_TAG_NAME = "h1";   // seul niveau touché
const DEMOTED_LEVEL   = "h2";   // un cran plus bas : aucun niveau n'est sauté

export function demoteLevelOneHeadings(html: string): string { /* renomme le nom de balise */ }
export function renderEditorialHtml(value: unknown): string {
  return demoteLevelOneHeadings(sanitizeHtml(value));   // assaini PUIS rétrograde
}
```

L'ordre est important : `renderEditorialHtml()` assainit d'abord, donc la rétrograde ne réécrit jamais un nom de balise que le filtre n'a pas déjà autorisé, et la chaîne brute non filtrée n'est jamais inspectée.

Garanties de la réécriture : attributs, classes, texte, ordre et imbrication sont reproduits octet pour octet ; **rien n'est supprimé et aucun octet n'est introduit** ; le flux de jetons est conservé et seul le nom change, donc l'opération est **idempotente** et structurellement incapable d'ouvrir une balise, un attribut, un commentaire ou un contexte de texte brut. Le contenu des éléments à texte brut (`iframe`, `noembed`, `noframes`, `noscript`, `plaintext`, `script`, `style`, `textarea`, `title`, `xmp`) est recopié tel quel, pour que le lecteur ne renomme pas un nom de balise qui n'y est que du texte.

Verrou de test : `tests/unit/demote-level-one-headings.test.ts` (**14 blocs `it()`**).

> #### ⚠️ Avertissement de référencement supprimé — il était devenu faux
>
> `validatePageSeo()` (`src/lib/seo.ts`) émettait un avertissement de **titre de niveau 1 en double**, calculé en comptant les sections `hero` de la page. Cet avertissement est **supprimé**, et il ne doit pas être réintroduit :
>
> - Il est devenu **faux**. `SectionRenderer.astro` rend le titre d'une section `hero` en `<h2>` (ligne 52), et le corps rédactionnel en `h2` par `renderEditorialHtml()`. **Aucun type de section ne rend de niveau 1.** Le nombre de sections `hero` ne peut donc plus produire de doublon.
> - Il **retirait des points à une page valide**. `computeSeoScore()` (`src/lib/seo.ts:126-134`) déduit 25 points par `error`, 10 par `warning`, 3 par `info`. L'avertissement retirait donc **10 points** à une page parfaitement conforme — un score artificialement dégradé, et un signal d'action là où il n'y avait rien à corriger.
> - Le paramètre `sections` de `validatePageSeo()` a **disparu du type**. L'audit/back-office ne l'exploite plus.
>
> Verrou de test : `tests/unit/seo.test.ts`, cas `reports nothing about sections for legacy data still carrying several hero sections` — des données héritées portant encore plusieurs sections `hero` ne doivent ressusciter **aucun** avertissement, et aucun problème ne doit être rapporté sur un champ `sections`. Le contrat testé est donc **négatif**, et il tient à l'exécution comme dans les types.

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
| `GET /api/search` | `search:{ip}` (repli `search:unknown`) | 60s | 60 |
| `POST /api/contact` | `contact:{ip}` (fallback global `contact:__global__`) | 300s | 3 (10 en global) |
| `GET /api/preview` | `preview:{userId}` (admin uniquement + audit `PAGE_PREVIEW`) | 60s | 30 |
| Admin actions (CMS) | `admin-{scope}:{userId}` | 60s | 30 |
| Blog actions | `blog-{scope}:{userId}` | 60s | 30 |

### Identité réseau de la recherche — `extractIp`, pas `clientAddress`

`GET /api/search` indexe sa limite sur `extractIp(request.headers, clientAddress) ?? "unknown"`, et **non** sur `clientAddress` seul.

Raison : derrière un reverse proxy, `context.clientAddress` vaut **l'adresse du proxy pour toutes les requêtes**. Indexer la limite sur cette seule valeur plaçait **tous les visiteurs dans un seul compartiment** : la recherche devenait inaccessible par saturation pour tous, sans qu'aucun client ne soit fautif.

`extractIp()` (`src/lib/audit.ts`) applique la résolution d'identité réseau standard du projet :

1. si `TRUST_PROXY === "true"` : premier IP de `x-forwarded-for`, puis `x-real-ip` ;
2. sinon, ou en repli : `clientAddress` ;
3. validation IPv4/IPv6 via `net.isIP()`, sinon `null`.

Le repli `"unknown"` (bucket global partagé) est **conservé tel quel** : il borne le débit d'un attaquant qui n'exposerait aucune adresse exploitable, au prix d'un partage de compartiment dans ce cas précis. C'est un compromis assumé.

Voir [rate-limit.md](rate-limit.md) pour l'API du limiteur.

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

**179 types d'actions** dans l'union `AuditAction` (`src/lib/audit.ts`), incluant les tentatives échouées (`_FAILED`) pour les opérations d'authentification. Ce total est recompté à partir de l'union ; il n'est pas repris d'un autre document.

Voir [audit.md](audit.md) pour le détail complet et la table par famille.

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
| `SITE_URL` | Origine publique unique — alimente `site`, `security.allowedDomains` et l'index de sitemap | Non |
| `BETTER_AUTH_SECRET` | Signature des cookies / tokens | ✅ |
| `BETTER_AUTH_URL` | URL de base pour les liens d'invitation org (emails) | ⚠️ protocole http/https validé, `throw` si absente/invalide — **seulement** dans `sendInvitationEmail` organisation |
| `DATABASE_URL` | Connexion PostgreSQL | ✅ |
| `HEALTH_TOKEN` | Jeton d'accès à `GET /api/health` | ✅ |
| `TRUST_PROXY` | Active la lecture de `x-forwarded-for` / `x-real-ip` par `extractIp()` | Non |
| `SMTP_FROM_EMAIL` | Adresse expéditeur | Non |
| `SMTP_FROM_NAME` | Nom expéditeur | Non |
| `BREVO_API_KEY` / `RESEND_API_KEY` | API keys SMTP | ✅ |
| `SMTP_HOST/PORT/USER/PASS` | Credentials Nodemailer | ✅ |

> **Règle** : jamais de secret dans le code source. Toutes les variables sensibles sont lues depuis `.env` (non versionné).

### `SITE_URL` — origine publique, stricte et fail-closed

`SITE_URL` est l'**unique** source de l'origine publique. `astro.config.mjs` (`resolveSiteUrl()`) en dérive trois valeurs :

| Dérivé | Usage |
| :-- | :-- |
| `site: siteUrl.origin` | Canoniques, hreflang, URLs absolues |
| `security.allowedDomains: [{ hostname: siteUrl.hostname }]` | Validation des en-têtes de transfert (voir §3) |
| `customSitemaps: [\`${siteUrl.origin}/sitemap-cms.xml\`]` | Index de sitemap |

#### Cinq conditions de rejet — le chargement de la configuration échoue

`resolveSiteUrl()` **`throw`**, ce qui fait échouer le chargement de `astro.config.mjs` :

| # | Condition | Message (résumé) |
| :-- | :-- | :-- |
| 1 | Absente, ou chaîne vide / uniquement des espaces | `SITE_URL is required but is not set` |
| 2 | Invalide pour `new URL()` | `SITE_URL is invalid` |
| 3 | Protocole autre que `http:` / `https:` | `uses an unsupported protocol` |
| 4 | `http:` sur un hôte **non local** | `must use https: for a non-loopback host` |
| 5 | `pathname !== "/"` — porte un chemin | `must be a bare origin without a path` |

Un hôte est « local » si (`isLoopbackHostname`) : `localhost`, `*.localhost`, `::1`, `[::1]`, `0:0:0:0:0:0:0:1`, ou une adresse `127.0.0.0/8` dont chaque octet est ≤ 255.

#### Trois replis silencieux ont été supprimés

Les versions antérieures retombaient sur une origine locale (`http://localhost:4321`) quand la variable était absente, invalide, ou en HTTP sur un hôte non local. Ces trois replis sont **supprimés** : une origine d'infrastructure manquante est une erreur d'infrastructure, et la dégrader produisait des URLs absolues `localhost` dans les sitemaps, les canoniques et les emails, et épinglait chaque formulaire mutant en 403 en production.

#### Le fichier d'environnement local n'est pas consulté pour cette variable

Ni le build, ni la suite de tests ne lisent `.env` pour `SITE_URL` :

- `astro.config.mjs` lit `process.env[SITE_URL_ENV]` au moment où le module est évalué, **avant** que le chargeur de configuration d'Astro ne puisse charger un fichier `.env`.
- `vitest.config.ts` (`resolveTestSiteOrigin()`) applique **le même contrat** et lit `process.env` directement. `import.meta.env.SITE` étant `undefined` sous Vitest (aucun plugin Astro ne gèle `site`), `src/pages/sitemap-cms.xml.ts` lèverait à chaque appel ; la seule injection correcte est donc la même variable, sans repli ni seconde constante.

**Conséquence** : `SITE_URL` doit être présente dans **l'environnement du processus**. La mettre uniquement dans `.env` ne suffit pas.

> `vitest.config.ts` est le miroir d'`astro.config.mjs` : toute règle que la config Astro gagne et qui change la valeur gelée (protocole, origine nue) doit être répercutée ici.

#### Valeurs par job CI — une job, une origine servie

| Job | `SITE_URL` | `BETTER_AUTH_URL` | Port réellement écouté | Source du port |
| :-- | :-- | :-- | :-- | :-- |
| `lint-and-check` | `http://localhost:4321` | — | aucun serveur | Valeur inerte : le job ne démarre rien |
| `unit-tests` | `http://localhost:4321` | `http://localhost:4321` | aucun serveur | La suite construit ses requêtes sur cette origine |
| `e2e-tests` | `http://localhost:4322` | `http://localhost:4322` | **4322** | `scripts/e2e-server.mjs` : `PORT = 4322`, `HOST = 'localhost'` (constantes) ; `playwright.config.ts` `baseURL`/`webServer.url` = `http://localhost:4322` |
| `a11y-perf` | `http://localhost:4321` | `http://localhost:4321` | **4321** | `pnpm preview` = `node scripts/serve-compressed.mjs`, sans `HOST`/`PORT` dans ce job → défauts `0.0.0.0:4321` |
| `deploy` | `${{ vars.SITE_URL }}` (**origine publique**) | `${{ vars.BETTER_AUTH_URL }}` | — | Aucun serveur local |

**Correction apportée au flux de travail** : deux jobs avaient des origines divergentes, dont **aucune** n'était celle réellement testée. `e2e-tests` avait `BETTER_AUTH_URL: http://localhost:4321` (le port de preview du job a11y) pendant que `SITE_URL` valait l'origine publique, alors que le serveur testé écoute sur 4322. `a11y-perf` et `unit-tests` pouvaient résoudre `SITE_URL` vers autre chose que la page auditée. Chaque job sert désormais une origine locale correspondant au port qu'il écoute réellement, `SITE_URL` et `BETTER_AUTH_URL` étant épinglées ensemble.

> `http:` est accepté par `astro.config.mjs` **sur un hôte loopback uniquement**. C'est ce qui rend ces valeurs locales légales.

#### Le job `deploy` refuse explicitement un artefact figé sur une origine locale

`deploy` est le seul job qui produit un artefact déployable, donc le seul à garder l'origine publique. Il est protégé par **deux gardes**, l'une **avant** le build, l'autre **après** :

**Garde 1 — avant `pnpm build`** (`Guard - public origin is resolvable (fail-closed)`) : échoue explicitement, avec `::error::` et `exit 1`, si

- `SITE_URL` est vide (la variable de dépôt `vars.SITE_URL` s expanse en chaîne vide quand elle n'est pas définie — et elle a été observée vide) ;
- `SITE_URL` n'est pas une URL absolue ;
- `SITE_URL` pointe sur un hôte loopback → *« A deployable artifact must never be frozen from a dev origin. »* ;
- `SITE_URL` n'est pas en `https:` ;
- `SITE_URL` porte un chemin ;
- `BETTER_AUTH_URL` est vide, n'est pas une URL absolue, n'est pas en `http:`/`https:`, ou porte un chemin.

Aucune étape n'est exécutée avant ces vérifications : rien n'est construit, aucun artefact n'est uploadé.

**Garde 2 — après `pnpm build`** (`Guard - artifact is frozen on the public origin`) :

1. exige que `dist/client/sitemap-index.xml` existe — sans lui, l'origine figée dans l'artefact est invérifiable et l'upload est refusé ;
2. exige que cet index référence l'origine publique validée par la garde 1 ;
3. refuse tout `dist/client/sitemap*.xml` contenant une origine loopback (`localhost`, `127.x`, `0.0.0.0`, `[::1]`).

> La recherche de loopback est **volontairement limitée aux XML de sitemap générés**. `dist/server/chunks/` contient un repli de niveau source (`src/modules/email-voyage/domain/voyage-email-worker.ts` lit `process.env.SITE_URL ?? "http://localhost:4321"`), donc une recherche sur l'ensemble du bundle signalerait une origine de dev sur **tout** build de production légitime. Les fichiers `sitemap*.xml` sont générés depuis `site` seul.

> **Écart de contrat signalé, non corrigé ici** : le job `deploy` est le seul à exiger `https:`, alors qu'`astro.config.mjs` accepte `http:` sur un hôte loopback. Les deux règles sont cohérentes (le deploy refuse le loopback *et* le http), mais elles ne sont pas le même prédicat, et les deux gardes dupliquent `isLoopbackHostname()` en JavaScript inline plutôt que de le partager. Voir « Changements de code rapportés » dans le rapport de livraison.

---

## 11. Contrat des formulaires

### L'invariant

> **Les données d'identité n'atteignent jamais le chemin, la chaîne de requête, l'en-tête de référence, l'historique de navigation ni un journal d'accès. Elles transitent par le corps d'une requête POST, qui est leur transport correct.**

La dernière clause est **partie de l'invariant**, pas une exception. Le mot de passe *doit* être présent dans le corps du POST ; une assertion d'absence y serait une définition de l'invariant à l'envers. Ce qui est interdit, c'est le chemin, la requête, le Referer, l'historique et le log d'accès — les transports qui finissent dans une URL ou dans un fichier.

L'invariant est mesuré par `tests/e2e/credential-url-leak.spec.ts`, qui vérifie la **non-vacuité** en sens inverse : le POST porteur des identifiants est asserts **présent**, et son corps est asserts porteur du champ `password`.

### Règle de source de vérité

Cinq éléments, tous requis sur un formulaire portant des données d'identité ou d'administration :

| # | Élément | Rôle |
| :-- | :-- | :-- |
| 1 | Attribut `method` non-GET | **Seule barrière structurelle** contre la soumission native |
| 2 | Attribut `action` explicite | Cible déclarée ; une action same-origin explicite exclut l'exfiltration de credentials sur POST |
| 3 | Nom stable (`id` + `name`) | Cible de test et de script |
| 4 | Déclencheur `type="submit"` | Garantit une soumission possible sans JavaScript |
| 5 | Gestionnaire d'événement **conservé** | Traitement sans rechargement de page, quand JavaScript est disponible |

### Pourquoi `method`, et pas le gestionnaire d'événement

L'attribut de méthode est structurel : il est dans le HTML, présent avant toute exécution de script.

Un gestionnaire `submit` JavaScript **n'est pas une barrière**. Il n'existe que dans l'état d'exécution où il s'est enregistré, et il est désactivé par :

- un module qui n'a pas été chargé ;
- une extension de navigateur ;
- un réseau lent ou interrompu au moment de l'enregistrement ;
- une soumission au clavier seule (par exemple un `Enter` dans un champ avant que l'écouteur ne soit posé).

Dans tous ces cas, le défaut HTML normatif s'applique : `method="get"` vers l'URL courante, et le navigateur sérialise **nativement** chaque contrôle nommé dans la chaîne de requête. Le résultat : identifiants dans le chemin, dans `location.href`, dans l'historique de navigation, dans l'en-tête `Referer` de la navigation suivante, et dans le journal d'accès du serveur.

> C'est exactement le mode de défaillance observé le 23/09 : la CSP portait alors `upgrade-insecure-requests`, WebKit réécrivait les `/_astro/*.js` vers `https://`, le serveur E2E n'écoutait qu'en HTTP, **aucun script ne se chargeait**, et le navigateur soumettait nativement. Les traces de ce run (`tests/reports/e2e-full.txt`) enregistrent la forme exacte :
>
> ```
> navigated to "http://localhost:4322/fr/auth/connexion?email=e2e-seed%40test.com&password=E2eTest1234%21"
> ```
>
> Le test E2E reproduit ce chemin de façon déterministe et indépendante de la CSP, via un contexte Playwright `javaScriptEnabled: false`.

### Méthode de comptage — reproductible par un tiers

Tous les chiffres qui suivent sont recomptés par lecture de `src/**/*.astro`, **après retrait des commentaires** HTML (`<!-- … -->`) et JavaScript (`/* … */`, `// …`), puis extraction de chaque balise `<form …>` et de ses attributs `method` et `action`. Le retrait des commentaires est nécessaire : le dépôt contient des commentaires qui citent `method="post"` à titre d'explication, et un compte par `rg` les confond avec des balises.

> **Écarts de méthode à connaître.** `rg '<form' src --glob "*.astro"` renvoie **63** occurrences sur **39** fichiers, et `rg 'method="post"' src --glob "*.astro"` en renvoie **93**. L'écart de **3** pour `<form` tient à un unique `<form>` cité dans un commentaire `eslint-disable` (`src/components/blog/PostGridToggle.astro:21`) ; l'écart de **46** pour `method="post"` tient à des commentaires qui expliquent la règle en la citant. **60 balises sur 38 fichiers** est le compte réel, et il faut **retirer les commentaires** pour l'obtenir.

### Inventaire mesuré

| Grandeur | Valeur |
| :-- | --: |
| Balises `<form>` dans `src/**/*.astro` | **60** |
| Fichiers `.astro` qui en portent | **38** |
| Balises `<form>` dans les fichiers de test et de configuration d'interface | **2** (dans 2 fichiers) |
| Balises portant une méthode **non GET** *et* une `action` explicite (« durcies ») | **47** |
| Fichiers qui les portent | **27** |
| Balises `method="get"` (« conformes par conception ») | **12** (12 fichiers) |
| Balises `method="dialog"` (« sans objet ») | **1** (1 fichier) |

Les trois groupes sont exhaustifs et disjoints : **47 + 12 + 1 = 60**. Les 47 balises durcies portent **toutes** les deux attributs — aucun cas partiel. Aucune balise ne porte une méthode non GET **sans** `action` explicite, à l'exception de la balise `method="dialog"`, qui est précisément la balise sans objet.

#### Les 2 balises de test ne sont pas des interfaces

Elles ne sont ni un formulaire d'interface ni une surface auditable : ce sont des **littéraux de chaîne** servant à vérifier que l'assainisseur **supprime** les formulaires.

| Fichier | Ligne | Rôle du littéral |
| :-- | --: | :-- |
| `tests/unit/sanitize.test.ts` | 136 | Entrée `'<form action="https://evil.com">…'`, assertion `expect(result).not.toContain('<form')` |
| `tests/unit/demote-level-one-headings.test.ts` | 116 | Cas `['a form and an input', '<h1><form action="https://evil.com"><input name="a"></form></h1>']` — un `<form>` qui **ne doit pas** être promu en titre |

Zéro occurrence de `<form` dans `.pa11yci.cjs`, `lighthouserc.cjs`, `playwright.config.ts`, `vitest.config.ts`, `astro.config.mjs` et `scripts/**`. Ces fichiers décrivent des URL, pas des interfaces.

#### Groupe 1 — conformes par conception : 12 balises `method="get"`

Ce sont des formulaires de **recherche et de filtrage**. La chaîne de requête est leur comportement voulu, et ils ne portent **aucun** champ d'identité ni de secret — relevé sur les 12 :

| Fichier | Ligne | Champs nommés exposés dans l'URL |
| :-- | --: | :-- |
| `src/components/blog/AdminPostList.astro` | 40 | `search`, `status`, `categoryId`, `authorId`, `tagId`, `featured`, `sticky`, `translationLocale`, `sortBy`, `sortOrder` |
| `src/components/pages/blog/BlogAuthorPage.astro` | 131 | `q` |
| `src/components/pages/blog/BlogListingPage.astro` | 123 | `q` |
| `src/components/services/AdminServiceList.astro` | 36 | `search`, `status`, `categoryId`, `tagId`, `providerId`, `locale`, `featured`, `mobile`, `sortBy`, `sortOrder`, `page` |
| `src/modules/applications/components/AdminApplicationList.astro` | 33 | `status` |
| `src/modules/email-voyage/components/AdminEmailList.astro` | 26 | `status`, `templateKey` |
| `src/modules/payments/components/AdminPaymentList.astro` | 27 | `status` |
| `src/modules/reservations/components/AdminReservationList.astro` | 27 | `status` |
| `src/modules/services/components/lists/ServicesListingPage.astro` | 72 | `search` |
| `src/modules/travelers/components/AdminTravelerList.astro` | 23 | `search` |
| `src/modules/trips/components/AdminTripList.astro` | 38 | `search`, `status`, `countryCode` |
| `src/pages/[lang]/trips/index.astro` | 39 | `difficulty`, `availability` |

Aucun nom ne correspond à `password`, `email`, `secret`, `token`, `card`, `cvv`, `otp` ou `pin`. Ces 12 balises sont donc **conformes par conception** : elles n'ont pas été durcies parce qu'il n'y a rien à durcir.

#### Groupe 2 — sans objet : 1 balise `method="dialog"`

**Une seule** balise de tout le dépôt porte `method="dialog"` :

| Fichier | Ligne | Contenu |
| :-- | --: | :-- |
| `src/components/blog/AdminPostForm.astro` | 65 | `<form method="dialog">` à l'intérieur de `<dialog id="blog-link-dialog">` — boîte de dialogue d'insertion de lien interne, bouton `value="cancel"` de fermeture |

`method="dialog"` **ferme la boîte de dialogue et ne produit ni navigation ni requête** : le navigateur ne sérialise pas les contrôles dans une URL et n'émet aucune requête réseau. Le contrat de la page — aucune donnée d'identité dans une URL — est donc **hors sujet** pour cette balise. Elle est comptée à part, jamais dans les 47, et jamais dans les 40 de la limite fonctionnelle ci-dessous.

> Les composants `src/components/atoms/dialog/Dialog.astro` et `src/components/atoms/alert-dialog/AlertDialog.astro` **ne rendent aucune balise `<form>`** : ils se contentent d'intercepter la soumission des formulaires qu'ils contiennent (`this.dialog.querySelectorAll("form")`). Le mot `dialog` y n'apparaît que dans un commentaire et dans la lecture de `form.method` au moment de l'exécution. Il n'y a donc pas de second lot de formulaires à compter.

#### Groupe 3 — durcies : 47 balises sur 27 fichiers

**7** des 47 pointent vers un vrai point d'entrée serveur et restent fonctionnels sans JavaScript ; **40** déclarent `action={Astro.url.pathname}`.

| Fichier | Balises | `name` (ligne) · `action` · instances rendues |
| :-- | --: | :-- |
| `src/components/blog/AdminPostForm.astro` | 1 | `blog-post-form` (49) · `Astro.url.pathname` · ×1 |
| `src/components/blog/CommentForm.astro` | 1 | `comment-form` (34) · `Astro.url.pathname` · ×1 |
| `src/components/blog/ReviewForm.astro` | 1 | `review-form` (34) · `Astro.url.pathname` · ×1 |
| `src/components/blog/sidebars/NewsletterSidebar.astro` | 1 | `newsletter-form` (49) · `Astro.url.pathname` · ×1 |
| `src/components/pages/ContactPage/ContactPage.astro` | 1 | `contact-form` (114) · `/api/contact` · ×1 |
| `src/components/pages/admin/AdminLegalEditor.astro` | 1 | `page-meta-form` (124) · `Astro.url.pathname` · ×1 |
| `src/components/pages/admin/AdminSectionsEditor.astro` | 1 | `page-meta-form` (77) · `Astro.url.pathname` · ×1 |
| `src/components/pages/admin/AdminSitePage.astro` | 5 | `locale-settings-form-${l}` (136) · `Astro.url.pathname` · ×4 locales<br>`contact-form` (287) · `Astro.url.pathname` · ×1<br>`hours-form` (353) · `Astro.url.pathname` · ×1<br>`header-settings-form-${l}` (444) · `Astro.url.pathname` · ×4 locales<br>`footer-settings-form-${l}` (516) · `Astro.url.pathname` · ×4 locales |
| `src/components/pages/admin/AdminThemePage.astro` | 2 | `create-theme-form` (78) · `Astro.url.pathname` · ×1<br>`theme-form-${th.id}` (134) · `Astro.url.pathname` · ×1 par thème |
| `src/components/pages/auth/ForgotPasswordPage.astro` | 1 | `forgot-password-form` (34) · `/api/auth/request-password-reset` · ×1 |
| `src/components/pages/auth/ProfilePage.astro` | 2 | `identity-form` (78) · `/api/auth/update-user` · ×1<br>`security-form` (114) · `/api/auth/change-password` · ×1 |
| `src/components/pages/auth/ResetPasswordPage.astro` | 1 | `reset-password-form` (36) · `/api/auth/reset-password` · ×1 |
| `src/components/pages/auth/SignInPage.astro` | 1 | `sign-in-form` (41) · `/api/auth/sign-in/email` · ×1 |
| `src/components/pages/auth/SignUpPage.astro` | 1 | `sign-up-form` (32) · `/api/auth/sign-up/email` · ×1 |
| `src/components/services/AdminServiceForm.astro` | 1 | `service-form` (46) · `Astro.url.pathname` · ×1 |
| `src/components/services/ServicesAdminPage.astro` | 4 | `service-category-create-form` (71) · `Astro.url.pathname` · ×1<br>`service-category-update-form-${item.category.id}` (90) · `Astro.url.pathname` · ×1 par catégorie<br>`service-tag-create-form` (112) · `Astro.url.pathname` · ×1<br>`service-tag-update-form-${item.tag.id}` (129) · `Astro.url.pathname` · ×1 par tag |
| `src/modules/itinerary/components/AdminItinerarySection.astro` | 3 | `itinerary-day-form-${day.id}` (39) · `Astro.url.pathname` · ×1 par jour<br>`itinerary-day-translation-form-${day.id}-${loc}` (63) · `Astro.url.pathname` · ×4 locales × 1 par jour<br>`itinerary-day-add-form` (88) · `Astro.url.pathname` · ×1 |
| `src/modules/policies/components/AdminPolicyList.astro` | 1 | `policy-version-form-${doc.id}` (43) · `Astro.url.pathname` · ×1 par document |
| `src/modules/services/components/single/ServiceEngagement.astro` | 2 | `service-review-form` (47) · `Astro.url.pathname` · ×1<br>`service-comment-form` (60) · `Astro.url.pathname` · ×1 |
| `src/modules/trips/components/AdminContentsSection.astro` | 2 | `content-translation-form-${item.id}-${loc}` (52) · `Astro.url.pathname` · ×4 locales × 1 par contenu<br>`content-add-form-${block.kind}` (83) · `Astro.url.pathname` · ×1 par bloc de contenu |
| `src/modules/trips/components/AdminFaqSection.astro` | 3 | `faq-translation-form-${faq.id}-${loc}` (41) · `Astro.url.pathname` · ×4 locales × 1 par FAQ<br>`faq-link-form` (69) · `Astro.url.pathname` · ×1<br>`faq-create-form` (86) · `Astro.url.pathname` · ×1 |
| `src/modules/trips/components/AdminTripForm.astro` | 5 | `trip-facts-form` (70) · `Astro.url.pathname` · ×1<br>`trip-engagement-form` (100) · `Astro.url.pathname` · ×1<br>`trip-translation-form-${loc}` (133) · `Astro.url.pathname` · ×4 locales<br>`trip-departure-edit-form-${d.id}` (199) · `Astro.url.pathname` · ×1 par départ<br>`trip-departure-create-form` (237) · `Astro.url.pathname` · ×1 |
| `src/modules/trips/components/AdminTripList.astro` | 1 | `trip-create-form` (82) · `Astro.url.pathname` · ×1 |
| `src/modules/trips/components/TripEngagement.astro` | 2 | `trip-review-form` (149) · `Astro.url.pathname` · ×1<br>`trip-comment-form` (212) · `Astro.url.pathname` · ×1 |
| `src/pages/[lang]/apply/[trip].astro` | 1 | `apply-form` (69) · `Astro.url.pathname` · ×1 |
| `src/pages/[lang]/booking-confirmed.astro` | 1 | `balance-form` (39) · `Astro.url.pathname` · ×1 |
| `src/pages/[lang]/checkout/[session].astro` | 1 | `checkout-form` (68) · `Astro.url.pathname` · ×1 |
| **Total** | **47** | **27 fichiers** |

Couverture des cinq éléments de la règle de source de vérité, sur les 47 :

| Élément | Couverture mesurée |
| :-- | :-- |
| 1. `method` non GET | **47 / 47** |
| 2. `action` explicite | **47 / 47** |
| 3. Nom stable | **47 / 47** portent un `name` ; **39 / 47** portent en outre un `id` (les 8 autres n'ont que `name`, dans `AdminSitePage.astro` ×3, `TripEngagement.astro` ×2, `apply/[trip].astro`, `booking-confirmed.astro`, `checkout/[session].astro`) |
| 4. Déclencheur `type="submit"` | **47 / 47** |
| 5. Gestionnaire d'événement **conservé** | **27 / 27 fichiers** enregistrent un `addEventListener('submit', …)` **et** appellent `preventDefault()` — vérifié par fichier, pas par échantillon |

### Balises source et formulaires rendus — deux nombres distincts

**60 balises source ≠ 62 formulaires rendus.** L'écart vient des composants rendus une fois par langue.

| Multiplicateur | Balises | Instances rendues | Détail |
| :-- | --: | --: | :-- |
| ×1 | 33 (durcies) + 12 (GET) + 1 (dialog) | 46 | rendu une fois par page |
| ×4 locales | 4 (durcies) | 16 | `AdminSitePage.astro:136`, `:444`, `:516` (boucle `LOCALES.map()`) · `AdminTripForm.astro:133` (boucle `LOCALES.map()`) |
| **Soustotal déterministe** | **50** | **62** | **62 formulaires rendus à l'écran**, indépendamment du contenu en base |

> **62 est un soustotal, pas le total.** Il couvre les 50 balises dont le rendu ne dépend d'aucune donnée. Les 10 balises restantes s'y ajoutent en fonction du nombre d'enregistrements ; le total réellement rendu sur une page donnée est donc **supérieur ou égal à 62**, et n'est pas une constante du dépôt. C'est 62 qu'on compare d'un document à l'autre, et 60 (balises source) qu'on cite quand on parle du contrat lui-même.

`LOCALES` vaut `['fr', 'en', 'es', 'ar']` (`src/i18n/config.ts:3`) : **4 locales**, donc ×4.

Restent **10 balises** dont le nombre d'instances dépend des données, et qui ne sont donc pas comptables statiquement :

| Balise | Fichier : ligne | Instances |
| :-- | :-- | :-- |
| `itinerary-day-form-${day.id}` | `AdminItinerarySection.astro:39` | 1 par jour |
| `itinerary-day-translation-form-${day.id}-${loc}` | `AdminItinerarySection.astro:63` | 4 par jour |
| `theme-form-${th.id}` | `AdminThemePage.astro:134` | 1 par thème |
| `service-category-update-form-…` | `ServicesAdminPage.astro:90` | 1 par catégorie |
| `service-tag-update-form-…` | `ServicesAdminPage.astro:129` | 1 par tag |
| `policy-version-form-${doc.id}` | `AdminPolicyList.astro:43` | 1 par document |
| `content-translation-form-…` | `AdminContentsSection.astro:52` | 4 par contenu |
| `content-add-form-${block.kind}` | `AdminContentsSection.astro:83` | 1 par bloc de contenu |
| `faq-translation-form-…` | `AdminFaqSection.astro:41` | 4 par FAQ |
| `trip-departure-edit-form-${d.id}` | `AdminTripForm.astro:199` | 1 par départ |

**Formule complète du nombre rendu** :

```text
rendus = 62 + Σ (1 par enregistrement) sur 7 balises
              + 4 × Σ (1 par enregistrement) sur 3 balises
```

Soit **62** à contenu vide, **81** si chaque boucle contient exactement un enregistrement, et plus encore au-delà.

> **Règle de rédaction** : dans toute la documentation, un compte de formulaires destiné à être comparable d'un document à l'autre est un compte de **balises source** (60 pour l'inventaire complet, 47 pour le groupe durci). Le nombre rendu (62, 81, ou davantage) ne vaut que pour une page et un jeu de données précis ; le citer sans dire quelle page et quel contenu serait une affirmation non reproductible.

### Limite fonctionnelle assumée : 40 formulaires sans traitement serveur de repli

**7** des 47 balises durcies pointent vers un vrai point d'entrée serveur (`/api/contact` et les six `/api/auth/*`, servis par la route attrape-tout `src/pages/api/auth/[...all].ts`) et restent donc fonctionnels sans JavaScript.

**40** déclarent `action={Astro.url.pathname}` : le traitement réel est un appel `astro:actions` ou `authClient.*`, et **aucune page `.astro` du dépôt n'exporte de `POST`** (`rg 'export const POST' src --glob "*.astro"` → 0 occurrence). La soumission native est donc **rejetée avant toute mutation**.

C'est un **manque fonctionnel assumé**, pas une garantie d'expérience sans JavaScript :

- Ce qui est garanti : l'invariant de l'URL. Les identifiants n'atteignent aucune URL, aucun Referer, aucun historique, aucun log d'accès.
- Ce qui n'est **pas** garanti : que la soumission aboutisse. Sur ces 40 balises, elle est rejetée. L'utilisateur sans JavaScript ne peut pas soumettre.

> Ne pas reformuler cet état en « le site fonctionne sans JavaScript ». La formulation honnête est : *la barrière de sécurité tient sans JavaScript ; la fonctionnalité de soumission, sur 40 balises sur 47, ne tient pas sans JavaScript.*

### Région de retour d'information — page de candidature

`src/pages/[lang]/apply/[trip].astro` : le nœud `<output data-form-message>` est **hors du `<form>`**, jamais détruit, et reçoit les **deux** canaux (succès et erreur).

> **Correction** : le chemin de succès remplaçait le contenu du formulaire (`replaceChildren()`) et **détruisait le nœud de message** — qui recevait pourtant les messages d'erreur. Le retour n'était ni annoncé ni adressable. Le nœud est désormais un frère du formulaire, avec `aria-live="polite"` déclaré explicitement (bien que `<output>` porte implicitement `role=status`), ce qui fige le contrat d'annonce.

### Vérification

Les trois commandes ci-dessous sont des **bornes** : elles confirment des negativités, pas le compte. Le compte exact exige le retrait des commentaires, décrit en « Méthode de comptage ».

```bash
# Borne haute : 63 occurrences brutes, 39 fichiers.
# 3 sont des faux positifs (1 <form> dans un commentaire eslint-disable,
# 2 occurrences de method="post" dans des commentaires explicatifs).
rg -c '<form' src --glob "*.astro"

# Faux positifs visibles : le commentaire du eslint-disable
rg -n '<form' src/components/blog/PostGridToggle.astro   # → 1, ligne 21, commentaire

# aucune soumission d'action par FormData
rg 'action=\{actions' src --glob "*.astro"    # → 0

# aucune page n'exporte de POST (donc aucun repli serveur)
rg 'export const POST' src --glob "*.astro"     # → 0

# la balise sans objet, unique dans tout le dépôt
rg -n 'method="dialog"' src --glob "*.astro"    # → 1
```
