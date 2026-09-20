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
  jsonb,
  primaryKey,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import { user } from "./auth.schema";
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
    commentStatus: text("comment_status", { enum: ["OPEN", "CLOSED", "DISABLED"] }).default("OPEN").notNull(),
    allowReviews: boolean("allow_reviews").default(true).notNull(),
    viewCount: integer("view_count").default(0).notNull(),
    ratingAverage100: integer("rating_average_100").default(0).notNull(),
    ratingCount: integer("rating_count").default(0).notNull(),
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
    check("trips_hero_ck", sql`NOT ${table.status} = 'published' OR ${table.heroMediaId} IS NOT NULL`),
    check("trips_rating_average_range", sql`${table.ratingAverage100} >= 0 AND ${table.ratingAverage100} <= 500`),
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
    updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()).notNull(),
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
    updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()).notNull(),
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
    updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()).notNull(),
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
    updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()).notNull(),
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

// ─── Engagement voyage (répliqué depuis blog + services 33→39) ─────────────
// Commentaires threadés avec statuts PENDING/APPROVED/REJECTED/SPAM/TRASH.
export const tripComments = pgTable(
  "trip_comments",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    tripId: text("trip_id").notNull().references(() => trips.id, { onDelete: "cascade" }),
    authorId: text("author_id").references(() => user.id, { onDelete: "set null" }),
    parentId: text("parent_id").references((): AnyPgColumn => tripComments.id, { onDelete: "cascade" }),
    guestName: text("guest_name"),
    guestEmail: text("guest_email"),
    content: text("content").notNull(),
    status: text("status", { enum: ["PENDING", "APPROVED", "REJECTED", "SPAM", "TRASH"] }).default("PENDING").notNull(),
    karma: integer("karma").default(0).notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    isEdited: boolean("is_edited").default(false).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()).notNull(),
  },
  (table) => [
    index("trip_comments_trip_idx").on(table.tripId),
    index("trip_comments_parent_idx").on(table.parentId),
    index("trip_comments_status_idx").on(table.status),
    index("trip_comments_author_idx").on(table.authorId),
    index("trip_comments_created_idx").on(table.createdAt),
  ],
);

export const tripCommentModerations = pgTable(
  "trip_comment_moderations",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    commentId: text("comment_id").notNull().references(() => tripComments.id, { onDelete: "cascade" }),
    moderatorId: text("moderator_id").notNull().references(() => user.id, { onDelete: "cascade" }),
    action: text("action", { enum: ["APPROVE", "REJECT", "DELETE", "RESTORE", "EDIT"] }).notNull(),
    reason: text("reason"),
    previousValues: jsonb("previous_values"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("trip_comment_moderations_comment_idx").on(table.commentId),
    index("trip_comment_moderations_moderator_idx").on(table.moderatorId),
  ],
);

// Avis avec note 1-5, statut PENDING/APPROVED/REJECTED/SPAM.
export const tripReviews = pgTable(
  "trip_reviews",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    tripId: text("trip_id").notNull().references(() => trips.id, { onDelete: "cascade" }),
    authorId: text("author_id").references(() => user.id, { onDelete: "set null" }),
    rating: integer("rating").notNull(),
    title: text("title"),
    content: text("content").notNull(),
    status: text("status", { enum: ["PENDING", "APPROVED", "REJECTED", "SPAM"] }).default("PENDING").notNull(),
    isRecommended: boolean("is_recommended").default(true).notNull(),
    helpfulCount: integer("helpful_count").default(0).notNull(),
    ipAddress: text("ip_address"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()).notNull(),
  },
  (table) => [
    index("trip_reviews_trip_idx").on(table.tripId),
    index("trip_reviews_author_idx").on(table.authorId),
    index("trip_reviews_rating_idx").on(table.rating),
    index("trip_reviews_status_idx").on(table.status),
    uniqueIndex("trip_reviews_trip_author_uidx").on(table.tripId, table.authorId),
    check("trip_reviews_rating_check", sql`${table.rating} BETWEEN 1 AND 5`),
  ],
);

export const tripReviewHelpful = pgTable(
  "trip_review_helpful",
  {
    reviewId: text("review_id").notNull().references(() => tripReviews.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
    isHelpful: boolean("is_helpful").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.reviewId, table.userId] }),
    index("trip_review_helpful_user_idx").on(table.userId),
  ],
);

// Signalements single-target (exactement une cible : voyage, commentaire ou avis).
export const tripReports = pgTable(
  "trip_reports",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    tripId: text("trip_id").references(() => trips.id, { onDelete: "cascade" }),
    commentId: text("comment_id").references(() => tripComments.id, { onDelete: "cascade" }),
    reviewId: text("review_id").references(() => tripReviews.id, { onDelete: "cascade" }),
    reporterId: text("reporter_id").references(() => user.id, { onDelete: "set null" }),
    reason: text("reason", { enum: ["SPAM", "ABUSIVE", "OFF_TOPIC", "HATE_SPEECH", "OTHER"] }).notNull(),
    description: text("description"),
    status: text("status", { enum: ["PENDING", "REVIEWED", "RESOLVED", "REJECTED"] }).default("PENDING").notNull(),
    resolvedBy: text("resolved_by").references(() => user.id, { onDelete: "set null" }),
    resolvedAt: timestamp("resolved_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("trip_reports_status_idx").on(table.status),
    index("trip_reports_reporter_idx").on(table.reporterId),
    index("trip_reports_trip_idx").on(table.tripId),
    check("trip_reports_single_target", sql`(((${table.tripId} IS NOT NULL)::int + (${table.commentId} IS NOT NULL)::int + (${table.reviewId} IS NOT NULL)::int) = 1)`),
  ],
);

export const tripFavorites = pgTable(
  "trip_favorites",
  {
    tripId: text("trip_id").notNull().references(() => trips.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [primaryKey({ columns: [table.tripId, table.userId] })],
);

export const tripReactions = pgTable(
  "trip_reactions",
  {
    tripId: text("trip_id").notNull().references(() => trips.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
    reactionType: text("reaction_type", { enum: ["LIKE", "LOVE", "FIRE", "CLAP"] }).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()).notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.tripId, table.userId] }),
    index("trip_reactions_type_idx").on(table.tripId, table.reactionType),
  ],
);

export const tripNotifications = pgTable(
  "trip_notifications",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    recipientId: text("recipient_id").notNull().references(() => user.id, { onDelete: "cascade" }),
    actorId: text("actor_id").references(() => user.id, { onDelete: "set null" }),
    tripId: text("trip_id").notNull().references(() => trips.id, { onDelete: "cascade" }),
    commentId: text("comment_id").references(() => tripComments.id, { onDelete: "cascade" }),
    reviewId: text("review_id").references(() => tripReviews.id, { onDelete: "cascade" }),
    type: text("type", { enum: ["NEW_COMMENT", "REPLY_TO_COMMENT", "NEW_REVIEW", "REVIEW_APPROVED", "REVIEW_REJECTED", "TRIP_PUBLISHED", "TRIP_MENTION"] }).notNull(),
    title: text("title").notNull(),
    message: text("message").notNull(),
    readAt: timestamp("read_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("trip_notifications_recipient_idx").on(table.recipientId, table.readAt),
    index("trip_notifications_trip_idx").on(table.tripId),
    index("trip_notifications_created_idx").on(table.createdAt),
    check("trip_notification_target_consistency", sql`CASE WHEN ${table.type} IN ('NEW_COMMENT','REPLY_TO_COMMENT') THEN ${table.commentId} IS NOT NULL AND ${table.reviewId} IS NULL WHEN ${table.type} IN ('NEW_REVIEW','REVIEW_APPROVED','REVIEW_REJECTED') THEN ${table.reviewId} IS NOT NULL AND ${table.commentId} IS NULL WHEN ${table.type} IN ('TRIP_PUBLISHED','TRIP_MENTION') THEN ${table.commentId} IS NULL AND ${table.reviewId} IS NULL ELSE FALSE END`),
  ],
);

export const tripViewStats = pgTable(
  "trip_view_stats",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    tripId: text("trip_id").notNull().references(() => trips.id, { onDelete: "cascade" }),
    viewedAt: timestamp("viewed_at").defaultNow().notNull(),
    date: text("date").notNull(),
    hour: integer("hour").notNull(),
    referrer: text("referrer"),
    country: varchar("country", { length: 2 }),
  },
  (table) => [
    index("trip_view_stats_trip_idx").on(table.tripId),
    index("trip_view_stats_date_idx").on(table.date),
    index("trip_view_stats_trip_date_idx").on(table.tripId, table.date),
    check("trip_view_stats_hour_check", sql`${table.hour} BETWEEN 0 AND 23`),
  ],
);

export const tripLocks = pgTable(
  "trip_locks",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    tripId: text("trip_id").notNull().references(() => trips.id, { onDelete: "cascade" }).unique(),
    userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
    sessionId: text("session_id").notNull(),
    lockedAt: timestamp("locked_at").defaultNow().notNull(),
    expiresAt: timestamp("expires_at").notNull(),
  },
  (table) => [
    index("trip_locks_expires_idx").on(table.expiresAt),
    check("trip_locks_expiry_after_lock", sql`${table.expiresAt} > ${table.lockedAt}`),
  ],
);

// ─── Relations ─────────────────────────────────────────────────────────────
export const tripsRelations = relations(trips, ({ many, one }) => ({
  translations: many(tripTranslations),
  highlights: many(tripHighlights),
  inclusions: many(tripInclusions),
  exclusions: many(tripExclusions),
  tripFaqs: many(tripFaqs),
  revisions: many(tripRevisions),
  comments: many(tripComments),
  reviews: many(tripReviews),
  favorites: many(tripFavorites),
  reactions: many(tripReactions),
  viewStats: many(tripViewStats),
  locks: one(tripLocks, { fields: [trips.id], references: [tripLocks.tripId] }),
}));

export const tripTranslationsRelations = relations(tripTranslations, ({ one }) => ({
  trip: one(trips, { fields: [tripTranslations.tripId], references: [trips.id] }),
}));

export const tripCommentsRelations = relations(tripComments, ({ one, many }) => ({
  trip: one(trips, { fields: [tripComments.tripId], references: [trips.id] }),
  author: one(user, { fields: [tripComments.authorId], references: [user.id] }),
  parent: one(tripComments, { fields: [tripComments.parentId], references: [tripComments.id], relationName: "tripCommentParent" }),
  replies: many(tripComments, { relationName: "tripCommentParent" }),
  moderations: many(tripCommentModerations),
}));

export const tripCommentModerationsRelations = relations(tripCommentModerations, ({ one }) => ({
  comment: one(tripComments, { fields: [tripCommentModerations.commentId], references: [tripComments.id] }),
  moderator: one(user, { fields: [tripCommentModerations.moderatorId], references: [user.id] }),
}));

export const tripReviewsRelations = relations(tripReviews, ({ one, many }) => ({
  trip: one(trips, { fields: [tripReviews.tripId], references: [trips.id] }),
  author: one(user, { fields: [tripReviews.authorId], references: [user.id] }),
  helpfulVotes: many(tripReviewHelpful),
}));

export const tripReviewHelpfulRelations = relations(tripReviewHelpful, ({ one }) => ({
  review: one(tripReviews, { fields: [tripReviewHelpful.reviewId], references: [tripReviews.id] }),
  user: one(user, { fields: [tripReviewHelpful.userId], references: [user.id] }),
}));

export const tripReportsRelations = relations(tripReports, ({ one }) => ({
  trip: one(trips, { fields: [tripReports.tripId], references: [trips.id] }),
  comment: one(tripComments, { fields: [tripReports.commentId], references: [tripComments.id] }),
  review: one(tripReviews, { fields: [tripReports.reviewId], references: [tripReviews.id] }),
  reporter: one(user, { fields: [tripReports.reporterId], references: [user.id] }),
  resolver: one(user, { fields: [tripReports.resolvedBy], references: [user.id] }),
}));

export const tripFavoritesRelations = relations(tripFavorites, ({ one }) => ({
  trip: one(trips, { fields: [tripFavorites.tripId], references: [trips.id] }),
  user: one(user, { fields: [tripFavorites.userId], references: [user.id] }),
}));

export const tripReactionsRelations = relations(tripReactions, ({ one }) => ({
  trip: one(trips, { fields: [tripReactions.tripId], references: [trips.id] }),
  user: one(user, { fields: [tripReactions.userId], references: [user.id] }),
}));

export const tripNotificationsRelations = relations(tripNotifications, ({ one }) => ({
  recipient: one(user, { fields: [tripNotifications.recipientId], references: [user.id], relationName: "tripNotificationRecipient" }),
  actor: one(user, { fields: [tripNotifications.actorId], references: [user.id], relationName: "tripNotificationActor" }),
  trip: one(trips, { fields: [tripNotifications.tripId], references: [trips.id] }),
  comment: one(tripComments, { fields: [tripNotifications.commentId], references: [tripComments.id] }),
  review: one(tripReviews, { fields: [tripNotifications.reviewId], references: [tripReviews.id] }),
}));

export const tripViewStatsRelations = relations(tripViewStats, ({ one }) => ({
  trip: one(trips, { fields: [tripViewStats.tripId], references: [trips.id] }),
}));

export const tripLocksRelations = relations(tripLocks, ({ one }) => ({
  trip: one(trips, { fields: [tripLocks.tripId], references: [trips.id] }),
  user: one(user, { fields: [tripLocks.userId], references: [user.id] }),
}));
