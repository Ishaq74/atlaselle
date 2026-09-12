/**
 * Migration 0019 — Add FK constraints:
 *   - pages.locked_by → user.id (ON DELETE SET NULL)
 *   - pages.updated_by → user.id (ON DELETE SET NULL)
 *   - page_sections.updated_by → user.id (ON DELETE SET NULL)
 *
 * Run: npx tsx scripts/apply-migration-0019.ts
 */
import { getDbUrl } from '../src/database/env';
import pg from 'pg';

const client = new pg.Client({ connectionString: getDbUrl() });
await client.connect();

async function addFkIfNotExists(
  constraintName: string,
  table: string,
  column: string,
  refTable: string,
  refColumn: string,
  onDelete: string,
) {
  // Clean stale references first
  await client.query(`
    UPDATE "${table}" SET "${column}" = NULL
    WHERE "${column}" IS NOT NULL
      AND "${column}" NOT IN (SELECT "${refColumn}" FROM "${refTable}")
  `);
  console.log(`[${constraintName}] Stale references cleaned`);

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

try {
  await addFkIfNotExists('pages_locked_by_user_fk', 'pages', 'locked_by', 'user', 'id', 'SET NULL');
  await addFkIfNotExists('pages_updated_by_user_fk', 'pages', 'updated_by', 'user', 'id', 'SET NULL');
  await addFkIfNotExists('page_sections_updated_by_user_fk', 'page_sections', 'updated_by', 'user', 'id', 'SET NULL');

  console.log('Migration 0019 applied successfully');
} catch (err) {
  console.error('Migration failed:', err);
  process.exit(1);
} finally {
  await client.end();
}
