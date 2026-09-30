/**
 * Loaders du module voyages.
 *
 * Chaque loader lit la base et retourne un DTO nommé ; aucun composant
 * n'interroge la base. Le barrel n'expose ici que les loaders publics : les
 * loaders admin restent importés par chemin direct, comme pour les services.
 */
export {
  loadTripPage,
  loadTripsList,
  loadTripMedia,
} from "./trip.loader";
export { loadTripEngagement, loadTripEngagementSummary } from "./trip-engagement.loader";
