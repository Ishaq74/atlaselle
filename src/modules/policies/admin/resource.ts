import { assertAdminResourceListDefinition } from "@/core/admin/filter-contract";
import { assertResourceCompatibility, type AdminResourceDefinition } from "@/lib/cms/resource-contract";
import { policiesModule } from "@/modules/policies/module";

const policyListDefinition = {
  filters: [
    { id: "type", kind: "select", queryParam: "type" },
  ],
  sorts: [
    { id: "createdAt", queryParam: "sortBy", directions: ["asc", "desc"] },
  ],
  defaultSort: "createdAt",
} as const;

assertAdminResourceListDefinition(policyListDefinition);

export const policyAdminResource: AdminResourceDefinition = {
  id: "policy_document",
  entity: "policy_document",
  management: { list: true, search: false, filters: true, sort: true, pagination: true, stats: false },
  list: policyListDefinition,
  actions: {
    create: true, read: true, update: true, duplicate: false,
    publish: true, unpublish: false, archive: false, restore: false, delete: false, bulk: false,
  },
  presentation: { list: ["default"], single: ["default"] },
  permissionNamespace: "policy",
};

assertResourceCompatibility(policiesModule, policyAdminResource);
