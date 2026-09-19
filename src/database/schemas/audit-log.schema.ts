import { pgTable, text, timestamp, index, jsonb } from "drizzle-orm/pg-core";

export const auditLog = pgTable(
  "audit_log",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id"),
    action: text("action").notNull(),
    resource: text("resource"),
    resourceId: text("resource_id"),
    metadata: jsonb("metadata"),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("audit_log_userId_idx").on(table.userId),
    index("audit_log_action_idx").on(table.action),
    index("audit_log_createdAt_idx").on(table.createdAt),
    index("audit_log_resource_idx").on(table.resource, table.resourceId),
  ],
);
