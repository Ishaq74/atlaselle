/**
 * CMS RBAC permissions — single source of truth for access control.
 *
 * Single-tenant: global access control only (admin plugin)
 * — user/session management + CMS resources.
 */
import { createAccessControl } from "better-auth/plugins/access";
import { defaultStatements as adminDefaultStatements, adminAc } from "better-auth/plugins/admin/access";

export const statement = {
  ...adminDefaultStatements,
  page: ["create", "read", "update", "delete", "publish"],
  section: ["create", "read", "update", "delete"],
  media: ["upload", "read", "delete"],
  site: ["read", "update"],
  navigation: ["read", "update"],
  audit: ["read", "export"],
  theme: ["read", "update"],
  blog: ["create", "read", "update", "delete", "publish", "moderate"],
  blogCategory: ["create", "read", "update", "delete"],
  blogTag: ["create", "read", "update", "delete"],
  blogComment: ["read", "update", "delete", "moderate"],
  blogReview: ["read", "update", "delete", "moderate"],
  service: ["create", "read", "update", "delete", "publish", "moderate"],
  serviceCategory: ["create", "read", "update", "delete"],
  serviceTag: ["create", "read", "update", "delete"],
  serviceComment: ["read", "update", "delete", "moderate"],
  serviceReview: ["read", "update", "delete", "moderate"],
  trip: ["create", "read", "update", "publish", "archive"],
  tripComment: ["read", "update", "delete", "moderate"],
  tripReview: ["read", "update", "delete", "moderate"],
  departure: ["create", "read", "update", "close"],
  application: ["read", "review", "approve", "decline"],
  reservation: ["read", "cancel"],
  payment: ["read", "refund"],
  traveler: ["read", "export", "anonymize"],
  policy: ["create", "read", "update", "publish"],
  email: ["read", "retry"],
} as const;

export const ac = createAccessControl(statement);

const cmsAdminServices = {
  service: ["create", "read", "update", "delete", "publish", "moderate"],
  serviceCategory: ["create", "read", "update", "delete"],
  serviceTag: ["create", "read", "update", "delete"],
  serviceComment: ["read", "update", "delete", "moderate"],
  serviceReview: ["read", "update", "delete", "moderate"],
} as const;

const cmsEditorServices = {
  service: ["create", "read", "update", "delete", "publish"],
  serviceCategory: ["create", "read", "update", "delete"],
  serviceTag: ["create", "read", "update", "delete"],
  serviceComment: ["read", "update", "moderate"],
  serviceReview: ["read", "update", "moderate"],
} as const;

const cmsReadOnlyServices = {
  service: ["read"],
  serviceCategory: ["read"],
  serviceTag: ["read"],
  serviceComment: ["read"],
  serviceReview: ["read"],
} as const;

export const adminRole = ac.newRole({
  ...adminAc.statements,
  page: ["create", "read", "update", "delete", "publish"],
  section: ["create", "read", "update", "delete"],
  media: ["upload", "read", "delete"],
  site: ["read", "update"],
  navigation: ["read", "update"],
  audit: ["read", "export"],
  theme: ["read", "update"],
  blog: ["create", "read", "update", "delete", "publish", "moderate"],
  blogCategory: ["create", "read", "update", "delete"],
  blogTag: ["create", "read", "update", "delete"],
  blogComment: ["read", "update", "delete", "moderate"],
  blogReview: ["read", "update", "delete", "moderate"],
  trip: ["create", "read", "update", "publish", "archive"],
  tripComment: ["read", "update", "delete", "moderate"],
  tripReview: ["read", "update", "delete", "moderate"],
  departure: ["create", "read", "update", "close"],
  application: ["read", "review", "approve", "decline"],
  reservation: ["read", "cancel"],
  payment: ["read", "refund"],
  traveler: ["read", "export", "anonymize"],
  policy: ["create", "read", "update", "publish"],
  email: ["read", "retry"],
  ...cmsAdminServices,
});

export const editorRole = ac.newRole({
  user: [], session: [],
  page: ["create", "read", "update", "delete", "publish"],
  section: ["create", "read", "update", "delete"],
  media: ["upload", "read", "delete"],
  site: ["read"], navigation: ["read"], audit: ["read"], theme: ["read"],
  blog: ["create", "read", "update", "delete", "publish"],
  blogCategory: ["create", "read", "update", "delete"],
  blogTag: ["create", "read", "update", "delete"],
  blogComment: ["read", "update", "moderate"],
  blogReview: ["read", "update", "moderate"],
  trip: ["create", "read", "update"],
  tripComment: ["read", "update", "moderate"],
  tripReview: ["read", "update", "moderate"],
  departure: ["create", "read", "update"],
  application: ["read"],
  reservation: ["read"],
  payment: ["read"],
  traveler: ["read"],
  policy: ["read"],
  email: ["read"],
  ...cmsEditorServices,
});

export const userRole = ac.newRole({
  user: [], session: [],
  page: ["read"], section: ["read"], media: ["read"], site: ["read"], navigation: ["read"], theme: ["read"],
  blog: ["read"], blogCategory: ["read"], blogTag: ["read"], blogComment: ["read"], blogReview: ["read"],
  trip: ["read"], tripComment: ["read"], tripReview: ["read"],
  ...cmsReadOnlyServices,
});
