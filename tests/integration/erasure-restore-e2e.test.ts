import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('astro:actions', () => {
  class ActionError extends Error {
    code: string;
    constructor({ code, message }: { code: string; message: string }) {
      super(message);
      this.code = code;
    }
  }
  return { ActionError, defineAction: (def: unknown) => def };
});

import { randomBytes } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { eq, inArray } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Client, Pool } from 'pg';
import { getDrizzle, schema } from '@database/drizzle';
import { getDbUrl } from '@database/env';
import { applications, departures, travelers, trips } from '@database/schemas';
import { createBackup, locatePgTool, parseMajor, runRestoreDrill, withDatabase } from '@database/commands/_backup';
import { replayErasures } from '@database/commands/_erasure';
import { readLedger } from '@/lib/erasure-ledger';
import { getTestHelpers } from '../helpers/auth';
import { anonymizedEmail } from '@/modules/travelers/domain/travelers-service';
import { anonymizeTraveler } from '@/actions/voyage/travelers';

/**
 * Scénario complet, avec les vrais outils PostgreSQL :
 *   sauvegarde → effacement RGPD → restauration → la personne est ressuscitée → rejeu → à nouveau effacée.
 * Ignoré si pg_dump/pg_restore n'ont pas la version majeure du serveur (le job « Restore drill » le fait tourner
 * avec le client exact). La sauvegarde porte sur la base de test partagée ; seules les lignes créées ici sont vérifiées.
 */
const anonymize = (anonymizeTraveler as any).handler as (i: unknown, c: unknown) => Promise<unknown>;
const serverUrl = withDatabase(getDbUrl(), 'postgres');
const stamp = randomBytes(4).toString('hex');
const TRIP_ID = `test-e2e-trip-${stamp}`;
const DEP_ID = `test-e2e-dep-${stamp}`;
const SECRET = 'Régime sans gluten strict';

const db = getDrizzle();
let ready = false;
let dir = '';
let ledger = '';
let travelerId = '';
let applicationId = '';
let adminId = '';
let helpers: Awaited<ReturnType<typeof getTestHelpers>> | null = null;
const previousLedger = process.env.ERASURE_LEDGER_PATH;

beforeAll(async () => {
  const admin = new Client({ connectionString: serverUrl });
  try {
    await admin.connect();
    const major = parseMajor((await admin.query<{ v: string }>("SELECT current_setting('server_version') AS v")).rows[0].v);
    const dump = await locatePgTool('pg_dump', major);
    const restore = await locatePgTool('pg_restore', major);
    ready = dump.major === major && restore.major === major;
  } catch {
    ready = false;
  } finally {
    await admin.end().catch(() => {});
  }
  if (!ready) return;
  dir = mkdtempSync(path.join(tmpdir(), 'atl-e2e-erasure-'));
  ledger = path.join(dir, 'erasure-ledger.ndjson');
  process.env.ERASURE_LEDGER_PATH = ledger;
  helpers = await getTestHelpers();
  adminId = (await helpers.saveUser(helpers.createUser({ email: `e2e-erasure-admin-${stamp}@test.com`, name: 'E2E Admin', emailVerified: true, role: 'admin' }))).id;

  await db.insert(trips).values({
    id: TRIP_ID, status: 'draft', countryCode: 'FR', defaultCurrency: 'EUR',
    durationDays: 3, durationNights: 2, groupMin: 1, groupMax: 4, difficulty: 'easy', difficultyLevel: 1,
  });
  await db.insert(departures).values({
    id: DEP_ID, tripId: TRIP_ID,
    startDate: new Date('2027-11-01T08:00:00.000Z'), endDate: new Date('2027-11-03T18:00:00.000Z'),
    status: 'open', capacityMin: 1, capacityMax: 4, priceAmount: 40000, currency: 'EUR', pricingRules: {},
  });
  const [t] = await db
    .insert(travelers)
    .values({ email: `e2e-erasure-${stamp}@test.com`, locale: 'fr', phone: '+33611112222', legalName: 'Jane Doe', preferredName: 'Janie', dateOfBirth: '1991-02-03' })
    .returning({ id: travelers.id });
  travelerId = t.id;
  const [a] = await db
    .insert(applications)
    .values({
      travelerId, tripId: TRIP_ID, departureId: DEP_ID, status: 'withdrawn',
      activityAcknowledgement: true, consent: true, submittedAt: new Date(), dietaryRequirements: SECRET,
    })
    .returning({ id: applications.id });
  applicationId = a.id;
}, 60_000);

afterAll(async () => {
  if (previousLedger === undefined) delete process.env.ERASURE_LEDGER_PATH;
  else process.env.ERASURE_LEDGER_PATH = previousLedger;
  if (travelerId) {
    await db.delete(applications).where(inArray(applications.travelerId, [travelerId])).catch(() => {});
    await db.delete(travelers).where(eq(travelers.id, travelerId)).catch(() => {});
  }
  await db.delete(departures).where(eq(departures.tripId, TRIP_ID)).catch(() => {});
  await db.delete(trips).where(eq(trips.id, TRIP_ID)).catch(() => {});
  if (helpers && adminId) await helpers.deleteUser(adminId).catch(() => {});
  if (dir) rmSync(dir, { recursive: true, force: true });
});

describe('sauvegarde → effacement → restauration → rejeu', () => {
  it('une personne effacée après la sauvegarde ne survit pas à la restauration', async (ctx) => {
    if (!ready) return ctx.skip();

    // 1. Sauvegarde : la personne y figure avec ses données.
    const { file } = await createBackup({ url: getDbUrl(), dir });

    // 2. Effacement après la sauvegarde, par l'action réelle (qui l'inscrit au registre hors base).
    await anonymize(
      { id: travelerId },
      {
        locals: { user: { id: adminId, role: 'admin', email: 'a@test.com', banned: false } },
        request: { headers: new Headers(), url: 'http://localhost:4321/en/admin' },
        clientAddress: '127.0.0.1',
      },
    );
    const [erasedInSource] = await db.select().from(travelers).where(eq(travelers.id, travelerId));
    expect(erasedInSource).toMatchObject({ email: anonymizedEmail(travelerId), legalName: null });

    // 3. Restauration réelle de la sauvegarde dans une base jetable, inspectée avant sa suppression.
    const { entries, problems } = await readLedger(ledger);
    expect(problems).toEqual([]);
    expect(entries).toHaveLength(1);

    const drill = await runRestoreDrill({
      file,
      adminUrl: serverUrl,
      inspect: async (scratchUrl) => {
        const pool = new Pool({ connectionString: scratchUrl });
        try {
          const restored = drizzle(pool, { schema });

          // 4. La restauration a ressuscité la personne (sans quoi ce test ne prouverait rien).
          const [resurrected] = await restored.select().from(travelers).where(eq(travelers.id, travelerId));
          expect(resurrected).toMatchObject({ email: `e2e-erasure-${stamp}@test.com`, legalName: 'Jane Doe', phone: '+33611112222' });
          const [resurrectedApp] = await restored.select().from(applications).where(eq(applications.id, applicationId));
          expect(resurrectedApp.dietaryRequirements).toBe(SECRET);

          // 5. Rejeu : la simulation ne change rien, le rejeu réel efface.
          const dry = await replayErasures(entries, { db: restored, dryRun: true });
          expect(dry[0].outcome).toBe('applied');
          const [afterDry] = await restored.select().from(travelers).where(eq(travelers.id, travelerId));
          expect(afterDry.legalName).toBe('Jane Doe');

          const real = await replayErasures(entries, { db: restored });
          expect(real[0].outcome).toBe('applied');
          const [erased] = await restored.select().from(travelers).where(eq(travelers.id, travelerId));
          expect(erased).toMatchObject({ email: anonymizedEmail(travelerId), phone: null, legalName: null, preferredName: null, dateOfBirth: null });
          const [erasedApp] = await restored.select().from(applications).where(eq(applications.id, applicationId));
          expect(erasedApp.dietaryRequirements).toBeNull();
          expect(JSON.stringify([erased, erasedApp])).not.toMatch(new RegExp(`Jane|${SECRET}|\\+3361111|${stamp}@test`, 'i'));

          // 6. Idempotent.
          const again = await replayErasures(entries, { db: restored });
          expect(again[0].outcome).toBe('already');
        } finally {
          await pool.end().catch(() => {});
        }
      },
    });
    expect(drill.ok).toBe(true);

    // La base jetable a bien été supprimée.
    const admin = new Client({ connectionString: serverUrl });
    await admin.connect();
    try {
      const gone = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [drill.scratch]);
      expect(gone.rowCount).toBe(0);
    } finally {
      await admin.end();
    }  }, 180_000);
});
