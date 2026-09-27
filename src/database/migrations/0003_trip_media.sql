-- Migration: galerie d'images par voyage (trip_media).
-- Modèle aligné sur service_media : table de liaison vers media_files, ordonnée,
-- alt obligatoire (variantes par locale dans media_file_alts).
-- UP réversible : voir section DOWN en fin de fichier (commentée).

CREATE TABLE IF NOT EXISTS "trip_media" (
  "trip_id" text NOT NULL REFERENCES "trips"("id") ON DELETE CASCADE,
  "media_id" text NOT NULL REFERENCES "media_files"("id") ON DELETE CASCADE,
  "kind" text DEFAULT 'GALLERY' NOT NULL,
  "alt_text" text NOT NULL,
  "caption" text,
  "sort_order" integer DEFAULT 0 NOT NULL,
  CONSTRAINT "trip_media_trip_id_media_id_pk" PRIMARY KEY ("trip_id","media_id"),
  CONSTRAINT "trip_media_kind_check" CHECK ("kind" IN ('GALLERY','DOCUMENT'))
);
--> statement-breakpoint

DO $$ BEGIN CREATE INDEX "trip_media_trip_idx" ON "trip_media" ("trip_id"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint

-- DOWN (commenté, comme sur les migrations précédentes) :
-- DROP TABLE IF EXISTS "trip_media";
