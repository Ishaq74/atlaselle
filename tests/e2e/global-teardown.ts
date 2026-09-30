/**
 * Playwright global teardown — removes the seed user and any leftover
 * fresh E2E users created during test runs.
 *
 * Also removes the stale `.astro/preview.json` lock: Astro 7.3+ writes this
 * lock even in FOREGROUND mode (its `background` field actually means
 * "ASTRO_PREVIEW_BACKGROUND opt-out was set", not daemon mode) and only
 * deletes it on a graceful stop. Playwright hard-kills the webServer process
 * tree, so the lock survives every run — cleaning it here keeps the working
 * tree tidy (scripts/e2e-server.mjs also pre-cleans it before each run).
 *
 * ## Isolation entre voies
 *
 * Le lock `.astro/preview.json` est PARTAGÉ par toutes les voies. Quand `E2E_LANE`
 * est défini, on ne le touche donc pas : tuer ce PID reviendrait à arrêter le
 * serveur d'une autre voie encore en cours (risque R4). Le lock sera nettoyé par
 * le teardown de la dernière voie, ou au prochain run en exécution simple.
 */
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { SEED_EMAIL } from './global-setup';

function cleanupPreviewLock() {
  // En mode voie, le lock est partagé : ne pas le toucher (voir en-tête).
  if (process.env.E2E_LANE) return;
  const lockPath = resolve('.astro/preview.json');
  if (!existsSync(lockPath)) return;
  try {
    const lock = JSON.parse(readFileSync(lockPath, 'utf8'));
    if (lock && typeof lock.pid === 'number') {
      try {
        process.kill(lock.pid, 'SIGTERM');
      } catch {
        // Already dead — expected after Playwright kills the webServer tree.
      }
    }
  } catch {
    // Unreadable lock — just delete it.
  }
  rmSync(lockPath, { force: true });
}

export default async function globalTeardown() {
  cleanupPreviewLock();
  const { getDrizzle, schema } = await import('../../src/database/drizzle');
  const { eq, like } = await import('drizzle-orm');
  const db = getDrizzle();

  // Clean up seed user
  const existing = await db
    .select({ id: schema.user.id })
    .from(schema.user)
    .where(eq(schema.user.email, SEED_EMAIL))
    .limit(1);

  if (existing.length > 0) {
    const userId = existing[0].id;
    await db.delete(schema.account).where(eq(schema.account.userId, userId)).catch(() => {});
    await db.delete(schema.session).where(eq(schema.session.userId, userId)).catch(() => {});
    await db.delete(schema.user).where(eq(schema.user.id, userId)).catch(() => {});
  }

  // Clean up fresh E2E users (e2e-{timestamp}@test.com)
  const freshUsers = await db
    .select({ id: schema.user.id })
    .from(schema.user)
    .where(like(schema.user.email, 'e2e-%@test.com'))
    .limit(50);

  for (const u of freshUsers) {
    await db.delete(schema.account).where(eq(schema.account.userId, u.id)).catch(() => {});
    await db.delete(schema.session).where(eq(schema.session.userId, u.id)).catch(() => {});
    await db.delete(schema.user).where(eq(schema.user.id, u.id)).catch(() => {});
  }
}
