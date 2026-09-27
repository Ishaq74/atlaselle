# Rate Limiting

> **Fichier** : `src/lib/rate-limit.ts`  
> **Store** : `src/lib/store.ts` (`MemoryRateLimitStore`, `getRateLimitStore()`, `setStores()`)  
> **Tests** : `tests/unit/rate-limit.test.ts` (10 tests)

---

## Objectif

Rate limiter in-memory à fenêtre fixe (**fixed-window**) pour les endpoints non-auth (admin actions, uploads, exports). Complémentaire au rate limiter built-in de better-auth qui protège les endpoints d'authentification (7 `customRules`, voir ci-dessous).

---

## API

### `checkRateLimit(key, opts): RateLimitResult`

```typescript
import { checkRateLimit } from '@/lib/rate-limit';

const rl = checkRateLimit(`upload:${ip}`, { window: 60, max: 10 });
if (!rl.allowed) {
  // HTTP 429 avec Retry-After
  const retryAfter = Math.ceil((rl.resetAt - Date.now()) / 1000);
}
```

### Paramètres

| Paramètre | Type | Description |
| :-- | :-- | :-- |
| `key` | `string` | Identifiant unique — typiquement `{scope}:{userId}` ou `{scope}:{ip}` |
| `opts.window` | `number` | Durée de la fenêtre en **secondes** |
| `opts.max` | `number` | Nombre max de requêtes dans la fenêtre |

### Retour (`RateLimitResult`)

| Champ | Type | Description |
| :-- | :-- | :-- |
| `allowed` | `boolean` | `true` si la requête est autorisée |
| `remaining` | `number` | Nombre de requêtes restantes dans la fenêtre |
| `resetAt` | `number` | Timestamp (ms) de réinitialisation de la fenêtre |

---

## Utilisation dans le projet

### Double couche de protection

| Couche | Scope | Endpoints | Implémentation |
| :-- | :-- | :-- | :-- |
| **better-auth** | Auth | `/sign-in/email` (5/10s), `/sign-up/email` (3/60s), `/forget-password` (3/60s), `/reset-password/*` (5/60s), `/change-password` (5/60s), `/delete-user/*` (2/60s), `/organization/create` (5/60s) + global 100 req/60s | 7 `customRules` (`src/lib/auth.ts`) |
| **Custom** | Non-auth | Admin CMS, uploads, exports | `checkRateLimit()` in-memory |

### Limites configurées

| Endpoint | Clé | Window | Max | Fichier |
| :-- | :-- | --: | --: | :-- |
| `POST /api/upload` | `upload:{ip}` | 60s | 10 | `src/pages/api/upload.ts` |
| `GET /api/export-data` | `export:{userId}` | 60s | 5 | `src/pages/api/export-data.ts` |
| `GET /api/content-export` | `content-export:{userId}` | 60s | 5 | `src/pages/api/content-export.ts` |
| `POST /api/content-import` | `content-import:{userId}` | 60s | 3 | `src/pages/api/content-import.ts` |
| `GET /api/audit-export` | `audit-export:{userId}` | 60s | 5 | `src/pages/api/audit-export.ts` |
| `GET /api/search` | `search:{ip}` (repli `search:unknown`) | 60s | 60 | `src/pages/api/search.ts` |
| `POST /api/contact` | `contact:{ip}` (fallback `contact:__global__`) | 300s | 3 (10 en global) | `src/pages/api/contact.ts` |
| `GET /api/preview` | `preview:{userId}` | 60s | 30 | `src/pages/api/preview.ts` |
| Admin actions (toutes) | `admin-{scope}:{userId}` | 60s | 30 | `src/actions/admin/_helpers.ts` |
| Blog actions | `blog-{scope}:{userId}` | 60s | 30 | `src/actions/blog/_helpers.ts` |

### Scopes admin

Le `scope` dans `adminRateLimit()` est différencié par domaine pour éviter qu'une action CMS ne bloque une autre :

```typescript
adminRateLimit(context, user.id, "nav");   // clé: admin-nav:{userId}
adminRateLimit(context, user.id, "site");  // clé: admin-site:{userId}
adminRateLimit(context, user.id, "pages"); // clé: admin-pages:{userId}
```

### Identité réseau de la recherche — pourquoi pas `clientAddress`

`GET /api/search` est le **seul** endpoint public indexé sur une identité réseau plutôt que sur un `userId`. Sa clé est :

```typescript
// src/pages/api/search.ts
const clientKey = extractIp(request.headers, clientAddress) ?? "unknown";
const rl = checkRateLimit(`search:${clientKey}`, { window: 60, max: 60 });
```

La limite était auparavant indexée sur `clientAddress` **seul**. Derrière un reverse proxy, `context.clientAddress` vaut l'adresse du proxy pour **toutes** les requêtes : tous les visiteurs partageaient alors un seul compartiment, et la recherche devenait inaccessible par saturation pour tous, sans qu'aucun client ne soit fautif.

`extractIp()` (`src/lib/audit.ts`) applique la résolution d'identité réseau standard du projet :

1. si `TRUST_PROXY === "true"` : premier IP de `x-forwarded-for`, puis `x-real-ip` ;
2. sinon, ou en repli : `clientAddress` ;
3. validation IPv4/IPv6 via `net.isIP()`, sinon `null`.

Le repli `"unknown"` (bucket global partagé) est **conservé tel quel** : il borne le débit quand aucune adresse exploitable n'est disponible, au prix d'un partage de compartiment dans ce cas précis. Compromis assumé, pas oubli.

> `TRUST_PROXY` doit valoir `"true"` en production derrière un proxy. Sans lui, `extractIp()` ignore les en-têtes transférés et la clé retombe sur `clientAddress` — c'est-à-dire sur l'adresse du proxy, donc sur le compartiment unique qu'on voulait précisément éviter. Voir `docs/security.md` §10.

Autres limites indexées sur une IP : `upload:{ip}`, `contact:{ip}` (avec repli `contact:__global__`). Les limites d'actions et d'exports sont indexées sur `{userId}`.

---

## Architecture interne

```typescript
// src/lib/store.ts — MemoryRateLimitStore (Map<string, { count: number; resetAt: number }>)
// accessible via getRateLimitStore(), interchangeable via setStores()
```

- **Store** : `MemoryRateLimitStore` process-local, obtenu via `getRateLimitStore()` (pluggable : `setStores({ rateLimit })` pour Redis/tests)
- **Fenêtre** : fixed-window — première requête crée l'entrée (`count: 1`), les suivantes incrémentent jusqu'à `max`
- **Capacité** : `MAX_ENTRIES = 10000` — à capacité atteinte (après purge des expirées), rejet fail-closed
- **Jitter** : ±2s sur `resetAt` lors du refus (plancher : ≥1s dans le futur)
- **Cleanup** : `setInterval` toutes les 5 minutes supprime les entrées expirées
- **unref()** : le timer de cleanup ne bloque pas l'arrêt du process Node

---

## Limitation : déploiement multi-instance

⚠️ Le store est **process-local**. En déploiement multi-instance (load balancer), chaque nœud a son propre compteur, ce qui multiplie effectivement la limite par le nombre d'instances.

### Migration Redis

Pour le scaling, remplacer le `Map` par un compteur Redis :

```typescript
// Exemple avec ioredis
import Redis from 'ioredis';
const redis = new Redis(process.env.REDIS_URL);

export async function checkRateLimit(key: string, opts: RateLimitOptions) {
  const count = await redis.incr(`rl:${key}`);
  if (count === 1) await redis.expire(`rl:${key}`, opts.window);
  return {
    allowed: count <= opts.max,
    remaining: Math.max(0, opts.max - count),
    resetAt: Date.now() + opts.window * 1000,
  };
}
```

---

## Tests

`tests/unit/rate-limit.test.ts` — **10 tests** :

1. `allows requests within the limit`
2. `decrements remaining on each call`
3. `blocks requests when limit is exceeded`
4. `returns a valid resetAt timestamp in the future`
5. `uses different counters for different keys`
6. `resets counter after window expires`
7. `provides fresh remaining count after window resets`
8. `rejects when MAX_ENTRIES is reached with active entries (fail-closed)`
9. `jittered resetAt is always at least 1 second in the future`
10. `purges expired entries to make room when full`

`tests/unit/extract-ip.test.ts` — **19 tests** : couvre la résolution d'identité réseau utilisée comme clé de limite par `upload`, `contact` et `search`.
