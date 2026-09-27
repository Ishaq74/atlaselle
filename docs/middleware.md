# Middleware

> **Fichier** : `src/middleware.ts`  
> **Type** : Astro `defineMiddleware` — exécuté à chaque requête SSR  
> **Tests** : `tests/unit/voyage/middleware.test.ts` (17 tests) · `tests/unit/voyage/middleware-forwarded-audit.test.ts` (21 tests) — **seuls deux fichiers qui importent `src/middleware.ts`**. `tests/integration/middleware.test.ts` (4 tests) et `tests/unit/middleware-timeout.test.ts` (6 tests) **ne l'importent pas** et ne sont pas de la couverture du middleware. Voir §Tests pour le détail de ce que chacun couvre réellement.

---

## Rôle

Le middleware Astro intercepte **toutes les requêtes** avant qu'elles n'atteignent les pages ou endpoints API. Il gère six responsabilités :

1. **Bootstrap des modules** — appelle `bootstrapModules()` (`@/lib/cms/bootstrap`, ré-export de `@/core/modules/bootstrap`) pour enregistrer blog/services avant traitement
2. **Request ID** — n'accepte qu'un `x-request-id` entrant au format UUID, sinon régénère (anti-poisoning / anti-collision)
3. **Signalement d'en-tête de transfert** — `reportRejectedForwardedHeaders()` → audit `INFRA_PROXY_HEADER_REJECTED`
4. **Garde locale** — rejette les segments `[lang]` invalides (`/^[A-Za-z]{2}$/` absent de `LOCALES`) avec une 404 ; redirige en 301 la casse non canonique
5. **Injection de session** — authentifie l'utilisateur et peuple `Astro.locals`
6. **Protection SVG + en-têtes de sécurité** — une fois la chaîne terminée, via un point d'application unique

> **Correction de la regex de locale** : le motif est `/^[A-Za-z]{2}$/` (**majuscules et minuscules**), pas `/^[a-z]{2}$/`. C'est ce qui permet au garde de distinguer `/EN/trips` (majuscule → 301 vers `/en/trips`) de `/xx/trips` (`xx` n'est pas une locale → 404). Avec un motif n'acceptant que les minuscules, `/EN/trips` serait tombé dans la branche 404 au lieu de la branche 301.

---

## 0. Point d'application unique des en-têtes

`onRequest` ne retourne **jamais** directement. Il attend `runRequestChain()`, puis appelle `applySecurityHeaders(response, context.locals.requestId)` sur l'objet `Response` réellement produit, avant de le retourner.

```typescript
export const onRequest = defineMiddleware(async (context, next) => {
  bootstrapModules();
  // … requestId …
  reportRejectedForwardedHeaders(context, url);

  // Aucune sortie précoce ne court-circuite applySecurityHeaders.
  const response = await runRequestChain(context, next, url);

  applySecurityHeaders(response, context.locals.requestId);
  return response;
});
```

`runRequestChain()` contient trois sorties qui court-circuitent `next()`. **Toutes trois passent désormais par le point d'application** :

| Sortie | Emplacement | En-têtes |
| :-- | :-- | :-- |
| 404 de locale invalide | `runRequestChain()` | ✅ |
| 301 de canonicalisation de casse | `runRequestChain()` | ✅ |
| 503 de session indisponible | `runRequestChain()` | ✅ |
| Rewrite localisé | `context.rewrite()` | ✅ |
| Réponse rendue | `next()` | ✅ |

> **Historique** : l'application des en-têtes se faisait à l'intérieur de la chaîne, après `next()`. Les trois premières sorties repartaient donc **sans aucun en-tête de sécurité** — y compris la 404 et la 301, qui sont précisément les réponses les plus soumises à l'échappement d'un lien.

### La 301 est construite, pas créée par `Response.redirect()`

**Contre-intuitif, et à respecter.**

```typescript
const location = `${url.origin}/${lower}${url.pathname.slice(3)}${url.search}`;
// Response.redirect() renvoie une Response à headers immuables (guard
// "immutable") : headers.set() y lève. La 301 est donc construite ici.
return new Response(null, { status: 301, headers: { Location: location } });
```

`Response.redirect(location, 301)` renvoie une `Response` dont les en-têtes portent le guard interne `immutable`. `headers.set()` sur une telle réponse **lève une `TypeError`**. Comme `applySecurityHeaders()` écrit sur la réponse de la 301, l'exception remonterait par le wrapper de `next()` et **toute la suite de la chaîne échouerait** — pas seulement la redirection. La 301 doit rester une `Response` **construite**, sans corps et mutable.

Ce verrou est testé (`la réponse expose des en-têtes MUTABLES`).

> #### Portée exacte de la mention « immuable » — à ne pas élargir
>
> Le guard `immutable` est une propriété des en-têtes d'une `Response` produite par **`Response.redirect()` / `Response.error()`**, c'est-à-dire des réponses *fabriquées par la plateforme*. Il ne s'applique **à aucun** en-tête que le middleware écrit lui-même.
>
> Le middleware n'écrit que sur des réponses **construites** ou **rendues**, dont les en-têtes sont mutables :
>
> | Ce que le middleware écrit | Sur quelle réponse | Mutable ? |
> | :-- | :-- | :-- |
> | `Location` (301 de casse) | `new Response(null, { status: 301, headers: { Location } })` | ✅ |
> | Les 9 `SECURITY_HEADERS` + `X-Request-Id` | la réponse renvoyée par `runRequestChain()`, quelle qu'en soit l'origine | ✅ |
> | `Content-Disposition`, `Content-Type` (SVG / SVGZ) | la réponse renvoyée par `next()` | ✅ |
>
> Écrire « les en-têtes sont immuables » sans désigner `Response.redirect()` serait faux : le point d'application unique des dix en-têtes et la protection SVG reposent justement sur leur **mutabilité**.

---

## 0 bis. Signalement d'en-tête de transfert

`reportRejectedForwardedHeaders()` s'exécute **avant** la chaîne de requête : un rejet est journalisé même quand la requête n'est pas rendue (404 de locale invalide).

`security.allowedDomains` n'est pas lisible depuis le code applicatif : Astro l'applique en amont et **retombe silencieusement** sur l'hôte du socket quand la validation échoue, sans erreur. On compare donc la valeur **annoncée par le proxy** à l'URL **effectivement résolue** : une valeur non appliquée est une valeur rejetée.

| Détail | Contenu |
| :-- | :-- |
| Événement | `INFRA_PROXY_HEADER_REJECTED`, `resource: 'infra'`, `resourceId: 'forwarded-headers'`, `userId: null` |
| En-têtes lus | `x-forwarded-host`, `x-forwarded-proto` (première valeur seulement) |
| `reason` | `not_applied` (valeur refusée) · `malformed` (non normalisable) |
| Une ligne par requête | Tronquée au premier en-tête refusé |
| Hors du cycle de requête | Absent de tout le cycle de requête : jamais de 403, jamais de 500 |
| IP | `extractIp(headers, clientAddress)` — l'identité réseau, pas celle du proxy |
| Non-bloquant | `.catch(() => {})` — une indisponibilité d'audit ne rend pas le site indisponible |

Détail complet des métadonnées, de la purge des caractères non-hôtes, de la borne de 128 caractères et de l'ensemble fermé de clés : [security.md](security.md) §3.

---

## 1. Injection de session

```typescript
// src/middleware.ts — constantes
const SESSION_TIMEOUT_MS = 5000;
const SESSION_RETRY_AFTER = '5';
const SESSION_UNAVAILABLE_BODY = JSON.stringify({ error: 'Service temporarily unavailable' });

// src/middleware.ts — runRequestChain()
let timedOut = false;
let isAuthed: Awaited<ReturnType<typeof auth.api.getSession>> | null = null;
const sessionPromise = auth.api.getSession({ headers: context.request.headers });

try {
  isAuthed = await Promise.race([
    sessionPromise,
    new Promise<null>((resolve) => setTimeout(() => { timedOut = true; resolve(null); }, SESSION_TIMEOUT_MS)),
  ]);
} catch (err) {
  console.error('[middleware] Session check failed:', err);
  isAuthed = null;
}

// Empêche le rejet non géré de la promesse getSession orpheline.
sessionPromise.catch((err) => {
  if (timedOut) console.warn('[middleware] Orphaned session check failed after timeout:', err);
});

if (timedOut) {
  console.warn(`[middleware] Session check timed out (${SESSION_TIMEOUT_MS / 1000}s) — returning 503`);
  return new Response(SESSION_UNAVAILABLE_BODY, {
    status: 503,
    headers: { 'Retry-After': SESSION_RETRY_AFTER, 'Content-Type': 'application/json' },
  });
}

if (isAuthed) {
  context.locals.user = isAuthed.user;
  context.locals.session = isAuthed.session;
} else {
  context.locals.user = null;
  context.locals.session = null;
}
```

> **Sortie précoce prise en charge** : la 503 ci-dessus est produite **à l'intérieur** de `runRequestChain()`, donc **avant** le point d'application des en-têtes. Elle n'en est pas moins posée sur l'objet retourné : `onRequest` applique les dix en-têtes dessus après avoir récupéré la valeur de retour. C'est couvert par le bloc de tests dédié (§Tests).

### Comportement

| Cas | `locals.user` | `locals.session` | Réponse |
| :-- | :-- | :-- | :-- |
| Cookie valide, DB réactive | `User` ✅ | `Session` ✅ | Page normale |
| Pas de cookie / invalid | `null` | `null` | Page normale |
| DB lente (> 5s) | — | — | **503** JSON `{ error }` (`Content-Type: application/json`) + `Retry-After: 5` |
| Erreur session (exception) | `null` | `null` | Page normale |

### Timeout (5 secondes)

Le `Promise.race` avec un timeout de 5 secondes protège contre les DB lentes. Si la requête de session dépasse 5s :

- La requête est interrompue et renvoie **HTTP 503** JSON (`{ error: 'Service temporarily unavailable' }`, `Content-Type: application/json`)
- Le header `Retry-After: 5` indique au client de réessayer
- Un `console.warn` est émis pour le monitoring

Si `getSession()` lève une exception (DB crash, etc.), l'erreur est catchée et l'utilisateur est traité comme non-authentifié (la page continue normalement).

### Types `App.Locals`

Définis dans `src/env.d.ts` :

```typescript
declare namespace App {
  interface Locals {
    user: Session["user"] | null;
    session: (Session["session"] & { impersonatedBy?: string | null }) | null;
  }
}
```

(`Session` = `Auth["$Infer"]["Session"]`, avec support d'impersonation via `impersonatedBy`.)

---

## 2. Protection SVG

```typescript
const lowerPath = url.pathname.toLowerCase();
if (lowerPath.startsWith('/uploads/') && (lowerPath.endsWith('.svg') || lowerPath.endsWith('.svgz'))) {
  response.headers.set('Content-Disposition', 'attachment');
  response.headers.set('Content-Type', 'image/svg+xml');
}
```

Les fichiers SVG peuvent contenir du JavaScript. Sans protection, un SVG uploadé malicieusement pourrait exécuter du code dans le contexte du domaine.

| Protection | Effet |
| :-- | :-- |
| `Content-Disposition: attachment` | Force le téléchargement au lieu du rendu inline |
| `Content-Type: image/svg+xml` | Empêche l'interprétation comme HTML |
| Case-insensitive | `.svg`, `.svgz`, `.SVG` — tous interceptés via `toLowerCase()` |

---

## 3. En-têtes de sécurité

`SECURITY_HEADERS` — **9 en-têtes**, plus `X-Request-Id` posé par `applySecurityHeaders()` = **10 en-têtes** au total :

| En-tête | Valeur |
| :-- | :-- |
| `X-Content-Type-Options` | `nosniff` |
| `X-Frame-Options` | `DENY` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=()` |
| `X-XSS-Protection` | `0` |
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains; preload` |
| `Cross-Origin-Opener-Policy` | `same-origin` |
| `Cross-Origin-Resource-Policy` | `same-origin` |
| `Cross-Origin-Embedder-Policy` | `credentialless` |
| `X-Request-Id` | `context.locals.requestId` (UUID entrant valide, sinon généré) |

Le CSP et la liste complète des en-têtes HTTP figurent dans [security.md](security.md) §3.

---

## Flux complet d'une requête

```text
HTTP Request
  │
  ▼
Astro — security.allowedDomains  → validation X-Forwarded-Host / X-Forwarded-Proto
Astro — security.checkOrigin     → 403 si soumission de formulaire intersite
  │
  ▼
Middleware onRequest()
  │
  ├─ 0) bootstrapModules() → enregistre modules blog/services, recherche, resolvers
  │
  ├─ 1) requestId → UUID entrant si valide, sinon régénéré
  │
  ├─ 2) reportRejectedForwardedHeaders() → audit INFRA_PROXY_HEADER_REJECTED
  │     └─ avant la chaîne : journalisé même sur une sortie précoce
  │
  ├─ 3) runRequestChain(context, next, url)
  │     ├─ 3a) Garde locale /^[A-Za-z]{2}$/ hors LOCALES → 404 « Not Found »
  │     ├─ 3b) Locale majuscule → 301 Response CONSTRUITE vers la forme canonique
  │     ├─ 3c) resolveLocalizedRoute() → context.rewrite()
  │     ├─ 3d) auth.api.getSession() → locals.user / locals.session
  │     │     ├─ Timeout 5s → 503 { error } + Retry-After: 5
  │     │     └─ Exception → locals = null, continue
  │     └─ 3e) next() → Page / API endpoint
  │           └─ SVG/SVGZ → Content-Disposition: attachment
  │
  ├─ 4) applySecurityHeaders(response, requestId)  ← POINT UNIQUE
  │
  ▼
HTTP Response
```

> Les étapes 3a, 3b et 3d sont des **sorties précoces** : elles court-circuitent 3e. Aucune ne court-circuite l'étape 4.

---

## Tests

> **Règle de ce tableau** : un fichier n'est décrit comme couvrant le middleware que s'il **l'importe**. **Deux** fichiers l'importent réellement ; **deux autres** ne le font pas et ne doivent pas être comptés comme couverture du middleware. Chacun est vérifié sur son contenu réel.

### Fichiers qui importent `src/middleware.ts`

| Fichier | Tests | Ce qu'il couvre réellement |
| :-- | --: | :-- |
| `tests/unit/voyage/middleware.test.ts` | **17** | Importe `onRequest` via `vi.mock('astro:middleware')`. Garde locale (404 minuscule et majuscule), 301 de canonicalisation **avec lecture de `Location` sur la réponse produite**, rewrite localisé, `requestId` (propagé si UUID, régénéré sinon), session présente / absente / expirée / en timeout, en-têtes sur les **trois sorties précoces**, mutabilité de la 301, conservation du `Content-Type` de la 503. |
| `tests/unit/voyage/middleware-forwarded-audit.test.ts` | **21** | Importe `onRequest`. N'observe pas un `logAuditEvent` mocké mais **la ligne que la base aurait reçue** (`insert().values(row)`) — `@/lib/audit` n'est pas mocké, seule la frontière de persistance l'est. Couvre l'émission, l'absence d'émission sur le chemin heureux et sur en-tête déjà appliqué, un seul événement par requête, la purge / borne de 128 caractères / absence de valeur brute, et l'ensemble fermé de clés (aucun secret d'en-tête lu). |

### Fichiers qui **ne** couvrent pas le middleware

| Fichier | Tests | Ce qu'il couvre réellement |
| :-- | --: | :-- |
| `tests/integration/middleware.test.ts` | **4** | **N'importe pas** `src/middleware.ts`. Teste uniquement `auth.api.getSession({ headers })` contre une vraie base : session valide, headers vides, token invalide, session révoquée. Son en-tête de fichier le dit : le middleware « depends on `astro:middleware` ». C'est un test de la dépendance d'authentification, pas du middleware. |
| `tests/unit/middleware-timeout.test.ts` | **6** | **N'importe pas** `src/middleware.ts`. Aucune instruction du fichier ne référence `@/middleware` ; son en-tête assume le contraire : « We can't easily import the Astro middleware directly (defineMiddleware) ». |

> #### ⚠️ Couverture illusoire — `tests/unit/middleware-timeout.test.ts`
>
> Ce fichier a été identifié comme donnant une **couverture illusoire** du middleware. Il teste deux choses, toutes deux **locales** :
>
> 1. **Le motif `Promise.race`** rejoué sur des promesses fabriquées dans le test. C'est un test de `Promise.race`, pas du délai de session d'Atlaselle : il ne met en jeu ni `auth.api.getSession`, ni `SESSION_TIMEOUT_MS = 5000`, ni l'absorption du rejet orphelin.
> 2. **Des littéraux locaux.** Le test `security headers are correct` construit un objet `securityHeaders` **dans le test** et assert ses propres valeurs. Il ne lit jamais `SECURITY_HEADERS` du produit. Il ne peut donc pas détecter une régression du produit — et il n'en détecte pas une aujourd'hui :
>
>    ```typescript
>    // tests/unit/middleware-timeout.test.ts — littéral local
>    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
>    // src/middleware.ts — valeur réellement émise
>    'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload',
>    ```
>
>    Le `max-age` du test (**31536000**, un an) diverge de celui du produit (**63072000**, deux ans). Le test passe malgré la divergence, ce qui démontre qu'il ne mesure rien du produit. Le même défaut s'applique au test `503 response has Retry-After header`, qui construit sa `Response` localement au lieu de déclencher la 503 du middleware, et au test `SVG upload paths…`, qui rejoue la condition `startsWith('/uploads/') && endsWith('.svg'|'svgz')` sur des chaînes.
>
> **Ce qu'il faut faire de ce fichier** : ne pas le citer comme couverture du middleware, et corriger ses littéraux pour qu'ils cessent d'affirmer une valeur que le produit n'émet pas. La correction est un changement de code ; elle est **rapportée**, pas appliquée ici. La couverture réelle du middleware est `tests/unit/voyage/middleware.test.ts`, qui lit les dix en-têtes sur l'objet `Response` réellement retourné.

### Ligne d'origine — ce qui est asserté, et où

L'affirmation vérifiée porte sur **la réponse réellement produite**, jamais sur un objet reconstruit localement. `tests/unit/voyage/middleware.test.ts` le garantit par construction :

- le corps est lu **avant** les en-têtes (`await res.text()`), ce qui prouve que l'objet observé est celui renvoyé par `next()` et sur lequel `applySecurityHeaders` a écrit ;
- `expectSecurityHeaders()` boucle sur un contrat de 9 paires `[nom, valeur]` + `X-Request-Id`, en lisant `response.headers.get(...)` sur l'objet retourné ;
- `next` est asserté **non appelé** sur les trois sorties précoces, ce qui prouve qu'il s'agit bien de la sortie du middleware et non d'un 404 rendu par la route.

Le contrat `SECURITY_HEADER_CONTRACT` est énoncé **indépendamment** de l'implémentation (la constante du produit n'est pas exportée) : c'est ce qui en fait un vrai test de régression, et non une assertion d'égalité avec la valeur d'une ligne précédente du même fichier.

### Récapitulatif

| Périmètre | Couverts par | Non couverts |
| :-- | :-- | :-- |
| Garde locale 404 / 301 | `tests/unit/voyage/middleware.test.ts` | — |
| Rewrite localisé | `tests/unit/voyage/middleware.test.ts` | — |
| Injection de session + timeout 503 | `tests/unit/voyage/middleware.test.ts` | — |
| Point d'application des 10 en-têtes | `tests/unit/voyage/middleware.test.ts` | — |
| Mutabilité de la 301 | `tests/unit/voyage/middleware.test.ts` | — |
| `INFRA_PROXY_HEADER_REJECTED` | `tests/unit/voyage/middleware-forwarded-audit.test.ts` | — |
| `auth.api.getSession` contre une vraie base | `tests/integration/middleware.test.ts` | — |
| Protection SVG | `tests/unit/voyage/middleware.test.ts` (chemin nominal) | — |
| `bootstrapModules()` | — | ⚠️ Non couvert par un test dédié |
