---
name: atlaselle-auth
description: Atlaselle better-auth usage (sessions, guards, roles, orgs). Use when adding login, protected routes, roles, invitations, or touching auth, session, permissions. Covers authentification, session, rôle, permission, organisation.
metadata:
  author: atlaselle-repo
  version: "1.0"
---

# Atlaselle Auth — better-auth, usage repo

Lib : `better-auth ^1.7.4`. Fichiers : `src/lib/auth.ts` (serveur), `src/lib/auth-client.ts` (client), `src/lib/auth-data.ts`, `src/lib/auth-guards.ts`, `src/lib/permissions.ts`. Rôles actuels : `user`, `admin` (+ impersonation) ; orgs via `organization`/`organization_role`. Génériques complémentaires : `better-auth-best-practices`, `email-and-password-best-practices`, `organization-best-practices`.

## 1. Patterns

- Session serveur : `auth.api.getSession({ headers })` (voir `CONTRIBUTING.md §5`, `src/lib/auth-guards.ts` : `requireAuth`, `requireAdmin`…).
- Protéger : chaque action/loader refait auth → autorisation → portée (voir `atlaselle-actions`).
- Mots de passe : hashés, vérification email, sessions à expiration, cookies sécurisés, CSRF (`security.checkOrigin`).
- Slugs auth localisés : `src/i18n/{locale}/auth.ts` (`connexion`, `sign-in`, `iniciar-sesion`, AR ASCII) résolus par `resolveAuthSlug` — le switcher mappe les équivalents (voir `atlaselle-i18n`).

## 2. Interdits / limites

- Pas d'auth custom (better-auth fait foi). Pas le plugin `better-auth-stripe` pour le tunnel voyage (module `payments` générique + adaptateur Stripe, TODO §13).
- Rôles voyage (`super_admin`, `trip_manager`, `reviewer`, `finance`, `support`, editor) : à étendre via `organization_role` (matrice TODO §17.3).
- `traveler ≠ user` : table voyage découplée, `userId` nullable, pas de fusion auto (`APPLICATION_EMAIL_CONFLICT` si conflit). `requireAccount` paramétrable (global + par Trip).
- Ré-authentification exigée : remboursement, suppression, changement de rôle, publication politique, dérogation capacité — auditées.

## 3. Anti-patterns

Rôle vérifié côté client uniquement · `userId` obligatoire sur traveler · fusion auto de comptes · token/secret en log · page admin sans guard serveur.

## 4. Checklist

Tests `auth-flow`, `auth-advanced`, `auth-org`, `middleware` ; E2E `auth.spec.ts` × 3 navigateurs ; 4 locales pour tout slug/label auth ajouté.
