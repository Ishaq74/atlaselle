/**
 * Source de vérité unique de l'origine du serveur E2E.
 *
 * ## Pourquoi ce fichier
 *
 * L'origine `http://localhost:4322` était recopiée dans une douzaine de fichiers :
 * `playwright.config.ts`, `scripts/e2e-server.mjs`, `tests/helpers/actions.ts` et
 * 11 specs — plus les en-têtes `Origin` / `X-Forwarded-*` de
 * `api-endpoints.spec.ts`. Chaque copie était une occasion de diverger, et
 * rendait impossible de faire tourner plusieurs « voies » E2E en parallèle sur
 * la même machine (il faut un port différent par voie).
 *
 * ## Compatibilité
 *
 * Sans variable d'environnement, tout vaut exactement ce qui valait avant :
 * `localhost:4322`. Le comportement par défaut de `pnpm test:e2e` est inchangé.
 *
 * ## Variables reconnues
 *
 * | Variable  | Défaut     | Rôle                                        |
 * |-----------|------------|---------------------------------------------|
 * | E2E_HOST  | localhost  | Hôte du serveur E2E                         |
 * | E2E_PORT  | 4322       | Port de la voie courante                    |
 *
 * `E2E_LANE` n'est pas lu ici : c'est un simple libellé utilisé par
 * `playwright.config.ts` pour nommer le rapport blob et par l'orchestrateur
 * `scripts/qa.mjs` pour identifier une voie dans les logs.
 */

export const E2E_HOST = process.env.E2E_HOST ?? 'localhost';
export const E2E_PORT = Number(process.env.E2E_PORT ?? 4322);

/** Origine complète de la voie courante, ex. `http://localhost:4322`. */
export const BASE_URL = `http://${E2E_HOST}:${E2E_PORT}`;

/** En-tête `Host` attendu par le serveur, ex. `localhost:4322`. */
export const HOST_HEADER = `${E2E_HOST}:${E2E_PORT}`;

/**
 * Nom de la voie courante (utilisé pour nommer les rapports). Vide en exécution
 * simple : dans ce cas le comportement reste celui d'avant.
 */
export const E2E_LANE = process.env.E2E_LANE ?? '';
