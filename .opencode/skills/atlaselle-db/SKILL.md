---
name: atlaselle-db
description: Atlaselle PostgreSQL 16 + Drizzle (schemas, migrations, seeds, commands). Use when adding tables, migrations, seeds, constraints, or touching database, Drizzle, SQL. Covers base de données, schéma, migration, seed, Drizzle.
metadata:
  author: atlaselle-repo
  version: "1.0"
---

# Atlaselle DB — PostgreSQL 16 + Drizzle

Env : `DB_ENV ∈ {LOCAL, PROD, TEST}`, `DATABASE_URL_*` (`.env.example`, validés par `src/database/env.ts`). Docs : `docs/database/` (11 guides — `migrate.md`, `seed.md`, `create-schemas.md`, `infra.md`…). État réel : `docs/ETAT-REEL.md §3`.

## 1. Organisation

- Schémas : `src/database/schemas/` (11 fichiers : audit-log, auth, blog, consent, media, navigation, page, page-version, services, services-engagement, site). Migrations `src/database/migrations/0000 → 0009` (Drizzle Kit). Infra custom : `src/database/infra/{functions,triggers,indexes,constraints}.sql`.
- Seeds : `src/database/data/` (63 fichiers, `00-…` + `manifest.ts`). Jamais de fausse donnée si `DB_ENV === PROD`.
- Commandes (`package.json`) : `db:check`, `db:compare`, `db:generate`, `db:infra`, `db:migrate`, `db:reset`, `db:seed`, `db:seed-media`, `db:sync`, `db:cleanup-audit`.
- Loaders `src/database/loaders/` + `cache.ts` (TTL). Recherche : FTS PostgreSQL (`search_vector`).

## 2. Conventions voyage (TODO §8–13, §21)

- Faits vs traductions : toute entité mixte = table faits + table `*_translations` (`UNIQUE(tripId, locale)`, `UNIQUE(locale, slug)`, slugs AR ASCII).
- Montants en **centimes** (integer) + `currency` ISO-4217 (V1 : EUR, USD). Aéroports ISO-3166/codes IATA en clair.
- Emails `CITEXT UNIQUE` + normalisation (trim/lowercase), `traveler.userId` NULLABLE (jamais de FK dure vers auth).
- Contraintes DB pour les invariants structurels (unique, not null, FK, check) ; logique métier dans les services.
- Transactions obligatoires : confirmation réservation, application paiement, conversion hold, remboursement, publication avec révision. Capacité : `SELECT … FOR UPDATE` sur `departures` (jamais de calcul navigateur seul).
- Nouveaux modules : schémas dans `src/modules/<domain>/schema/`, migrations `0010 → 0015` prévues, seeds `41 → 46`.

## 3. Anti-patterns

Texte traduit dans la table de faits · montant flottant · devise en dur · seed prod avec fausses données · migration éditée après application (créer la suivante) · import DB croisé entre modules voyage (interfaces + outbox uniquement).

## 4. Checklist

`pnpm db:generate && pnpm db:migrate && pnpm db:seed` en local, `pnpm db:check`, tests `schema-validation`, CI verte (migrations + seed + tests).
