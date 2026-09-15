import type { AtlaselleModuleDefinition } from "@/core/modules/module-contract";
import {
  assertModuleCapabilityProviders,
  defineModuleCapabilities,
  defineModuleCapabilityProviders,
  defineModulePresentations,
} from "@/core/modules/module-contract";

export const policiesModule: AtlaselleModuleDefinition = {
  id: "policies",
  entity: "policy_document",
  capabilities: defineModuleCapabilities({
    content: true, localization: true, media: false, seo: false, taxonomy: false,
    attributes: false, search: false, publication: true, revisions: true, locks: false,
    engagement: false, moderation: false, notifications: false, audit: true, cache: false,
  }),
  capabilityProviders: defineModuleCapabilityProviders({
    content: "policies",
    localization: "policy_documents",
    media: "—",
    seo: "—",
    taxonomy: "—",
    attributes: "—",
    search: "—",
    publication: "policy actions",
    revisions: "policy_versions",
    locks: "—",
    engagement: "—",
    moderation: "—",
    notifications: "—",
    audit: "audit_log",
    cache: "—",
  }),
  presentations: defineModulePresentations({
    card: ["default"], list: ["default", "dense"], single: ["default"], ui: ["default"],
  }),
};

assertModuleCapabilityProviders(policiesModule);