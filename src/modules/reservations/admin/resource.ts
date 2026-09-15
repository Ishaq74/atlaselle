import { assertAdminResourceListDefinition } from "@/core/admin/filter-contract";
import { assertResourceCompatibility, type AdminResourceDefinition } from "@/lib/cms/resource-contract";
import { reservationsModule } from "@/modules/reservations/module";

const reservationListDefinition = {
  filters: [
    { id: "search", kind: "search", queryParam: "search" },
    { id: "status", kind: "select", queryParam: "status" },
    { id: "trip", kind: "select", queryParam: "tripId" },
  ],
  sorts: [
    { id: "createdAt", queryParam: "sortBy", directions: ["asc", "desc"] },
  ],
  defaultSort: "createdAt",
} as const;

assertAdminResourceListDefinition(reservationListDefinition);

export const reservationAdminResource: AdminResourceDefinition = {
  id: "reservation",
  entity: "reservation",
  management: { list: true, search: true, filters: true, sort: true, pagination: true, stats: true },
  list: reservationListDefinition,
  actions: {
    create: false, read: true, update: false, duplicate: false,
    publish: false, unpublish: false, archive: false, restore: false, delete: false, bulk: false,
  },
  presentation: { list: ["default", "dense"], single: ["default"] },
  permissionNamespace: "reservation",
};

assertResourceCompatibility(reservationsModule, reservationAdminResource);
