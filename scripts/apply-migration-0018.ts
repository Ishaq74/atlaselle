/**
 * Migration 0018 — Add content-locking columns (locked_by, locked_at) to pages.
 *
 * Run: npx tsx scripts/apply-migration-0018.ts
 */
import { getDbUrl } from '../src/database/env';
import pg from 'pg';

const client = new pg.Client({ connectionString: getDbUrl() });
await client.connect();

try {
  await client.query('ALTER TABLE pages ADD COLUMN IF NOT EXISTS locked_by TEXT');
  console.log('locked_by column added');

  await client.query('ALTER TABLE pages ADD COLUMN IF NOT EXISTS locked_at TIMESTAMP');
  console.log('locked_at column added');

  console.log('Migration 0018 applied successfully');
} catch (err) {
  console.error('Migration failed:', err);
  process.exit(1);
} finally {
  await client.end();
}
