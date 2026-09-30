# QA parallélisée — voies E2E et bases jetables

Ce document explique **pourquoi** la QA est organisée en « voies » (lanes), **comment**
elle fonctionne, et **comment la dépanner**. Il complète `e2e.md` (les specs) et
`ci.md` (le workflow).

---

## 1. Le problème

`pnpm qa` exécutait toute la suite Playwright d'un bloc : **un worker**, **un
serveur**, **une base**, et les trois navigateurs **les uns après les autres**.

D'après le rapport de référence (`tests/reports/playwright-results.json`), le temps
cumulé par navigateur est :

| Navigateur | Temps cumulé | Part |
|------------|-------------:|-----:|
| firefox    | 1 095 s      | 41 % |
| webkit     |   814 s      | 30 % |
| chromium   |   775 s      | 29 % |
| **total**  | **2 685 s**  | |

Mis bout à bout, cela donne **≈ 45 min** de tests, uniquement pour les navigateurs.

Changer `workers: 1` en `workers: 3` **ne fonctionne pas** : un unique serveur SSR
Node et une unique base PostgreDB s'effondrent sous la concurrence
(`SSL connect error`, `NS_ERROR_CONNECTION_REFUSED`, « Sign-in failed »), et surtout
les tests se disputent le même utilisateur `e2e-seed@test.com` — que
`global-setup.ts` supprime puis recrée à chaque exécution.

## 2. L'unité de parallélisation : le navigateur, pas le fichier de test

> **Décision centrale.** On parallélise par **projet Playwright** (le navigateur),
> jamais avec `--shard=i/N`.

`--shard` découpe la **liste de tests**. Or la suite contient des scénarios
enchaînés :

- `tests/e2e/services.spec.ts` et `tests/e2e/blog.spec.ts` utilisent
  `test.describe.serial` ;
- `tests/e2e/zz-regression-probe.spec.ts` ne peut s'exécuter qu'en dernier.

Un découpage par fichier disperse les étapes d'un même scénario sur des shards
différents, exécutés dans un ordre arbitraire. On obtient alors des échecs
**qui n'existent pas** dans le séquentiel — des faux positifs, c'est-à-dire la
pire des pathologies pour une suite de tests.

Avec une voie = un navigateur, **la sélection des tests est inchangée** : aucun
scénario n'est coupé, et le temps mural devient la voie la plus lente
(Firefox, ≈ 18 min) au lieu de la somme des trois.

## 3. Ce qu'est une voie

Une voie est un environnement **complètement isolé** :

| Ressource | Isolation |
|-----------|-----------|
| Navigateurs | un projet Playwright par voie |
| Serveur | un processus `scripts/e2e-server.mjs` par voie |
| Port | `4322 + index` (4323, 4324…). **Jamais 4321**, réservé à l'a11y |
| Base | un clone PostgreSQL `atlaselle_qa_<voie>` |
| Rapport | un sous-dossier `tests/reports/qa/playwright/blob/<voie>/` |
| Log | `tests/reports/qa/logs/<voie>.log` |

### Répartition par défaut (`--lanes=3`)

```
firefox            :4322   firefox             ~18 min
webkit             :4323   webkit              ~14 min
chromium           :4324   chromium            ~13 min
                                  temps mural ≈ 18 min
```

Avec `--lanes=2`, chromium et webkit sont regroupés (14 + 13 = 27 min) plutôt que
firefox + chromium : c'est le découpage qui minimise la voie la plus lente.

Avec `--lanes=1` (ou `--serial`), on retrouve **exactement** le comportement
historique : un serveur, une base, les trois navigateurs à la suite.

## 4. Les bases jetables

### Principe : la QA ne touche jamais la base du développeur

Avant, `pnpm qa` écrivait dans la base de `.env` : `global-setup.ts` y créait puis
supprimait `e2e-seed@test.com`, et les specs qui laissent des fixtures
l polluaient les données locales. En multi-voies, la collision aurait été
garantie.

### Fonctionnement

1. `atlaselle_qa_template` est créée **vide**, puis `migrate` + `infra` + `seed`
   y sont exécutés **une seule fois**.
2. Un clone par voie : `CREATE DATABASE … TEMPLATE …` — quasi instantané, contre
   un seed de plusieurs dizaines de fichiers de données rejoué à chaque fois.
3. La base modèle est supprimée après clonage.
4. Toutes les bases `atlaselle_qa_*` sont supprimées à la fin du run, **y compris
   en cas d'échec ou d'interruption** (Ctrl+C).

### Résolution de la base source

Les scripts appliquent **exactement** la règle de `src/database/env.ts` :
`DB_ENV` (LOCAL | TEST | PROD), puis `DATABASE_URL_<ENV>`. C'est
`scripts/qa-db-url.mjs` qui porte cette règle, partagé par `qa.mjs` et `qa-db.mjs`.

Un `DB_ENV=TEST` fait donc dériver les clones de `atlaselle_test`, et non de
`atlaselle_local`. Pour cibler une base jetable, on **conserve** le `DB_ENV` du
développeur et on ne surcharge que la variable d'URL
(`DATABASE_URL_TEST=…/atlaselle_qa_firefox`).

### Garde-fous (invariants)

1. Toute base ciblée doit respecter `^atlaselle_qa_[a-z0-9_]+$`, vérifié **avant
   tout SQL**.
2. On refuse de cibler une base réellement configurée.
3. Aucun `DROP` sur un nom hors liste blanche.
4. Un verrou (`tests/reports/qa/.lock`, PID) empêche deux `qa` simultanés de se
   supprimer mutuellement leurs bases.

## 5. Les rapports

### Le piège du reporter `blob`

Deux contraintes de Playwright 1.63 se contredisent :

1. le reporter `blob` **vide son `outputDir` au démarrage** → deux voies
   partageant un dossier s'effacent mutuellement ;
2. `playwright merge-reports` **ne cherche pas récursivement** les `.zip` → il
   en veut tous dans un dossier plat.

D'où la solution : chaque voie écrit dans **son** sous-dossier
(`blob/<voie>/report.zip`), et `scripts/merge-playwright-blobs.mjs` les rassemble
dans un dossier plat avant de lancer l'outil officiel de fusion.

> ⚠️ Corollaire important : **ne jamais passer `--reporter` en ligne de commande**.
> Le flag CLI *remplace* le tableau `reporter` de `playwright.config.ts`, donc
> notre `outputDir` par voie serait ignoré et toutes les voies écriraient dans
> `blob-report/`. C'est la variable `E2E_BLOB=1` qui déclenche le bon reporter.

### Garde-fou anti-faux-positif

Si une voie est annulée ou n'upload pas son rapport, la fusion produirait un
rapport **silencieusement incomplet** — donc un rapport « vert » qui ne couvre pas
tous les navigateurs. `merge-playwright-blobs.mjs --expect=N` refuse dans ce cas
et sort en erreur.

### Chemins des rapports

Inchangés, pour que `qa-report.cjs` et `playwright-report.cjs` continuent de
fonctionner sans réécriture :

```
tests/reports/
  playwright/                  ← HTML final (identique avant/après)
  playwright-results.json      ← JSON final (identique avant/après)
  vitest-results.json          ← inchangé
  qa-report.txt / .json        ← inchangé
  qa/                          ← NOUVEAU, intermédiaire, ignoré par git
    playwright/blob/<voie>/report.zip
    logs/<voie>.log
    .lock
```

## 6. Variables d'environnement

| Variable | Défaut | Rôle |
|----------|--------|------|
| `E2E_HOST` | `localhost` | Hôte du serveur E2E |
| `E2E_PORT` | `4322` | Port de la voie |
| `E2E_LANE` | *(vide)* | Nom de la voie. **Active le mode multi-voies** : le lock `.astro/preview.json`, qui est partagé, n'est alors plus touché |
| `E2E_SKIP_BUILD` | *(vide)* | `1` = ne pas rebuild dans le `webServer` |
| `E2E_BLOB` | *(vide)* | `1` = reporter blob au lieu de html+json |
| `E2E_BLOB_DIR` | `tests/reports/qa/playwright/blob` | Racine des blobs (un sous-dossier par voie est ajouté) |

Sans aucune de ces variables, le comportement est **strictement inchangé** :
port 4322, build inclus, rapports html+json.

## 7. Commandes

```bash
pnpm qa                       # 3 voies en parallèle (défaut)
pnpm qa -- --lanes=2          # 2 voies
pnpm qa -- --serial           # 1 voie : comportement historique
pnpm qa -- --only=firefox     # un seul navigateur
pnpm qa -- --keep-dbs         # conserve atlaselle_qa_* pour débogage
pnpm qa:offline               # check + build + lint + vitest (base jetable)
pnpm qa:serial                # raccourci de `pnpm qa -- --serial`

node scripts/qa-db.mjs prepare        # provisionne les clones
node scripts/qa-db.mjs status          # liste les bases QA
node scripts/qa-db.mjs drop            # supprime les bases QA
```

## 8. CI

En CI, chaque navigateur est un **job** de matrice :

- chaque job a sa **propre machine** et son **propre PostgreSQL** ;
- donc le port `4322` et la base `atlaselle_e2e` restent inchangés, et **aucun
  spec n'a besoin d'être modifié** ;
- chaque job produit un `blob`, et le job `e2e-report` fusionne avec
  `--expect=3`.

`fail-fast: false` est indispensable : sinon un échec Chromium annule Firefox et
WebKit, et leurs rapports sont perdus.

`download-artifact@v8` est la version courante (vérifiée) et forme le couple
attendu avec `upload-artifact@v7`.

## 9. Dépannage

| Symptôme | Cause probable | Solution |
|----------|----------------|----------|
| `un autre qa-db est déjà en cours (PID …)` | Un `pnpm qa` antérieur a été tué brutalement et son verrou traîne dans `tests/reports/qa/.lock` | Vérifier que le PID n'existe plus, puis supprimer le fichier. `qa-db drop` nettoie aussi |
| `nom de base hors liste blanche` | `--lanes=` mal saisi (caractères interdits) | N'utiliser que `[a-z0-9_]` |
| `CREATE DATABASE … TEMPLATE` échoue | Une session est encore connectée au modèle | Le script termine déjà les sessions résiduelles ; si cela persiste, `qa-db drop` puis relancer |
| Le rapport fusionné ne contient qu'un navigateur | Une voie n'a rien produit | **C'est voulu** : la fusion refuse. Regarder `tests/reports/qa/logs/<voie>.log` de la voie manquante |
| Tous les blobs dans `blob-report/` | Un `--reporter` a été passé en CLI | Le retirer : c'est `E2E_BLOB=1` qui doit activer le blob |
| Un test E2E échoue seulement en multi-voies | pollution historically ; ou `SITE_URL` figé au build sur un autre port | Comparer à `--serial`. Le `dist/` est partagé : `SITE_URL` reste celui du build et `security.allowedDomains` ne contient que le hostname (sans port) |
| « Sign-in failed » / `SSL connect error` | Trop de charge sur une machine | `--lanes=2`, ou `--serial`. Le `workers: 1` par voie est volontaire |
| Bases `atlaselle_qa_*` encore présentes | Run interrompu par un kill brutal | `pnpm qa:db:drop` |

> ⚠️ `tests/a11y/run.cjs` **tue tout ce qui écoute sur le port 4321**. Si un
> `pnpm dev` tourne, il sera arrêté. C'est aussi pourquoi 4321 n'est jamais
> attribué à une voie.

## 10. Retour arrière

- `pnpm qa:serial` reproduit le séquentiel historique.
- Les valeurs par défaut n'ont pas changé : sans variable, `pnpm test:e2e` se
  comporte exactement comme avant.
- Les bases se nettoient avec `node scripts/qa-db.mjs drop`.
- En dernier recours, `git revert` est propre : aucun comportement par défaut
  n'a été modifié.
