import { relations, sql } from "drizzle-orm";
import {
  pgTable,
  text,
  timestamp,
  integer,
  uniqueIndex,
  index,
  check,
} from "drizzle-orm/pg-core";
import { trips } from "./trips.schema";
import { LOCALES } from "@i18n/config";

const localeEnum = text("locale", { enum: LOCALES }).notNull();

// ─── Itinerary days (faits, TODO §8.5 — ordre piloté par dayNumber) ─────────
export const itineraryDays = pgTable(
  "itinerary_days",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    tripId: text("trip_id").notNull().references(() => trips.id, { onDelete: "cascade" }),
    dayNumber: integer("day_number").notNull(),
    location: text("location"),
    route: text("route"),
    activityLevel: integer("activity_level"),
    distanceKm: integer("distance_km"),
    activityDurationMin: integer("activity_duration_min"),
    minAltitudeM: integer("min_altitude_m"),
    maxAltitudeM: integer("max_altitude_m"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()).notNull(),
  },
  (table) => [
    uniqueIndex("itinerary_days_trip_day_uidx").on(table.tripId, table.dayNumber),
    index("itinerary_days_trip_idx").on(table.tripId),
    check("itinerary_days_day_ck", sql`${table.dayNumber} > 0`),
    check("itinerary_days_activity_ck", sql`${table.activityLevel} IS NULL OR (${table.activityLevel} BETWEEN 1 AND 5)`),
    check("itinerary_days_distance_ck", sql`${table.distanceKm} IS NULL OR ${table.distanceKm} >= 0`),
    check("itinerary_days_duration_ck", sql`${table.activityDurationMin} IS NULL OR ${table.activityDurationMin} >= 0`),
  ],
);

export const itineraryDayTranslations = pgTable(
  "itinerary_day_translations",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    dayId: text("day_id").notNull().references(() => itineraryDays.id, { onDelete: "cascade" }),
    locale: localeEnum,
    title: text("title").notNull(),
    morning: text("morning"),
    afternoon: text("afternoon"),
    evening: text("evening"),
    meals: text("meals"),
    accommodation: text("accommodation"),
    transfer: text("transfer"),
    notes: text("notes"),
    updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()).notNull(),
  },
  (table) => [
    uniqueIndex("itinerary_day_tr_day_locale_uidx").on(table.dayId, table.locale),
    index("itinerary_day_tr_day_idx").on(table.dayId),
  ],
);

export const itineraryDaysRelations = relations(itineraryDays, ({ many, one }) => ({
  translations: many(itineraryDayTranslations),
  trip: one(trips, { fields: [itineraryDays.tripId], references: [trips.id] }),
}));
