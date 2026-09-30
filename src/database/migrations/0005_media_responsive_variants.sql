-- Migration: variantes responsive des médias (media_files.variants).
--
-- Problème : les photos uploadées étaient servies en pleine résolution. Une
-- photo de voyage de 4737×3440 px en JPEG (3 Mo) partait telle quelle en LCP
-- sur chaque carte de blog — Lighthouse mesurait 5,7 Mo par page, un LCP à
-- 4,6 s et réclamait 5,5 Mo d'économies.
--
-- `astro:assets` ne peut pas régler ce cas : nos médias vivent dans
-- `public/uploads/`, donc « images in your public/ folder are never
-- optimized », et une simple chaîne passée à <Image> est traitée comme une
-- image distante, également non optimisée.
--
-- Les variantes WebP sont donc générées à l'upload avec sharp
-- (src/media/variants.ts) et stockées ici, pour qu'un <picture> puisse servir
-- un srcset sans recalcul à chaque rendu.
--
-- NULL ou [] = aucune variante : le rendu retombe sur `url` (l'original).

ALTER TABLE "media_files" ADD COLUMN IF NOT EXISTS "variants" jsonb;
--> statement-breakpoint

DO $$ BEGIN
  COMMENT ON COLUMN "media_files"."variants" IS
    'Variantes WebP responsive : [{ width, height, url }]. NULL/[] = servir l''original.';
EXCEPTION WHEN others THEN NULL; END $$;
