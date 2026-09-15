import type { AtlaselleModuleDefinition } from "@/core/modules/module-contract";
import {
  assertModuleCapabilityProviders,
  defineModuleCapabilities,
  defineModuleCapabilityProviders,
  defineModulePresentations,
} from "@/core/modules/module-contract";

export const paymentsModule: AtlaselleModuleDefinition = {
  id: "payments",
  entity: "payment",
  capabilities: defineModuleCapabilities({
    content: true, localization: false, media: false, seo: false, taxonomy: false,
    attributes: false, search: false, publication: false, revisions: false, locks: false,
    engagement: false, moderation: true, notifications: true, audit: true, cache: false,
  }),
  capabilityProviders: defineModuleCapabilityProviders({
    content: "payments",
    localization: "—",
    media: "—",
    seo: "—",
    taxonomy: "—",
    attributes: "—",
    search: "—",
    publication: "—",
    revisions: "—",
    locks: "—",
    engagement: "—",
    moderation: "payments actions",
    notifications: "outbox",
    audit: "audit_log",
    cache: "—",
  }),
  presentations: defineModulePresentations({
    card: ["default"], list: ["default", "dense"], single: ["default"], ui: ["default"],
  }),
};

assertModuleCapabilityProviders(paymentsModule);