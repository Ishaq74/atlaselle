import { relations, sql } from "drizzle-orm";
import {
  pgTable,
  text,
  varchar,
  timestamp,
  integer,
  jsonb,
  uniqueIndex,
  index,
  check,
} from "drizzle-orm/pg-core";
import { travelers } from "./travelers.schema";
import { trips } from "./trips.schema";
import { departures } from "./departures.schema";
import { applications } from "./applications.schema";

export const RESERVATION_STATUSES = [
  "pending",
  "awaiting_payment",
  "confirmed",
  "balance_due",
  "completed",
  "cancelled",
  "refunded",
] as const;
export type ReservationStatus = (typeof RESERVATION_STATUSES)[number];

// ─── Reservations (prix immuable après confirmation, TODO §12) ─────────────
export const reservations = pgTable(
  "reservations",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    reservationNumber: varchar("reservation_number", { length: 32 }).notNull(),
    travelerId: text("traveler_id").notNull().references(() => travelers.id, { onDelete: "restrict" }),
    tripId: text("trip_id").notNull().references(() => trips.id, { onDelete: "restrict" }),
    departureId: text("departure_id").notNull().references(() => departures.id, { onDelete: "restrict" }),
    applicationId: text("application_id").references(() => applications.id, { onDelete: "set null" }),
    status: text("status", { enum: RESERVATION_STATUSES }).default("pending").notNull(),
    currency: varchar("currency", { length: 3 }).notNull().default("EUR"),
    baseAmount: integer("base_amount").notNull().default(0),
    singleSupplementAmount: integer("single_supplement_amount").notNull().default(0),
    discountAmount: integer("discount_amount").notNull().default(0),
    taxAmount: integer("tax_amount").notNull().default(0),
    feeAmount: integer("fee_amount").notNull().default(0),
    totalAmount: integer("total_amount").notNull().default(0),
    amountPaid: integer("amount_paid").notNull().default(0),
    amountDue: integer("amount_due").notNull().default(0),
    balanceDueDate: timestamp("balance_due_date"),
    agreementVersionId: text("agreement_version_id"),
    acceptedAt: timestamp("accepted_at"),
    confirmedAt: timestamp("confirmed_at"),
    cancelledAt: timestamp("cancelled_at"),
    completedAt: timestamp("completed_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()).notNull(),
  },
  (table) => [
    uniqueIndex("reservations_number_uidx").on(table.reservationNumber),
    index("reservations_traveler_idx").on(table.travelerId),
    index("reservations_departure_idx").on(table.departureId),
    index("reservations_status_idx").on(table.status),
    check("reservations_amounts_ck", sql`${table.totalAmount} >= 0 AND ${table.amountPaid} >= 0 AND ${table.amountDue} >= 0`),
  ],
);

export const reservationPriceSnapshots = pgTable(
  "reservation_price_snapshots",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    reservationId: text("reservation_id").notNull().references(() => reservations.id, { onDelete: "cascade" }),
    snapshot: jsonb("snapshot").$type<Record<string, unknown>>().notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("reservation_snapshots_res_idx").on(table.reservationId)],
);

export const reservationInternalNotes = pgTable(
  "reservation_internal_notes",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    reservationId: text("reservation_id").notNull().references(() => reservations.id, { onDelete: "cascade" }),
    adminUserId: text("admin_user_id"),
    note: text("note").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("reservation_notes_res_idx").on(table.reservationId)],
);

export const reservationsRelations = relations(reservations, ({ many, one }) => ({
  snapshots: many(reservationPriceSnapshots),
  traveler: one(travelers, { fields: [reservations.travelerId], references: [travelers.id] }),
  departure: one(departures, { fields: [reservations.departureId], references: [departures.id] }),
}));
