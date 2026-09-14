import { relations, sql } from "drizzle-orm";
import {
  pgTable,
  text,
  varchar,
  timestamp,
  integer,
  jsonb,
  index,
  check,
} from "drizzle-orm/pg-core";
import { trips } from "./trips.schema";

export const DEPARTURE_STATUSES = [
  "draft",
  "open",
  "limited",
  "waitlist",
  "closed",
  "cancelled",
  "completed",
] as const;
export type DepartureStatus = (typeof DEPARTURE_STATUSES)[number];

export const AMOUNT_TYPES = ["fixed", "percent", "none"] as const;
export type AmountType = (typeof AMOUNT_TYPES)[number];

const amountType = (name: string) => text(name, { enum: AMOUNT_TYPES }).default("none").notNull();

// ─── Departures (prix 100 % administrables, centimes, TODO §8.4) ────────────
export const departures = pgTable(
  "departures",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    tripId: text("trip_id").notNull().references(() => trips.id, { onDelete: "cascade" }),
    startDate: timestamp("start_date").notNull(),
    endDate: timestamp("end_date").notNull(),
    status: text("status", { enum: DEPARTURE_STATUSES }).default("draft").notNull(),
    capacityMin: integer("capacity_min").notNull(),
    capacityMax: integer("capacity_max").notNull(),
    priceAmount: integer("price_amount").notNull(),
    currency: varchar("currency", { length: 3 }).notNull().default("EUR"),
    depositType: amountType("deposit_type"),
    depositAmount: integer("deposit_amount").default(0).notNull(),
    depositPercent: integer("deposit_percent").default(0).notNull(),
    singleSupplementType: amountType("single_supplement_type"),
    singleSupplementAmount: integer("single_supplement_amount").default(0).notNull(),
    taxType: amountType("tax_type"),
    taxAmount: integer("tax_amount").default(0).notNull(),
    feeType: amountType("fee_type"),
    feeAmount: integer("fee_amount").default(0).notNull(),
    discountType: amountType("discount_type"),
    discountAmount: integer("discount_amount").default(0).notNull(),
    pricingRules: jsonb("pricing_rules").$type<Record<string, unknown>>().default({}).notNull(),
    balanceDueDate: timestamp("balance_due_date"),
    bookingDeadline: timestamp("booking_deadline"),
    arrivalAirport: varchar("arrival_airport", { length: 8 }),
    departureAirport: varchar("departure_airport", { length: 8 }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()).notNull(),
  },
  (table) => [
    index("departures_trip_idx").on(table.tripId),
    index("departures_status_idx").on(table.status),
    index("departures_dates_idx").on(table.startDate),
    check("departures_dates_ck", sql`${table.endDate} > ${table.startDate}`),
    check("departures_capacity_ck", sql`${table.capacityMin} > 0 AND ${table.capacityMax} >= ${table.capacityMin}`),
    check("departures_price_ck", sql`${table.priceAmount} >= 0`),
  ],
);

// ─── Seat holds (TODO §10.3 — TTL 30 min par défaut, acté) ──────────────────
export const SEAT_HOLD_STATUSES = ["active", "expired", "released", "converted"] as const;
export type SeatHoldStatus = (typeof SEAT_HOLD_STATUSES)[number];

export const SEAT_HOLD_TTL_MINUTES = 30;

export const seatHolds = pgTable(
  "seat_holds",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    departureId: text("departure_id").notNull().references(() => departures.id, { onDelete: "cascade" }),
    applicationId: text("application_id"),
    quantity: integer("quantity").notNull().default(1),
    status: text("status", { enum: SEAT_HOLD_STATUSES }).default("active").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    releasedAt: timestamp("released_at"),
  },
  (table) => [
    index("seat_holds_departure_idx").on(table.departureId),
    index("seat_holds_status_idx").on(table.status),
    index("seat_holds_expires_idx").on(table.expiresAt),
    check("seat_holds_qty_ck", sql`${table.quantity} > 0`),
  ],
);

export const departuresRelations = relations(departures, ({ many, one }) => ({
  holds: many(seatHolds),
  trip: one(trips, { fields: [departures.tripId], references: [trips.id] }),
}));
