/**
 * Migration 0022 — Newsletter token single-use.
 *
 * Problem: `blog_subscribers.token` was persistent and never invalidated
 * after consumption. A leaked token (URL logs, Referer, forwarded email)
 * remained replayable until the next (re)subscribe regenerated it.
 *
 * Fix: add `token_used_at`. Once a token is consumed (confirm OR unsubscribe)
 * it is marked used and rejected on subsequent calls. Backfill: any subscriber
 * already CONFIRMED or UNSUBSCRIBED has, by definition, consumed its
 * original token, so mark it used. PENDING subscribers keep a live token.
 *
 * Run: npx tsx scripts/apply-migration-0022.ts
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

try {
  await addColumnIfNotExists(
    'blog_subscribers',
    'token_used_at',
    'timestamp without time zone',
  );

  // Backfill: CONFIRMED / UNSUBSCRIBED subscribers have consumed their token.
  const backfill = await client.query(
    `UPDATE blog_subscribers
       SET token_used_at = COALESCE(confirmed_at, unsubscribed_at, now())
       WHERE status IN ('CONFIRMED', 'UNSUBSCRIBED')
         AND token_used_at IS NULL`,
  );
  console.log(`[blog_subscribers] Backfilled token_used_at on ${backfill.rowCount ?? 0} rows`);

  console.log('Migration 0022 applied successfully.');
} catch (err) {
  console.error('Migration 0022 failed:', err);
  process.exitCode = 1;
} finally {
  await client.end();
}
