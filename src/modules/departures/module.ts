import type { AtlaselleModuleDefinition } from "@/core/modules/module-contract";
import {
  assertModuleCapabilityProviders,
  defineModuleCapabilities,
  defineModuleCapabilityProviders,
  defineModulePresentations,
} from "@/core/modules/module-contract";

export const departuresModule: AtlaselleModuleDefinition = {
  id: "departures",
  entity: "departure",
  capabilities: defineModuleCapabilities({
    content: true, localization: false, media: false, seo: false, taxonomy: false,
    attributes: false, search: false, publication: true, revisions: false, locks: true,
    engagement: false, moderation: false, notifications: true, audit: true, cache: true,
  }),
  capabilityProviders: defineModuleCapabilityProviders({
    content: "departures",
    localization: "—",
    media: "—",
    seo: "—",
    taxonomy: "—",
    attributes: "—",
    search: "—",
    publication: "departure actions",
    revisions: "—",
    locks: "core/locks",
    engagement: "—",
    moderation: "—",
    notifications: "outbox",
    audit: "audit_log",
    cache: "database/cache",
  }),
  presentations: defineModulePresentations({
    card: ["default"], list: ["default"], single: ["default"], ui: ["availability", "pricing"],
  }),
};

assertModuleCapabilityProviders(departuresModule);
