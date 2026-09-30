/**
 * Actions du module voyages.
 *
 * Les mutations vivent dans `src/actions/voyage/` (le registre global
 * `astro:actions`) ; ce barrel est la façade du module, sur le modèle de
 * `modules/blog/actions` et `modules/services/actions`. Un domaine expose donc
 * toujours `modules/<domaine>/actions`, sans déplacer le registre ni casser
 * les imports des pages.
 */
export * from "@/actions/voyage";
