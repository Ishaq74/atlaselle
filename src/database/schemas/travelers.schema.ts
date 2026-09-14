import { sql } from "drizzle-orm";
import {
  pgTable,
  text,
  varchar,
  timestamp,
  date,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { user } from "./auth.schema";
import { LOCALES } from "@i18n/config";

const localeEnum = text("locale", { enum: LOCALES });

// ─── Travelers (découplé de user, TODO §11.1) ──────────────────────────────
// userId NULLABLE, jamais de FK dure bloquante. Unicité insensible à la casse
// via index lower(email) + normalisation à l'écriture (trim/lowercase).
export const travelers = pgTable(
  "travelers",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
    email: varchar("email", { length: 320 }).notNull(),
    phone: varchar("phone", { length: 40 }),
    legalName: varchar("legal_name", { length: 200 }),
    preferredName: varchar("preferred_name", { length: 200 }),
    dateOfBirth: date("date_of_birth"),
    locale: localeEnum,
    timezone: varchar("timezone", { length: 64 }),
    emailVerifiedAt: timestamp("email_verified_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()).notNull(),
  },
  (table) => [
    uniqueIndex("travelers_email_lower_uidx").on(sql`lower(${table.email})`),
    index("travelers_user_idx").on(table.userId),
  ],
);

export const travelerInternalNotes = pgTable(
  "traveler_internal_notes",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    travelerId: text("traveler_id").notNull().references(() => travelers.id, { onDelete: "cascade" }),
    adminUserId: text("admin_user_id"),
    note: text("note").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("traveler_notes_traveler_idx").on(table.travelerId)],
);
