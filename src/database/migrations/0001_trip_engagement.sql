-- Migration: voyage reviews/commentaires complets (gouvernance CMS).
-- UP réversible : voir section DOWN en fin de fichier (commentée).
-- Tables: trip_comments, trip_comment_moderations, trip_reviews, trip_review_helpful,
-- trip_reports, trip_favorites, trip_reactions, trip_notifications, trip_view_stats, trip_locks
-- + colonnes trips.comment_status / trips.allow_reviews / trips.view_count / trips.rating_average_100 / trips.rating_count.

ALTER TABLE "trips" ADD COLUMN IF NOT EXISTS "comment_status" text DEFAULT 'OPEN' NOT NULL;
--> statement-breakpoint
ALTER TABLE "trips" ADD COLUMN IF NOT EXISTS "allow_reviews" boolean DEFAULT true NOT NULL;
--> statement-breakpoint
ALTER TABLE "trips" ADD COLUMN IF NOT EXISTS "view_count" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "trips" ADD COLUMN IF NOT EXISTS "rating_average_100" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "trips" ADD COLUMN IF NOT EXISTS "rating_count" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "trips" ADD CONSTRAINT "trips_rating_average_range" CHECK ("trips"."rating_average_100" >= 0 AND "trips"."rating_average_100" <= 500); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "trip_comments" (
  "id" text PRIMARY KEY NOT NULL,
  "trip_id" text NOT NULL REFERENCES "trips"("id") ON DELETE cascade,
  "author_id" text REFERENCES "user"("id") ON DELETE set null,
  "parent_id" text REFERENCES "trip_comments"("id") ON DELETE cascade,
  "guest_name" text,
  "guest_email" text,
  "content" text NOT NULL,
  "status" text DEFAULT 'PENDING' NOT NULL,
  "karma" integer DEFAULT 0 NOT NULL,
  "ip_address" text,
  "user_agent" text,
  "is_edited" boolean DEFAULT false NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "trip_comments_trip_idx" ON "trip_comments" ("trip_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "trip_comments_parent_idx" ON "trip_comments" ("parent_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "trip_comments_status_idx" ON "trip_comments" ("status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "trip_comments_author_idx" ON "trip_comments" ("author_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "trip_comments_created_idx" ON "trip_comments" ("created_at");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "trip_comment_moderations" (
  "id" text PRIMARY KEY NOT NULL,
  "comment_id" text NOT NULL REFERENCES "trip_comments"("id") ON DELETE cascade,
  "moderator_id" text NOT NULL REFERENCES "user"("id") ON DELETE cascade,
  "action" text NOT NULL,
  "reason" text,
  "previous_values" jsonb,
  "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "trip_comment_moderations_comment_idx" ON "trip_comment_moderations" ("comment_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "trip_comment_moderations_moderator_idx" ON "trip_comment_moderations" ("moderator_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "trip_reviews" (
  "id" text PRIMARY KEY NOT NULL,
  "trip_id" text NOT NULL REFERENCES "trips"("id") ON DELETE cascade,
  "author_id" text REFERENCES "user"("id") ON DELETE set null,
  "rating" integer NOT NULL,
  "title" text,
  "content" text NOT NULL,
  "status" text DEFAULT 'PENDING' NOT NULL,
  "is_recommended" boolean DEFAULT true NOT NULL,
  "helpful_count" integer DEFAULT 0 NOT NULL,
  "ip_address" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "trip_reviews_rating_check" CHECK ("trip_reviews"."rating" BETWEEN 1 AND 5)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "trip_reviews_trip_idx" ON "trip_reviews" ("trip_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "trip_reviews_author_idx" ON "trip_reviews" ("author_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "trip_reviews_rating_idx" ON "trip_reviews" ("rating");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "trip_reviews_status_idx" ON "trip_reviews" ("status");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "trip_reviews_trip_author_uidx" ON "trip_reviews" ("trip_id", "author_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "trip_review_helpful" (
  "review_id" text NOT NULL REFERENCES "trip_reviews"("id") ON DELETE cascade,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE cascade,
  "is_helpful" boolean NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "trip_review_helpful_review_id_user_id_pk" PRIMARY KEY("review_id","user_id")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "trip_review_helpful_user_idx" ON "trip_review_helpful" ("user_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "trip_reports" (
  "id" text PRIMARY KEY NOT NULL,
  "trip_id" text REFERENCES "trips"("id") ON DELETE cascade,
  "comment_id" text REFERENCES "trip_comments"("id") ON DELETE cascade,
  "review_id" text REFERENCES "trip_reviews"("id") ON DELETE cascade,
  "reporter_id" text REFERENCES "user"("id") ON DELETE set null,
  "reason" text NOT NULL,
  "description" text,
  "status" text DEFAULT 'PENDING' NOT NULL,
  "resolved_by" text REFERENCES "user"("id") ON DELETE set null,
  "resolved_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "trip_reports_single_target" CHECK (((("trip_reports"."trip_id" IS NOT NULL)::int + ("trip_reports"."comment_id" IS NOT NULL)::int + ("trip_reports"."review_id" IS NOT NULL)::int) = 1))
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "trip_reports_status_idx" ON "trip_reports" ("status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "trip_reports_reporter_idx" ON "trip_reports" ("reporter_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "trip_reports_trip_idx" ON "trip_reports" ("trip_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "trip_favorites" (
  "trip_id" text NOT NULL REFERENCES "trips"("id") ON DELETE cascade,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE cascade,
  "created_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "trip_favorites_trip_id_user_id_pk" PRIMARY KEY("trip_id","user_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "trip_reactions" (
  "trip_id" text NOT NULL REFERENCES "trips"("id") ON DELETE cascade,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE cascade,
  "reaction_type" text NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "trip_reactions_trip_id_user_id_pk" PRIMARY KEY("trip_id","user_id")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "trip_reactions_type_idx" ON "trip_reactions" ("trip_id", "reaction_type");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "trip_notifications" (
  "id" text PRIMARY KEY NOT NULL,
  "recipient_id" text NOT NULL REFERENCES "user"("id") ON DELETE cascade,
  "actor_id" text REFERENCES "user"("id") ON DELETE set null,
  "trip_id" text NOT NULL REFERENCES "trips"("id") ON DELETE cascade,
  "comment_id" text REFERENCES "trip_comments"("id") ON DELETE cascade,
  "review_id" text REFERENCES "trip_reviews"("id") ON DELETE cascade,
  "type" text NOT NULL,
  "title" text NOT NULL,
  "message" text NOT NULL,
  "read_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "trip_notification_target_consistency" CHECK (CASE WHEN "trip_notifications"."type" IN ('NEW_COMMENT','REPLY_TO_COMMENT') THEN "trip_notifications"."comment_id" IS NOT NULL AND "trip_notifications"."review_id" IS NULL WHEN "trip_notifications"."type" IN ('NEW_REVIEW','REVIEW_APPROVED','REVIEW_REJECTED') THEN "trip_notifications"."review_id" IS NOT NULL AND "trip_notifications"."comment_id" IS NULL WHEN "trip_notifications"."type" IN ('TRIP_PUBLISHED','TRIP_MENTION') THEN "trip_notifications"."comment_id" IS NULL AND "trip_notifications"."review_id" IS NULL ELSE FALSE END)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "trip_notifications_recipient_idx" ON "trip_notifications" ("recipient_id", "read_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "trip_notifications_trip_idx" ON "trip_notifications" ("trip_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "trip_notifications_created_idx" ON "trip_notifications" ("created_at");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "trip_view_stats" (
  "id" text PRIMARY KEY NOT NULL,
  "trip_id" text NOT NULL REFERENCES "trips"("id") ON DELETE cascade,
  "viewed_at" timestamp DEFAULT now() NOT NULL,
  "date" text NOT NULL,
  "hour" integer NOT NULL,
  "referrer" text,
  "country" varchar(2),
  CONSTRAINT "trip_view_stats_hour_check" CHECK ("trip_view_stats"."hour" BETWEEN 0 AND 23)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "trip_view_stats_trip_idx" ON "trip_view_stats" ("trip_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "trip_view_stats_date_idx" ON "trip_view_stats" ("date");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "trip_view_stats_trip_date_idx" ON "trip_view_stats" ("trip_id", "date");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "trip_locks" (
  "id" text PRIMARY KEY NOT NULL,
  "trip_id" text NOT NULL REFERENCES "trips"("id") ON DELETE cascade UNIQUE,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE cascade,
  "session_id" text NOT NULL,
  "locked_at" timestamp DEFAULT now() NOT NULL,
  "expires_at" timestamp NOT NULL,
  CONSTRAINT "trip_locks_expiry_after_lock" CHECK ("trip_locks"."expires_at" > "trip_locks"."locked_at")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "trip_locks_expires_idx" ON "trip_locks" ("expires_at");
--> statement-breakpoint
-- Backfill aggregates from approved reviews (idempotent).
-- UPDATE "trips" SET ... via application recalculation on moderation; seeds carry aggregates.

-- ─── DOWN (réversible, à exécuter manuellement en cas de rollback) ──────────
-- DROP TABLE IF EXISTS "trip_locks";
-- DROP TABLE IF EXISTS "trip_view_stats";
-- DROP TABLE IF EXISTS "trip_notifications";
-- DROP TABLE IF EXISTS "trip_reactions";
-- DROP TABLE IF EXISTS "trip_favorites";
-- DROP TABLE IF EXISTS "trip_reports";
-- DROP TABLE IF EXISTS "trip_review_helpful";
-- DROP TABLE IF EXISTS "trip_reviews";
-- DROP TABLE IF EXISTS "trip_comment_moderations";
-- DROP TABLE IF EXISTS "trip_comments";
-- ALTER TABLE "trips" DROP CONSTRAINT IF EXISTS "trips_rating_average_range";
-- ALTER TABLE "trips" DROP COLUMN IF EXISTS "rating_count";
-- ALTER TABLE "trips" DROP COLUMN IF EXISTS "rating_average_100";
-- ALTER TABLE "trips" DROP COLUMN IF EXISTS "view_count";
-- ALTER TABLE "trips" DROP COLUMN IF EXISTS "allow_reviews";
-- ALTER TABLE "trips" DROP COLUMN IF EXISTS "comment_status";
