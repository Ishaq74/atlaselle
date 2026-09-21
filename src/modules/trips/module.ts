import type { AtlaselleModuleDefinition } from "@/core/modules/module-contract";
import {
  assertModuleCapabilityProviders,
  defineModuleCapabilities,
  defineModuleCapabilityProviders,
  defineModulePresentations,
} from "@/core/modules/module-contract";
import { tripsSearchDefinition } from "./search";

const providers = {
  content: "trips",
  localization: "trip_translations",
  media: "media_files",
  seo: "trip_translations",
  taxonomy: "—",
  attributes: "—",
  search: "trip_translations",
  publication: "trip actions",
  revisions: "trip_revisions",
  locks: "trip_locks",
  engagement: "trip_comments/trip_reviews/trip_favorites/trip_reactions",
  moderation: "trip_comment_moderations/trip_reports",
  notifications: "trip_notifications+outbox",
  audit: "audit_log",
  cache: "database/cache",
} as const;

export const tripsModule: AtlaselleModuleDefinition = {
  id: "trips",
  entity: "trip",
  capabilities: defineModuleCapabilities({
    content: true, localization: true, media: true, seo: true, taxonomy: false,
    attributes: false, search: true, publication: true, revisions: true, locks: true,
    engagement: true, moderation: true, notifications: true, audit: true, cache: true,
  }),
  capabilityProviders: defineModuleCapabilityProviders({ ...providers }),
  presentations: defineModulePresentations({
    card: ["default"], list: ["default", "dense"], single: ["default"], ui: ["facts", "itinerary", "pricing"],
  }),
  searchDefinition: tripsSearchDefinition,
};

assertModuleCapabilityProviders(tripsModule);
