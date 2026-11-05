# Sauvegarde, restauration et retour arrière

> Runbook d'exploitation — TODO §27.4 et checklist §34 (« sauvegarde base de données », « test de restauration (réel) », « plan de retour arrière »).
> Commandes : [`db:backup` / `db:restore-test`](../database/backup.md). Exercice automatique : `.github/workflows/restore-drill.yml`.

**Statut honnête.** Le code fournit une sauvegarde logique vérifiable et un exercice de restauration automatisé. Le reste (sauvegardes continues du fournisseur, stockage hors site, chiffrement, astreinte) **dépend de l'hébergeur, qui n'est pas encore choisi** (le job `deploy` de la CI est un emplacement réservé). Ce document dit ce qui est prouvé, ce qui est proposé et ce qui reste à décider (§8).

---

## 1. Ce qu'il faut pouvoir reconstruire

| Élément | Où | Source de vérité | Sauvegarde |
| :-- | :-- | :-- | :-- |
| Base PostgreSQL (comptes, CMS, voyages, candidatures, réservations, paiements, outbox, audit) | `DATABASE_URL_PROD` | la base elle-même | §3.1 et §3.2 |
| Fichiers téléversés (médias, variantes) | `public/uploads/` (volume `uploads`) | le volume ; la base ne contient que les références | §3.3 |
| Registre d'effacements RGPD (aucune donnée personnelle) | `data/erasure-ledger.ndjson` (volume `erasure`) ou `ERASURE_LEDGER_PATH` | le fichier | §3.3 — **obligatoire**, jamais purgé |
| Journaux opérationnels, dead-letter e-mail | `logs/` (`email-dead-letter-AAAA-MM-JJ.jsonl`) | le volume `logs` | §3.3 (rejouable, non critique) |
| Secrets : `BETTER_AUTH_SECRET`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `CRON_SECRET`, `HEALTH_TOKEN`, `DATABASE_URL_PROD`, identifiants SMTP | gestionnaire de secrets de l'hébergeur | le gestionnaire de secrets | **jamais** dans une sauvegarde de base ; copie séparée sous contrôle d'accès |
| Paiements | Stripe | **Stripe** (la base n'en garde qu'un reflet) | réconciliation, §4.3 |
| Code et migrations | dépôt Git | Git (`src/database/migrations/`) | Git |

> Perdre `BETTER_AUTH_SECRET` n'empêche pas de restaurer la base, mais invalide les sessions actives (cookies signés) : conservez-le indépendamment des sauvegardes.

---

## 2. Objectifs RPO / RTO

Valeurs **proposées, à valider** (§8). Elles sont dimensionnées pour un site de réservation à faible volume (quelques dizaines de réservations par mois).

| Scénario | RPO (perte de données tolérée) | RTO (délai de remise en service) |
| :-- | :-- | :-- |
| Panne ou corruption de la base, sauvegardes continues du fournisseur disponibles | ≤ 15 min (restauration à un instant donné) | ≤ 2 h |
| Idem, uniquement dump logique quotidien (`db:backup`) | ≤ 24 h | ≤ 4 h |
| Mauvaise migration ou mauvaise release | 0 si retour code seul (§5.A) ; sinon ≤ dernière sauvegarde (§5.B) | ≤ 30 min (A) ; ≤ 4 h (B) |
| Perte du serveur applicatif | 0 (aucun état local hors `uploads/` et `logs/`) | ≤ 1 h |

**Mesuré** : voir le journal des exercices (§7). Le premier exercice porte sur une base de développement ; il prouve la procédure, **pas** les durées de production.

---

## 3. Sauvegarder

### 3.1 Principal — sauvegardes continues du fournisseur (recommandé)

Activer, chez l'hébergeur de la base, la sauvegarde continue avec restauration à un instant donné (PITR) et des instantanés quotidiens, conservés dans une autre zone que la base. C'est la seule option qui tient un RPO de quelques minutes. Elle ne se configure pas depuis ce dépôt.

### 3.2 Complément — dump logique vérifiable (`pnpm db:backup`)

```bash
DB_ENV=PROD pnpm db:backup      # écrit backups/<base>-<horodatage>.dump + .dump.json
```

- `pg_dump` au format `custom`, pris dans une **transaction figée** : les comptes de référence du manifeste et le contenu du dump viennent du même état, même si le site reçoit du trafic pendant la sauvegarde.
- Le manifeste (`.dump.json`) contient la somme SHA-256, la version de PostgreSQL, les comptes exacts par table et le journal des migrations. Sans lui, `db:restore-test` refuse de s'exécuter.
- Les fichiers sont créés en `0600`, et `backups/` est ignoré par Git.

**Ce fichier contient des données personnelles** (voyageuses, candidatures, coordonnées). Avant de le sortir du serveur : chiffrement (par exemple `age` ou GPG, clé conservée hors du stockage des sauvegardes), transfert chiffré, accès restreint. Ne **jamais** le publier comme artefact de CI.

Cadence proposée : quotidienne, plus une sauvegarde **immédiatement avant chaque migration en production** (§5). Rétention proposée : 7 quotidiennes, 4 hebdomadaires, 12 mensuelles — à confronter à la politique de conservation des données personnelles (TODO §19) : une sauvegarde est une copie, elle ne doit pas vivre plus longtemps que la durée de conservation annoncée.

### 3.3 Fichiers

- `public/uploads/` : instantané du volume ou synchronisation vers un stockage objet. Sauvegardez les fichiers **au même moment ou après** la base : une base plus ancienne que les fichiers est sans conséquence (fichiers en trop) ; l'inverse laisse des références cassées.
- `data/erasure-ledger.ndjson` (registre d'effacements, [détails](../database/erasure-ledger.md)) : le sauvegarder **avec chaque sauvegarde de base**, hors du serveur, et le conserver au moins aussi longtemps que la plus ancienne sauvegarde. Sans lui, une restauration ressuscite les personnes effacées depuis. Ne contient aucune donnée personnelle.
- `logs/` : copie non critique (les e-mails en dead-letter sont rejouables, §4.3).

---

## 4. Restaurer

### 4.1 Vérifier qu'une sauvegarde est restaurable (à tout moment, sans risque)

```bash
pnpm db:restore-test                            # sauvegarde la base cible puis la restaure dans une base jetable
pnpm db:restore-test -- --file backups/X.dump   # vérifie une sauvegarde existante
```

La commande vérifie la somme de contrôle, crée `restore_drill_<horodatage>_<aléa>` sur le serveur, restaure avec `pg_restore --exit-on-error`, compare **chaque table et le journal des migrations** à la source, puis supprime la base jetable. Elle échoue (code 1) au moindre écart. En `DB_ENV=PROD`, elle exige `RESTORE_TEST_ADMIN_URL` vers un **autre** serveur : jamais de base jetable sur le serveur de production.

Les cas d'échec sont testés (`tests/integration/db-backup-restore.test.ts`) : décompte falsifié, journal de migrations différent, fichier altéré.

### 4.2 Sinistre : restaurer la production

1. **Geler** : arrêter l'application et désactiver le workflow `Voyage cron` (sinon des e-mails partent et des réservations bougent pendant la restauration).
2. **Choisir le point de reprise** : instant précis (PITR du fournisseur) ou dernier dump valide dont `db:restore-test` a confirmé la conformité.
3. **Restaurer dans une base neuve** (jamais par-dessus la base abîmée tant qu'on n'a pas fini d'enquêter) :
   ```bash
   createdb -h <hote> -U <admin> atlaselle_restored
   pg_restore --no-owner --no-acl --exit-on-error -h <hote> -U <admin> -d atlaselle_restored backups/<fichier>.dump
   ```
4. **Aligner le schéma sur le code déployé** : `DB_ENV=PROD DATABASE_URL_PROD=<nouvelle base> pnpm db:migrate` (applique les migrations absentes d'un dump plus ancien), puis `pnpm db:check`.
5. **Rejouer les effacements RGPD** avant de rebasculer le trafic : `DB_ENV=PROD DATABASE_URL_PROD=<nouvelle base> pnpm db:replay-erasures -- --dry-run`, puis sans `--dry-run` (registre : [erasure-ledger.md](../database/erasure-ledger.md)). Sans cette étape, une personne dont l'effacement date d'après la sauvegarde **est ressuscitée**.
6. **Basculer** `DATABASE_URL_PROD`, redémarrer l'application, vérifier `GET /api/health` (en-tête `Authorization: Bearer $HEALTH_TOKEN`, attendu `status: "ok"` en HTTP 200).
7. **Réactiver** le cron, exécuter un cycle à la main (`POST /api/cron/voyage`, en-tête `Authorization: Bearer $CRON_SECRET`) et surveiller les erreurs.
8. Conserver l'ancienne base jusqu'à la fin de l'analyse, puis la supprimer.

### 4.3 Après restauration — réconciliation obligatoire

Un point de reprise antérieur à l'incident perd les écritures intermédiaires. À traiter, dans cet ordre :

1. **Paiements (Stripe)** : Stripe fait foi. Lister les événements depuis l'heure du point de reprise (tableau de bord Stripe, section Événements) et les **renvoyer** vers `/api/payments/webhook` : le traitement est idempotent (clé d'idempotence, voir le commentaire de `src/pages/api/payments/webhook.ts` : « les traitements sont idempotents »), le rejeu ne double pas un paiement. Vérifier ensuite qu'aucune réservation n'est confirmée sans paiement ni l'inverse.
2. **E-mails** : les événements d'outbox créés après le point de reprise sont perdus ; les messages restés en dead-letter sont dans `logs/email-dead-letter-*.jsonl`. Décider au cas par cas des relances à renvoyer.
3. **Places** : les blocages temporaires (`seat_holds`) restaurés expirent par le cron (`expireHolds`) ; ne rien corriger à la main.
4. **Effacements RGPD** : déjà rejoués à l'étape 5 du §4.2 ; examiner les avertissements « candidature / réservation en cours dans la base restaurée » (dossier plus ancien que l'effacement) et décider des e-mails ou paiements à clarifier.

---

## 5. Retour arrière d'une release

**Les migrations sont à sens unique** : chaque fichier de `src/database/migrations/` s'exécute dans une transaction, il n'existe pas de migration « descendante » (`src/database/commands/db.migrate.ts`). Revenir en arrière signifie donc revenir à un **code compatible avec le schéma actuel**, ou restaurer une sauvegarde.

### Règle avant tout déploiement avec migration

1. Classer chaque migration : **additive** (nouvelle table, nouvelle colonne nullable ou avec valeur par défaut, nouvel index) ou **destructive** (`DROP`, renommage, `NOT NULL` sans défaut, changement de type).
2. Une migration destructive se fait en **deux releases** : d'abord le code qui n'utilise plus l'ancien élément (release N), puis la suppression (release N+1).
3. Prendre une sauvegarde juste avant : `DB_ENV=PROD pnpm db:backup` (ou instantané du fournisseur), noter la dernière migration appliquée.

### A. Retour du code seul (cas normal)

Condition : les migrations de la release sont additives, donc l'ancien code tourne avec le nouveau schéma.

1. Redéployer l'artefact/image de la release précédente (conserver au moins les trois derniers artefacts, identifiés par le SHA du commit).
2. Ne rien toucher à la base.
3. Vérifier `/api/health` et un parcours public (liste des voyages, page de candidature).

### B. Schéma incompatible ou données corrompues

1. Si la correction est simple : **corriger en avant** (hotfix + nouvelle migration additive). C'est le chemin le plus sûr, il ne perd aucune donnée.
2. Sinon : geler (§4.2 étape 1), restaurer la sauvegarde prise avant le déploiement dans une base neuve (§4.2 étapes 3 à 6), redéployer la release précédente, puis réconcilier (§4.3). **Toute écriture faite depuis la sauvegarde est perdue** ; la durée de cette fenêtre est le coût réel de ce chemin.

### C. Retours hors base de données

| Changement | Retour |
| :-- | :-- |
| Variable d'environnement | remettre la valeur précédente (versionner les changements dans le gestionnaire de secrets) |
| Cron voyage | désactiver le workflow `Voyage cron` (`workflow_dispatch` reste possible) |
| Webhook Stripe | désactiver le point de terminaison dans Stripe : Stripe réessaie ensuite avec un délai croissant et rien n'est perdu |
| Fichiers téléversés | restaurer le volume `uploads/` à partir de son instantané |

---

## 6. Pannes de fournisseurs

Détection : alertes Sentry (`source:session-check`, `db-pool`, `smtp`, moniteur `voyage-cron`) et sonde externe sur `/api/health` — [monitoring.md](monitoring.md) §5 et §6.

| Panne | Comportement | Action |
| :-- | :-- | :-- |
| Base indisponible | `/api/health` répond 503 ; la vérification de session expire après 5 s et répond 503 avec `Retry-After: 5` (`src/middleware.ts`) | restaurer ou basculer (§4.2) |
| SMTP indisponible | l'envoi échoue ; les messages définitivement en échec vont en dead-letter (`logs/email-dead-letter-*.jsonl`) ; la réservation reste confirmée | corriger le fournisseur, rejouer depuis l'admin (`requeueOutboxEvent`, `retryEmailDelivery`) |
| Stripe indisponible | le paiement ne peut pas être initié ; les webhooks sont réessayés par Stripe | comportement cible : TODO §27.5 (message dédié, candidature jamais supprimée) ; après rétablissement, vérifier la réconciliation §4.3 |
| Stockage des fichiers inaccessible en écriture | `/api/health` répond 503 avec `status: "degraded"` et `disk.uploadsWritable: false` ; le contenu textuel reste servi | restaurer le volume (§3.3) |

---

## 7. Journal des exercices de restauration

Un exercice n'est valable que s'il est **daté et mesuré**. Reporter chaque résultat (le job hebdomadaire `Restore drill` fournit la mesure CI dans son journal).

| Date | Environnement | Procédure | Tables / lignes | `pg_restore` | Total | Résultat |
| :-- | :-- | :-- | :-- | --: | --: | :-- |
| 2026-11-04 | base de développement locale, outils PostgreSQL 17 | `db:restore-test` | 114 / 26 355 | 4,6 s | 13,3 s | conforme (comptes et journal identiques) |

**Non encore exercé** : rejeu des effacements sur une vraie restauration de production ; taille et durée réelles de production ; restauration vers un autre serveur ; sauvegardes continues du fournisseur ; restauration du volume `uploads/` ; rejeu de webhooks Stripe ; retour arrière d'une release (§5).

---

## 8. Décisions et lacunes ouvertes

1. **Effacements RGPD et restauration — traité** : registre hors base + rejeu (`pnpm db:replay-erasures`, [erasure-ledger.md](../database/erasure-ledger.md)), prouvé avec de vrais `pg_dump`/`pg_restore` (`tests/integration/erasure-restore-e2e.test.ts`, job `Restore drill`) ; l'effacement d'un dossier couvre désormais textes libres, notes et e-mails (périmètre exact dans le même document). **Reste à faire** : en production, `pnpm db:erasure-ledger -- --import-audit` puis `pnpm db:replay-erasures` (rattrape les dossiers anonymisés avec l'ancienne version), et sauvegarder le registre.
2. **À décider** : hébergeur de la base et de l'application (conditionne §3.1, la rétention et le chiffrement) ; valeurs RPO/RTO du §2 ; outil de chiffrement des dumps et lieu de stockage hors site ; personne d'astreinte et canal d'alerte.
3. **À faire ensuite** (checklist §34) : monitoring et suivi d'erreurs ; QA paiement Stripe en bac à sable ; premier exercice sur une base de taille de production.
