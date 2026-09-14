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
import { reservations } from "./reservations.schema";
import { applications } from "./applications.schema";
import { departures } from "./departures.schema";

export const PAYMENT_TYPES = ["deposit", "balance", "full_payment", "refund"] as const;
export type PaymentType = (typeof PAYMENT_TYPES)[number];

export const PAYMENT_STATUSES = [
  "created",
  "pending",
  "authorized",
  "paid",
  "failed",
  "cancelled",
  "refunded",
  "partially_refunded",
] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

// ─── Payments (module générique, TODO §13 — ne connaît que reservationId) ──
export const payments = pgTable(
  "payments",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    reservationId: text("reservation_id").notNull().references(() => reservations.id, { onDelete: "restrict" }),
    provider: varchar("provider", { length: 32 }).notNull().default("stripe"),
    providerPaymentId: varchar("provider_payment_id", { length: 160 }),
    type: text("type", { enum: PAYMENT_TYPES }).notNull(),
    status: text("status", { enum: PAYMENT_STATUSES }).default("created").notNull(),
    amount: integer("amount").notNull(),
    currency: varchar("currency", { length: 3 }).notNull().default("EUR"),
    idempotencyKey: varchar("idempotency_key", { length: 160 }).notNull(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    paidAt: timestamp("paid_at"),
    failedAt: timestamp("failed_at"),
  },
  (table) => [
    uniqueIndex("payments_idempotency_uidx").on(table.idempotencyKey),
    index("payments_reservation_idx").on(table.reservationId),
    index("payments_status_idx").on(table.status),
    index("payments_provider_idx").on(table.providerPaymentId),
    check("payments_amount_ck", sql`${table.amount} >= 0`),
  ],
);

export const CHECKOUT_SESSION_STATUSES = ["open", "completed", "expired", "cancelled"] as const;
export type CheckoutSessionStatus = (typeof CHECKOUT_SESSION_STATUSES)[number];

// ─── Checkout sessions (TODO §13.5) ────────────────────────────────────────
export const checkoutSessions = pgTable(
  "checkout_sessions",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    applicationId: text("application_id").notNull().references(() => applications.id, { onDelete: "cascade" }),
    departureId: text("departure_id").notNull().references(() => departures.id, { onDelete: "restrict" }),
    reservationId: text("reservation_id").references(() => reservations.id, { onDelete: "set null" }),
    providerSessionId: varchar("provider_session_id", { length: 160 }),
    status: text("status", { enum: CHECKOUT_SESSION_STATUSES }).default("open").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()).notNull(),
  },
  (table) => [
    index("checkout_sessions_app_idx").on(table.applicationId),
    index("checkout_sessions_status_idx").on(table.status),
    index("checkout_sessions_expires_idx").on(table.expiresAt),
  ],
);

export const paymentsRelations = relations(payments, ({ one }) => ({
  reservation: one(reservations, { fields: [payments.reservationId], references: [reservations.id] }),
}));
