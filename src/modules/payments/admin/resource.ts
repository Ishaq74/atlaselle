import { assertAdminResourceListDefinition } from "@/core/admin/filter-contract";
import { assertResourceCompatibility, type AdminResourceDefinition } from "@/lib/cms/resource-contract";
import { paymentsModule } from "@/modules/payments/module";

const paymentListDefinition = {
  filters: [
    { id: "status", kind: "select", queryParam: "status" },
    { id: "type", kind: "select", queryParam: "type" },
  ],
  sorts: [
    { id: "createdAt", queryParam: "sortBy", directions: ["asc", "desc"] },
  ],
  defaultSort: "createdAt",
} as const;

assertAdminResourceListDefinition(paymentListDefinition);

export const paymentAdminResource: AdminResourceDefinition = {
  id: "payment",
  entity: "payment",
  management: { list: true, search: false, filters: true, sort: true, pagination: true, stats: true },
  list: paymentListDefinition,
  actions: {
    create: false, read: true, update: false, duplicate: false,
    publish: false, unpublish: false, archive: false, restore: false, delete: false, bulk: false,
  },
  presentation: { list: ["default"], single: ["default"] },
  permissionNamespace: "payment",
};

assertResourceCompatibility(paymentsModule, paymentAdminResource);
