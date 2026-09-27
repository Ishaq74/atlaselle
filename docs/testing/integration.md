# Testing — Tests d'Intégration

> Retour à l'[index](index.md) · Voir aussi [setup](setup.md)

---

## Vue d'ensemble (45 fichiers sur disque — extraits ci-dessous)

| Fichier | Cible | Tests | Status |
| :-- | :-- | --: | :-- |
| `tests/integration/auth.test.ts` | better-auth API — session, admin, impersonation, RGPD | 11 | ✅ |
| `tests/integration/auth-flow.test.ts` | Sign-up → Sign-in → Sign-out flow | 5 | ✅ |
| `tests/integration/audit.test.ts` | `logAuditEvent()` + hooks intégration | 8 | ✅ |
| `tests/integration/export.test.ts` | `/api/export-data` endpoint | 3 | ✅ |
| `tests/integration/auth-advanced.test.ts` | Password reset/change, email verification, updateUser | 10 | ✅ |
| `tests/integration/middleware.test.ts` | `getSession()` avec différents headers — **n'importe pas** `src/middleware.ts` | 4 | ✅ |
| `tests/integration/db-health.test.ts` | `checkConnection()`, singleton Drizzle, raw query | 4 | ✅ |
| `tests/integration/cms-admin.test.ts` | Actions CMS admin : CRUD site, social, nav, theme, hours, pages | 14 | ✅ |
| **Sous-total des extraits ci-dessus** | | **59** | **✅** |
| **Total des 45 fichiers du dossier** | | **—** | **✅** |

> **`tests/integration/auth-org.test.ts` n'existe plus.** Le plugin `organization` a été retiré (TODO §30.3) et le fichier avec lui. Aucune action `ORG_*` ne subsiste dans l'union `AuditAction` — voir [audit.md](../audit.md). Toute référence à `auth-org.test.ts` dans cette documentation est périmée.
>
> Les **45** fichiers se répartissent par **préfixe de nom de fichier**, recompté sur `tests/integration/*.test.ts` : `voyage-*` **15**, `*cms*` **4**, `auth*` **3**, `admin-*` **3**, `blog-*` **2**, `payments-*` **1**, autres **17** (`analytics-endpoint`, `applications`, `apply-page`, `audit`, `availability`, `booking-tunnel`, `cancellation`, `contact-api`, `db-health`, `email-worker`, `export`, `itinerary-contents-faq`, `middleware`, `navigation-cycle`, `repositories`, `sitemap`, `trip-loader`). Somme : 15 + 4 + 3 + 3 + 2 + 1 + 17 = **45**. Le détail par fichier se lit dans `tests/integration/`.

### Prérequis

Tous les tests d'intégration nécessitent une **base PostgreSQL opérationnelle** avec les migrations appliquées. Les variables d'environnement requises :

```bash
DATABASE_URL_LOCAL=postgresql://test:test@localhost:5432/atlaselle_test
DB_ENV=LOCAL
NODE_ENV=test
BETTER_AUTH_SECRET=ci-test-secret-key-minimum-32-chars!!
BETTER_AUTH_URL=http://localhost:4321
```

> **`SITE_URL` est également requise, et dans l'environnement du processus.** `vitest.config.ts` est fail-closed dessus : sans elle, la suite **ne démarre pas**, avant même le premier test. Elle n'est **pas** lue depuis un fichier `.env` — la mettre uniquement dans `.env` ne suffit pas. Contrat complet et commandes de lancement : [setup.md](setup.md) § « `SITE_URL` — obligatoire, dans l'environnement du processus, et pas lisible depuis `.env` ».

---

## `auth.test.ts` — Session, Admin, Impersonation, RGPD

**Cible** : `src/lib/auth.ts` → `auth.api.*` — **11 tests**

### Session & User (3 tests)

| # | Test | Ce qu'il vérifie |
| :-- | :-- | :-- |
| 1 | `creates a valid session via login()` | `signInEmail()` retourne un `token` non-nul |
| 2 | `getSession returns user from auth headers` | Headers avec token valide → session avec `user.email` |
| 3 | `getSession returns null for empty headers` | Headers vides → `null` |

### Admin API (4 tests)

| # | Test | Ce qu'il vérifie |
| :-- | :-- | :-- |
| 4 | `admin can list users` | `listUsers()` retourne un tableau contenant les users seeds |
| 5 | `admin can ban and unban a user` | `banUser()` → `banned: true` → `unbanUser()` → `banned: false` |
| 6 | `admin can change user role` | `setRole()` modifie le rôle dans la DB |
| 7 | `non-admin cannot list users` | Un user normal reçoit une erreur/null |

### Impersonation (2 tests)

| # | Test | Ce qu'il vérifie |
| :-- | :-- | :-- |
| 8 | `admin can impersonate a user and stop` | `impersonateUser()` → session changée → `stopImpersonating()` → session originale |
| 9 | `non-admin cannot impersonate` | Un user normal reçoit une erreur |

### RGPD — suppression de compte (2 tests)

| # | Test | Ce qu'il vérifie |
| :-- | :-- | :-- |
| 10 | `admin can remove a user` | `deleteUser()` retire l'utilisateur |
| 11 | `session is invalid after user deletion` | La session de l'utilisateur supprimé n'est plus résolue |

> **Section « Organization » retirée.** Les tests `createOrganization()` / `getFullOrganization()` listés dans les versions antérieures de ce document **n'existent plus** : le plugin `organization` a été retiré et `tests/integration/auth-org.test.ts` a été supprimé avec lui.

### User Deletion — RGPD (2 tests)

| # | Test | Ce qu'il vérifie |
| :-- | :-- | :-- |
| 12 | `admin can remove a user` | `removeUser()` → user supprimé de la DB |
| 13 | `session is invalid after user deletion` | L'ancien token retourne `null` après suppression |

### Stratégie — auth.test.ts

- **Setup** : crée 2 users (admin + normal) dans `beforeAll`, les supprime dans `afterAll`
- **Admin** : user principal promu admin via SQL direct (`role: 'admin'`)
- **Isolation** : chaque test utilise des email uniques (`Date.now()` suffix)

---

## `auth-flow.test.ts` — Sign-up → Sign-in → Sign-out

**Cible** : `auth.api.signUpEmail()`, `signInEmail()`, `signOut()`

| # | Test | Ce qu'il vérifie |
| :-- | :-- | :-- |
| 1 | `signUpEmail creates a new user (no session when emailVerification required)` | Inscription ok, pas de session si email non vérifié |
| 2 | `signInEmail returns a session for valid credentials` | Connexion après vérification manuelle → `token` valide |
| 3 | `signInEmail rejects invalid password` | Password incorrect → erreur |
| 4 | `signInEmail rejects non-existent email` | Email inconnu → erreur |
| 5 | `signOut invalidates the session` | Déconnexion → session invalidée |

### Stratégie — auth-flow.test.ts

- **Flow complet** : sign-up → force `emailVerified` en DB → sign-in → sign-out
- **Nettoyage** : supprime le user dans `afterAll`

---

## `audit.test.ts` — Audit Log

**Cible** : `src/lib/audit.ts` → `logAuditEvent()` + hooks better-auth — **8 tests**

### Direct logging (2 tests)

| # | Test | Ce qu'il vérifie |
| :-- | :-- | :-- |
| 1 | `inserts an audit event into the database` | `logAuditEvent()` insère une ligne avec action, resource, userId, metadata |
| 2 | `handles null metadata gracefully` | Metadata `null` ne provoque pas d'erreur |

### Hooks integration (6 tests)

| # | Test | Ce qu'il vérifie |
| :-- | :-- | :-- |
| 3 | `logs SIGN_UP when a user signs up` | Un `signUpEmail()` génère un log `SIGN_UP` en base |
| 4 | `logs USER_BAN when admin bans a user` | `banUser()` génère un log `USER_BAN` |
| 5 | `logs USER_ROLE_CHANGE when admin changes role` | `setRole()` génère un log `USER_ROLE_CHANGE` |
| 6 | `does not log passwords in metadata` | Aucun champ `password`/`hashedPassword` dans metadata |
| 7 | `logs SIGN_IN_FAILED for bad credentials` | Un `signInEmail()` raté génère `SIGN_IN_FAILED` |
| 8 | `filters metadata to SAFE_FIELDS only (no password in metadata)` | Le filtrage des champs est effectif, pas seulement l'absence fortuite |

### Stratégie — audit.test.ts

- **Vérification directe** : lit les logs dans `auditLog` table après chaque action
- **Sécurité** : vérifie que les passwords ne fuient jamais dans les metadata
- **Nettoyage** : supprime les logs et users dans `afterAll`
- ** hors de ce fichier** : l'action `INFRA_PROXY_HEADER_REJECTED` est couverte par `tests/unit/voyage/middleware-forwarded-audit.test.ts` (21 tests) — voir [audit.md](../audit.md) §Actions d'infrastructure

---

## `export.test.ts` — API Export Data

**Cible** : `src/pages/api/export-data.ts` (endpoint RGPD)

| # | Test | Ce qu'il vérifie |
| :-- | :-- | :-- |
| 1 | `returns null session for unauthenticated request` | Sans headers → pas de session |
| 2 | `returns user data for authenticated request via auth.api` | Avec headers → données user dans la réponse |
| 3 | `export query returns accounts for the user` | La query inclut les comptes liés |

### Stratégie — export.test.ts

- **API directe** : appelle `auth.api.getSession()` avec des headers fabriqués
- **RGPD** : teste le droit à la portabilité des données

---

## `auth-advanced.test.ts` — Password, Email, Profile

**Cible** : password reset/change, email verification, update profile

### Forget & Reset Password (2 tests)

| # | Test | Ce qu'il vérifie |
| :-- | :-- | :-- |
| 1 | `requestPasswordReset succeeds without error` | `requestPasswordReset()` ne throw pas (email envoyé en mode non-test ignoré) |
| 2 | `requestPasswordReset for unknown email does not throw` | Email inconnu → pas d'erreur (sécurité : pas de leak) |

### Change Password (2 tests)

| # | Test | Ce qu'il vérifie |
| :-- | :-- | :-- |
| 3 | `changePassword updates credentials` | `changePassword()` → peut re-login avec le nouveau password |
| 4 | `changePassword rejects wrong current password` | Mauvais ancien password → erreur |

### Email Verification (3 tests)

| # | Test | Ce qu'il vérifie |
| :-- | :-- | :-- |
| 5 | `user starts as unverified after signUp` | `emailVerified: false` après inscription |
| 6 | `cannot sign in before email is verified` | Login échoue tant que `emailVerified: false` |
| 7 | `can sign in after email is verified in DB` | Après `emailVerified: true` en DB → login réussit |

### Update User (3 tests)

| # | Test | Ce qu'il vérifie |
| :-- | :-- | :-- |
| 8 | `updateUser changes the user name` | `updateUser({ name })` → nom mis à jour |
| 9 | `updateUser changes the username` | `updateUser({ username })` → username mis à jour |
| 10 | `getSession reflects updated user data` | `getSession()` retourne les données mises à jour |

### Stratégie — auth-advanced.test.ts

- **Vérification manuelle en DB** : force `emailVerified` via SQL pour tester les flows
- **Zero SMTP** : `NODE_ENV=test` → aucun email envoyé (dynamic import skip)
- **Nettoyage** : supprime les users dans `afterAll`

---

## ~~`auth-org.test.ts`~~ — Organisation CRUD avancé — **FICHIER SUPPRIMÉ**

> **Cette section est retirée, pas mise à jour.** Le fichier `tests/integration/auth-org.test.ts` **n'existe plus** sur le disque : le plugin `organization` a été retiré (TODO §30.3), et le fichier de test avec lui.
>
> Les cinq cas listés ci-dessous — `updateOrganization`, `createInvitation`, `acceptInvitation`, `removeMember`, `deleteOrganization` — n'ont **plus aucun test**. Ils n'ont pas été déplacés ailleurs : la functionality a été retirée avec le plugin.
>
> Si une documentation ou un skill mentionne `auth-org.test.ts`, `createInvitation` ou une action `ORG_*`, cette mention est périmée.

---

## `middleware.test.ts` — Dépendance d'authentification

**Cible** : `auth.api.getSession()` avec différents headers HTTP — **4 tests**

> **Ce fichier ne teste pas `src/middleware.ts`.** Son en-tête de fichier le dit : le middleware Astro « depends on `astro:middleware` ». Aucune instruction de ce fichier n'importe `@/middleware`. C'est un test de la dépendance better-auth contre une vraie base, et il doit être décrit comme tel.

| # | Test | Ce qu'il vérifie |
| :-- | :-- | :-- |
| 1 | `returns user and session for authenticated headers` | Headers valides → `user` + `session` non null |
| 2 | `returns null for empty headers (unauthenticated)` | Headers vides → `null` |
| 3 | `returns null for invalid auth token` | Token invalide → `null` |
| 4 | `returns null for expired/revoked session` | Session révoquée par `signOut()` → `null` |

### Stratégie — middleware.test.ts

- **Base réelle** : `getTestHelpers()` de better-auth crée et supprime un utilisateur vérifié
- **Headers natifs** : utilise `new Headers()` Web API
- **Ce qui n'est pas couvert ici** : la garde locale, le point d'application unique des en-têtes, le timeout 503, le signalement d'en-tête de transfert. Ces points sont couverts par `tests/unit/voyage/middleware.test.ts` (17 tests) et `tests/unit/voyage/middleware-forwarded-audit.test.ts` (21 tests), qui importent réellement le middleware. Voir [middleware.md](../middleware.md) §Tests.

---

## `db-health.test.ts` — Santé Base de Données

**Cible** : `checkConnection()`, `getDrizzle()`, raw query — **4 tests**

| # | Test | Ce qu'il vérifie |
| :-- | :-- | :-- |
| 1 | `checkConnection returns ok with valid latency` | `status: 'ok'`, `latency` est un nombre positif |
| 2 | `getDrizzle returns the same instance (singleton)` | 2 appels → même référence (`===`) |
| 3 | `can execute a raw query via drizzle` | `SELECT 1` retourne le résultat attendu |
| 4 | `getLazyDrizzle proxy delegates to current instance` | Le proxy paresseux délègue à l'instance courante |

### Stratégie — db-health.test.ts

- **Smoke test** : vérifie que la connexion DB est fonctionnelle
- **Singleton** : garantit qu'on ne crée pas de connexions multiples

---

## Résumé couverture intégration

```text
Auth flows testés :          session, admin, impersonation, RGPD
Auth advanced :              password, email, profile
Auth org :                   ⚠️ RETIRÉ (plugin organization supprimé)
Audit :                      logging + hooks
Export RGPD :                via API
Middleware :                  via getSession (le middleware Astro lui-même injecte session + security headers, voir src/middleware.ts)
DB health :                   connexion, singleton, raw query
Total fichiers intégration : 15 sur disque
```
