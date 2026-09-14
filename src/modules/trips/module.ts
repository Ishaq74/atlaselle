import type { AtlaselleModuleDefinition } from "@/core/modules/module-contract";
import {
  assertModuleCapabilityProviders,
  defineModuleCapabilities,
  defineModuleCapabilityProviders,
  defineModulePresentations,
} from "@/core/modules/module-contract";

const providers = {
  content: "trips",
  localization: "trip_translations",
  media: "media_files",
  seo: "trip_translations",
  taxonomy: "—",
  attributes: "—",
  search: "—",
  publication: "trip actions",
  revisions: "trip_revisions",
  locks: "core/locks",
  engagement: "—",
  moderation: "—",
  notifications: "outbox",
  audit: "audit_log",
  cache: "database/cache",
} as const;

export const tripsModule: AtlaselleModuleDefinition = {
  id: "trips",
  entity: "trip",
  capabilities: defineModuleCapabilities({
    content: true, localization: true, media: true, seo: true, taxonomy: false,
    attributes: false, search: false, publication: true, revisions: true, locks: true,
    engagement: false, moderation: false, notifications: true, audit: true, cache: true,
  }),
  capabilityProviders: defineModuleCapabilityProviders({ ...providers }),
  presentations: defineModulePresentations({
    card: ["default"], list: ["default", "dense"], single: ["default"], ui: ["facts", "itinerary", "pricing"],
  }),
};

assertModuleCapabilityProviders(tripsModule);
