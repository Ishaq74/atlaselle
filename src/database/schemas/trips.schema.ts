import { relations, sql } from "drizzle-orm";
import {
  pgTable,
  text,
  varchar,
  timestamp,
  boolean,
  integer,
  uniqueIndex,
  index,
  check,
} from "drizzle-orm/pg-core";
import { mediaFiles } from "./media.schema";
import { LOCALES } from "@i18n/config";

const localeEnum = text("locale", { enum: LOCALES }).notNull();

export const TRIP_STATUSES = ["draft", "review", "approved", "published", "unpublished", "archived"] as const;
export type TripStatus = (typeof TRIP_STATUSES)[number];

// ─── Trips (faits — jamais de texte traduit ici, TODO §8.1) ────────────────
export const trips = pgTable(
  "trips",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    status: text("status", { enum: TRIP_STATUSES }).default("draft").notNull(),
    countryCode: varchar("country_code", { length: 2 }).notNull(),
    defaultCurrency: varchar("default_currency", { length: 3 }).notNull().default("EUR"),
    heroMediaId: text("hero_media_id").references(() => mediaFiles.id, { onDelete: "set null" }),
    durationDays: integer("duration_days").notNull(),
    durationNights: integer("duration_nights").notNull(),
    groupMin: integer("group_min").notNull(),
    groupMax: integer("group_max").notNull(),
    difficulty: varchar("difficulty", { length: 32 }).notNull().default("moderate"),
    difficultyLevel: integer("difficulty_level").notNull().default(3),
    arrivalAirport: varchar("arrival_airport", { length: 8 }),
    departureAirport: varchar("departure_airport", { length: 8 }),
    accommodationStyle: varchar("accommodation_style", { length: 64 }),
    requireAccount: boolean("require_account"),
    publishedAt: timestamp("published_at"),
    archivedAt: timestamp("archived_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()).notNull(),
  },
  (table) => [
    index("trips_status_idx").on(table.status),
    index("trips_country_idx").on(table.countryCode),
    check("trips_duration_ck", sql`${table.durationDays} > 0 AND ${table.durationNights} >= 0`),
    check("trips_group_ck", sql`${table.groupMin} > 0 AND ${table.groupMax} >= ${table.groupMin}`),
    check("trips_difficulty_ck", sql`${table.difficultyLevel} BETWEEN 1 AND 5`),
    check("trips_publish_ck", sql`NOT ${table.status} = 'published' OR ${table.publishedAt} IS NOT NULL`),
  ],
);

// ─── Trip translations (TODO §8.2 — slugs traduits, AR = ASCII EN) ─────────
export const tripTranslations = pgTable(
  "trip_translations",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    tripId: text("trip_id").notNull().references(() => trips.id, { onDelete: "cascade" }),
    locale: localeEnum,
    slug: varchar("slug", { length: 160 }).notNull(),
    title: text("title").notNull(),
    shortTitle: varchar("short_title", { length: 160 }),
    summary: text("summary").notNull(),
    overview: text("overview").notNull(),
    highlights: text("highlights"),
    experience: text("experience"),
    fitness: text("fitness"),
    preparation: text("preparation"),
    lodging: text("lodging"),
    food: text("food"),
    faithConsiderations: text("faith_considerations"),
    metaTitle: varchar("meta_title", { length: 220 }),
    metaDescription: varchar("meta_description", { length: 320 }),
    localeVisible: boolean("locale_visible").default(false).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()).notNull(),
  },
  (table) => [
    uniqueIndex("trip_translations_trip_locale_uidx").on(table.tripId, table.locale),
    uniqueIndex("trip_translations_locale_slug_uidx").on(table.locale, table.slug),
    index("trip_translations_trip_idx").on(table.tripId),
  ],
);

// ─── Highlights / inclusions / exclusions (+ traductions, TODO §8.6) ───────
export const tripHighlights = pgTable(
  "trip_highlights",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    tripId: text("trip_id").notNull().references(() => trips.id, { onDelete: "cascade" }),
    mediaId: text("media_id").references(() => mediaFiles.id, { onDelete: "set null" }),
    iconKey: varchar("icon_key", { length: 64 }),
    sortOrder: integer("sort_order").default(0).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("trip_highlights_trip_idx").on(table.tripId)],
);

export const tripHighlightTranslations = pgTable(
  "trip_highlight_translations",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    highlightId: text("highlight_id").notNull().references(() => tripHighlights.id, { onDelete: "cascade" }),
    locale: localeEnum,
    title: text("title").notNull(),
    description: text("description"),
  },
  (table) => [
    uniqueIndex("trip_highlight_tr_hl_locale_uidx").on(table.highlightId, table.locale),
    index("trip_highlight_tr_hl_idx").on(table.highlightId),
  ],
);

export const tripInclusions = pgTable(
  "trip_inclusions",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    tripId: text("trip_id").notNull().references(() => trips.id, { onDelete: "cascade" }),
    sortOrder: integer("sort_order").default(0).notNull(),
  },
  (table) => [index("trip_inclusions_trip_idx").on(table.tripId)],
);

export const tripInclusionTranslations = pgTable(
  "trip_inclusion_translations",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    inclusionId: text("inclusion_id").notNull().references(() => tripInclusions.id, { onDelete: "cascade" }),
    locale: localeEnum,
    text: text("text").notNull(),
  },
  (table) => [
    uniqueIndex("trip_inclusion_tr_inc_locale_uidx").on(table.inclusionId, table.locale),
    index("trip_inclusion_tr_inc_idx").on(table.inclusionId),
  ],
);

export const tripExclusions = pgTable(
  "trip_exclusions",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    tripId: text("trip_id").notNull().references(() => trips.id, { onDelete: "cascade" }),
    sortOrder: integer("sort_order").default(0).notNull(),
  },
  (table) => [index("trip_exclusions_trip_idx").on(table.tripId)],
);

export const tripExclusionTranslations = pgTable(
  "trip_exclusion_translations",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    exclusionId: text("exclusion_id").notNull().references(() => tripExclusions.id, { onDelete: "cascade" }),
    locale: localeEnum,
    text: text("text").notNull(),
  },
  (table) => [
    uniqueIndex("trip_exclusion_tr_exc_locale_uidx").on(table.exclusionId, table.locale),
    index("trip_exclusion_tr_exc_idx").on(table.exclusionId),
  ],
);

// ─── FAQ voyage (TODO §8.6) ────────────────────────────────────────────────
export const faqs = pgTable(
  "faqs",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    sortOrder: integer("sort_order").default(0).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()).notNull(),
  },
  () => [],
);

export const faqTranslations = pgTable(
  "faq_translations",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    faqId: text("faq_id").notNull().references(() => faqs.id, { onDelete: "cascade" }),
    locale: localeEnum,
    question: text("question").notNull(),
    answer: text("answer").notNull(),
  },
  (table) => [
    uniqueIndex("faq_tr_faq_locale_uidx").on(table.faqId, table.locale),
    index("faq_tr_faq_idx").on(table.faqId),
  ],
);

export const tripFaqs = pgTable(
  "trip_faqs",
  {
    tripId: text("trip_id").notNull().references(() => trips.id, { onDelete: "cascade" }),
    faqId: text("faq_id").notNull().references(() => faqs.id, { onDelete: "cascade" }),
    sortOrder: integer("sort_order").default(0).notNull(),
  },
  (table) => [index("trip_faqs_trip_idx").on(table.tripId)],
);

// ─── Révisions (pattern page_versions, TODO §16.5) ─────────────────────────
export const tripRevisions = pgTable(
  "trip_revisions",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    tripId: text("trip_id").notNull().references(() => trips.id, { onDelete: "cascade" }),
    snapshot: text("snapshot").notNull(),
    createdBy: text("created_by"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("trip_revisions_trip_idx").on(table.tripId)],
);

// ─── Relations ─────────────────────────────────────────────────────────────
export const tripsRelations = relations(trips, ({ many }) => ({
  translations: many(tripTranslations),
  highlights: many(tripHighlights),
  inclusions: many(tripInclusions),
  exclusions: many(tripExclusions),
  tripFaqs: many(tripFaqs),
  revisions: many(tripRevisions),
}));

export const tripTranslationsRelations = relations(tripTranslations, ({ one }) => ({
  trip: one(trips, { fields: [tripTranslations.tripId], references: [trips.id] }),
}));
