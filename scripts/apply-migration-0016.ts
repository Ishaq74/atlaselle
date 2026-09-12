import { getDbUrl } from '../src/database/env';
import pg from 'pg';

const client = new pg.Client({ connectionString: getDbUrl() });
await client.connect();

try {
  await client.query('ALTER TABLE pages ADD COLUMN IF NOT EXISTS canonical text');
  console.log('canonical column added');

  await client.query('ALTER TABLE pages ADD COLUMN IF NOT EXISTS robots text');
  console.log('robots column added');

  const res = await client.query(
    `SELECT data_type FROM information_schema.columns WHERE table_name='page_sections' AND column_name='content'`
  );
  console.log('content type:', res.rows[0]?.data_type);

  if (res.rows[0]?.data_type === 'text') {
    await client.query('ALTER TABLE page_sections ALTER COLUMN content TYPE jsonb USING content::jsonb');
    console.log('content converted to jsonb');
  } else {
    console.log('content already jsonb');
  }

  // Mark migration as applied in drizzle journal
  await client.query(
    `INSERT INTO __drizzle_migrations (id, hash, created_at) VALUES ($1, $2, NOW()) ON CONFLICT DO NOTHING`,
    ['0016_perpetual_giant_girl', '0016_perpetual_giant_girl']
  );
  console.log('migration journal updated');
} catch (err) {
  console.error('Migration failed:', err);
  process.exit(1);
} finally {
  await client.end();
}
