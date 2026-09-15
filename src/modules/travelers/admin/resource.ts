import { assertAdminResourceListDefinition } from "@/core/admin/filter-contract";
import { assertResourceCompatibility, type AdminResourceDefinition } from "@/lib/cms/resource-contract";
import { travelersModule } from "@/modules/travelers/module";

const travelerListDefinition = {
  filters: [
    { id: "search", kind: "search", queryParam: "search" },
  ],
  sorts: [
    { id: "createdAt", queryParam: "sortBy", directions: ["asc", "desc"] },
  ],
  defaultSort: "createdAt",
} as const;

assertAdminResourceListDefinition(travelerListDefinition);

export const travelerAdminResource: AdminResourceDefinition = {
  id: "traveler",
  entity: "traveler",
  management: { list: true, search: true, filters: true, sort: true, pagination: true, stats: false },
  list: travelerListDefinition,
  actions: {
    create: false, read: true, update: false, duplicate: false,
    publish: false, unpublish: false, archive: false, restore: false, delete: false, bulk: false,
  },
  presentation: { list: ["default"], single: ["default"] },
  permissionNamespace: "traveler",
};

assertResourceCompatibility(travelersModule, travelerAdminResource);
