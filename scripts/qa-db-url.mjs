/**
 * Résolution de la base de données, partagé par les scripts de la QA.
 *
 * ## Pourquoi ce module existe
 *
 * `src/database/env.ts` choisit la base ainsi : `DB_ENV` (LOCAL | TEST | PROD)
 * puis la variable `DATABASE_URL_<ENV>`. Les scripts de QA doivent appliquer
 * EXACTEMENT la même règle, sinon ils dériveraient leurs clones d'une autre base
 * que celle que l'application utilise réellement — typiquement un développeur en
 * `DB_ENV=TEST` verrait la QA travailler par-dessus `atlaselle_local`.
 *
 * Hardcoder `DATABASE_URL_LOCAL` serait donc un bug, pas une simplification.
 *
 * ## Règles (miroir de src/database/env.ts)
 *
 *  - `DB_ENV` absent ou vide → `LOCAL` (avec avertissement)
 *  - valeur normalisée en majuscules, espaces retirés
 *  - valeur hors de LOCAL/TEST/PROD → erreur franche, pas de repli silencieux
 *
 * ## Surcharge par voie
 *
 * Pour cibler une base jetable, on ne force PAS `DB_ENV` : on garde l'env
 * actif du développeur et on surcharge uniquement la variable d'URL
 * correspondante (`DATABASE_URL_TEST=…/atlaselle_qa_firefox`, par exemple).
 * `dotenv` n'écrase pas l'environnement du processus, donc cette valeur gagne
 * sur `.env`.
 */

const VALID_ENVS = ['PROD', 'TEST', 'LOCAL'];

/**
 * Environnement de base de données actif.
 * @returns {'LOCAL'|'TEST'|'PROD'}
 */
export function activeDbEnv() {
  const raw = process.env.DB_ENV;

  if (raw === undefined || raw.trim() === '') {
    return 'LOCAL';
  }

  const normalized = raw.trim().toUpperCase();
  if (!VALID_ENVS.includes(normalized)) {
    throw new Error(
      `[qa] DB_ENV invalide : « ${raw} ». Valeurs acceptées : ${VALID_ENVS.join(', ')}.`
    );
  }
  return normalized;
}

/** Nom de la variable d'URL correspondant à l'env actif, ex. `DATABASE_URL_TEST`. */
export function dbUrlVarName() {
  return `DATABASE_URL_${activeDbEnv()}`;
}

/** URL de la base réellement utilisée par l'application (source des clones). */
export function sourceUrl() {
  const varName = dbUrlVarName();
  const raw = process.env[varName];
  if (!raw) {
    throw new Error(
      `[qa] ${varName} absente de l’environnement / .env. ` +
        `Impossible de dériver les bases jetables de la QA.`
    );
  }
  return raw;
}

/** Noms de TOUTES les bases configurées — protégés, jamais supprimables. */
export function configuredDbNames() {
  const names = new Set();
  for (const env of VALID_ENVS) {
    const raw = process.env[`DATABASE_URL_${env}`];
    if (!raw) continue;
    try {
      names.add(new URL(raw).pathname.slice(1));
    } catch {
      /* URL illisible : ne peut correspondre à aucun nom validé */
    }
  }
  return names;
}

/**
 * URL d'une base QA dérivée de l'URL source.
 * @param {string} dbName nom déjà validé par la liste blanche
 */
export function urlForDb(dbName) {
  const u = new URL(sourceUrl());
  u.pathname = `/${dbName}`;
  return u.toString();
}

/** URL d'administration : mêmes credentials, base `postgres`. */
export function adminUrl() {
  const u = new URL(sourceUrl());
  u.pathname = '/postgres';
  return u.toString();
}

/**
 * Variables d'environnement permettant à un sous-processus (migrate, seed,
 * Playwright, Vitest, a11y) de travailler sur une base jetable.
 *
 * `DB_ENV` est conservé tel quel : seule l'URL change. C'est ce qui garantit
 * qu'on ne bascule pas un `DB_ENV=PROD` vers `LOCAL` par accident.
 *
 * @param {string} dbName
 * @returns {Record<string, string>}
 */
export function laneEnv(dbName) {
  return {
    DB_ENV: activeDbEnv(),
    [dbUrlVarName()]: urlForDb(dbName),
  };
}
