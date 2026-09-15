import { assertAdminResourceListDefinition } from "@/core/admin/filter-contract";
import { assertResourceCompatibility, type AdminResourceDefinition } from "@/lib/cms/resource-contract";
import { applicationsModule } from "@/modules/applications/module";

const applicationListDefinition = {
  filters: [
    { id: "search", kind: "search", queryParam: "search" },
    { id: "status", kind: "select", queryParam: "status" },
    { id: "trip", kind: "select", queryParam: "tripId" },
    { id: "departure", kind: "select", queryParam: "departureId" },
  ],
  sorts: [
    { id: "createdAt", queryParam: "sortBy", directions: ["asc", "desc"] },
    { id: "submittedAt", queryParam: "sortBy", directions: ["asc", "desc"] },
  ],
  defaultSort: "createdAt",
} as const;

assertAdminResourceListDefinition(applicationListDefinition);

export const applicationAdminResource: AdminResourceDefinition = {
  id: "application",
  entity: "application",
  management: { list: true, search: true, filters: true, sort: true, pagination: true, stats: true },
  list: applicationListDefinition,
  actions: {
    create: false, read: true, update: false, duplicate: false,
    publish: false, unpublish: false, archive: false, restore: false, delete: false, bulk: false,
  },
  presentation: { list: ["default", "dense"], single: ["default"] },
  permissionNamespace: "application",
};

assertResourceCompatibility(applicationsModule, applicationAdminResource);
