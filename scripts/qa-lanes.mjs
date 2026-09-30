#!/usr/bin/env node
/**
 * Définition et équilibrage des « voies » (lanes) E2E.
 *
 * ## Rappel : pourquoi par navigateur, et pas par `--shard`
 *
 * `--shard=i/N` découpe la LISTE DE TESTS. Or la suite contient des scénarios
 * enchaînés : deux fichiers utilisent `test.describe.serial`, et un fichier
 * `zz-regression-probe` ne peut pas tourner avant les autres. Un découpage par
 * fichier disperse les étapes d'un même scénario sur des shards différents, qui
 * s'exécutent dans un ordre arbitraire : on obtient alors des échecs qui
 * n'existent pas dans le séquentiel (faux positifs).
 *
 * L'unité de parallélisation retenue est donc le PROJET Playwright (le
 * navigateur) : une voie = un navigateur + son serveur + son port + sa base. La
 * sélection des tests est inchangée, donc aucun scénario n'est coupé.
 *
 * ## Coûts mesurés (baseline `tests/reports/playwright-results.json`)
 *
 * Temps cumulé par projet sur la suite complète :
 *   firefox  1095 s (41 %) · webkit 814 s (30 %) · chromium 775 s (29 %)
 *
 * Le temps mural d'un run parallélisé est la somme de la voie la plus lente :
 * c'est pourquoi Firefox est toujours seul en premier, et pourquoi
 * `--lanes=2` regroupe chromium+webkit plutôt que firefox+chromium.
 *
 * ## Ports
 *
 * 4322 + index de voie. ** Jamais 4321** : c'est le port du serveur a11y/dev,
 * `tests/a11y/run.cjs` tue tout ce l'écoute.
 */

export const PROJECTS = ['chromium', 'firefox', 'webkit'];

/** Coût cumulé mesuré par projet (secondes). Sert uniquement à l'équilibrage. */
export const PROJECT_WEIGHT = {
  firefox: 1095,
  webkit: 814,
  chromium: 775,
};

const FIRST_PORT = 4322;
/** Port réservé à l'a11y et au serveur de dev : jamais utilisé par une voie. */
export const RESERVED_PORT = 4321;

/**
 * @typedef {object} Lane
 * @property {string} name          identifiant de voie (base `atlaselle_qa_<name>`)
 * @property {string[]} projects    projets Playwright joués par cette voie
 * @property {number} port          port du serveur de la voie
 * @property {number} weight        charge estimée, en secondes
 */

/** Nom de base pour une voie — doit respecter la liste blanche de qa-db. */
export function laneDbName(name) {
  return `atlaselle_qa_${name}`;
}

/**
 * Construit les voies.
 *
 * @param {object} [options]
 * @param {number} [options.lanes=3]  nombre de voies (1 = comportement historique)
 * @param {string} [options.only]     ne garder qu'un navigateur (ex. 'firefox')
 * @returns {Lane[]}
 */
export function buildLanes({ lanes = 3, only = undefined } = {}) {
  const wanted = only ? PROJECTS.filter((p) => p === only) : PROJECTS;

  if (wanted.length === 0) {
    throw new Error(
      `--only=${only} ne correspond à aucun projet (attendu : ${PROJECTS.join(' | ')})`
    );
  }

  const count = Math.min(Math.max(Number(lanes) || 1, 1), wanted.length);

  // ── 1 voie : le comportement historique, inchangé ──
  // Un seul serveur, une seule base, les navigateurs passent l'un après l'autre.
  if (count === 1) {
    return [{ name: 'all', projects: wanted, port: FIRST_PORT, weight: sum(wanted) }];
  }

  // ── Répartition gloutonne : on place d'abord le projet le plus lourd ──
  // Firefox en premier assure qu'il se retrouve seul tant que la voie la plus
  // lente possible reste en dessous des autres. L'ordre de la liste de départ
  // est volontairement trié par poids décroissant.
  const sorted = [...wanted].sort((a, b) => PROJECT_WEIGHT[b] - PROJECT_WEIGHT[a]);
  const buckets = Array.from({ length: count }, () => []);

  for (const project of sorted) {
    // La voie la moins chargée reçoit le projet.
    let lightest = 0;
    for (let i = 1; i < buckets.length; i++) {
      if (weightOf(buckets[i]) < weightOf(buckets[lightest])) lightest = i;
    }
    buckets[lightest].push(project);
  }

  return buckets.map((projects, index) => ({
    name: projects.join('_'),
    projects,
    // Jamais 4321 : réservé au serveur a11y/dev.
    port: FIRST_PORT + index,
    weight: weightOf(projects),
  }));
}

function weightOf(projects) {
  return projects.reduce((total, p) => total + (PROJECT_WEIGHT[p] ?? 0), 0);
}

function sum(projects) {
  return weightOf(projects);
}

/** Bases hors voies E2E : Vitest et a11y ont chacune leur clone jetable. */
export const VITEST_LANE = 'unit';
export const A11Y_LANE = 'a11y';

/** Résumé lisible pour le terminal. */
export function describeLanes(lanes) {
  return lanes
    .map(
      (l) =>
        `  ${l.name.padEnd(18)} :${l.port}  ${l.projects.join(', ').padEnd(20)} ~${Math.round(l.weight / 60)} min`
    )
    .join('\n');
}
