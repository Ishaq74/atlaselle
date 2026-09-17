import { relations, sql } from "drizzle-orm";
import {
  pgTable,
  text,
  varchar,
  timestamp,
  boolean,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { travelers } from "./travelers.schema";
import { trips } from "./trips.schema";
import { departures } from "./departures.schema";

export const APPLICATION_STATUSES = [
  "draft",
  "submitted",
  "under_review",
  "contact_required",
  "approved",
  "declined",
  "withdrawn",
  "expired",
] as const;
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

export const APPLICATION_EVENTS = [
  "created",
  "submitted",
  "viewed",
  "review_started",
  "contact_requested",
  "approved",
  "declined",
  "withdrawn",
  "expired",
] as const;
export type ApplicationEvent = (typeof APPLICATION_EVENTS)[number];

// ─── Applications (TODO §11.3 — jamais d'écrasement de statut) ─────────────
export const applications = pgTable(
  "applications",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    travelerId: text("traveler_id").notNull().references(() => travelers.id, { onDelete: "restrict" }),
    tripId: text("trip_id").notNull().references(() => trips.id, { onDelete: "restrict" }),
    departureId: text("departure_id").notNull().references(() => departures.id, { onDelete: "restrict" }),
    status: text("status", { enum: APPLICATION_STATUSES }).default("draft").notNull(),
    roomPreference: varchar("room_preference", { length: 32 }),
    dietaryRequirements: text("dietary_requirements"),
    accessibilityNeeds: text("accessibility_needs"),
    activityAcknowledgement: boolean("activity_acknowledgement").default(false).notNull(),
    motivation: text("motivation"),
    expectations: text("expectations"),
    consent: boolean("consent").default(false).notNull(),
    submittedAt: timestamp("submitted_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()).notNull(),
  },
  (table) => [
    index("applications_traveler_idx").on(table.travelerId),
    index("applications_trip_idx").on(table.tripId),
    index("applications_departure_idx").on(table.departureId),
    index("applications_status_idx").on(table.status),
    // Un seul dossier ACTIF par voyageuse et par départ (les statuts terminaux
    // declined/withdrawn/expired autorisent une nouvelle candidature).
    uniqueIndex("applications_traveler_departure_active_uidx")
      .on(table.travelerId, table.departureId)
      .where(sql`${table.status} in ('draft', 'submitted', 'under_review', 'contact_required', 'approved')`),
  ],
);

export const applicationDecisions = pgTable(
  "application_decisions",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    applicationId: text("application_id").notNull().references(() => applications.id, { onDelete: "cascade" }),
    decision: text("decision", { enum: ["approved", "declined", "contact_required"] }).notNull(),
    adminUserId: text("admin_user_id"),
    internalNote: text("internal_note"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("application_decisions_app_idx").on(table.applicationId)],
);

export const applicationEvents = pgTable(
  "application_events",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    applicationId: text("application_id").notNull().references(() => applications.id, { onDelete: "cascade" }),
    event: text("event", { enum: APPLICATION_EVENTS }).notNull(),
    actorId: text("actor_id"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("application_events_app_idx").on(table.applicationId)],
);

export const applicationInternalNotes = pgTable(
  "application_internal_notes",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    applicationId: text("application_id").notNull().references(() => applications.id, { onDelete: "cascade" }),
    adminUserId: text("admin_user_id"),
    note: text("note").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("application_notes_app_idx").on(table.applicationId)],
);

export const applicationsRelations = relations(applications, ({ many, one }) => ({
  decisions: many(applicationDecisions),
  events: many(applicationEvents),
  traveler: one(travelers, { fields: [applications.travelerId], references: [travelers.id] }),
  trip: one(trips, { fields: [applications.tripId], references: [trips.id] }),
  departure: one(departures, { fields: [applications.departureId], references: [departures.id] }),
}));
