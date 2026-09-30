/**
 * Capacités du module voyages.
 *
 * Extrait de `module.ts` pour que la liste des capacités et la table des
 * fournisseurs soient lisibles séparément — même découpage que
 * `modules/services/capabilities.ts` et `modules/blog/capabilities.ts`.
 */
import type { AtlaselleModuleCapabilityProviders } from "@/core/modules/module-contract";

export const tripsCapabilityProviders = {
  content: "trips",
  localization: "trip_translations",
  media: "media_files",
  seo: "trip_translations",
  taxonomy: "-",
  attributes: "-",
  search: "trip_translations",
  publication: "trip actions",
  revisions: "trip_revisions",
  locks: "trip_locks",
  engagement: "trip_comments/trip_reviews/trip_favorites/trip_reactions",
  moderation: "trip_comment_moderations/trip_reports",
  notifications: "trip_notifications+outbox",
  audit: "audit_log",
  cache: "database/cache",
} as unknown as AtlaselleModuleCapabilityProviders;
