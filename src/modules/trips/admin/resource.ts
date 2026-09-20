import { assertAdminResourceListDefinition } from "@/core/admin/filter-contract";
import { assertResourceCompatibility, type AdminResourceDefinition } from "@/lib/cms/resource-contract";
import { tripsModule } from "@/modules/trips/module";
import { departuresModule } from "@/modules/departures/module";

const tripListDefinition = {
  filters: [
    { id: "search", kind: "search", queryParam: "search" },
    { id: "status", kind: "select", queryParam: "status" },
    { id: "country", kind: "select", queryParam: "countryCode" },
  ],
  sorts: [
    { id: "createdAt", queryParam: "sortBy", directions: ["asc", "desc"] },
    { id: "updatedAt", queryParam: "sortBy", directions: ["asc", "desc"] },
  ],
  defaultSort: "updatedAt",
} as const;

assertAdminResourceListDefinition(tripListDefinition);

export const tripAdminResource: AdminResourceDefinition = {
  id: "trip",
  entity: "trip",
  management: { list: true, search: true, filters: true, sort: true, pagination: true, stats: true },
  list: tripListDefinition,
  actions: {
    create: true, read: true, update: true, duplicate: false,
    publish: true, unpublish: true, archive: true, restore: true, delete: false, bulk: false,
  },
  presentation: { card: ["default"], list: ["default", "dense"], single: ["default"] },
  permissionNamespace: "trip",
};

assertResourceCompatibility(tripsModule, tripAdminResource);

export const tripModerationAdminResource: AdminResourceDefinition = {
  id: "trip-moderation",
  entity: "trip-moderation",
  management: { list: true, search: false, filters: true, sort: true, pagination: true, stats: true },
  list: {
    filters: [
      { id: "tab", kind: "select", queryParam: "tab" },
      { id: "status", kind: "select", queryParam: "status" },
      { id: "trip", kind: "select", queryParam: "tripId" },
    ],
    sorts: [{ id: "createdAt", queryParam: "sortBy", directions: ["asc", "desc"] }],
    defaultSort: "createdAt",
  } as const,
  actions: {
    create: false, read: true, update: true, duplicate: false,
    publish: false, unpublish: false, archive: false, restore: true, delete: false, bulk: false,
  },
  presentation: { list: ["default"], single: ["default"] },
  permissionNamespace: "trip",
};

const departureListDefinition = {
  filters: [
    { id: "status", kind: "select", queryParam: "status" },
    { id: "trip", kind: "select", queryParam: "tripId" },
  ],
  sorts: [
    { id: "startDate", queryParam: "sortBy", directions: ["asc", "desc"] },
    { id: "updatedAt", queryParam: "sortBy", directions: ["asc", "desc"] },
  ],
  defaultSort: "startDate",
} as const;

assertAdminResourceListDefinition(departureListDefinition);

export const departureAdminResource: AdminResourceDefinition = {
  id: "departure",
  entity: "departure",
  management: { list: true, search: false, filters: true, sort: true, pagination: true, stats: false },
  list: departureListDefinition,
  actions: {
    create: true, read: true, update: true, duplicate: false,
    publish: false, unpublish: false, archive: false, restore: false, delete: false, bulk: false,
  },
  presentation: { list: ["default"], single: ["default"] },
  permissionNamespace: "departure",
};

assertResourceCompatibility(departuresModule, departureAdminResource);
