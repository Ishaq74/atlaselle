/**
 * Migration 0020 — Add organization scoping to media folders and files.
 *
 * Run: npx tsx scripts/apply-migration-0020.ts
 */
import { getDbUrl } from '../src/database/env';
import pg from 'pg';

const client = new pg.Client({ connectionString: getDbUrl() });
await client.connect();

async function addColumnIfNotExists(table: string, column: string, definition: string) {
  const result = await client.query(
    `SELECT 1 FROM information_schema.columns WHERE table_name = $1 AND column_name = $2`,
    [table, column],
  );

  if ((result.rowCount ?? 0) > 0) {
    console.log(`[${table}.${column}] Already exists, skipping`);
    return;
  }

  await client.query(`ALTER TABLE "${table}" ADD COLUMN "${column}" ${definition}`);
  console.log(`[${table}.${column}] Column added`);
}

async function addFkIfNotExists(
  constraintName: string,
  table: string,
  column: string,
  refTable: string,
  refColumn: string,
  onDelete: string,
) {
  try {
    await client.query(`
      ALTER TABLE "${table}"
      ADD CONSTRAINT ${constraintName}
      FOREIGN KEY ("${column}") REFERENCES "${refTable}" ("${refColumn}")
      ON DELETE ${onDelete}
    `);
    console.log(`[${constraintName}] FK constraint added`);
  } catch (err: unknown) {
    if (typeof err === 'object' && err !== null && 'code' in err && (err as { code: string }).code === '42710') {
      console.log(`[${constraintName}] Already exists, skipping`);
    } else {
      throw err;
    }
  }
}

async function dropIndexIfExists(indexName: string) {
  await client.query(`DROP INDEX IF EXISTS "${indexName}"`);
  console.log(`[${indexName}] Dropped if present`);
}

async function createIndexIfNotExists(indexName: string, statement: string) {
  await client.query(`CREATE INDEX IF NOT EXISTS "${indexName}" ${statement}`);
  console.log(`[${indexName}] Index ensured`);
}

async function createUniqueIndexIfNotExists(indexName: string, statement: string) {
  await client.query(`CREATE UNIQUE INDEX IF NOT EXISTS "${indexName}" ${statement}`);
  console.log(`[${indexName}] Unique index ensured`);
}

try {
  await addColumnIfNotExists('media_folders', 'organization_id', 'text');
  await addColumnIfNotExists('media_files', 'organization_id', 'text');

  await addFkIfNotExists(
    'media_folders_organization_id_fkey',
    'media_folders',
    'organization_id',
    'organization',
    'id',
    'CASCADE',
  );
  await addFkIfNotExists(
    'media_files_organization_id_fkey',
    'media_files',
    'organization_id',
    'organization',
    'id',
    'CASCADE',
  );

  await dropIndexIfExists('media_folders_parentId_name_uidx');
  await createIndexIfNotExists('media_folders_organizationId_idx', 'ON "media_folders" ("organization_id")');
  await createIndexIfNotExists('media_files_organizationId_idx', 'ON "media_files" ("organization_id")');
  await createUniqueIndexIfNotExists(
    'media_folders_org_parent_name_uidx',
    'ON "media_folders" ("organization_id", "parent_id", "name")',
  );

  console.log('Migration 0020 applied successfully');
} catch (err) {
  console.error('Migration failed:', err);
  process.exit(1);
} finally {
  await client.end();
}