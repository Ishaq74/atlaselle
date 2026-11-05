import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomBytes } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync, openSync, writeSync, closeSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Client } from 'pg';
import { getDbUrl } from '@database/env';
import { createBackup, locatePgTool, parseMajor, runRestoreDrill, withDatabase, type BackupManifest } from '@database/commands/_backup';

/**
 * Exercice réel sauvegarde → restauration sur une base source JETABLE créée ici
 * (la base de test partagée n'est jamais dumpée). Ignoré si pg_dump/pg_restore ou
 * le droit CREATEDB manquent. Les cas d'échec prouvent que le contrôle n'est pas vacueux.
 */
const serverUrl = withDatabase(getDbUrl(), 'postgres');
const sourceName = `drill_src_${randomBytes(4).toString('hex')}`;
const sourceUrl = withDatabase(serverUrl, sourceName);
let ready = false;
let dir = '';
let admin: Client;

beforeAll(async () => {
  try {
    admin = new Client({ connectionString: serverUrl });
    await admin.connect();
    // Même version majeure que le serveur, sinon le résultat dépendrait de la machine
    // (pg_dump 17+ écrit des commandes que PostgreSQL 16 refuse). Le job « Restore drill »
    // installe le client exact et fait foi.
    const major = parseMajor((await admin.query<{ v: string }>("SELECT current_setting('server_version') AS v")).rows[0].v);
    const dump = await locatePgTool('pg_dump', major);
    const restore = await locatePgTool('pg_restore', major);
    if (dump.major !== major || restore.major !== major) return;
    await admin.query(`CREATE DATABASE "${sourceName}"`);
  } catch {
    return;
  }
  const src = new Client({ connectionString: sourceUrl });
  await src.connect();
  await src.query(`
    CREATE TABLE "__drizzle_migrations" (id text PRIMARY KEY, hash text NOT NULL DEFAULT '', created_at timestamptz NOT NULL DEFAULT now());
    INSERT INTO "__drizzle_migrations" (id) VALUES ('0000_init'), ('0001_more');
    CREATE TABLE travellers (id serial PRIMARY KEY, name text NOT NULL, note text);
    CREATE TABLE "Booking Items" (id serial PRIMARY KEY, traveller_id int NOT NULL REFERENCES travellers(id), payload jsonb);
    INSERT INTO travellers (name, note) SELECT 'Voyageuse ' || g, 'é à ç ' || g FROM generate_series(1, 250) g;
    INSERT INTO "Booking Items" (traveller_id, payload) SELECT (g % 250) + 1, jsonb_build_object('n', g) FROM generate_series(1, 400) g;
  `);
  await src.end();
  dir = mkdtempSync(path.join(tmpdir(), 'atl-backup-'));
  ready = true;
}, 60_000);

afterAll(async () => {
  if (admin) {
    await admin.query(`DROP DATABASE IF EXISTS "${sourceName}" WITH (FORCE)`).catch(() => {});
    await admin.end().catch(() => {});
  }
  if (dir) rmSync(dir, { recursive: true, force: true });
});

// Par nom : d'autres fichiers de test restaurent en parallèle leurs propres bases jetables.
async function databaseExists(name: string): Promise<boolean> {
  const res = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [name]);
  return (res.rowCount ?? 0) > 0;
}

describe('sauvegarde → restauration (base jetable)', () => {
  it('restaure à l’identique et supprime la base jetable', async (ctx) => {
    if (!ready) return ctx.skip();
    const { file, manifest } = await createBackup({ url: sourceUrl, dir });
    expect(manifest.snapshot.tables['public.travellers']).toBe(250);
    expect(manifest.snapshot.tables['public.Booking Items']).toBe(400);
    expect(manifest.snapshot.migrations).toEqual(['0000_init', '0001_more']);

    const result = await runRestoreDrill({ file, adminUrl: serverUrl });
    expect(result.diffs).toEqual([]);
    expect(result.ok).toBe(true);
    expect(result.rows).toBe(250 + 400 + 2);
    expect(await databaseExists(result.scratch)).toBe(false);
  }, 120_000);

  it('détecte un décompte falsifié (comparaison non vacueuse)', async (ctx) => {
    if (!ready) return ctx.skip();
    const { file, manifestFile } = await createBackup({ url: sourceUrl, dir });
    const manifest = JSON.parse(readFileSync(manifestFile, 'utf8')) as BackupManifest;
    manifest.snapshot.tables['public.travellers'] = 251;
    manifest.snapshot.migrations.push('9999_ghost');
    writeFileSync(manifestFile, JSON.stringify(manifest));

    const result = await runRestoreDrill({ file, adminUrl: serverUrl });
    expect(result.ok).toBe(false);
    expect(result.diffs.join('\n')).toMatch(/public\.travellers : 251 ligne\(s\) attendue\(s\), 250/);
    expect(result.diffs.join('\n')).toMatch(/journal des migrations différent/);
    expect(await databaseExists(result.scratch)).toBe(false);
  }, 120_000);

  it('refuse une sauvegarde altérée avant toute restauration', async (ctx) => {
    if (!ready) return ctx.skip();
    const { file } = await createBackup({ url: sourceUrl, dir });
    const fd = openSync(file, 'r+');
    writeSync(fd, Buffer.from([0xff, 0xfe, 0xfd]), 0, 3, 40);
    closeSync(fd);
    // La somme de contrôle est vérifiée AVANT toute création de base : rien à nettoyer.
    await expect(runRestoreDrill({ file, adminUrl: serverUrl })).rejects.toThrow(/Somme de contrôle/);
  }, 120_000);

  it('exige le manifeste produit par db:backup', async (ctx) => {
    if (!ready) return ctx.skip();
    await expect(runRestoreDrill({ file: path.join(dir, 'absent.dump'), adminUrl: serverUrl })).rejects.toThrow(/Manifeste introuvable/);
  });
});
