import {
  pgTable,
  text,
  varchar,
  timestamp,
  integer,
  jsonb,
  index,
} from "drizzle-orm/pg-core";

export const OUTBOX_STATUSES = ["pending", "processing", "done", "dead_letter"] as const;
export type OutboxStatus = (typeof OUTBOX_STATUSES)[number];

// ─── Outbox events (TODO §14.4 — communication inter-modules) ──────────────
export const outboxEvents = pgTable(
  "outbox_events",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    eventType: varchar("event_type", { length: 120 }).notNull(),
    aggregateType: varchar("aggregate_type", { length: 80 }).notNull(),
    aggregateId: text("aggregate_id").notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().default({}).notNull(),
    status: text("status", { enum: OUTBOX_STATUSES }).default("pending").notNull(),
    attempts: integer("attempts").default(0).notNull(),
    availableAt: timestamp("available_at").defaultNow().notNull(),
    processedAt: timestamp("processed_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("outbox_status_available_idx").on(table.status, table.availableAt),
    index("outbox_aggregate_idx").on(table.aggregateType, table.aggregateId),
  ],
);
