import { relations, sql } from "drizzle-orm";
import { pgTable, text, timestamp, uniqueIndex, index, check } from "drizzle-orm/pg-core";
import { applications } from "./applications.schema";
import { departures } from "./departures.schema";

export const WAITLIST_STATUSES = ["waiting", "offered", "promoted", "expired", "removed"] as const;
export type WaitlistStatus = (typeof WAITLIST_STATUSES)[number];

export const WAITLIST_OFFER_TTL_MINUTES = 30;

export const waitlistEntries = pgTable(
  "waitlist_entries",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    applicationId: text("application_id").notNull().references(() => applications.id, { onDelete: "cascade" }),
    departureId: text("departure_id").notNull().references(() => departures.id, { onDelete: "cascade" }),
    status: text("status", { enum: WAITLIST_STATUSES }).default("waiting").notNull(),
    joinedAt: timestamp("joined_at").defaultNow().notNull(),
    offeredAt: timestamp("offered_at"),
    expiresAt: timestamp("expires_at"),
    promotedAt: timestamp("promoted_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()).notNull(),
  },
  (table) => [
    check("waitlist_entries_status_ck", sql`${table.status} in ('waiting', 'offered', 'promoted', 'expired', 'removed')`),
    uniqueIndex("waitlist_application_uidx").on(table.applicationId),
    uniqueIndex("waitlist_one_offer_per_departure_uidx")
      .on(table.departureId)
      .where(sql`${table.status} = 'offered'`),
    index("waitlist_fifo_idx").on(table.departureId, table.status, table.joinedAt, table.id),
    index("waitlist_offer_expiry_idx").on(table.status, table.expiresAt),
  ],
);

export const waitlistEntriesRelations = relations(waitlistEntries, ({ one }) => ({
  application: one(applications, { fields: [waitlistEntries.applicationId], references: [applications.id] }),
  departure: one(departures, { fields: [waitlistEntries.departureId], references: [departures.id] }),
}));
