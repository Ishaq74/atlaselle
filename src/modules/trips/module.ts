import type { AtlaselleModuleDefinition } from "@/core/modules/module-contract";
import {
  assertModuleCapabilityProviders,
  defineModuleCapabilities,
  defineModuleCapabilityProviders,
  defineModulePresentations,
} from "@/core/modules/module-contract";
import { tripsCapabilityProviders } from "./capabilities";
import { tripsSearchDefinition } from "./search";

export const tripsModule: AtlaselleModuleDefinition = {
  id: "trips",
  entity: "trip",
  capabilities: defineModuleCapabilities({
    content: true,
    localization: true,
    media: true,
    seo: true,
    taxonomy: false,
    attributes: false,
    search: true,
    publication: true,
    revisions: true,
    locks: true,
    engagement: true,
    moderation: true,
    notifications: true,
    audit: true,
    cache: true,
  }),
  capabilityProviders: defineModuleCapabilityProviders({ ...tripsCapabilityProviders }),
  presentations: defineModulePresentations({
    card: ["default"],
    list: ["default", "dense"],
    single: ["default"],
    ui: ["facts", "itinerary", "pricing"],
  }),
  searchDefinition: tripsSearchDefinition,
};

assertModuleCapabilityProviders(tripsModule);
