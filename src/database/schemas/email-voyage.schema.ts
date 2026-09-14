import { relations } from "drizzle-orm";
import {
  pgTable,
  text,
  varchar,
  timestamp,
  boolean,
  integer,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { LOCALES } from "@i18n/config";

const localeEnum = text("locale", { enum: LOCALES }).notNull();

export const VOYAGE_EMAIL_TEMPLATES = [
  "application_received",
  "application_approved",
  "application_contact_required",
  "application_declined",
  "checkout_started",
  "payment_received",
  "booking_confirmed",
  "balance_due",
  "balance_reminder",
  "pre_trip_preparation",
  "pre_trip_reminder",
  "post_trip_followup",
] as const;
export type VoyageEmailTemplate = (typeof VOYAGE_EMAIL_TEMPLATES)[number];

export const EMAIL_DELIVERY_STATUSES = ["queued", "sending", "sent", "failed", "retrying", "dead_letter"] as const;
export type EmailDeliveryStatus = (typeof EMAIL_DELIVERY_STATUSES)[number];

// ─── Templates email voyage (versionnés, 4 langues — TODO §14.1) ────────────
export const emailTemplates = pgTable(
  "email_templates",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    key: text("key", { enum: VOYAGE_EMAIL_TEMPLATES }).notNull(),
    locale: localeEnum,
    version: integer("version").notNull().default(1),
    subject: text("subject").notNull(),
    html: text("html").notNull(),
    textBody: text("text_body").notNull(),
    active: boolean("active").default(true).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()).notNull(),
  },
  (table) => [
    uniqueIndex("email_templates_key_locale_version_uidx").on(table.key, table.locale, table.version),
    index("email_templates_key_locale_idx").on(table.key, table.locale),
  ],
);

export const emailDeliveries = pgTable(
  "email_deliveries",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    templateKey: text("template_key").notNull(),
    templateVersion: integer("template_version"),
    locale: localeEnum,
    toEmail: varchar("to_email", { length: 320 }).notNull(),
    travelerId: text("traveler_id"),
    reservationId: text("reservation_id"),
    status: text("status", { enum: EMAIL_DELIVERY_STATUSES }).default("queued").notNull(),
    attempts: integer("attempts").default(0).notNull(),
    lastError: text("last_error"),
    scheduledAt: timestamp("scheduled_at").defaultNow().notNull(),
    sentAt: timestamp("sent_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()).notNull(),
  },
  (table) => [
    index("email_deliveries_status_idx").on(table.status, table.scheduledAt),
    index("email_deliveries_traveler_idx").on(table.travelerId),
    index("email_deliveries_reservation_idx").on(table.reservationId),
  ],
);

export const emailEvents = pgTable(
  "email_events",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    deliveryId: text("delivery_id").notNull().references(() => emailDeliveries.id, { onDelete: "cascade" }),
    event: varchar("event", { length: 40 }).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("email_events_delivery_idx").on(table.deliveryId)],
);

export const emailDeliveriesRelations = relations(emailDeliveries, ({ many }) => ({
  events: many(emailEvents),
}));
