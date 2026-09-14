---
name: atlaselle-admin
description: Atlaselle back-office ([lang]/admin resources, dashboards, roles). Use when adding admin pages, resources, filters, dashboards, or touching admin permissions, revisions, locks. Covers admin, back-office, ressource, tableau de bord, rôle.
metadata:
  author: atlaselle-repo
  version: "1.0"
---

# Atlaselle Admin — ressources et back-office

Existant : `src/pages/[lang]/admin/` (audit, blog, index, media, navigation, pages, roles, services, site, stats, theme, users). À créer (TODO §16.2) : trips, departures, applications, reservations, payments, policies, email-templates, travelers.

## 1. Contrat de ressource (obligatoire)

`src/core/admin/resource-contract.ts` + `filter-contract.ts` — réutiliser tel quel (docs : `docs/cms/admin-resources.md`, `docs/cms/admin.md`, `docs/architecture/module-system.md`).
Chaque ressource : liste + filtres + formulaires + actions groupées opt-in, avec :
- Filtres **dans l'URL** (rendu serveur déterministe).
- Loaders admin typés (`loadAdminTrips()`, `loadAdminApplications()`…) : contexte, permission, schéma Zod, type déterministe.
- Flux formulaire TODO §16.4 (voir `atlaselle-ui` §3).

## 2. Dashboard et priorités (TODO §16.6–16.7)

Santé affichée : candidatures en attente, départs à venir, places restantes, réservations récentes, paiements en attente, soldes dus, contenu à traduire, activité récente. Reporting jour/semaine/mois/voyage/départ (candidatures, approbation, réservations, revenus brut/encaissé/en attente/remboursé, occupation).

## 3. Concurrence, révision, prévisualisation

- Verrouillage optimiste (`version`/`updatedAt`, pattern `src/core/locks/`) : message « version obsolète, recharger ou comparer », jamais d'écrasement silencieux.
- Révisions : pattern `page_versions` à dupliquer (`trip_revisions`, `policy_revisions`, `faq_revisions`, `email_template_revisions`).
- Preview `/[lang]/preview/...` : autorisée, non indexable (`noindex`), hors cache public.

## 4. Permissions (voir `atlaselle-auth`)

Domaines : `trips.*`, `departures.*`, `applications.*`, `reservations.*`, `payments.*`, `media.*`, `policies.*`, `admins.manage`, `audit.read`. Rôles : super_admin, admin, trip_manager, reviewer, finance, support, editor. Contrôle **serveur uniquement** ; ré-authentification exigée pour remboursement, suppression, changement de rôle, publication politique, dérogation capacité — chaque fois auditée.

## 5. Anti-patterns

Mutation générique de statut (passer par `publishTrip()`, `approveApplication()`…) · page admin hors `[lang]` · filtre en état client · action admin sans audit · note interne sérialisée côté public.

## 6. Checklist

`pnpm check`, tests (structure + E2E admin), rôles vérifiés par ressource, audit écrit, cache public invalidé en cascade après publication.
