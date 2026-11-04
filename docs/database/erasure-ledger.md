# Registre d'effacements RGPD — `db:erasure-ledger` / `db:replay-erasures`

> **Commandes** : `pnpm db:erasure-ledger`, `pnpm db:replay-erasures`  
> **Fichiers** : `src/lib/erasure-ledger.ts` (registre), `src/database/commands/_erasure.ts` (rejeu), `db.erasure-ledger.ts`, `db.replay-erasures.ts`  
> **Contexte** : [runbook de restauration](../operations/backup-restore-rollback.md) §4 et §8

---

## Problème résolu

Une sauvegarde ramène les données telles qu'elles étaient à sa date. Si une personne a demandé son effacement **après** cette sauvegarde, restaurer la base **la ressuscite**, et la trace de l'effacement (`audit_log`) est dans la même base : elle disparaît avec. Le registre est un fichier **hors base** qui survit à la restauration et permet de **rejouer** les effacements.

## Ce qui est enregistré

Une ligne ndjson par effacement, **sans aucune donnée personnelle** : identifiant opaque (id de dossier ou de compte), date, type, acteur, source, somme de contrôle SHA-256.

```json
{"v":1,"id":"…","at":"2026-11-05T09:12:00.000Z","kind":"traveler.anonymize","subject":"<uuid>","actor":"<id admin>","source":"action","sum":"…"}
```

| `kind` | Déclencheur | Rejeu |
| :-- | :-- | :-- |
| `traveler.anonymize` | action `anonymizeTraveler` (admin) | `anonymizeTravelerRecord` — **la même fonction** que l'action, elles ne peuvent pas diverger |
| `user.delete` | suppression d'un compte : auto-suppression (`deleteUser.afterDelete`), action `adminRemoveUser`, appel direct à l'API better-auth `/admin/remove-user` | suppression de la ligne `user` ; les clés étrangères (cascade / `set null`) reproduisent la suppression d'origine |

`source` : `action`, `hook` (better-auth) ou `audit-import` (reconstitué). Hook et action peuvent écrire la même suppression : le doublon est ignoré.

L'écriture se fait **après** l'effacement en base. Si elle échoue, l'effacement reste valide, l'erreur est journalisée (`[erasure-ledger] CRITIQUE`) et un événement d'audit **`ERASURE_LEDGER_FAILED`** est créé : à alerter. Reconstituer alors le registre avec `--import-audit`.

## Où est le fichier

| Variable | Défaut | |
| :-- | :-- | :-- |
| `ERASURE_LEDGER_PATH` | `data/erasure-ledger.ndjson` | en production, un **volume dédié** (Docker : volume `erasure` monté sur `/app/data`) |

- **Jamais dans `logs/`** : `logs.rotate` supprime les `.jsonl` de plus de 30 jours.
- Désactivé en `NODE_ENV=test` sans chemin explicite : les tests n'écrivent jamais dans le dépôt.
- Créé en `0600` (dossier `0700`), écriture synchronisée (`fsync`). `/data/` est ignoré par Git.

## Usage

```bash
pnpm db:erasure-ledger                        # vérifie l'intégrité (sommes de contrôle) et compte les entrées
pnpm db:erasure-ledger -- --import-audit      # reconstitue le registre depuis les USER_DELETE de l'audit (idempotent)
pnpm db:replay-erasures -- --dry-run          # simule le rejeu sur la base cible
pnpm db:replay-erasures                       # rejoue (confirmation en DB_ENV=PROD)
```

Options communes : `--ledger <fichier>` pour cibler un autre fichier.

**À faire une fois, maintenant** : `pnpm db:erasure-ledger -- --import-audit` en production. Les effacements antérieurs à ce registre n'y sont que si l'audit les a encore (`db:cleanup-audit` purge après 90 jours).

## Rejeu après restauration

À exécuter **avant** de rebasculer le trafic (runbook §4.2). Pour chaque entrée :

| Résultat | Sens |
| :-- | :-- |
| effacé | la personne était revenue avec la restauration : réeffacée |
| déjà effacé | rien à faire (rejeu idempotent) |
| absent de cette base | la personne n'existait pas à la date du dump : rien à effacer |
| ERREUR | à corriger puis relancer ; code de sortie `1` |

Un dossier restauré peut être « en cours » alors qu'il ne l'était plus au moment de l'effacement d'origine. **L'effacement demandé prime** : il est appliqué, avec l'avertissement `candidature en cours` / `réservation en cours dans la base restaurée` à examiner (e-mails ou paiements à clarifier, runbook §4.3).

Un registre vide ou absent produit un avertissement explicite : vérifier qu'on utilise bien celui de **production**.

## Limites

- **Sauvegarde du registre obligatoire** : une troncature en fin de fichier n'est pas détectable (les sommes de contrôle détectent corruption, modification et écriture partielle, pas l'ajout/suppression de lignes complètes). Le sauvegarder avec les dumps et le conserver **au moins aussi longtemps que la plus ancienne sauvegarde** (c'est la durée pendant laquelle une restauration peut ressusciter quelqu'un) ; il ne contient aucune donnée personnelle, sa conservation n'ajoute pas de risque.
- **Écritures concurrentes de plusieurs instances** : un doublon est possible, sans effet (rejeu idempotent).
- **Fichiers téléversés** : l'image de profil d'un compte supprimé est effacée à la suppression ; une restauration du volume `uploads/` plus ancien peut la rapporter. Non rejoué.
- **Complétude de l'anonymisation** (antérieure au registre, non modifiée ici) : `anonymizeTravelerRecord` n'efface que les champs de `travelers` (e-mail, téléphone, noms, date de naissance). Subsistent notamment `applications.dietary_requirements`, `accessibility_needs`, `motivation`, `expectations`, les notes internes, et l'adresse réelle dans `email_deliveries.to_email`. Le rejeu applique exactement la même fonction : étendre l'anonymisation étendra le rejeu. Décision juridique à prendre (TODO §19).

## Tests

- `tests/unit/erasure-ledger.test.ts` — format, refus des données personnelles, concurrence, altérations détectées, import d'audit
- `tests/integration/erasure-replay.test.ts` — base réelle : rejeu après « restauration » simulée, idempotence, dossier en cours, erreur isolée ; effacements réels (`anonymizeTraveler`, suppression admin via better-auth, `afterDelete`) alimentent le registre
