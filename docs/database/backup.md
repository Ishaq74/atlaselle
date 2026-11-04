# db:backup / db:restore-test — Sauvegarde logique et test de restauration

> **Commandes** : `pnpm db:backup`, `pnpm db:restore-test`  
> **Fichiers** : `src/database/commands/db.backup.ts`, `src/database/commands/db.restore-test.ts`, bibliothèque `src/database/commands/_backup.ts`  
> **Runbook complet** (RPO/RTO, sinistre, retour arrière) : [docs/operations/backup-restore-rollback.md](../operations/backup-restore-rollback.md)

---

## Usage

```bash
pnpm db:backup                                   # backups/<base>-<horodatage>.dump + .dump.json
pnpm db:restore-test                             # sauvegarde la base cible, la restaure dans une base jetable, compare
pnpm db:restore-test -- --file backups/X.dump    # vérifie une sauvegarde existante (manifeste .json requis)
pnpm db:restore-test -- --keep                   # conserve la base jetable pour l'inspecter
```

## Prérequis

- Client PostgreSQL (`pg_dump`, `pg_restore`) de **même version majeure que le serveur** (à défaut, la plus proche version supérieure, avec un avertissement). Ne jamais utiliser un client plus récent « par défaut » : un dump produit par `pg_dump` 17+ contient des commandes (`SET transaction_timeout`) qu'un serveur 16 refuse de restaurer. Recherche dans `PG_BIN_DIR`, le `PATH`, `C:\Program Files\PostgreSQL\<v>\bin` (Windows) et `/usr/lib/postgresql/<v>/bin` (Linux).
- Pour `db:restore-test` : droit `CREATEDB` sur le serveur de restauration.

## Variables d'environnement

| Variable | Défaut | Description |
| :-- | :-- | :-- |
| `DB_ENV` / `DATABASE_URL_*` | `LOCAL` | base **source**, résolue par `src/database/env.ts` |
| `BACKUP_DIR` | `backups` | dossier des sauvegardes (ignoré par Git, fichiers `0600`) |
| `PG_BIN_DIR` | — | dossier des binaires PostgreSQL à utiliser en priorité |
| `RESTORE_TEST_ADMIN_URL` | URL source, base `postgres` | serveur sur lequel créer la base jetable. **Obligatoire en `DB_ENV=PROD`** (jamais de base jetable sur le serveur de production) |

## Fonctionnement

**Sauvegarde.** Ouvre une transaction `REPEATABLE READ READ ONLY`, exporte son instantané (`pg_export_snapshot`), relève le nombre exact de lignes de chaque table et le journal `__drizzle_migrations`, puis lance `pg_dump --format=custom --snapshot=…` dans ce même état. Écrit le dump et son manifeste (SHA-256, versions, comptes, journal). Le mot de passe passe par `PGPASSWORD`, jamais par la ligne de commande.

**Test de restauration.** Vérifie le SHA-256, crée `restore_drill_<horodatage>_<aléa>` (nom validé par un garde-fou : aucune autre base ne peut être créée ni supprimée), restaure avec `pg_restore --no-owner --no-acl --exit-on-error`, relève les mêmes comptes sur la base restaurée et les compare à ceux du manifeste (tables manquantes ou en trop, lignes, journal des migrations). Supprime la base jetable (sauf `--keep`). Code de sortie `1` au moindre écart.

## Effacements RGPD

Une restauration ressuscite les personnes effacées après le dump. Rejouer le registre hors base **avant de rebasculer le trafic** : [erasure-ledger.md](erasure-ledger.md) (`pnpm db:replay-erasures`).

## Sécurité

Les dumps contiennent des données personnelles : chiffrement et transfert hors serveur obligatoires, jamais en artefact de CI.

## Tests

- `tests/unit/db-backup.test.ts` — helpers (URL, noms, garde-fou, comparaison, recherche des binaires)
- `tests/integration/db-backup-restore.test.ts` — exercice réel sur une base source jetable, avec cas d'échec (décompte falsifié, journal différent, fichier altéré) ; ignoré si les outils ou `CREATEDB` manquent
- CI : `.github/workflows/restore-drill.yml` (hebdomadaire, manuel, et sur modification de ces fichiers)
