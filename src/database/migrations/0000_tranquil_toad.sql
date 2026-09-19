CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"issuer" text DEFAULT '' NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	"impersonated_by" text,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"username" text,
	"display_username" text,
	"bio" text,
	"website" text,
	"twitter" text,
	"linkedin" text,
	"role" text,
	"banned" boolean DEFAULT false,
	"ban_reason" text,
	"ban_expires" timestamp,
	CONSTRAINT "user_email_unique" UNIQUE("email"),
	CONSTRAINT "user_username_unique" UNIQUE("username")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text,
	"action" text NOT NULL,
	"resource" text,
	"resource_id" text,
	"metadata" jsonb,
	"ip_address" text,
	"user_agent" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contact_info" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text,
	"phone" text,
	"address" text,
	"city" text,
	"postal_code" text,
	"country" text,
	"map_url" text,
	"latitude" text,
	"longitude" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "opening_hours" (
	"id" text PRIMARY KEY NOT NULL,
	"day_of_week" integer NOT NULL,
	"open_time" text,
	"close_time" text,
	"has_midday_break" boolean DEFAULT false NOT NULL,
	"morning_open" text,
	"morning_close" text,
	"afternoon_open" text,
	"afternoon_close" text,
	"is_closed" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "opening_hours_day_range" CHECK ("opening_hours"."day_of_week" >= 0 AND "opening_hours"."day_of_week" <= 6),
	CONSTRAINT "opening_hours_midday_consistency" CHECK (NOT "opening_hours"."has_midday_break" OR ("opening_hours"."afternoon_open" IS NOT NULL AND "opening_hours"."afternoon_close" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "site_settings" (
	"id" text PRIMARY KEY NOT NULL,
	"locale" text NOT NULL,
	"site_name" text NOT NULL,
	"site_description" text,
	"site_slogan" text,
	"meta_title" text,
	"meta_description" text,
	"logo_light" text,
	"logo_dark" text,
	"favicon" text,
	"og_image" text,
	"header_cta_text" text,
	"header_cta_url" text,
	"header_secondary_text" text,
	"header_secondary_url" text,
	"header_sticky" boolean DEFAULT true NOT NULL,
	"footer_copyright_text" text,
	"footer_copyright_url" text,
	"footer_social_heading" text,
	"footer_nav_primary_heading" text,
	"footer_nav_secondary_heading" text,
	"footer_legal_heading" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "social_links" (
	"id" text PRIMARY KEY NOT NULL,
	"platform" text NOT NULL,
	"url" text NOT NULL,
	"icon" text,
	"label" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "theme_settings" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"is_active" boolean DEFAULT false NOT NULL,
	"light_tokens" text,
	"dark_tokens" text,
	"primary_color" text,
	"secondary_color" text,
	"accent_color" text,
	"background_color" text,
	"foreground_color" text,
	"muted_color" text,
	"muted_foreground_color" text,
	"font_heading" text,
	"font_body" text,
	"border_radius" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "navigation_items" (
	"id" text PRIMARY KEY NOT NULL,
	"menu_id" text NOT NULL,
	"parent_id" text,
	"locale" text NOT NULL,
	"label" text NOT NULL,
	"url" text,
	"icon" text,
	"show_icon" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"open_in_new_tab" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "nav_items_no_self_parent" CHECK ("navigation_items"."parent_id" IS NULL OR "navigation_items"."parent_id" != "navigation_items"."id")
);
--> statement-breakpoint
CREATE TABLE "navigation_menus" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"is_visible" boolean DEFAULT true NOT NULL,
	"display_label" text,
	"show_heading" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "page_sections" (
	"id" text PRIMARY KEY NOT NULL,
	"page_id" text NOT NULL,
	"type" text NOT NULL,
	"content" jsonb NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_visible" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"updated_by" text
);
--> statement-breakpoint
CREATE TABLE "pages" (
	"id" text PRIMARY KEY NOT NULL,
	"locale" text NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"meta_title" text,
	"meta_description" text,
	"og_image" text,
	"canonical" text,
	"robots" text,
	"template" text DEFAULT 'default' NOT NULL,
	"is_published" boolean DEFAULT false NOT NULL,
	"published_at" timestamp,
	"scheduled_at" timestamp,
	"scheduled_unpublish_at" timestamp,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"deleted_at" timestamp,
	"updated_by" text,
	"locked_by" text,
	"locked_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "pages_publish_consistency" CHECK (NOT "pages"."is_published" OR "pages"."published_at" IS NOT NULL)
);
--> statement-breakpoint
CREATE TABLE "page_versions" (
	"id" text PRIMARY KEY NOT NULL,
	"page_id" text NOT NULL,
	"version_number" integer NOT NULL,
	"snapshot" jsonb NOT NULL,
	"created_by" text,
	"note" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "media_file_alts" (
	"id" text PRIMARY KEY NOT NULL,
	"file_id" text NOT NULL,
	"locale" text NOT NULL,
	"alt" text NOT NULL,
	"title" text
);
--> statement-breakpoint
CREATE TABLE "media_files" (
	"id" text PRIMARY KEY NOT NULL,
	"folder_id" text,
	"filename" text NOT NULL,
	"url" text NOT NULL,
	"mime_type" text NOT NULL,
	"size" integer NOT NULL,
	"width" integer,
	"height" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "media_files_size_positive" CHECK ("media_files"."size" > 0)
);
--> statement-breakpoint
CREATE TABLE "media_folders" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"parent_id" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "consent_settings" (
	"id" text PRIMARY KEY NOT NULL,
	"locale" text NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"accept_all" text NOT NULL,
	"reject_all" text NOT NULL,
	"customize" text NOT NULL,
	"save_preferences" text NOT NULL,
	"necessary_label" text NOT NULL,
	"necessary_description" text NOT NULL,
	"analytics_label" text NOT NULL,
	"analytics_description" text NOT NULL,
	"marketing_label" text NOT NULL,
	"marketing_description" text NOT NULL,
	"privacy_policy_label" text NOT NULL,
	"privacy_policy_url" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "blog_categories" (
	"id" text PRIMARY KEY NOT NULL,
	"parent_id" text,
	"slug" text NOT NULL,
	"icon" text,
	"color" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "blog_categories_no_self_parent" CHECK ("blog_categories"."parent_id" IS NULL OR "blog_categories"."parent_id" != "blog_categories"."id")
);
--> statement-breakpoint
CREATE TABLE "blog_category_translations" (
	"id" text PRIMARY KEY NOT NULL,
	"category_id" text NOT NULL,
	"locale" text NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"meta_title" text,
	"meta_description" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "blog_comment_moderations" (
	"id" text PRIMARY KEY NOT NULL,
	"comment_id" text NOT NULL,
	"moderator_id" text NOT NULL,
	"action" text NOT NULL,
	"reason" text,
	"previous_values" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "blog_comments" (
	"id" text PRIMARY KEY NOT NULL,
	"post_id" text NOT NULL,
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
CREATE TABLE "blog_notifications" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"type" text NOT NULL,
	"post_id" text,
	"comment_id" text,
	"review_id" text,
	"from_user_id" text,
	"is_read" boolean DEFAULT false NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "blog_notifications_single_target" CHECK (("blog_notifications"."post_id" IS NOT NULL AND NOT ("blog_notifications"."comment_id" IS NOT NULL AND "blog_notifications"."review_id" IS NOT NULL)))
);
--> statement-breakpoint
CREATE TABLE "blog_post_categories" (
	"post_id" text NOT NULL,
	"category_id" text NOT NULL,
	CONSTRAINT "blog_post_categories_post_id_category_id_pk" PRIMARY KEY("post_id","category_id")
);
--> statement-breakpoint
CREATE TABLE "blog_post_favorites" (
	"post_id" text NOT NULL,
	"user_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "blog_post_favorites_post_id_user_id_pk" PRIMARY KEY("post_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "blog_post_galleries" (
	"id" text PRIMARY KEY NOT NULL,
	"post_id" text NOT NULL,
	"title" text,
	"description" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "blog_post_gallery_media" (
	"gallery_id" text NOT NULL,
	"media_id" text NOT NULL,
	"alt_text" text NOT NULL,
	"caption" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "blog_post_gallery_media_gallery_id_media_id_pk" PRIMARY KEY("gallery_id","media_id")
);
--> statement-breakpoint
CREATE TABLE "blog_post_links" (
	"id" text PRIMARY KEY NOT NULL,
	"source_post_id" text NOT NULL,
	"target_post_id" text NOT NULL,
	"link_type" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "blog_post_links_no_self_check" CHECK ("blog_post_links"."source_post_id" <> "blog_post_links"."target_post_id")
);
--> statement-breakpoint
CREATE TABLE "blog_post_locks" (
	"id" text PRIMARY KEY NOT NULL,
	"post_id" text NOT NULL,
	"user_id" text NOT NULL,
	"session_id" text NOT NULL,
	"locked_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp NOT NULL,
	CONSTRAINT "blog_post_locks_post_id_unique" UNIQUE("post_id")
);
--> statement-breakpoint
CREATE TABLE "blog_post_reactions" (
	"post_id" text NOT NULL,
	"user_id" text NOT NULL,
	"reaction_type" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "blog_post_reactions_post_id_user_id_pk" PRIMARY KEY("post_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "blog_post_review_helpful" (
	"review_id" text NOT NULL,
	"user_id" text NOT NULL,
	"is_helpful" boolean NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "blog_post_review_helpful_review_id_user_id_pk" PRIMARY KEY("review_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "blog_post_reviews" (
	"id" text PRIMARY KEY NOT NULL,
	"post_id" text NOT NULL,
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
	CONSTRAINT "blog_post_reviews_rating_check" CHECK ("blog_post_reviews"."rating" BETWEEN 1 AND 5)
);
--> statement-breakpoint
CREATE TABLE "blog_post_revisions" (
	"id" text PRIMARY KEY NOT NULL,
	"post_id" text NOT NULL,
	"author_id" text NOT NULL,
	"locale" text NOT NULL,
	"title" text NOT NULL,
	"slug" text NOT NULL,
	"content" text NOT NULL,
	"excerpt" text,
	"status" text NOT NULL,
	"revision_note" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "blog_post_seo" (
	"id" text PRIMARY KEY NOT NULL,
	"post_id" text NOT NULL,
	"locale" text NOT NULL,
	"focus_keyword" text,
	"focus_keyword_score" integer,
	"readability_score" integer,
	"meta_robots" text DEFAULT 'index,follow',
	"meta_og_type" text DEFAULT 'article',
	"meta_og_locale" text,
	"meta_twitter_card" text DEFAULT 'summary_large_image',
	"schema_markup" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "blog_post_tags" (
	"post_id" text NOT NULL,
	"tag_id" text NOT NULL,
	CONSTRAINT "blog_post_tags_post_id_tag_id_pk" PRIMARY KEY("post_id","tag_id")
);
--> statement-breakpoint
CREATE TABLE "blog_post_translations" (
	"id" text PRIMARY KEY NOT NULL,
	"post_id" text NOT NULL,
	"locale" text NOT NULL,
	"title" text NOT NULL,
	"slug" text NOT NULL,
	"content" text NOT NULL,
	"excerpt" text,
	"meta_title" text,
	"meta_description" text,
	"meta_keywords" text,
	"canonical_url" text,
	"og_title" text,
	"og_description" text,
	"og_image_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "blog_post_view_stats" (
	"id" text PRIMARY KEY NOT NULL,
	"post_id" text NOT NULL,
	"viewed_at" timestamp DEFAULT now() NOT NULL,
	"date" text NOT NULL,
	"hour" integer NOT NULL,
	"referrer" text,
	"country" varchar(2),
	"device_type" text,
	"session_id" text,
	CONSTRAINT "blog_post_view_stats_hour_check" CHECK ("blog_post_view_stats"."hour" BETWEEN 0 AND 23)
);
--> statement-breakpoint
CREATE TABLE "blog_posts" (
	"id" text PRIMARY KEY NOT NULL,
	"author_id" text NOT NULL,
	"slug" text NOT NULL,
	"status" text DEFAULT 'DRAFT' NOT NULL,
	"featured_image_id" text,
	"view_count" integer DEFAULT 0 NOT NULL,
	"is_featured" boolean DEFAULT false NOT NULL,
	"is_sticky" boolean DEFAULT false NOT NULL,
	"comment_status" text DEFAULT 'OPEN' NOT NULL,
	"allow_reviews" boolean DEFAULT true NOT NULL,
	"seo_score" integer,
	"published_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"updated_by" text,
	"locked_by" text,
	"locked_at" timestamp,
	CONSTRAINT "blog_posts_publish_consistency" CHECK (NOT "blog_posts"."status" = 'PUBLISHED' OR "blog_posts"."published_at" IS NOT NULL)
);
--> statement-breakpoint
CREATE TABLE "blog_reports" (
	"id" text PRIMARY KEY NOT NULL,
	"post_id" text,
	"comment_id" text,
	"review_id" text,
	"reporter_id" text,
	"reason" text NOT NULL,
	"description" text,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"resolved_by" text,
	"resolved_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "blog_reports_single_target" CHECK (((("blog_reports"."post_id" IS NOT NULL)::int + ("blog_reports"."comment_id" IS NOT NULL)::int + ("blog_reports"."review_id" IS NOT NULL)::int) = 1))
);
--> statement-breakpoint
CREATE TABLE "blog_subscribers" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"locale" text NOT NULL,
	"token" text,
	"token_used_at" timestamp,
	"confirmation_token_hash" text,
	"confirmation_token_expires_at" timestamp,
	"confirmation_token_used_at" timestamp,
	"unsubscribe_token_hash" text,
	"unsubscribe_token_used_at" timestamp,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"confirmed_at" timestamp,
	"unsubscribed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "blog_subscribers_token_unique" UNIQUE("token"),
	CONSTRAINT "blog_subscribers_token_purpose_check" CHECK ("blog_subscribers"."confirmation_token_hash" IS NULL OR "blog_subscribers"."unsubscribe_token_hash" IS NULL OR "blog_subscribers"."confirmation_token_hash" <> "blog_subscribers"."unsubscribe_token_hash" OR ("blog_subscribers"."token" IS NULL AND "blog_subscribers"."token_used_at" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "blog_tag_translations" (
	"id" text PRIMARY KEY NOT NULL,
	"tag_id" text NOT NULL,
	"locale" text NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "blog_tags" (
	"id" text PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"color" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "service_attribute_definitions" (
	"id" text PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"label" text NOT NULL,
	"type" text NOT NULL,
	"options" text,
	"required" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "service_attribute_values" (
	"service_id" text NOT NULL,
	"definition_id" text NOT NULL,
	"string_value" text,
	"number_value" integer,
	"boolean_value" boolean,
	"selected_value" text,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "service_attribute_values_service_id_definition_id_pk" PRIMARY KEY("service_id","definition_id")
);
--> statement-breakpoint
CREATE TABLE "service_availability" (
	"id" text PRIMARY KEY NOT NULL,
	"service_id" text NOT NULL,
	"day_of_week" integer NOT NULL,
	"start_time" text NOT NULL,
	"end_time" text NOT NULL,
	"timezone" text DEFAULT 'UTC' NOT NULL,
	"max_participants" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "service_availability_day_range" CHECK ("service_availability"."day_of_week" BETWEEN 0 AND 6),
	CONSTRAINT "service_availability_time_order" CHECK ("service_availability"."start_time" < "service_availability"."end_time"),
	CONSTRAINT "service_availability_participants_positive" CHECK ("service_availability"."max_participants" IS NULL OR "service_availability"."max_participants" > 0)
);
--> statement-breakpoint
CREATE TABLE "service_categories" (
	"id" text PRIMARY KEY NOT NULL,
	"parent_id" text,
	"slug" text NOT NULL,
	"icon" text,
	"color" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "service_categories_no_self_parent" CHECK ("service_categories"."parent_id" IS NULL OR "service_categories"."parent_id" != "service_categories"."id")
);
--> statement-breakpoint
CREATE TABLE "service_category_links" (
	"service_id" text NOT NULL,
	"category_id" text NOT NULL,
	CONSTRAINT "service_category_links_service_id_category_id_pk" PRIMARY KEY("service_id","category_id")
);
--> statement-breakpoint
CREATE TABLE "service_category_translations" (
	"id" text PRIMARY KEY NOT NULL,
	"category_id" text NOT NULL,
	"locale" text NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"meta_title" text,
	"meta_description" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "service_comments" (
	"id" text PRIMARY KEY NOT NULL,
	"service_id" text NOT NULL,
	"author_id" text,
	"parent_id" text,
	"content" text NOT NULL,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "service_favorites" (
	"service_id" text NOT NULL,
	"user_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "service_favorites_service_id_user_id_pk" PRIMARY KEY("service_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "service_locks" (
	"id" text PRIMARY KEY NOT NULL,
	"service_id" text NOT NULL,
	"user_id" text NOT NULL,
	"session_id" text NOT NULL,
	"locked_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp NOT NULL,
	CONSTRAINT "service_locks_service_id_unique" UNIQUE("service_id"),
	CONSTRAINT "service_locks_expiry_after_lock" CHECK ("service_locks"."expires_at" > "service_locks"."locked_at")
);
--> statement-breakpoint
CREATE TABLE "service_media" (
	"service_id" text NOT NULL,
	"media_id" text NOT NULL,
	"kind" text DEFAULT 'GALLERY' NOT NULL,
	"alt_text" text NOT NULL,
	"caption" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "service_media_service_id_media_id_pk" PRIMARY KEY("service_id","media_id")
);
--> statement-breakpoint
CREATE TABLE "service_notifications" (
	"id" text PRIMARY KEY NOT NULL,
	"recipient_id" text NOT NULL,
	"actor_id" text,
	"service_id" text NOT NULL,
	"comment_id" text,
	"review_id" text,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"message" text NOT NULL,
	"read_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "service_notification_target_consistency" CHECK (CASE WHEN "service_notifications"."type" IN ('NEW_COMMENT','REPLY_TO_COMMENT') THEN "service_notifications"."comment_id" IS NOT NULL AND "service_notifications"."review_id" IS NULL WHEN "service_notifications"."type" IN ('NEW_REVIEW','REVIEW_APPROVED','REVIEW_REJECTED') THEN "service_notifications"."review_id" IS NOT NULL AND "service_notifications"."comment_id" IS NULL WHEN "service_notifications"."type" IN ('SERVICE_PUBLISHED','SERVICE_MENTION') THEN "service_notifications"."comment_id" IS NULL AND "service_notifications"."review_id" IS NULL ELSE FALSE END)
);
--> statement-breakpoint
CREATE TABLE "service_reactions" (
	"service_id" text NOT NULL,
	"user_id" text NOT NULL,
	"reaction_type" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "service_reactions_service_id_user_id_pk" PRIMARY KEY("service_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "service_reports" (
	"id" text PRIMARY KEY NOT NULL,
	"service_id" text,
	"comment_id" text,
	"review_id" text,
	"reporter_id" text,
	"reason" text NOT NULL,
	"description" text,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"resolved_by" text,
	"resolved_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "service_reports_single_target" CHECK (((CASE WHEN "service_reports"."service_id" IS NOT NULL THEN 1 ELSE 0 END) + (CASE WHEN "service_reports"."comment_id" IS NOT NULL THEN 1 ELSE 0 END) + (CASE WHEN "service_reports"."review_id" IS NOT NULL THEN 1 ELSE 0 END)) = 1)
);
--> statement-breakpoint
CREATE TABLE "service_reviews" (
	"id" text PRIMARY KEY NOT NULL,
	"service_id" text NOT NULL,
	"author_id" text,
	"rating" integer NOT NULL,
	"title" text,
	"content" text NOT NULL,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"is_recommended" boolean DEFAULT true NOT NULL,
	"helpful_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "service_reviews_rating_range" CHECK ("service_reviews"."rating" BETWEEN 1 AND 5)
);
--> statement-breakpoint
CREATE TABLE "service_revisions" (
	"id" text PRIMARY KEY NOT NULL,
	"service_id" text NOT NULL,
	"author_id" text NOT NULL,
	"locale" text NOT NULL,
	"title" text NOT NULL,
	"slug" text NOT NULL,
	"content" text NOT NULL,
	"excerpt" text,
	"status" text NOT NULL,
	"revision_note" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "service_seo" (
	"id" text PRIMARY KEY NOT NULL,
	"service_id" text NOT NULL,
	"locale" text NOT NULL,
	"focus_keyword" text,
	"focus_keyword_score" integer,
	"readability_score" integer,
	"meta_robots" text DEFAULT 'index,follow',
	"meta_og_type" text DEFAULT 'service',
	"meta_og_locale" text,
	"schema_markup" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "service_tag_links" (
	"service_id" text NOT NULL,
	"tag_id" text NOT NULL,
	CONSTRAINT "service_tag_links_service_id_tag_id_pk" PRIMARY KEY("service_id","tag_id")
);
--> statement-breakpoint
CREATE TABLE "service_tag_translations" (
	"id" text PRIMARY KEY NOT NULL,
	"tag_id" text NOT NULL,
	"locale" text NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "service_tags" (
	"id" text PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"color" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "service_translations" (
	"id" text PRIMARY KEY NOT NULL,
	"service_id" text NOT NULL,
	"locale" text NOT NULL,
	"title" text NOT NULL,
	"slug" text NOT NULL,
	"excerpt" text,
	"content" text NOT NULL,
	"location_label" text,
	"location_address" text,
	"meta_title" text,
	"meta_description" text,
	"meta_keywords" text,
	"canonical_url" text,
	"og_title" text,
	"og_description" text,
	"og_image_id" text,
	"search_vector" "tsvector",
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "service_view_stats" (
	"id" text PRIMARY KEY NOT NULL,
	"service_id" text NOT NULL,
	"viewed_at" timestamp DEFAULT now() NOT NULL,
	"date" text NOT NULL,
	"hour" integer NOT NULL,
	"referrer" text,
	"country" varchar(2),
	CONSTRAINT "service_view_stats_hour_range" CHECK ("service_view_stats"."hour" BETWEEN 0 AND 23)
);
--> statement-breakpoint
CREATE TABLE "services" (
	"id" text PRIMARY KEY NOT NULL,
	"provider_id" text NOT NULL,
	"slug" text NOT NULL,
	"status" text DEFAULT 'DRAFT' NOT NULL,
	"cover_image_id" text,
	"price_minor" integer,
	"currency" varchar(3),
	"duration_minutes" integer,
	"max_participants" integer,
	"is_mobile" boolean DEFAULT false NOT NULL,
	"is_featured" boolean DEFAULT false NOT NULL,
	"view_count" integer DEFAULT 0 NOT NULL,
	"rating_average_100" integer DEFAULT 0 NOT NULL,
	"rating_count" integer DEFAULT 0 NOT NULL,
	"seo_score" integer,
	"published_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"updated_by" text,
	"locked_by" text,
	"locked_at" timestamp,
	CONSTRAINT "services_publish_consistency" CHECK (NOT "services"."status" = 'PUBLISHED' OR "services"."published_at" IS NOT NULL),
	CONSTRAINT "services_price_non_negative" CHECK ("services"."price_minor" IS NULL OR "services"."price_minor" >= 0),
	CONSTRAINT "services_duration_positive" CHECK ("services"."duration_minutes" IS NULL OR "services"."duration_minutes" > 0),
	CONSTRAINT "services_participants_positive" CHECK ("services"."max_participants" IS NULL OR "services"."max_participants" > 0),
	CONSTRAINT "services_rating_average_range" CHECK ("services"."rating_average_100" >= 0 AND "services"."rating_average_100" <= 500)
);
--> statement-breakpoint
CREATE TABLE "service_review_helpful" (
	"review_id" text NOT NULL,
	"user_id" text NOT NULL,
	"is_helpful" boolean NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "service_review_helpful_review_id_user_id_pk" PRIMARY KEY("review_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "faq_translations" (
	"id" text PRIMARY KEY NOT NULL,
	"faq_id" text NOT NULL,
	"locale" text NOT NULL,
	"question" text NOT NULL,
	"answer" text NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "faqs" (
	"id" text PRIMARY KEY NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trip_exclusion_translations" (
	"id" text PRIMARY KEY NOT NULL,
	"exclusion_id" text NOT NULL,
	"locale" text NOT NULL,
	"text" text NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trip_exclusions" (
	"id" text PRIMARY KEY NOT NULL,
	"trip_id" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trip_faqs" (
	"trip_id" text NOT NULL,
	"faq_id" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trip_highlight_translations" (
	"id" text PRIMARY KEY NOT NULL,
	"highlight_id" text NOT NULL,
	"locale" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trip_highlights" (
	"id" text PRIMARY KEY NOT NULL,
	"trip_id" text NOT NULL,
	"media_id" text,
	"icon_key" varchar(64),
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trip_inclusion_translations" (
	"id" text PRIMARY KEY NOT NULL,
	"inclusion_id" text NOT NULL,
	"locale" text NOT NULL,
	"text" text NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trip_inclusions" (
	"id" text PRIMARY KEY NOT NULL,
	"trip_id" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trip_revisions" (
	"id" text PRIMARY KEY NOT NULL,
	"trip_id" text NOT NULL,
	"snapshot" text NOT NULL,
	"created_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trip_translations" (
	"id" text PRIMARY KEY NOT NULL,
	"trip_id" text NOT NULL,
	"locale" text NOT NULL,
	"slug" varchar(160) NOT NULL,
	"title" text NOT NULL,
	"short_title" varchar(160),
	"summary" text NOT NULL,
	"overview" text NOT NULL,
	"highlights" text,
	"experience" text,
	"fitness" text,
	"preparation" text,
	"lodging" text,
	"food" text,
	"faith_considerations" text,
	"meta_title" varchar(220),
	"meta_description" varchar(320),
	"locale_visible" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trips" (
	"id" text PRIMARY KEY NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"country_code" varchar(2) NOT NULL,
	"default_currency" varchar(3) DEFAULT 'EUR' NOT NULL,
	"hero_media_id" text,
	"duration_days" integer NOT NULL,
	"duration_nights" integer NOT NULL,
	"group_min" integer NOT NULL,
	"group_max" integer NOT NULL,
	"difficulty" varchar(32) DEFAULT 'moderate' NOT NULL,
	"difficulty_level" integer DEFAULT 3 NOT NULL,
	"arrival_airport" varchar(8),
	"departure_airport" varchar(8),
	"accommodation_style" varchar(64),
	"require_account" boolean,
	"published_at" timestamp,
	"archived_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "trips_duration_ck" CHECK ("trips"."duration_days" > 0 AND "trips"."duration_nights" >= 0),
	CONSTRAINT "trips_group_ck" CHECK ("trips"."group_min" > 0 AND "trips"."group_max" >= "trips"."group_min"),
	CONSTRAINT "trips_difficulty_ck" CHECK ("trips"."difficulty_level" BETWEEN 1 AND 5),
	CONSTRAINT "trips_publish_ck" CHECK (NOT "trips"."status" = 'published' OR "trips"."published_at" IS NOT NULL)
);
--> statement-breakpoint
CREATE TABLE "itinerary_day_translations" (
	"id" text PRIMARY KEY NOT NULL,
	"day_id" text NOT NULL,
	"locale" text NOT NULL,
	"title" text NOT NULL,
	"morning" text,
	"afternoon" text,
	"evening" text,
	"meals" text,
	"accommodation" text,
	"transfer" text,
	"notes" text,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "itinerary_days" (
	"id" text PRIMARY KEY NOT NULL,
	"trip_id" text NOT NULL,
	"day_number" integer NOT NULL,
	"location" text,
	"route" text,
	"activity_level" integer,
	"distance_km" integer,
	"activity_duration_min" integer,
	"min_altitude_m" integer,
	"max_altitude_m" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "itinerary_days_day_ck" CHECK ("itinerary_days"."day_number" > 0)
);
--> statement-breakpoint
CREATE TABLE "departures" (
	"id" text PRIMARY KEY NOT NULL,
	"trip_id" text NOT NULL,
	"start_date" timestamp NOT NULL,
	"end_date" timestamp NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"capacity_min" integer NOT NULL,
	"capacity_max" integer NOT NULL,
	"price_amount" integer NOT NULL,
	"currency" varchar(3) DEFAULT 'EUR' NOT NULL,
	"deposit_type" text DEFAULT 'none' NOT NULL,
	"deposit_amount" integer DEFAULT 0 NOT NULL,
	"deposit_percent" integer DEFAULT 0 NOT NULL,
	"single_supplement_type" text DEFAULT 'none' NOT NULL,
	"single_supplement_amount" integer DEFAULT 0 NOT NULL,
	"tax_type" text DEFAULT 'none' NOT NULL,
	"tax_amount" integer DEFAULT 0 NOT NULL,
	"fee_type" text DEFAULT 'none' NOT NULL,
	"fee_amount" integer DEFAULT 0 NOT NULL,
	"discount_type" text DEFAULT 'none' NOT NULL,
	"discount_amount" integer DEFAULT 0 NOT NULL,
	"pricing_rules" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"balance_due_date" timestamp,
	"booking_deadline" timestamp,
	"arrival_airport" varchar(8),
	"departure_airport" varchar(8),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "departures_dates_ck" CHECK ("departures"."end_date" > "departures"."start_date"),
	CONSTRAINT "departures_capacity_ck" CHECK ("departures"."capacity_min" > 0 AND "departures"."capacity_max" >= "departures"."capacity_min"),
	CONSTRAINT "departures_price_ck" CHECK ("departures"."price_amount" >= 0)
);
--> statement-breakpoint
CREATE TABLE "seat_holds" (
	"id" text PRIMARY KEY NOT NULL,
	"departure_id" text NOT NULL,
	"application_id" text,
	"quantity" integer DEFAULT 1 NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"released_at" timestamp,
	CONSTRAINT "seat_holds_qty_ck" CHECK ("seat_holds"."quantity" > 0)
);
--> statement-breakpoint
CREATE TABLE "traveler_internal_notes" (
	"id" text PRIMARY KEY NOT NULL,
	"traveler_id" text NOT NULL,
	"admin_user_id" text,
	"note" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "travelers" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text,
	"email" varchar(320) NOT NULL,
	"phone" varchar(40),
	"legal_name" varchar(200),
	"preferred_name" varchar(200),
	"date_of_birth" date,
	"locale" text,
	"timezone" varchar(64),
	"email_verified_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "application_decisions" (
	"id" text PRIMARY KEY NOT NULL,
	"application_id" text NOT NULL,
	"decision" text NOT NULL,
	"admin_user_id" text,
	"internal_note" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "application_events" (
	"id" text PRIMARY KEY NOT NULL,
	"application_id" text NOT NULL,
	"event" text NOT NULL,
	"actor_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "application_internal_notes" (
	"id" text PRIMARY KEY NOT NULL,
	"application_id" text NOT NULL,
	"admin_user_id" text,
	"note" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "applications" (
	"id" text PRIMARY KEY NOT NULL,
	"traveler_id" text NOT NULL,
	"trip_id" text NOT NULL,
	"departure_id" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"room_preference" varchar(32),
	"dietary_requirements" text,
	"accessibility_needs" text,
	"activity_acknowledgement" boolean DEFAULT false NOT NULL,
	"motivation" text,
	"expectations" text,
	"consent" boolean DEFAULT false NOT NULL,
	"submitted_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reservation_internal_notes" (
	"id" text PRIMARY KEY NOT NULL,
	"reservation_id" text NOT NULL,
	"admin_user_id" text,
	"note" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reservation_price_snapshots" (
	"id" text PRIMARY KEY NOT NULL,
	"reservation_id" text NOT NULL,
	"snapshot" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reservations" (
	"id" text PRIMARY KEY NOT NULL,
	"reservation_number" varchar(32) NOT NULL,
	"traveler_id" text NOT NULL,
	"trip_id" text NOT NULL,
	"departure_id" text NOT NULL,
	"application_id" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"currency" varchar(3) DEFAULT 'EUR' NOT NULL,
	"base_amount" integer DEFAULT 0 NOT NULL,
	"single_supplement_amount" integer DEFAULT 0 NOT NULL,
	"discount_amount" integer DEFAULT 0 NOT NULL,
	"tax_amount" integer DEFAULT 0 NOT NULL,
	"fee_amount" integer DEFAULT 0 NOT NULL,
	"total_amount" integer DEFAULT 0 NOT NULL,
	"amount_paid" integer DEFAULT 0 NOT NULL,
	"amount_due" integer DEFAULT 0 NOT NULL,
	"balance_due_date" timestamp,
	"agreement_version_id" text,
	"accepted_at" timestamp,
	"confirmed_at" timestamp,
	"cancelled_at" timestamp,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "reservations_amounts_ck" CHECK ("reservations"."total_amount" >= 0 AND "reservations"."amount_paid" >= 0 AND "reservations"."amount_due" >= 0)
);
--> statement-breakpoint
CREATE TABLE "checkout_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"application_id" text NOT NULL,
	"departure_id" text NOT NULL,
	"reservation_id" text,
	"provider_session_id" varchar(160),
	"status" text DEFAULT 'open' NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" text PRIMARY KEY NOT NULL,
	"reservation_id" text NOT NULL,
	"provider" varchar(32) DEFAULT 'stripe' NOT NULL,
	"provider_payment_id" varchar(160),
	"type" text NOT NULL,
	"status" text DEFAULT 'created' NOT NULL,
	"amount" integer NOT NULL,
	"currency" varchar(3) DEFAULT 'EUR' NOT NULL,
	"idempotency_key" varchar(160) NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"paid_at" timestamp,
	"failed_at" timestamp,
	CONSTRAINT "payments_amount_ck" CHECK ("payments"."amount" >= 0)
);
--> statement-breakpoint
CREATE TABLE "policy_documents" (
	"id" text PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"locale" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "policy_versions" (
	"id" text PRIMARY KEY NOT NULL,
	"document_id" text NOT NULL,
	"version" integer NOT NULL,
	"title" text NOT NULL,
	"content" text NOT NULL,
	"published" boolean DEFAULT false NOT NULL,
	"reviewed_by" text,
	"reviewed_at" timestamp,
	"published_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "outbox_events" (
	"id" text PRIMARY KEY NOT NULL,
	"event_type" varchar(120) NOT NULL,
	"aggregate_type" varchar(80) NOT NULL,
	"aggregate_id" text NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"available_at" timestamp DEFAULT now() NOT NULL,
	"processed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "email_deliveries" (
	"id" text PRIMARY KEY NOT NULL,
	"template_key" text NOT NULL,
	"template_version" integer,
	"locale" text NOT NULL,
	"to_email" varchar(320) NOT NULL,
	"traveler_id" text,
	"reservation_id" text,
	"status" text DEFAULT 'queued' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"scheduled_at" timestamp DEFAULT now() NOT NULL,
	"sent_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "email_events" (
	"id" text PRIMARY KEY NOT NULL,
	"delivery_id" text NOT NULL,
	"event" varchar(40) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "email_templates" (
	"id" text PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"locale" text NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"subject" text NOT NULL,
	"html" text NOT NULL,
	"text_body" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "navigation_items" ADD CONSTRAINT "navigation_items_menu_id_navigation_menus_id_fk" FOREIGN KEY ("menu_id") REFERENCES "public"."navigation_menus"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "navigation_items" ADD CONSTRAINT "navigation_items_parent_id_navigation_items_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."navigation_items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "page_sections" ADD CONSTRAINT "page_sections_page_id_pages_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "page_sections" ADD CONSTRAINT "page_sections_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pages" ADD CONSTRAINT "pages_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pages" ADD CONSTRAINT "pages_locked_by_user_id_fk" FOREIGN KEY ("locked_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "page_versions" ADD CONSTRAINT "page_versions_page_id_pages_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "page_versions" ADD CONSTRAINT "page_versions_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_file_alts" ADD CONSTRAINT "media_file_alts_file_id_media_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."media_files"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_files" ADD CONSTRAINT "media_files_folder_id_media_folders_id_fk" FOREIGN KEY ("folder_id") REFERENCES "public"."media_folders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blog_categories" ADD CONSTRAINT "blog_categories_parent_id_blog_categories_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."blog_categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blog_category_translations" ADD CONSTRAINT "blog_category_translations_category_id_blog_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."blog_categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blog_comment_moderations" ADD CONSTRAINT "blog_comment_moderations_comment_id_blog_comments_id_fk" FOREIGN KEY ("comment_id") REFERENCES "public"."blog_comments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blog_comment_moderations" ADD CONSTRAINT "blog_comment_moderations_moderator_id_user_id_fk" FOREIGN KEY ("moderator_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blog_comments" ADD CONSTRAINT "blog_comments_post_id_blog_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."blog_posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blog_comments" ADD CONSTRAINT "blog_comments_author_id_user_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blog_comments" ADD CONSTRAINT "blog_comments_parent_id_blog_comments_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."blog_comments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blog_notifications" ADD CONSTRAINT "blog_notifications_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blog_notifications" ADD CONSTRAINT "blog_notifications_post_id_blog_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."blog_posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blog_notifications" ADD CONSTRAINT "blog_notifications_comment_id_blog_comments_id_fk" FOREIGN KEY ("comment_id") REFERENCES "public"."blog_comments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blog_notifications" ADD CONSTRAINT "blog_notifications_review_id_blog_post_reviews_id_fk" FOREIGN KEY ("review_id") REFERENCES "public"."blog_post_reviews"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blog_notifications" ADD CONSTRAINT "blog_notifications_from_user_id_user_id_fk" FOREIGN KEY ("from_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blog_post_categories" ADD CONSTRAINT "blog_post_categories_post_id_blog_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."blog_posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blog_post_categories" ADD CONSTRAINT "blog_post_categories_category_id_blog_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."blog_categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blog_post_favorites" ADD CONSTRAINT "blog_post_favorites_post_id_blog_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."blog_posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blog_post_favorites" ADD CONSTRAINT "blog_post_favorites_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blog_post_galleries" ADD CONSTRAINT "blog_post_galleries_post_id_blog_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."blog_posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blog_post_gallery_media" ADD CONSTRAINT "blog_post_gallery_media_gallery_id_blog_post_galleries_id_fk" FOREIGN KEY ("gallery_id") REFERENCES "public"."blog_post_galleries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blog_post_gallery_media" ADD CONSTRAINT "blog_post_gallery_media_media_id_media_files_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media_files"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blog_post_links" ADD CONSTRAINT "blog_post_links_source_post_id_blog_posts_id_fk" FOREIGN KEY ("source_post_id") REFERENCES "public"."blog_posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blog_post_links" ADD CONSTRAINT "blog_post_links_target_post_id_blog_posts_id_fk" FOREIGN KEY ("target_post_id") REFERENCES "public"."blog_posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blog_post_locks" ADD CONSTRAINT "blog_post_locks_post_id_blog_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."blog_posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blog_post_locks" ADD CONSTRAINT "blog_post_locks_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blog_post_reactions" ADD CONSTRAINT "blog_post_reactions_post_id_blog_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."blog_posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blog_post_reactions" ADD CONSTRAINT "blog_post_reactions_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blog_post_review_helpful" ADD CONSTRAINT "blog_post_review_helpful_review_id_blog_post_reviews_id_fk" FOREIGN KEY ("review_id") REFERENCES "public"."blog_post_reviews"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blog_post_review_helpful" ADD CONSTRAINT "blog_post_review_helpful_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blog_post_reviews" ADD CONSTRAINT "blog_post_reviews_post_id_blog_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."blog_posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blog_post_reviews" ADD CONSTRAINT "blog_post_reviews_author_id_user_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blog_post_revisions" ADD CONSTRAINT "blog_post_revisions_post_id_blog_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."blog_posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blog_post_revisions" ADD CONSTRAINT "blog_post_revisions_author_id_user_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blog_post_seo" ADD CONSTRAINT "blog_post_seo_post_id_blog_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."blog_posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blog_post_tags" ADD CONSTRAINT "blog_post_tags_post_id_blog_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."blog_posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blog_post_tags" ADD CONSTRAINT "blog_post_tags_tag_id_blog_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."blog_tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blog_post_translations" ADD CONSTRAINT "blog_post_translations_post_id_blog_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."blog_posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blog_post_translations" ADD CONSTRAINT "blog_post_translations_og_image_id_media_files_id_fk" FOREIGN KEY ("og_image_id") REFERENCES "public"."media_files"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blog_post_view_stats" ADD CONSTRAINT "blog_post_view_stats_post_id_blog_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."blog_posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blog_posts" ADD CONSTRAINT "blog_posts_author_id_user_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blog_posts" ADD CONSTRAINT "blog_posts_featured_image_id_media_files_id_fk" FOREIGN KEY ("featured_image_id") REFERENCES "public"."media_files"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blog_posts" ADD CONSTRAINT "blog_posts_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blog_posts" ADD CONSTRAINT "blog_posts_locked_by_user_id_fk" FOREIGN KEY ("locked_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blog_reports" ADD CONSTRAINT "blog_reports_post_id_blog_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."blog_posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blog_reports" ADD CONSTRAINT "blog_reports_comment_id_blog_comments_id_fk" FOREIGN KEY ("comment_id") REFERENCES "public"."blog_comments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blog_reports" ADD CONSTRAINT "blog_reports_review_id_blog_post_reviews_id_fk" FOREIGN KEY ("review_id") REFERENCES "public"."blog_post_reviews"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blog_reports" ADD CONSTRAINT "blog_reports_reporter_id_user_id_fk" FOREIGN KEY ("reporter_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blog_reports" ADD CONSTRAINT "blog_reports_resolved_by_user_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blog_tag_translations" ADD CONSTRAINT "blog_tag_translations_tag_id_blog_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."blog_tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_attribute_values" ADD CONSTRAINT "service_attribute_values_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_attribute_values" ADD CONSTRAINT "service_attribute_values_definition_id_service_attribute_definitions_id_fk" FOREIGN KEY ("definition_id") REFERENCES "public"."service_attribute_definitions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_availability" ADD CONSTRAINT "service_availability_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_categories" ADD CONSTRAINT "service_categories_parent_id_service_categories_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."service_categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_category_links" ADD CONSTRAINT "service_category_links_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_category_links" ADD CONSTRAINT "service_category_links_category_id_service_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."service_categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_category_translations" ADD CONSTRAINT "service_category_translations_category_id_service_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."service_categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_comments" ADD CONSTRAINT "service_comments_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_comments" ADD CONSTRAINT "service_comments_author_id_user_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_comments" ADD CONSTRAINT "service_comments_parent_id_service_comments_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."service_comments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_favorites" ADD CONSTRAINT "service_favorites_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_favorites" ADD CONSTRAINT "service_favorites_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_locks" ADD CONSTRAINT "service_locks_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_locks" ADD CONSTRAINT "service_locks_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_media" ADD CONSTRAINT "service_media_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_media" ADD CONSTRAINT "service_media_media_id_media_files_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media_files"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_notifications" ADD CONSTRAINT "service_notifications_recipient_id_user_id_fk" FOREIGN KEY ("recipient_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_notifications" ADD CONSTRAINT "service_notifications_actor_id_user_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_notifications" ADD CONSTRAINT "service_notifications_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_notifications" ADD CONSTRAINT "service_notifications_comment_id_service_comments_id_fk" FOREIGN KEY ("comment_id") REFERENCES "public"."service_comments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_notifications" ADD CONSTRAINT "service_notifications_review_id_service_reviews_id_fk" FOREIGN KEY ("review_id") REFERENCES "public"."service_reviews"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_reactions" ADD CONSTRAINT "service_reactions_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_reactions" ADD CONSTRAINT "service_reactions_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_reports" ADD CONSTRAINT "service_reports_comment_id_service_comments_id_fk" FOREIGN KEY ("comment_id") REFERENCES "public"."service_comments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_reports" ADD CONSTRAINT "service_reports_review_id_service_reviews_id_fk" FOREIGN KEY ("review_id") REFERENCES "public"."service_reviews"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_reports" ADD CONSTRAINT "service_reports_reporter_id_user_id_fk" FOREIGN KEY ("reporter_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_reports" ADD CONSTRAINT "service_reports_resolved_by_user_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_reviews" ADD CONSTRAINT "service_reviews_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_reviews" ADD CONSTRAINT "service_reviews_author_id_user_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_revisions" ADD CONSTRAINT "service_revisions_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_revisions" ADD CONSTRAINT "service_revisions_author_id_user_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_seo" ADD CONSTRAINT "service_seo_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_tag_links" ADD CONSTRAINT "service_tag_links_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_tag_links" ADD CONSTRAINT "service_tag_links_tag_id_service_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."service_tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_tag_translations" ADD CONSTRAINT "service_tag_translations_tag_id_service_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."service_tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_translations" ADD CONSTRAINT "service_translations_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_translations" ADD CONSTRAINT "service_translations_og_image_id_media_files_id_fk" FOREIGN KEY ("og_image_id") REFERENCES "public"."media_files"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_view_stats" ADD CONSTRAINT "service_view_stats_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "services" ADD CONSTRAINT "services_provider_id_user_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "services" ADD CONSTRAINT "services_cover_image_id_media_files_id_fk" FOREIGN KEY ("cover_image_id") REFERENCES "public"."media_files"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "services" ADD CONSTRAINT "services_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "services" ADD CONSTRAINT "services_locked_by_user_id_fk" FOREIGN KEY ("locked_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_review_helpful" ADD CONSTRAINT "service_review_helpful_review_id_service_reviews_id_fk" FOREIGN KEY ("review_id") REFERENCES "public"."service_reviews"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_review_helpful" ADD CONSTRAINT "service_review_helpful_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "faq_translations" ADD CONSTRAINT "faq_translations_faq_id_faqs_id_fk" FOREIGN KEY ("faq_id") REFERENCES "public"."faqs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_exclusion_translations" ADD CONSTRAINT "trip_exclusion_translations_exclusion_id_trip_exclusions_id_fk" FOREIGN KEY ("exclusion_id") REFERENCES "public"."trip_exclusions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_exclusions" ADD CONSTRAINT "trip_exclusions_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_faqs" ADD CONSTRAINT "trip_faqs_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_faqs" ADD CONSTRAINT "trip_faqs_faq_id_faqs_id_fk" FOREIGN KEY ("faq_id") REFERENCES "public"."faqs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_highlight_translations" ADD CONSTRAINT "trip_highlight_translations_highlight_id_trip_highlights_id_fk" FOREIGN KEY ("highlight_id") REFERENCES "public"."trip_highlights"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_highlights" ADD CONSTRAINT "trip_highlights_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_highlights" ADD CONSTRAINT "trip_highlights_media_id_media_files_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media_files"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_inclusion_translations" ADD CONSTRAINT "trip_inclusion_translations_inclusion_id_trip_inclusions_id_fk" FOREIGN KEY ("inclusion_id") REFERENCES "public"."trip_inclusions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_inclusions" ADD CONSTRAINT "trip_inclusions_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_revisions" ADD CONSTRAINT "trip_revisions_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_translations" ADD CONSTRAINT "trip_translations_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trips" ADD CONSTRAINT "trips_hero_media_id_media_files_id_fk" FOREIGN KEY ("hero_media_id") REFERENCES "public"."media_files"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "itinerary_day_translations" ADD CONSTRAINT "itinerary_day_translations_day_id_itinerary_days_id_fk" FOREIGN KEY ("day_id") REFERENCES "public"."itinerary_days"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "itinerary_days" ADD CONSTRAINT "itinerary_days_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "departures" ADD CONSTRAINT "departures_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seat_holds" ADD CONSTRAINT "seat_holds_departure_id_departures_id_fk" FOREIGN KEY ("departure_id") REFERENCES "public"."departures"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "traveler_internal_notes" ADD CONSTRAINT "traveler_internal_notes_traveler_id_travelers_id_fk" FOREIGN KEY ("traveler_id") REFERENCES "public"."travelers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "travelers" ADD CONSTRAINT "travelers_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_decisions" ADD CONSTRAINT "application_decisions_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_events" ADD CONSTRAINT "application_events_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_internal_notes" ADD CONSTRAINT "application_internal_notes_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "applications" ADD CONSTRAINT "applications_traveler_id_travelers_id_fk" FOREIGN KEY ("traveler_id") REFERENCES "public"."travelers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "applications" ADD CONSTRAINT "applications_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "applications" ADD CONSTRAINT "applications_departure_id_departures_id_fk" FOREIGN KEY ("departure_id") REFERENCES "public"."departures"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservation_internal_notes" ADD CONSTRAINT "reservation_internal_notes_reservation_id_reservations_id_fk" FOREIGN KEY ("reservation_id") REFERENCES "public"."reservations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservation_price_snapshots" ADD CONSTRAINT "reservation_price_snapshots_reservation_id_reservations_id_fk" FOREIGN KEY ("reservation_id") REFERENCES "public"."reservations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_traveler_id_travelers_id_fk" FOREIGN KEY ("traveler_id") REFERENCES "public"."travelers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_departure_id_departures_id_fk" FOREIGN KEY ("departure_id") REFERENCES "public"."departures"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checkout_sessions" ADD CONSTRAINT "checkout_sessions_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checkout_sessions" ADD CONSTRAINT "checkout_sessions_departure_id_departures_id_fk" FOREIGN KEY ("departure_id") REFERENCES "public"."departures"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checkout_sessions" ADD CONSTRAINT "checkout_sessions_reservation_id_reservations_id_fk" FOREIGN KEY ("reservation_id") REFERENCES "public"."reservations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_reservation_id_reservations_id_fk" FOREIGN KEY ("reservation_id") REFERENCES "public"."reservations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "policy_versions" ADD CONSTRAINT "policy_versions_document_id_policy_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."policy_documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_events" ADD CONSTRAINT "email_events_delivery_id_email_deliveries_id_fk" FOREIGN KEY ("delivery_id") REFERENCES "public"."email_deliveries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_userId_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "account_issuer_account_id_uidx" ON "account" USING btree ("issuer","account_id");--> statement-breakpoint
CREATE INDEX "session_userId_idx" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verification" USING btree ("identifier");--> statement-breakpoint
CREATE INDEX "audit_log_userId_idx" ON "audit_log" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "audit_log_action_idx" ON "audit_log" USING btree ("action");--> statement-breakpoint
CREATE INDEX "audit_log_createdAt_idx" ON "audit_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "audit_log_resource_idx" ON "audit_log" USING btree ("resource","resource_id");--> statement-breakpoint
CREATE UNIQUE INDEX "opening_hours_day_uidx" ON "opening_hours" USING btree ("day_of_week");--> statement-breakpoint
CREATE UNIQUE INDEX "site_settings_locale_uidx" ON "site_settings" USING btree ("locale");--> statement-breakpoint
CREATE UNIQUE INDEX "social_links_platform_uidx" ON "social_links" USING btree ("platform");--> statement-breakpoint
CREATE INDEX "social_links_sortOrder_idx" ON "social_links" USING btree ("sort_order");--> statement-breakpoint
CREATE UNIQUE INDEX "theme_settings_name_uidx" ON "theme_settings" USING btree ("name");--> statement-breakpoint
CREATE INDEX "theme_settings_isActive_idx" ON "theme_settings" USING btree ("is_active");--> statement-breakpoint
CREATE UNIQUE INDEX "theme_one_active_uidx" ON "theme_settings" USING btree ("is_active") WHERE "theme_settings"."is_active" = true;--> statement-breakpoint
CREATE INDEX "nav_items_menuId_idx" ON "navigation_items" USING btree ("menu_id");--> statement-breakpoint
CREATE INDEX "nav_items_parentId_idx" ON "navigation_items" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "nav_items_menu_locale_idx" ON "navigation_items" USING btree ("menu_id","locale","sort_order");--> statement-breakpoint
CREATE UNIQUE INDEX "navigation_menus_name_uidx" ON "navigation_menus" USING btree ("name");--> statement-breakpoint
CREATE INDEX "page_sections_pageId_idx" ON "page_sections" USING btree ("page_id");--> statement-breakpoint
CREATE INDEX "page_sections_pageId_visible_sort_idx" ON "page_sections" USING btree ("page_id","is_visible","sort_order");--> statement-breakpoint
CREATE UNIQUE INDEX "pages_locale_slug_uidx" ON "pages" USING btree ("locale","slug");--> statement-breakpoint
CREATE INDEX "pages_locale_idx" ON "pages" USING btree ("locale");--> statement-breakpoint
CREATE INDEX "pages_locale_published_idx" ON "pages" USING btree ("locale","is_published","sort_order");--> statement-breakpoint
CREATE INDEX "pages_deletedAt_idx" ON "pages" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "pages_scheduledAt_idx" ON "pages" USING btree ("scheduled_at");--> statement-breakpoint
CREATE INDEX "pages_scheduledUnpublishAt_idx" ON "pages" USING btree ("scheduled_unpublish_at");--> statement-breakpoint
CREATE UNIQUE INDEX "page_versions_pageId_versionNumber_uidx" ON "page_versions" USING btree ("page_id","version_number");--> statement-breakpoint
CREATE INDEX "page_versions_pageId_idx" ON "page_versions" USING btree ("page_id");--> statement-breakpoint
CREATE INDEX "page_versions_createdAt_idx" ON "page_versions" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "media_file_alts_fileId_locale_uidx" ON "media_file_alts" USING btree ("file_id","locale");--> statement-breakpoint
CREATE INDEX "media_file_alts_fileId_idx" ON "media_file_alts" USING btree ("file_id");--> statement-breakpoint
CREATE INDEX "media_files_folderId_idx" ON "media_files" USING btree ("folder_id");--> statement-breakpoint
CREATE UNIQUE INDEX "media_files_url_uidx" ON "media_files" USING btree ("url");--> statement-breakpoint
CREATE INDEX "media_folders_parentId_idx" ON "media_folders" USING btree ("parent_id");--> statement-breakpoint
CREATE UNIQUE INDEX "media_folders_parent_name_uidx" ON "media_folders" USING btree ("parent_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX "consent_settings_locale_uidx" ON "consent_settings" USING btree ("locale");--> statement-breakpoint
CREATE UNIQUE INDEX "blog_categories_slug_uidx" ON "blog_categories" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "blog_categories_parent_idx" ON "blog_categories" USING btree ("parent_id");--> statement-breakpoint
CREATE UNIQUE INDEX "blog_category_translations_category_locale_uidx" ON "blog_category_translations" USING btree ("category_id","locale");--> statement-breakpoint
CREATE UNIQUE INDEX "blog_category_translations_locale_slug_uidx" ON "blog_category_translations" USING btree ("locale","slug");--> statement-breakpoint
CREATE INDEX "blog_comment_moderations_comment_idx" ON "blog_comment_moderations" USING btree ("comment_id");--> statement-breakpoint
CREATE INDEX "blog_comment_moderations_moderator_idx" ON "blog_comment_moderations" USING btree ("moderator_id");--> statement-breakpoint
CREATE INDEX "blog_comments_post_idx" ON "blog_comments" USING btree ("post_id");--> statement-breakpoint
CREATE INDEX "blog_comments_parent_idx" ON "blog_comments" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "blog_comments_status_idx" ON "blog_comments" USING btree ("status");--> statement-breakpoint
CREATE INDEX "blog_comments_author_idx" ON "blog_comments" USING btree ("author_id");--> statement-breakpoint
CREATE INDEX "blog_comments_created_idx" ON "blog_comments" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "blog_notifications_user_idx" ON "blog_notifications" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "blog_notifications_read_idx" ON "blog_notifications" USING btree ("is_read");--> statement-breakpoint
CREATE INDEX "blog_notifications_type_idx" ON "blog_notifications" USING btree ("type");--> statement-breakpoint
CREATE INDEX "blog_notifications_created_idx" ON "blog_notifications" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "blog_post_galleries_post_idx" ON "blog_post_galleries" USING btree ("post_id");--> statement-breakpoint
CREATE UNIQUE INDEX "blog_post_links_unique_idx" ON "blog_post_links" USING btree ("source_post_id","target_post_id","link_type");--> statement-breakpoint
CREATE INDEX "blog_post_links_source_idx" ON "blog_post_links" USING btree ("source_post_id");--> statement-breakpoint
CREATE INDEX "blog_post_links_target_idx" ON "blog_post_links" USING btree ("target_post_id");--> statement-breakpoint
CREATE INDEX "blog_post_locks_expires_idx" ON "blog_post_locks" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "blog_post_reviews_post_idx" ON "blog_post_reviews" USING btree ("post_id");--> statement-breakpoint
CREATE INDEX "blog_post_reviews_author_idx" ON "blog_post_reviews" USING btree ("author_id");--> statement-breakpoint
CREATE INDEX "blog_post_reviews_rating_idx" ON "blog_post_reviews" USING btree ("rating");--> statement-breakpoint
CREATE INDEX "blog_post_reviews_status_idx" ON "blog_post_reviews" USING btree ("status");--> statement-breakpoint
CREATE INDEX "blog_post_revisions_post_idx" ON "blog_post_revisions" USING btree ("post_id");--> statement-breakpoint
CREATE INDEX "blog_post_revisions_author_idx" ON "blog_post_revisions" USING btree ("author_id");--> statement-breakpoint
CREATE UNIQUE INDEX "blog_post_seo_post_locale_uidx" ON "blog_post_seo" USING btree ("post_id","locale");--> statement-breakpoint
CREATE UNIQUE INDEX "blog_post_translations_post_locale_uidx" ON "blog_post_translations" USING btree ("post_id","locale");--> statement-breakpoint
CREATE UNIQUE INDEX "blog_post_translations_locale_slug_uidx" ON "blog_post_translations" USING btree ("locale","slug");--> statement-breakpoint
CREATE INDEX "blog_post_view_stats_post_idx" ON "blog_post_view_stats" USING btree ("post_id");--> statement-breakpoint
CREATE INDEX "blog_post_view_stats_date_idx" ON "blog_post_view_stats" USING btree ("date");--> statement-breakpoint
CREATE INDEX "blog_post_view_stats_post_date_idx" ON "blog_post_view_stats" USING btree ("post_id","date");--> statement-breakpoint
CREATE UNIQUE INDEX "blog_posts_slug_uidx" ON "blog_posts" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "blog_posts_author_idx" ON "blog_posts" USING btree ("author_id");--> statement-breakpoint
CREATE INDEX "blog_posts_status_idx" ON "blog_posts" USING btree ("status");--> statement-breakpoint
CREATE INDEX "blog_posts_published_at_idx" ON "blog_posts" USING btree ("published_at");--> statement-breakpoint
CREATE INDEX "blog_posts_featured_idx" ON "blog_posts" USING btree ("is_featured","status");--> statement-breakpoint
CREATE INDEX "blog_posts_sticky_idx" ON "blog_posts" USING btree ("is_sticky","status");--> statement-breakpoint
CREATE INDEX "blog_reports_status_idx" ON "blog_reports" USING btree ("status");--> statement-breakpoint
CREATE INDEX "blog_reports_reporter_idx" ON "blog_reports" USING btree ("reporter_id");--> statement-breakpoint
CREATE UNIQUE INDEX "blog_subscribers_email_uidx" ON "blog_subscribers" USING btree ("email");--> statement-breakpoint
CREATE INDEX "blog_subscribers_status_idx" ON "blog_subscribers" USING btree ("status");--> statement-breakpoint
CREATE INDEX "blog_subscribers_token_idx" ON "blog_subscribers" USING btree ("token");--> statement-breakpoint
CREATE UNIQUE INDEX "blog_subscribers_confirmation_token_hash_uidx" ON "blog_subscribers" USING btree ("confirmation_token_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "blog_subscribers_unsubscribe_token_hash_uidx" ON "blog_subscribers" USING btree ("unsubscribe_token_hash");--> statement-breakpoint
CREATE INDEX "blog_subscribers_confirmation_expires_idx" ON "blog_subscribers" USING btree ("confirmation_token_expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "blog_tag_translations_tag_locale_uidx" ON "blog_tag_translations" USING btree ("tag_id","locale");--> statement-breakpoint
CREATE UNIQUE INDEX "blog_tag_translations_locale_slug_uidx" ON "blog_tag_translations" USING btree ("locale","slug");--> statement-breakpoint
CREATE UNIQUE INDEX "blog_tags_slug_uidx" ON "blog_tags" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "service_attribute_definitions_key_uidx" ON "service_attribute_definitions" USING btree ("key");--> statement-breakpoint
CREATE INDEX "service_attribute_values_definition_idx" ON "service_attribute_values" USING btree ("definition_id");--> statement-breakpoint
CREATE INDEX "service_availability_service_idx" ON "service_availability" USING btree ("service_id");--> statement-breakpoint
CREATE UNIQUE INDEX "service_categories_slug_uidx" ON "service_categories" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "service_categories_parent_idx" ON "service_categories" USING btree ("parent_id");--> statement-breakpoint
CREATE UNIQUE INDEX "service_category_translations_category_locale_uidx" ON "service_category_translations" USING btree ("category_id","locale");--> statement-breakpoint
CREATE UNIQUE INDEX "service_category_translations_locale_slug_uidx" ON "service_category_translations" USING btree ("locale","slug");--> statement-breakpoint
CREATE INDEX "service_comments_service_idx" ON "service_comments" USING btree ("service_id");--> statement-breakpoint
CREATE INDEX "service_comments_parent_idx" ON "service_comments" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "service_comments_status_idx" ON "service_comments" USING btree ("status");--> statement-breakpoint
CREATE INDEX "service_locks_user_idx" ON "service_locks" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "service_media_service_idx" ON "service_media" USING btree ("service_id");--> statement-breakpoint
CREATE INDEX "service_notifications_recipient_idx" ON "service_notifications" USING btree ("recipient_id","read_at");--> statement-breakpoint
CREATE INDEX "service_notifications_service_idx" ON "service_notifications" USING btree ("service_id");--> statement-breakpoint
CREATE INDEX "service_notifications_created_idx" ON "service_notifications" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "service_reactions_type_idx" ON "service_reactions" USING btree ("service_id","reaction_type");--> statement-breakpoint
CREATE INDEX "service_reports_status_idx" ON "service_reports" USING btree ("status");--> statement-breakpoint
CREATE INDEX "service_reviews_service_idx" ON "service_reviews" USING btree ("service_id");--> statement-breakpoint
CREATE INDEX "service_reviews_status_idx" ON "service_reviews" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "service_reviews_service_author_uidx" ON "service_reviews" USING btree ("service_id","author_id");--> statement-breakpoint
CREATE INDEX "service_revisions_service_idx" ON "service_revisions" USING btree ("service_id");--> statement-breakpoint
CREATE INDEX "service_revisions_author_idx" ON "service_revisions" USING btree ("author_id");--> statement-breakpoint
CREATE UNIQUE INDEX "service_seo_service_locale_uidx" ON "service_seo" USING btree ("service_id","locale");--> statement-breakpoint
CREATE UNIQUE INDEX "service_tag_translations_tag_locale_uidx" ON "service_tag_translations" USING btree ("tag_id","locale");--> statement-breakpoint
CREATE UNIQUE INDEX "service_tag_translations_locale_slug_uidx" ON "service_tag_translations" USING btree ("locale","slug");--> statement-breakpoint
CREATE UNIQUE INDEX "service_tags_slug_uidx" ON "service_tags" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "service_translations_service_locale_uidx" ON "service_translations" USING btree ("service_id","locale");--> statement-breakpoint
CREATE UNIQUE INDEX "service_translations_locale_slug_uidx" ON "service_translations" USING btree ("locale","slug");--> statement-breakpoint
CREATE INDEX "service_translations_search_vector_gin_idx" ON "service_translations" USING gin ("search_vector");--> statement-breakpoint
CREATE INDEX "service_view_stats_service_idx" ON "service_view_stats" USING btree ("service_id");--> statement-breakpoint
CREATE UNIQUE INDEX "services_slug_uidx" ON "services" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "services_provider_idx" ON "services" USING btree ("provider_id");--> statement-breakpoint
CREATE INDEX "services_status_idx" ON "services" USING btree ("status");--> statement-breakpoint
CREATE INDEX "services_published_at_idx" ON "services" USING btree ("published_at");--> statement-breakpoint
CREATE INDEX "services_featured_idx" ON "services" USING btree ("is_featured","status");--> statement-breakpoint
CREATE INDEX "service_review_helpful_user_idx" ON "service_review_helpful" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "faq_tr_faq_locale_uidx" ON "faq_translations" USING btree ("faq_id","locale");--> statement-breakpoint
CREATE INDEX "faq_tr_faq_idx" ON "faq_translations" USING btree ("faq_id");--> statement-breakpoint
CREATE UNIQUE INDEX "trip_exclusion_tr_exc_locale_uidx" ON "trip_exclusion_translations" USING btree ("exclusion_id","locale");--> statement-breakpoint
CREATE INDEX "trip_exclusion_tr_exc_idx" ON "trip_exclusion_translations" USING btree ("exclusion_id");--> statement-breakpoint
CREATE INDEX "trip_exclusions_trip_idx" ON "trip_exclusions" USING btree ("trip_id");--> statement-breakpoint
CREATE INDEX "trip_faqs_trip_idx" ON "trip_faqs" USING btree ("trip_id");--> statement-breakpoint
CREATE UNIQUE INDEX "trip_highlight_tr_hl_locale_uidx" ON "trip_highlight_translations" USING btree ("highlight_id","locale");--> statement-breakpoint
CREATE INDEX "trip_highlight_tr_hl_idx" ON "trip_highlight_translations" USING btree ("highlight_id");--> statement-breakpoint
CREATE INDEX "trip_highlights_trip_idx" ON "trip_highlights" USING btree ("trip_id");--> statement-breakpoint
CREATE UNIQUE INDEX "trip_inclusion_tr_inc_locale_uidx" ON "trip_inclusion_translations" USING btree ("inclusion_id","locale");--> statement-breakpoint
CREATE INDEX "trip_inclusion_tr_inc_idx" ON "trip_inclusion_translations" USING btree ("inclusion_id");--> statement-breakpoint
CREATE INDEX "trip_inclusions_trip_idx" ON "trip_inclusions" USING btree ("trip_id");--> statement-breakpoint
CREATE INDEX "trip_revisions_trip_idx" ON "trip_revisions" USING btree ("trip_id");--> statement-breakpoint
CREATE UNIQUE INDEX "trip_translations_trip_locale_uidx" ON "trip_translations" USING btree ("trip_id","locale");--> statement-breakpoint
CREATE UNIQUE INDEX "trip_translations_locale_slug_uidx" ON "trip_translations" USING btree ("locale","slug");--> statement-breakpoint
CREATE INDEX "trip_translations_trip_idx" ON "trip_translations" USING btree ("trip_id");--> statement-breakpoint
CREATE INDEX "trips_status_idx" ON "trips" USING btree ("status");--> statement-breakpoint
CREATE INDEX "trips_country_idx" ON "trips" USING btree ("country_code");--> statement-breakpoint
CREATE UNIQUE INDEX "itinerary_day_tr_day_locale_uidx" ON "itinerary_day_translations" USING btree ("day_id","locale");--> statement-breakpoint
CREATE INDEX "itinerary_day_tr_day_idx" ON "itinerary_day_translations" USING btree ("day_id");--> statement-breakpoint
CREATE UNIQUE INDEX "itinerary_days_trip_day_uidx" ON "itinerary_days" USING btree ("trip_id","day_number");--> statement-breakpoint
CREATE INDEX "itinerary_days_trip_idx" ON "itinerary_days" USING btree ("trip_id");--> statement-breakpoint
CREATE INDEX "departures_trip_idx" ON "departures" USING btree ("trip_id");--> statement-breakpoint
CREATE INDEX "departures_status_idx" ON "departures" USING btree ("status");--> statement-breakpoint
CREATE INDEX "departures_dates_idx" ON "departures" USING btree ("start_date");--> statement-breakpoint
CREATE INDEX "seat_holds_departure_idx" ON "seat_holds" USING btree ("departure_id");--> statement-breakpoint
CREATE INDEX "seat_holds_status_idx" ON "seat_holds" USING btree ("status");--> statement-breakpoint
CREATE INDEX "seat_holds_expires_idx" ON "seat_holds" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "traveler_notes_traveler_idx" ON "traveler_internal_notes" USING btree ("traveler_id");--> statement-breakpoint
CREATE UNIQUE INDEX "travelers_email_lower_uidx" ON "travelers" USING btree (lower("email"));--> statement-breakpoint
CREATE INDEX "travelers_user_idx" ON "travelers" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "application_decisions_app_idx" ON "application_decisions" USING btree ("application_id");--> statement-breakpoint
CREATE INDEX "application_events_app_idx" ON "application_events" USING btree ("application_id");--> statement-breakpoint
CREATE INDEX "application_notes_app_idx" ON "application_internal_notes" USING btree ("application_id");--> statement-breakpoint
CREATE INDEX "applications_traveler_idx" ON "applications" USING btree ("traveler_id");--> statement-breakpoint
CREATE INDEX "applications_trip_idx" ON "applications" USING btree ("trip_id");--> statement-breakpoint
CREATE INDEX "applications_departure_idx" ON "applications" USING btree ("departure_id");--> statement-breakpoint
CREATE INDEX "applications_status_idx" ON "applications" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "applications_traveler_departure_active_uidx" ON "applications" USING btree ("traveler_id","departure_id") WHERE "applications"."status" in ('draft', 'submitted', 'under_review', 'contact_required', 'approved');--> statement-breakpoint
CREATE INDEX "reservation_notes_res_idx" ON "reservation_internal_notes" USING btree ("reservation_id");--> statement-breakpoint
CREATE INDEX "reservation_snapshots_res_idx" ON "reservation_price_snapshots" USING btree ("reservation_id");--> statement-breakpoint
CREATE UNIQUE INDEX "reservations_number_uidx" ON "reservations" USING btree ("reservation_number");--> statement-breakpoint
CREATE INDEX "reservations_traveler_idx" ON "reservations" USING btree ("traveler_id");--> statement-breakpoint
CREATE INDEX "reservations_departure_idx" ON "reservations" USING btree ("departure_id");--> statement-breakpoint
CREATE INDEX "reservations_status_idx" ON "reservations" USING btree ("status");--> statement-breakpoint
CREATE INDEX "checkout_sessions_app_idx" ON "checkout_sessions" USING btree ("application_id");--> statement-breakpoint
CREATE INDEX "checkout_sessions_status_idx" ON "checkout_sessions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "checkout_sessions_expires_idx" ON "checkout_sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "payments_idempotency_uidx" ON "payments" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX "payments_reservation_idx" ON "payments" USING btree ("reservation_id");--> statement-breakpoint
CREATE INDEX "payments_status_idx" ON "payments" USING btree ("status");--> statement-breakpoint
CREATE INDEX "payments_provider_idx" ON "payments" USING btree ("provider_payment_id");--> statement-breakpoint
CREATE UNIQUE INDEX "policy_docs_type_locale_uidx" ON "policy_documents" USING btree ("type","locale");--> statement-breakpoint
CREATE INDEX "policy_docs_type_idx" ON "policy_documents" USING btree ("type");--> statement-breakpoint
CREATE UNIQUE INDEX "policy_versions_doc_version_uidx" ON "policy_versions" USING btree ("document_id","version");--> statement-breakpoint
CREATE INDEX "policy_versions_doc_idx" ON "policy_versions" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "outbox_status_available_idx" ON "outbox_events" USING btree ("status","available_at");--> statement-breakpoint
CREATE INDEX "outbox_aggregate_idx" ON "outbox_events" USING btree ("aggregate_type","aggregate_id");--> statement-breakpoint
CREATE INDEX "email_deliveries_status_idx" ON "email_deliveries" USING btree ("status","scheduled_at");--> statement-breakpoint
CREATE INDEX "email_deliveries_traveler_idx" ON "email_deliveries" USING btree ("traveler_id");--> statement-breakpoint
CREATE INDEX "email_deliveries_reservation_idx" ON "email_deliveries" USING btree ("reservation_id");--> statement-breakpoint
CREATE INDEX "email_events_delivery_idx" ON "email_events" USING btree ("delivery_id");--> statement-breakpoint
CREATE UNIQUE INDEX "email_templates_key_locale_version_uidx" ON "email_templates" USING btree ("key","locale","version");--> statement-breakpoint
CREATE INDEX "email_templates_key_locale_idx" ON "email_templates" USING btree ("key","locale");