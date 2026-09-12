import { getDbUrl } from '../src/database/env';
import pg from 'pg';

const client = new pg.Client({ connectionString: getDbUrl() });
await client.connect();

try {
  // Add scheduled_unpublish_at column
  await client.query('ALTER TABLE pages ADD COLUMN IF NOT EXISTS scheduled_unpublish_at timestamp');
  console.log('scheduled_unpublish_at column added');

  // Add index for cron queries on scheduled_unpublish_at
  await client.query(
    'CREATE INDEX IF NOT EXISTS pages_scheduledUnpublishAt_idx ON pages (scheduled_unpublish_at)'
  );
  console.log('pages_scheduledUnpublishAt_idx index created');

  console.log('Migration 0017 applied successfully');
} catch (err) {
  console.error('Migration failed:', err);
  process.exit(1);
} finally {
  await client.end();
}
