CREATE TABLE "trip_comment_moderations" (
	"id" text PRIMARY KEY NOT NULL,
	"comment_id" text NOT NULL,
	"moderator_id" text NOT NULL,
	"action" text NOT NULL,
	"reason" text,
	"previous_values" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trip_comments" (
	"id" text PRIMARY KEY NOT NULL,
	"trip_id" text NOT NULL,
	"author_id" text,
	"parent_id" text,
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
CREATE TABLE "trip_favorites" (
	"trip_id" text NOT NULL,
	"user_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "trip_favorites_trip_id_user_id_pk" PRIMARY KEY("trip_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "trip_locks" (
	"id" text PRIMARY KEY NOT NULL,
	"trip_id" text NOT NULL,
	"user_id" text NOT NULL,
	"session_id" text NOT NULL,
	"locked_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp NOT NULL,
	CONSTRAINT "trip_locks_trip_id_unique" UNIQUE("trip_id"),
	CONSTRAINT "trip_locks_expiry_after_lock" CHECK ("trip_locks"."expires_at" > "trip_locks"."locked_at")
);
--> statement-breakpoint
CREATE TABLE "trip_notifications" (
	"id" text PRIMARY KEY NOT NULL,
	"recipient_id" text NOT NULL,
	"actor_id" text,
	"trip_id" text NOT NULL,
	"comment_id" text,
	"review_id" text,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"message" text NOT NULL,
	"read_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "trip_notification_target_consistency" CHECK (CASE WHEN "trip_notifications"."type" IN ('NEW_COMMENT','REPLY_TO_COMMENT') THEN "trip_notifications"."comment_id" IS NOT NULL AND "trip_notifications"."review_id" IS NULL WHEN "trip_notifications"."type" IN ('NEW_REVIEW','REVIEW_APPROVED','REVIEW_REJECTED') THEN "trip_notifications"."review_id" IS NOT NULL AND "trip_notifications"."comment_id" IS NULL WHEN "trip_notifications"."type" IN ('TRIP_PUBLISHED','TRIP_MENTION') THEN "trip_notifications"."comment_id" IS NULL AND "trip_notifications"."review_id" IS NULL ELSE FALSE END)
);
--> statement-breakpoint
CREATE TABLE "trip_reactions" (
	"trip_id" text NOT NULL,
	"user_id" text NOT NULL,
	"reaction_type" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "trip_reactions_trip_id_user_id_pk" PRIMARY KEY("trip_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "trip_reports" (
	"id" text PRIMARY KEY NOT NULL,
	"trip_id" text,
	"comment_id" text,
	"review_id" text,
	"reporter_id" text,
	"reason" text NOT NULL,
	"description" text,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"resolved_by" text,
	"resolved_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "trip_reports_single_target" CHECK (((("trip_reports"."trip_id" IS NOT NULL)::int + ("trip_reports"."comment_id" IS NOT NULL)::int + ("trip_reports"."review_id" IS NOT NULL)::int) = 1))
);
--> statement-breakpoint
CREATE TABLE "trip_review_helpful" (
	"review_id" text NOT NULL,
	"user_id" text NOT NULL,
	"is_helpful" boolean NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "trip_review_helpful_review_id_user_id_pk" PRIMARY KEY("review_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "trip_reviews" (
	"id" text PRIMARY KEY NOT NULL,
	"trip_id" text NOT NULL,
	"author_id" text,
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
CREATE TABLE "trip_view_stats" (
	"id" text PRIMARY KEY NOT NULL,
	"trip_id" text NOT NULL,
	"viewed_at" timestamp DEFAULT now() NOT NULL,
	"date" text NOT NULL,
	"hour" integer NOT NULL,
	"referrer" text,
	"country" varchar(2),
	CONSTRAINT "trip_view_stats_hour_check" CHECK ("trip_view_stats"."hour" BETWEEN 0 AND 23)
);
--> statement-breakpoint
ALTER TABLE "trips" ADD COLUMN "comment_status" text DEFAULT 'OPEN' NOT NULL;--> statement-breakpoint
ALTER TABLE "trips" ADD COLUMN "allow_reviews" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "trips" ADD COLUMN "view_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "trips" ADD COLUMN "rating_average_100" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "trips" ADD COLUMN "rating_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "trip_comment_moderations" ADD CONSTRAINT "trip_comment_moderations_comment_id_trip_comments_id_fk" FOREIGN KEY ("comment_id") REFERENCES "public"."trip_comments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_comment_moderations" ADD CONSTRAINT "trip_comment_moderations_moderator_id_user_id_fk" FOREIGN KEY ("moderator_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_comments" ADD CONSTRAINT "trip_comments_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_comments" ADD CONSTRAINT "trip_comments_author_id_user_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_comments" ADD CONSTRAINT "trip_comments_parent_id_trip_comments_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."trip_comments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_favorites" ADD CONSTRAINT "trip_favorites_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_favorites" ADD CONSTRAINT "trip_favorites_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_locks" ADD CONSTRAINT "trip_locks_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_locks" ADD CONSTRAINT "trip_locks_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_notifications" ADD CONSTRAINT "trip_notifications_recipient_id_user_id_fk" FOREIGN KEY ("recipient_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_notifications" ADD CONSTRAINT "trip_notifications_actor_id_user_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_notifications" ADD CONSTRAINT "trip_notifications_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_notifications" ADD CONSTRAINT "trip_notifications_comment_id_trip_comments_id_fk" FOREIGN KEY ("comment_id") REFERENCES "public"."trip_comments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_notifications" ADD CONSTRAINT "trip_notifications_review_id_trip_reviews_id_fk" FOREIGN KEY ("review_id") REFERENCES "public"."trip_reviews"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_reactions" ADD CONSTRAINT "trip_reactions_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_reactions" ADD CONSTRAINT "trip_reactions_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_reports" ADD CONSTRAINT "trip_reports_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_reports" ADD CONSTRAINT "trip_reports_comment_id_trip_comments_id_fk" FOREIGN KEY ("comment_id") REFERENCES "public"."trip_comments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_reports" ADD CONSTRAINT "trip_reports_review_id_trip_reviews_id_fk" FOREIGN KEY ("review_id") REFERENCES "public"."trip_reviews"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_reports" ADD CONSTRAINT "trip_reports_reporter_id_user_id_fk" FOREIGN KEY ("reporter_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_reports" ADD CONSTRAINT "trip_reports_resolved_by_user_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_review_helpful" ADD CONSTRAINT "trip_review_helpful_review_id_trip_reviews_id_fk" FOREIGN KEY ("review_id") REFERENCES "public"."trip_reviews"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_review_helpful" ADD CONSTRAINT "trip_review_helpful_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_reviews" ADD CONSTRAINT "trip_reviews_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_reviews" ADD CONSTRAINT "trip_reviews_author_id_user_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_view_stats" ADD CONSTRAINT "trip_view_stats_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "trip_comment_moderations_comment_idx" ON "trip_comment_moderations" USING btree ("comment_id");--> statement-breakpoint
CREATE INDEX "trip_comment_moderations_moderator_idx" ON "trip_comment_moderations" USING btree ("moderator_id");--> statement-breakpoint
CREATE INDEX "trip_comments_trip_idx" ON "trip_comments" USING btree ("trip_id");--> statement-breakpoint
CREATE INDEX "trip_comments_parent_idx" ON "trip_comments" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "trip_comments_status_idx" ON "trip_comments" USING btree ("status");--> statement-breakpoint
CREATE INDEX "trip_comments_author_idx" ON "trip_comments" USING btree ("author_id");--> statement-breakpoint
CREATE INDEX "trip_comments_created_idx" ON "trip_comments" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "trip_locks_expires_idx" ON "trip_locks" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "trip_notifications_recipient_idx" ON "trip_notifications" USING btree ("recipient_id","read_at");--> statement-breakpoint
CREATE INDEX "trip_notifications_trip_idx" ON "trip_notifications" USING btree ("trip_id");--> statement-breakpoint
CREATE INDEX "trip_notifications_created_idx" ON "trip_notifications" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "trip_reactions_type_idx" ON "trip_reactions" USING btree ("trip_id","reaction_type");--> statement-breakpoint
CREATE INDEX "trip_reports_status_idx" ON "trip_reports" USING btree ("status");--> statement-breakpoint
CREATE INDEX "trip_reports_reporter_idx" ON "trip_reports" USING btree ("reporter_id");--> statement-breakpoint
CREATE INDEX "trip_reports_trip_idx" ON "trip_reports" USING btree ("trip_id");--> statement-breakpoint
CREATE INDEX "trip_review_helpful_user_idx" ON "trip_review_helpful" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "trip_reviews_trip_idx" ON "trip_reviews" USING btree ("trip_id");--> statement-breakpoint
CREATE INDEX "trip_reviews_author_idx" ON "trip_reviews" USING btree ("author_id");--> statement-breakpoint
CREATE INDEX "trip_reviews_rating_idx" ON "trip_reviews" USING btree ("rating");--> statement-breakpoint
CREATE INDEX "trip_reviews_status_idx" ON "trip_reviews" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "trip_reviews_trip_author_uidx" ON "trip_reviews" USING btree ("trip_id","author_id");--> statement-breakpoint
CREATE INDEX "trip_view_stats_trip_idx" ON "trip_view_stats" USING btree ("trip_id");--> statement-breakpoint
CREATE INDEX "trip_view_stats_date_idx" ON "trip_view_stats" USING btree ("date");--> statement-breakpoint
CREATE INDEX "trip_view_stats_trip_date_idx" ON "trip_view_stats" USING btree ("trip_id","date");--> statement-breakpoint
ALTER TABLE "media_file_alts" ADD CONSTRAINT "media_file_alts_alt_ck" CHECK (char_length("media_file_alts"."alt") BETWEEN 4 AND 280);--> statement-breakpoint
ALTER TABLE "trips" ADD CONSTRAINT "trips_hero_ck" CHECK (NOT "trips"."status" = 'published' OR "trips"."hero_media_id" IS NOT NULL);--> statement-breakpoint
ALTER TABLE "trips" ADD CONSTRAINT "trips_rating_average_range" CHECK ("trips"."rating_average_100" >= 0 AND "trips"."rating_average_100" <= 500);--> statement-breakpoint
ALTER TABLE "itinerary_days" ADD CONSTRAINT "itinerary_days_activity_ck" CHECK ("itinerary_days"."activity_level" IS NULL OR ("itinerary_days"."activity_level" BETWEEN 1 AND 5));--> statement-breakpoint
ALTER TABLE "itinerary_days" ADD CONSTRAINT "itinerary_days_distance_ck" CHECK ("itinerary_days"."distance_km" IS NULL OR "itinerary_days"."distance_km" >= 0);--> statement-breakpoint
ALTER TABLE "itinerary_days" ADD CONSTRAINT "itinerary_days_duration_ck" CHECK ("itinerary_days"."activity_duration_min" IS NULL OR "itinerary_days"."activity_duration_min" >= 0);--> statement-breakpoint
ALTER TABLE "departures" ADD CONSTRAINT "departures_balance_due_ck" CHECK ("departures"."balance_due_date" IS NULL OR "departures"."balance_due_date" < "departures"."start_date");--> statement-breakpoint
ALTER TABLE "departures" ADD CONSTRAINT "departures_booking_deadline_ck" CHECK ("departures"."booking_deadline" IS NULL OR "departures"."booking_deadline" < "departures"."start_date");--> statement-breakpoint
ALTER TABLE "departures" ADD CONSTRAINT "departures_deposit_percent_ck" CHECK ("departures"."deposit_percent" >= 0 AND "departures"."deposit_percent" <= 100);--> statement-breakpoint
ALTER TABLE "policy_versions" ADD CONSTRAINT "policy_versions_version_ck" CHECK ("policy_versions"."version" > 0);--> statement-breakpoint
ALTER TABLE "policy_versions" ADD CONSTRAINT "policy_versions_published_review_ck" CHECK (NOT "policy_versions"."published" OR "policy_versions"."reviewed_by" IS NOT NULL);--> statement-breakpoint
ALTER TABLE "policy_versions" ADD CONSTRAINT "policy_versions_published_at_ck" CHECK (NOT "policy_versions"."published" OR "policy_versions"."published_at" IS NOT NULL);