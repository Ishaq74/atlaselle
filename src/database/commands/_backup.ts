/**
 * Sauvegarde logique (pg_dump) et test de restauration (pg_restore dans une base
 * jetable). Sans dépendance à `../env` ni à `../drizzle` : l'URL est un paramètre,
 * ce qui rend le module testable contre n'importe quelle base.
 */
import { execFile } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import { createReadStream, existsSync, mkdirSync, readdirSync, statSync, writeFileSync, chmodSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';
import { Client } from 'pg';

const execFileAsync = promisify(execFile);

// ─── Types ───────────────────────────────────────────────────────────
export interface Snapshot {
  /** `schema.table` → nombre exact de lignes. */
  tables: Record<string, number>;
  /** Identifiants du journal `__drizzle_migrations` (vide si absent). */
  migrations: string[];
}

export interface BackupManifest {
  version: 1;
  createdAt: string;
  database: string;
  serverVersion: string;
  pgDump: string;
  file: string;
  bytes: number;
  sha256: string;
  dumpDurationMs: number;
  snapshot: Snapshot;
}

export interface DbTarget {
  host: string;
  port: string;
  user: string;
  password: string;
  database: string;
  sslmode: string | null;
}

// ─── Helpers purs ────────────────────────────────────────────────────
export function parseDbUrl(url: string): DbTarget {
  const u = new URL(url);
  return {
    host: u.hostname,
    port: u.port || '5432',
    user: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
    database: decodeURIComponent(u.pathname.replace(/^\//, '')),
    sslmode: u.searchParams.get('sslmode'),
  };
}

export function withDatabase(url: string, database: string): string {
  const u = new URL(url);
  u.pathname = `/${encodeURIComponent(database)}`;
  return u.toString();
}

/** Variables d'environnement libpq : le mot de passe ne passe jamais par argv. */
export function pgEnv(target: DbTarget): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...process.env, PGPASSWORD: target.password };
  if (target.sslmode) env.PGSSLMODE = target.sslmode;
  return env;
}

export function timestampSlug(date: Date = new Date()): string {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z').replace('T', '-');
}

export function backupFileName(database: string, date: Date = new Date()): string {
  const safe = database.replace(/[^A-Za-z0-9_.-]/g, '_');
  return `${safe}-${timestampSlug(date)}.dump`;
}

const SCRATCH_RE = /^restore_drill_[0-9]{8}t?[0-9]{6}z?_[a-f0-9]{6}$/;

export function scratchDatabaseName(date: Date = new Date()): string {
  const slug = timestampSlug(date).replace('-', 't').toLowerCase();
  return `restore_drill_${slug}_${randomBytes(3).toString('hex')}`;
}

/** Garde-fou : seule une base nommée par `scratchDatabaseName` peut être créée/supprimée. */
export function assertScratchName(name: string, source?: string): void {
  if (!SCRATCH_RE.test(name)) throw new Error(`Nom de base jetable invalide : ${name}`);
  if (source !== undefined && name === source) throw new Error('La base jetable ne peut pas être la base source.');
}

export function compareSnapshots(expected: Snapshot, actual: Snapshot): string[] {
  const diffs: string[] = [];
  for (const [table, count] of Object.entries(expected.tables)) {
    if (!(table in actual.tables)) diffs.push(`table absente après restauration : ${table}`);
    else if (actual.tables[table] !== count) diffs.push(`${table} : ${count} ligne(s) attendue(s), ${actual.tables[table]} restaurée(s)`);
  }
  for (const table of Object.keys(actual.tables)) {
    if (!(table in expected.tables)) diffs.push(`table inattendue après restauration : ${table}`);
  }
  const exp = [...expected.migrations].sort();
  const act = [...actual.migrations].sort();
  if (exp.join('|') !== act.join('|')) diffs.push(`journal des migrations différent (${exp.length} attendue(s), ${act.length} restaurée(s))`);
  return diffs;
}

export function parseMajor(versionText: string): number {
  const match = /(\d+)(?:\.\d+)?/.exec(versionText);
  return match ? Number(match[1]) : 0;
}

export async function sha256File(file: string): Promise<string> {
  const hash = createHash('sha256');
  await new Promise<void>((resolve, reject) => {
    createReadStream(file).on('data', (chunk) => hash.update(chunk)).on('error', reject).on('end', () => resolve());
  });
  return hash.digest('hex');
}

// ─── Outils PostgreSQL ───────────────────────────────────────────────
export function pgToolCandidates(
  tool: 'pg_dump' | 'pg_restore',
  platform: NodeJS.Platform = process.platform,
  env: NodeJS.ProcessEnv = process.env,
  listDir: (dir: string) => string[] = (dir) => (existsSync(dir) ? readdirSync(dir) : []),
): string[] {
  const p = platform === 'win32' ? path.win32 : path.posix;
  const exe = platform === 'win32' ? `${tool}.exe` : tool;
  const out: string[] = [];
  if (env.PG_BIN_DIR) out.push(p.join(env.PG_BIN_DIR, exe));
  out.push(exe);
  if (platform === 'win32') {
    const root = 'C:\\Program Files\\PostgreSQL';
    const versions = listDir(root).filter((v) => /^\d+$/.test(v)).sort((a, b) => Number(b) - Number(a));
    for (const v of versions) out.push(p.join(root, v, 'bin', exe));
  } else if (platform === 'linux') {
    const root = '/usr/lib/postgresql';
    const versions = listDir(root).filter((v) => /^\d+$/.test(v)).sort((a, b) => Number(b) - Number(a));
    for (const v of versions) out.push(p.join(root, v, 'bin', exe));
  }
  return out;
}

export interface PgTool {
  path: string;
  version: string;
  major: number;
}

export async function locatePgTool(tool: 'pg_dump' | 'pg_restore', minMajor = 0): Promise<PgTool> {
  const tried: string[] = [];
  let best: PgTool | null = null;
  for (const candidate of pgToolCandidates(tool)) {
    try {
      const { stdout } = await execFileAsync(candidate, ['--version']);
      const version = stdout.trim();
      const major = parseMajor(version.replace(/^.*\)\s*/, ''));
      if (major >= minMajor && (best === null || major > best.major)) best = { path: candidate, version, major };
    } catch {
      tried.push(candidate);
    }
  }
  if (best) return best;
  throw new Error(
    `${tool} (version majeure ≥ ${minMajor}) introuvable. Installez le client PostgreSQL ou définissez PG_BIN_DIR. ` +
      `Essayé : ${[...new Set(tried)].join(', ') || '(aucun candidat exécutable)'}`,
  );
}

// ─── Instantané (comptes exacts + journal des migrations) ────────────
export async function collectSnapshot(client: Client): Promise<Snapshot> {
  const tableRows = await client.query<{ nspname: string; relname: string }>(`
    SELECT n.nspname, c.relname
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relkind IN ('r', 'p')
      AND n.nspname NOT IN ('pg_catalog', 'information_schema')
      AND n.nspname NOT LIKE 'pg_toast%'
      AND NOT EXISTS (
        SELECT 1 FROM pg_depend d WHERE d.classid = 'pg_class'::regclass AND d.objid = c.oid AND d.deptype = 'e'
      )
    ORDER BY n.nspname, c.relname`);

  const tables: Record<string, number> = {};
  for (const row of tableRows.rows) {
    const qualified = `${client.escapeIdentifier(row.nspname)}.${client.escapeIdentifier(row.relname)}`;
    const result = await client.query<{ n: string }>(`SELECT count(*)::bigint AS n FROM ${qualified}`);
    tables[`${row.nspname}.${row.relname}`] = Number(result.rows[0].n);
  }

  let migrations: string[] = [];
  const hasJournal = await client.query<{ present: boolean }>(`SELECT to_regclass('public.__drizzle_migrations') IS NOT NULL AS present`);
  if (hasJournal.rows[0].present) {
    migrations = (await client.query<{ id: string }>('SELECT id FROM public.__drizzle_migrations ORDER BY id')).rows.map((r) => r.id);
  }
  return { tables, migrations };
}

// ─── Sauvegarde ──────────────────────────────────────────────────────
export interface BackupOptions {
  url: string;
  dir: string;
  log?: (message: string) => void;
}

export async function createBackup({ url, dir, log = () => {} }: BackupOptions): Promise<{ file: string; manifestFile: string; manifest: BackupManifest }> {
  const target = parseDbUrl(url);
  mkdirSync(dir, { recursive: true });

  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    const serverVersion = (await client.query<{ v: string }>('SHOW server_version')).rows[0].v;
    const dumpTool = await locatePgTool('pg_dump', parseMajor(serverVersion));

    // Transaction figée : l'instantané exporté est celui que pg_dump lit, et les comptes
    // de référence sont pris dans le même état → la comparaison ne dépend pas du trafic.
    await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    const snapshotId = (await client.query<{ id: string }>('SELECT pg_export_snapshot() AS id')).rows[0].id;
    const snapshot = await collectSnapshot(client);

    const file = path.join(dir, backupFileName(target.database));
    log(`pg_dump → ${file}`);
    const started = Date.now();
    await execFileAsync(
      dumpTool.path,
      ['--format=custom', '--compress=6', `--snapshot=${snapshotId}`, '--host', target.host, '--port', target.port, '--username', target.user, '--dbname', target.database, '--file', file],
      { env: pgEnv(target), maxBuffer: 16 * 1024 * 1024 },
    );
    const dumpDurationMs = Date.now() - started;
    await client.query('COMMIT');

    chmodSync(file, 0o600);
    const manifest: BackupManifest = {
      version: 1,
      createdAt: new Date().toISOString(),
      database: target.database,
      serverVersion,
      pgDump: dumpTool.version,
      file: path.basename(file),
      bytes: statSync(file).size,
      sha256: await sha256File(file),
      dumpDurationMs,
      snapshot,
    };
    const manifestFile = `${file}.json`;
    writeFileSync(manifestFile, `${JSON.stringify(manifest, null, 2)}\n`, { mode: 0o600 });
    return { file, manifestFile, manifest };
  } finally {
    await client.end().catch(() => {});
  }
}

// ─── Test de restauration ────────────────────────────────────────────
export interface RestoreDrillOptions {
  file: string;
  /** URL d'un serveur (n'importe quelle base) sur lequel créer la base jetable. */
  adminUrl: string;
  keep?: boolean;
  log?: (message: string) => void;
}

export interface RestoreDrillResult {
  ok: boolean;
  diffs: string[];
  scratch: string;
  restoreDurationMs: number;
  totalDurationMs: number;
  tables: number;
  rows: number;
}

export function loadManifest(file: string): BackupManifest {
  const manifestFile = `${file}.json`;
  if (!existsSync(manifestFile)) throw new Error(`Manifeste introuvable : ${manifestFile} (la sauvegarde a-t-elle été produite par db:backup ?)`);
  const manifest = JSON.parse(readFileSync(manifestFile, 'utf8')) as BackupManifest;
  if (manifest.version !== 1) throw new Error(`Version de manifeste non prise en charge : ${String(manifest.version)}`);
  return manifest;
}

export async function runRestoreDrill({ file, adminUrl, keep = false, log = () => {} }: RestoreDrillOptions): Promise<RestoreDrillResult> {
  const startedAt = Date.now();
  const manifest = loadManifest(file);

  const actualHash = await sha256File(file);
  if (actualHash !== manifest.sha256) throw new Error(`Somme de contrôle différente : sauvegarde corrompue ou modifiée (attendu ${manifest.sha256}, obtenu ${actualHash}).`);
  log('Somme de contrôle SHA-256 vérifiée.');

  const admin = parseDbUrl(adminUrl);
  const scratch = scratchDatabaseName();
  assertScratchName(scratch, admin.database);
  const scratchUrl = withDatabase(adminUrl, scratch);

  const adminClient = new Client({ connectionString: adminUrl });
  await adminClient.connect();
  let restoreDurationMs = 0;
  let diffs: string[] = [];
  let tables = 0;
  let rows = 0;
  try {
    const serverMajor = parseMajor((await adminClient.query<{ v: string }>('SHOW server_version')).rows[0].v);
    const restoreTool = await locatePgTool('pg_restore', serverMajor);

    log(`Création de la base jetable ${scratch}…`);
    try {
      await adminClient.query(`CREATE DATABASE ${adminClient.escapeIdentifier(scratch)}`);
    } catch (error) {
      if ((error as { code?: string }).code === '42501') throw new Error("Droit CREATEDB manquant pour l'utilisateur de RESTORE_TEST_ADMIN_URL / DATABASE_URL.");
      throw error;
    }

    try {
      log('pg_restore…');
      const restoreStarted = Date.now();
      await execFileAsync(
        restoreTool.path,
        ['--no-owner', '--no-acl', '--exit-on-error', '--host', admin.host, '--port', admin.port, '--username', admin.user, '--dbname', scratch, file],
        { env: pgEnv(admin), maxBuffer: 16 * 1024 * 1024 },
      );
      restoreDurationMs = Date.now() - restoreStarted;

      const scratchClient = new Client({ connectionString: scratchUrl });
      await scratchClient.connect();
      try {
        const actual = await collectSnapshot(scratchClient);
        diffs = compareSnapshots(manifest.snapshot, actual);
        tables = Object.keys(actual.tables).length;
        rows = Object.values(actual.tables).reduce((sum, n) => sum + n, 0);
      } finally {
        await scratchClient.end().catch(() => {});
      }
    } finally {
      if (!keep) {
        assertScratchName(scratch, admin.database);
        await adminClient.query(`DROP DATABASE IF EXISTS ${adminClient.escapeIdentifier(scratch)} WITH (FORCE)`);
        log(`Base jetable ${scratch} supprimée.`);
      } else {
        log(`Base jetable conservée : ${scratch}`);
      }
    }
  } finally {
    await adminClient.end().catch(() => {});
  }

  return { ok: diffs.length === 0, diffs, scratch, restoreDurationMs, totalDurationMs: Date.now() - startedAt, tables, rows };
}
