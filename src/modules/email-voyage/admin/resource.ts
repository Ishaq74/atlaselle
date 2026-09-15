import { assertAdminResourceListDefinition } from "@/core/admin/filter-contract";
import { assertResourceCompatibility, type AdminResourceDefinition } from "@/lib/cms/resource-contract";
import { emailvoyageModule } from "@/modules/email-voyage/module";

const emailListDefinition = {
  filters: [
    { id: "status", kind: "select", queryParam: "status" },
    { id: "template", kind: "select", queryParam: "templateKey" },
  ],
  sorts: [
    { id: "createdAt", queryParam: "sortBy", directions: ["asc", "desc"] },
  ],
  defaultSort: "createdAt",
} as const;

assertAdminResourceListDefinition(emailListDefinition);

export const emailAdminResource: AdminResourceDefinition = {
  id: "email_delivery",
  entity: "email_delivery",
  management: { list: true, search: false, filters: true, sort: true, pagination: true, stats: true },
  list: emailListDefinition,
  actions: {
    create: false, read: true, update: false, duplicate: false,
    publish: false, unpublish: false, archive: false, restore: false, delete: false, bulk: false,
  },
  presentation: { list: ["default"], single: ["default"] },
  permissionNamespace: "email",
};

assertResourceCompatibility(emailvoyageModule, emailAdminResource);
