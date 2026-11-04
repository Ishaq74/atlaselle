import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

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

import { eq, inArray } from 'drizzle-orm';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { getDrizzle } from '@database/drizzle';
import { applications, departures, reservations, travelers, trips, user } from '@database/schemas';
import { auth } from '@/lib/auth';
import { buildEntry, readLedger, recordErasure } from '@/lib/erasure-ledger';
import { replayErasures } from '@database/commands/_erasure';
import { anonymizedEmail } from '@/modules/travelers/domain/travelers-service';
import { anonymizeTraveler } from '@/actions/voyage/travelers';
import { adminRemoveUser } from '@/actions/admin/users';
import { getTestHelpers } from '../helpers/auth';

const db = getDrizzle();
const stamp = Date.now().toString(36);
const TRIP_ID = `test-erase-trip-${stamp}`;
const DEP_ID = `test-erase-dep-${stamp}`;
const anonymize = (anonymizeTraveler as any).handler as (i: unknown, c: unknown) => Promise<unknown>;
const removeUserAction = (adminRemoveUser as any).handler as (i: unknown, c: unknown) => Promise<unknown>;

const created = { travelerIds: [] as string[], userIds: [] as string[] };
let dir: string;
let ledger: string;
let helpers: Awaited<ReturnType<typeof getTestHelpers>>;
let adminId: string;
const previousPath = process.env.ERASURE_LEDGER_PATH;

async function makeTraveler(label: string, withPii = true) {
  const [row] = await db
    .insert(travelers)
    .values({
      email: `erase-${label}-${stamp}@test.com`,
      locale: 'en',
      ...(withPii ? { phone: '+33600000000', legalName: 'Jane Doe', preferredName: 'Jane', dateOfBirth: '1990-01-01' } : {}),
    })
    .returning({ id: travelers.id });
  created.travelerIds.push(row.id);
  return row.id;
}

async function makeUser(label: string) {
  const saved = await helpers.saveUser(helpers.createUser({ email: `erase-${label}-${stamp}@test.com`, name: `Erase ${label}`, emailVerified: true }));
  created.userIds.push(saved.id);
  return saved.id;
}

async function waitForEntry(kind: string, subject: string) {
  for (let i = 0; i < 40; i++) {
    const found = (await readLedger(ledger)).entries.find((e) => e.kind === kind && e.subject === subject);
    if (found) return found;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  return undefined;
}

beforeAll(async () => {
  dir = mkdtempSync(path.join(tmpdir(), 'atl-erase-'));
  ledger = path.join(dir, 'erasure-ledger.ndjson');
  process.env.ERASURE_LEDGER_PATH = ledger;
  helpers = await getTestHelpers();
  adminId = (await helpers.saveUser(helpers.createUser({ email: `erase-admin-${stamp}@test.com`, name: 'Erase Admin', emailVerified: true, role: 'admin' }))).id;
  created.userIds.push(adminId);
  await db.insert(trips).values({
    id: TRIP_ID, status: 'draft', countryCode: 'FR', defaultCurrency: 'EUR',
    durationDays: 3, durationNights: 2, groupMin: 1, groupMax: 4, difficulty: 'easy', difficultyLevel: 1,
  });
  await db.insert(departures).values({
    id: DEP_ID, tripId: TRIP_ID,
    startDate: new Date('2027-09-01T08:00:00.000Z'), endDate: new Date('2027-09-03T18:00:00.000Z'),
    status: 'open', capacityMin: 1, capacityMax: 4, priceAmount: 40000, currency: 'EUR', pricingRules: {},
  });
});

beforeEach(() => writeFileSync(ledger, ''));

afterAll(async () => {
  if (previousPath === undefined) delete process.env.ERASURE_LEDGER_PATH;
  else process.env.ERASURE_LEDGER_PATH = previousPath;
  if (created.travelerIds.length) {
    await db.delete(reservations).where(inArray(reservations.travelerId, created.travelerIds)).catch(() => {});
    await db.delete(applications).where(inArray(applications.travelerId, created.travelerIds)).catch(() => {});
    await db.delete(travelers).where(inArray(travelers.id, created.travelerIds)).catch(() => {});
  }
  await db.delete(departures).where(eq(departures.tripId, TRIP_ID)).catch(() => {});
  await db.delete(trips).where(eq(trips.id, TRIP_ID)).catch(() => {});
  for (const id of created.userIds) await helpers.deleteUser(id).catch(() => {});
  rmSync(dir, { recursive: true, force: true });
});

describe('rejeu des effacements après restauration', () => {
  it('ré-efface ce que la restauration a ressuscité, et seulement cela', async () => {
    // État « restauré » : la voyageuse et le compte effacés depuis la sauvegarde sont revenus.
    const resurrected = await makeTraveler('resurrected');
    const untouched = await makeTraveler('untouched');
    const userBack = await makeUser('back');
    const userKept = await makeUser('kept');
    const entries = [
      buildEntry({ kind: 'traveler.anonymize', subject: resurrected, actor: adminId, source: 'action' }),
      buildEntry({ kind: 'user.delete', subject: userBack, actor: adminId, source: 'hook' }),
      buildEntry({ kind: 'user.delete', subject: 'ghost_account_never_in_backup', source: 'hook' }),
      buildEntry({ kind: 'traveler.anonymize', subject: '11111111-1111-4111-8111-111111111111', source: 'action' }),
    ];

    const dry = await replayErasures(entries, { db, dryRun: true });
    expect(dry.map((r) => r.outcome)).toEqual(['applied', 'applied', 'absent', 'absent']);
    const [stillThere] = await db.select().from(travelers).where(eq(travelers.id, resurrected)).limit(1);
    expect(stillThere.legalName).toBe('Jane Doe');
    expect(await db.select({ id: user.id }).from(user).where(eq(user.id, userBack))).toHaveLength(1);

    const rows = await replayErasures(entries, { db });
    expect(rows.map((r) => r.outcome)).toEqual(['applied', 'applied', 'absent', 'absent']);

    const [erased] = await db.select().from(travelers).where(eq(travelers.id, resurrected)).limit(1);
    expect(erased).toMatchObject({ email: anonymizedEmail(resurrected), phone: null, legalName: null, preferredName: null, dateOfBirth: null });
    expect(await db.select({ id: user.id }).from(user).where(eq(user.id, userBack))).toHaveLength(0);

    const [other] = await db.select().from(travelers).where(eq(travelers.id, untouched)).limit(1);
    expect(other.legalName).toBe('Jane Doe');
    expect(await db.select({ id: user.id }).from(user).where(eq(user.id, userKept))).toHaveLength(1);

    // Idempotent : un second rejeu ne change rien.
    const again = await replayErasures(entries, { db });
    expect(again.map((r) => r.outcome)).toEqual(['already', 'absent', 'absent', 'absent']);
  }, 60_000);

  it('applique l’effacement même sur un dossier « en cours » de la base restaurée, en le signalant', async () => {
    const id = await makeTraveler('active');
    await db.insert(applications).values({
      travelerId: id, tripId: TRIP_ID, departureId: DEP_ID, status: 'submitted',
      activityAcknowledgement: true, consent: true, submittedAt: new Date(),
    });
    await db.insert(reservations).values({
      reservationNumber: `ATL-2027-X${stamp.slice(-4).toUpperCase()}`,
      travelerId: id, tripId: TRIP_ID, departureId: DEP_ID, status: 'confirmed',
      currency: 'EUR', baseAmount: 100, totalAmount: 100, amountPaid: 100, amountDue: 0,
    });
    const [row] = await replayErasures([buildEntry({ kind: 'traveler.anonymize', subject: id, source: 'action' })], { db });
    expect(row.outcome).toBe('applied');
    expect(row.warnings).toEqual(['candidature en cours dans la base restaurée', 'réservation en cours dans la base restaurée']);
    const [erased] = await db.select().from(travelers).where(eq(travelers.id, id)).limit(1);
    expect(erased.legalName).toBeNull();
    // Les transactions sont conservées, sans donnée personnelle.
    expect(await db.select({ id: reservations.id }).from(reservations).where(eq(reservations.travelerId, id))).toHaveLength(1);
  });

  it('une erreur sur une entrée n’empêche pas les suivantes', async () => {
    const id = await makeTraveler('after-error');
    const failing = { select: () => { throw new Error('boom'); } } as never;
    const [bad] = await replayErasures([buildEntry({ kind: 'user.delete', subject: 'whatever', source: 'hook' })], { db: failing });
    expect(bad).toMatchObject({ outcome: 'error', error: 'boom' });
    const [good] = await replayErasures([buildEntry({ kind: 'traveler.anonymize', subject: id, source: 'action' })], { db });
    expect(good.outcome).toBe('applied');
  });
});

describe('alimentation du registre par les effacements réels', () => {
  it('anonymizeTraveler inscrit l’effacement, sans donnée personnelle, et le rejeu le retrouve', async () => {
    const id = await makeTraveler('action');
    const ctx = {
      locals: { user: { id: adminId, role: 'admin', email: 'a@test.com', banned: false } },
      request: { headers: new Headers(), url: 'http://localhost:4321/en/admin' },
      clientAddress: '127.0.0.1',
    };
    await anonymize({ id }, ctx);

    const { entries, problems } = await readLedger(ledger);
    expect(problems).toEqual([]);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ kind: 'traveler.anonymize', subject: id, actor: adminId, source: 'action' });
    const raw = readFileSync(ledger, 'utf8');
    expect(raw).not.toMatch(/@test\.com|Jane|\+33/);

    // Restauration simulée : les données reviennent, le registre les ré-efface.
    await db.update(travelers).set({ email: `erase-action-${stamp}@test.com`, legalName: 'Jane Doe', phone: '+33600000000' }).where(eq(travelers.id, id));
    const rows = await replayErasures(entries, { db });
    expect(rows[0].outcome).toBe('applied');
    const [again] = await db.select().from(travelers).where(eq(travelers.id, id)).limit(1);
    expect(again).toMatchObject({ email: anonymizedEmail(id), legalName: null, phone: null });
  });

  it('une suppression de compte par un administrateur (API better-auth) est inscrite', async () => {
    const victim = await makeUser('victim-api');
    const headers = await helpers.getAuthHeaders({ userId: adminId });
    await auth.api.removeUser({ body: { userId: victim }, headers });
    const entry = await waitForEntry('user.delete', victim);
    expect(entry).toBeDefined();
    expect(entry?.actor).toBe(adminId);
    expect(entry?.source).toBe('hook');
    expect(await db.select({ id: user.id }).from(user).where(eq(user.id, victim))).toHaveLength(0);
  }, 30_000);

  it('l’action adminRemoveUser inscrit la suppression une seule fois (hook et action dédoublonnés)', async () => {
    const victim = await makeUser('victim-action');
    const headers = await helpers.getAuthHeaders({ userId: adminId });
    const ctx = {
      locals: { user: { id: adminId, role: 'admin', email: 'a@test.com', banned: false } },
      request: { headers, url: 'http://localhost:4321/en/admin/users' },
      clientAddress: '127.0.0.1',
    };
    await removeUserAction({ userId: victim }, ctx);
    await waitForEntry('user.delete', victim);
    await new Promise((resolve) => setTimeout(resolve, 300));
    const matching = (await readLedger(ledger)).entries.filter((e) => e.kind === 'user.delete' && e.subject === victim);
    expect(matching).toHaveLength(1);
  }, 30_000);

  it('l’auto-suppression de compte est câblée (afterDelete)', async () => {
    const options = auth.options as unknown as { user?: { deleteUser?: { afterDelete?: (u: { id: string }) => Promise<void> } } };
    const afterDelete = options.user?.deleteUser?.afterDelete;
    expect(typeof afterDelete).toBe('function');
    await afterDelete!({ id: 'self_deleted_account_1' });
    const entry = (await readLedger(ledger)).entries.find((e) => e.subject === 'self_deleted_account_1');
    expect(entry).toMatchObject({ kind: 'user.delete', actor: 'self_deleted_account_1', source: 'hook' });
  });
});

describe('sans configuration explicite en test', () => {
  it('ne crée aucun fichier dans le dépôt', async () => {
    delete process.env.ERASURE_LEDGER_PATH;
    try {
      expect(await recordErasure({ kind: 'user.delete', subject: 'never_written', source: 'hook' })).toBe('disabled');
    } finally {
      process.env.ERASURE_LEDGER_PATH = ledger;
    }
  });
});
