/**
 * Migration 0021 — Blog data integrity: scope translated slugs by organization.
 *
 * Problem: `blog_post_translations` / `blog_category_translations` / `blog_tag_translations`
 * only had a unique index on (entityId, locale). Two DIFFERENT entities in the SAME
 * tenant+locale could share a translated slug → URL collision, SEO duplication, and
 * ambiguous `getBlogPostBySlug` (LIMIT 1 resolves arbitrarily).
 *
 * Fix: add a non-null `organization_id` column to each translation table (copied from the
 * parent row) and a UNIQUE index on (organization_id, locale, slug). This guarantees a
 * translated slug is unique within its tenant+locale, matching the existing unique
 * (organization_id, slug) on the base tables.
 *
 * Backfill: organization_id is copied from the parent row (blog_posts / blog_categories /
 * blog_tags) before the NOT NULL + unique constraints are applied.
 *
 * Run: npx tsx scripts/apply-migration-0021.ts
 */
import { getDbUrl } from '../src/database/env';
import pg from 'pg';

const client = new pg.Client({ connectionString: getDbUrl() });
await client.connect();

async function columnExists(table: string, column: string): Promise<boolean> {
  const res = await client.query(
    `SELECT 1 FROM information_schema.columns WHERE table_name = $1 AND column_name = $2`,
    [table, column],
  );
  return (res.rowCount ?? 0) > 0;
}

async function addColumnIfNotExists(table: string, column: string, definition: string) {
  if (await columnExists(table, column)) {
    console.log(`[${table}.${column}] Already exists, skipping`);
    return;
  }
  await client.query(`ALTER TABLE "${table}" ADD COLUMN "${column}" ${definition}`);
  console.log(`[${table}.${column}] Column added`);
}

async function createUniqueIndexIfNotExists(indexName: string, statement: string) {
  await client.query(`CREATE UNIQUE INDEX IF NOT EXISTS "${indexName}" ${statement}`);
  console.log(`[${indexName}] Unique index ensured`);
}

async function dropIndexIfExists(indexName: string) {
  await client.query(`DROP INDEX IF EXISTS "${indexName}"`);
  console.log(`[${indexName}] Dropped if present`);
}

try {
  // ── Posts ─────────────────────────────────────────────────────────────────
  // organization_id stays NULLABLE (global posts have organization_id = NULL,
  // matching blog_posts). Uniqueness is enforced by two PARTIAL unique indexes:
  //   • org-scoped rows  → (organization_id, locale, slug) WHERE organization_id IS NOT NULL
  //   • global rows      → (locale, slug)                  WHERE organization_id IS NULL
  await addColumnIfNotExists('blog_post_translations', 'organization_id', 'text');
  await client.query(`
    UPDATE "blog_post_translations" t
    SET "organization_id" = p."organization_id"
    FROM "blog_posts" p
    WHERE t."post_id" = p."id" AND t."organization_id" IS NULL
  `);
  await client.query(`
    DELETE FROM "blog_post_translations" t
    WHERE NOT EXISTS (SELECT 1 FROM "blog_posts" p WHERE p."id" = t."post_id")
  `);
  console.log('[blog_post_translations] Backfilled + cleaned orphans');
  await dropIndexIfExists('blog_post_translations_post_locale_uidx');
  await createUniqueIndexIfNotExists(
    'blog_post_translations_org_locale_slug_uidx',
    `ON "blog_post_translations" ("organization_id", "locale", "slug") WHERE "organization_id" IS NOT NULL`,
  );
  await createUniqueIndexIfNotExists(
    'blog_post_translations_global_locale_slug_uidx',
    `ON "blog_post_translations" ("locale", "slug") WHERE "organization_id" IS NULL`,
  );

  // ── Categories ──────────────────────────────────────────────────────────────
  await addColumnIfNotExists('blog_category_translations', 'organization_id', 'text');
  await client.query(`
    UPDATE "blog_category_translations" t
    SET "organization_id" = c."organization_id"
    FROM "blog_categories" c
    WHERE t."category_id" = c."id" AND t."organization_id" IS NULL
  `);
  await client.query(`
    DELETE FROM "blog_category_translations" t
    WHERE NOT EXISTS (SELECT 1 FROM "blog_categories" c WHERE c."id" = t."category_id")
  `);
  console.log('[blog_category_translations] Backfilled + cleaned orphans');
  await dropIndexIfExists('blog_category_translations_cat_locale_uidx');
  await createUniqueIndexIfNotExists(
    'blog_category_translations_org_locale_slug_uidx',
    `ON "blog_category_translations" ("organization_id", "locale", "slug") WHERE "organization_id" IS NOT NULL`,
  );
  await createUniqueIndexIfNotExists(
    'blog_category_translations_global_locale_slug_uidx',
    `ON "blog_category_translations" ("locale", "slug") WHERE "organization_id" IS NULL`,
  );

  // ── Tags ─────────────────────────────────────────────────────────────────────
  await addColumnIfNotExists('blog_tag_translations', 'organization_id', 'text');
  await client.query(`
    UPDATE "blog_tag_translations" t
    SET "organization_id" = tg."organization_id"
    FROM "blog_tags" tg
    WHERE t."tag_id" = tg."id" AND t."organization_id" IS NULL
  `);
  await client.query(`
    DELETE FROM "blog_tag_translations" t
    WHERE NOT EXISTS (SELECT 1 FROM "blog_tags" tg WHERE tg."id" = t."tag_id")
  `);
  console.log('[blog_tag_translations] Backfilled + cleaned orphans');
  await dropIndexIfExists('blog_tag_translations_tag_locale_uidx');
  await createUniqueIndexIfNotExists(
    'blog_tag_translations_org_locale_slug_uidx',
    `ON "blog_tag_translations" ("organization_id", "locale", "slug") WHERE "organization_id" IS NOT NULL`,
  );
  await createUniqueIndexIfNotExists(
    'blog_tag_translations_global_locale_slug_uidx',
    `ON "blog_tag_translations" ("locale", "slug") WHERE "organization_id" IS NULL`,
  );

  console.log('Migration 0021 applied successfully');
} catch (err) {
  console.error('Migration failed:', err);
  process.exit(1);
} finally {
  await client.end();
}
