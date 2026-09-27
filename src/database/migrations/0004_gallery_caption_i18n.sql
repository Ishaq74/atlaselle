-- Migration: légendes de galerie localisées (blog + voyages).
-- Problème : `caption` était une colonne texte simple, donc la légende restait
-- dans la langue de saisie sur les 4 locales, alors que les alt sont bien
-- localisés via media_file_alts. Ces tables portent la légende par locale ;
-- la colonne d'origine reste le repli.

CREATE TABLE IF NOT EXISTS "blog_post_gallery_media_captions" (
  "gallery_id" text NOT NULL REFERENCES "blog_post_galleries"("id") ON DELETE CASCADE,
  "media_id" text NOT NULL REFERENCES "media_files"("id") ON DELETE CASCADE,
  "locale" text NOT NULL,
  "caption" text NOT NULL,
  CONSTRAINT "blog_gallery_captions_pk" PRIMARY KEY ("gallery_id","media_id","locale")
);
--> statement-breakpoint

DO $$ BEGIN CREATE INDEX "blog_gallery_captions_locale_idx" ON "blog_post_gallery_media_captions" ("locale"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "trip_media_captions" (
  "trip_id" text NOT NULL REFERENCES "trips"("id") ON DELETE CASCADE,
  "media_id" text NOT NULL REFERENCES "media_files"("id") ON DELETE CASCADE,
  "locale" text NOT NULL,
  "caption" text NOT NULL,
  CONSTRAINT "trip_media_captions_pk" PRIMARY KEY ("trip_id","media_id","locale")
);
--> statement-breakpoint

DO $$ BEGIN CREATE INDEX "trip_media_captions_locale_idx" ON "trip_media_captions" ("locale"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint

DO $$ BEGIN ALTER TABLE "blog_post_gallery_media_captions" ADD CONSTRAINT "blog_gallery_captions_locale_ck" CHECK ("locale" IN ('fr','en','es','ar')); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint

DO $$ BEGIN ALTER TABLE "trip_media_captions" ADD CONSTRAINT "trip_media_captions_locale_ck" CHECK ("locale" IN ('fr','en','es','ar')); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint

-- DOWN (commenté) :
-- DROP TABLE IF EXISTS "trip_media_captions";
-- DROP TABLE IF EXISTS "blog_post_gallery_media_captions";
