---
name: atlaselle-media
description: Atlaselle media upload, validation, alts. Use when adding images, avatars, uploads, galleries, or touching media, upload, Sharp, alt texts. Covers média, upload, image, avatar, alt.
metadata:
  author: atlaselle-repo
  version: "1.0"
---

# Atlaselle Media — upload local + alts localisés

Code : `src/media/` (`types.ts`, `upload.ts`, `delete.ts`, `list.ts`), endpoint `src/pages/api/upload.ts`. Doc : `docs/media/upload.md`. DB : `media_folders`, `media_files`, `media_file_alts` (alts **par locale**).

## 1. Endpoint `POST /api/upload`

Auth obligatoire (cookie session). Champs : `file` (requis), `type` (`avatar|logo|site|media`), `oldUrl` (optionnel, supprimé ssi même dossier de type). Succès 201 `{ url }`. Erreurs : 401, 400 (`INVALID_TYPE`, `FILE_TOO_LARGE`, `EMPTY_FILE`, `INVALID_CONTENT`, `INVALID_SUBDIR`), 429 (10 req/60 s/IP), 500.

## 2. Validation et stockage

- MIME : jpeg/png/webp/avif/x-icon + svg. Matrices validées par **magic bytes** ; SVG exclu (voie DOMPurify, rejeté si vidé).
- Tailles : 2 Mo défaut, SVG 256 Ko. Nom = UUID + extension déduite du MIME (jamais l'originale). Variante WebP via Sharp (supprimée avec l'original).
- Dossiers : `public/uploads/images/{avatars,logos,media,site}/` (seul `.gitkeep` versionné). `site` = logo clair/sombre, favicon, OG. Prod : migrer vers bucket S3/R2 (TODO §24).
- `deleteUpload()` : refuse tout hors `/uploads/` (anti path-traversal). Chaque upload journalisé en audit `FILE_UPLOAD`.

## 3. Usages

Client : `FormData` + `credentials: include`, URL retournée en champ hidden du formulaire. Admin Site : 4 champs `site`. Import : chaque média = usage + alt **dans les langues concernées** + droits (TODO §9.3, §28.3 : hero + alt 4 langues avant publication).

## 4. Anti-patterns

Extension originale trustée · SVG inline servi (toujours `attachment`) · suppression cross-dossier via `oldUrl` · média sans alt · PII dans le nom de fichier.

## 5. Checklist

Tests `tests/unit/upload.test.ts`, E2E du champ, alts 4 langues, licences vérifiées, poids optimisé (WebP, lazy sauf hero).
