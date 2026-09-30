#!/usr/bin/env node
/**
 * Provisionnement des bases jetables de la QA (`atlaselle_qa_*`).
 *
 * ## Pourquoi
 *
 * Historiquement `pnpm qa` s'exécutait contre la base de développement : les tests
 * E2E y créaient puis supprimaient `e2e-seed@test.com`, et les specs qui laissent
 * des fixtures polluaient les données du développeur. Multiplier les « voies » E2E
 * en parallèle aggrave le problème : plusieurs voies se disputeraient le même
 * utilisateur et le même préfixe `e2e-*`.
 *
 * Solution : une base **modèle** (migrate + infra + seed exécutés une seule fois)
 * puis un clone PostgreSQL par voie (`CREATE DATABASE … TEMPLATE …`), ce qui est
 * quasi instantané — on ne rejoue pas le seed (> 50 fichiers de données) à chaque
 * fois. La base de développement n'est jamais lue ni écrite par ce script : on en
 * dérive seulement l'URL (credentials, serveur, port).
 *
 * ## Garde-fous (invariants non négociables)
 *
 *  1. Toute base ciblée passe la liste blanche `^atlaselle_qa_[a-z0-9_]+$`,
 *     vérifiée AVANT tout SQL.
 *  2. On refuse de cibler une base réellement utilisée (celle de DB_ENV, ou
 *     l'une des variables DATABASE_URL_LOCAL / _TEST / _PROD).
 *  3. Aucun `DROP` sur un nom hors liste blanche.
 *  4. Un verrou (`tests/reports/qa/.lock`, PID) empêche deux `qa-db` simultanés
 *     de se supprimer mutuellement les bases.
 *
 * ## Usage
 *
 *   node scripts/qa-db.mjs prepare [--lanes=chromium,firefox,webkit] [--keep]
 *   node scripts/qa-db.mjs drop
 *   node scripts/qa-db.mjs status
 */

import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { config as loadDotenv } from 'dotenv';
import {
  activeDbEnv,
  configuredDbNames,
  sourceUrl,
  adminUrl,
  urlForDb,
  laneEnv,
} from './qa-db-url.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const require = createRequire(import.meta.url);

loadDotenv({ path: path.join(ROOT, '.env') });

const { default: pg } = await import('pg');

// ── Constantes ───────────────────────────────────────────────────────────────
const PREFIX = 'atlaselle_qa_';
const NAME_RE = /^atlaselle_qa_[a-z0-9_]+$/;
const TEMPLATE_DB = `${PREFIX}template`;
const DEFAULT_LANES = ['chromium', 'firefox', 'webkit', 'unit', 'a11y'];
const LOCK_FILE = path.join(ROOT, 'tests', 'reports', 'qa', '.lock');

const log = (msg) => console.log(`[qa-db] ${msg}`);

function fail(msg) {
  console.error(`[qa-db] ERREUR : ${msg}`);
  releaseLock();
  process.exit(1);
}

// ── Arguments ────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const command = argv.find((a) => !a.startsWith('-')) ?? 'status';
const flagOf = (name) => {
  const hit = argv.find((a) => a === `--${name}` || a.startsWith(`--${name}=`));
  if (!hit) return undefined;
  return hit.includes('=') ? hit.split('=').slice(1).join('=') : 'true';
};

const keepDbs = flagOf('keep') === 'true';
const lanes = (flagOf('lanes') ?? DEFAULT_LANES.join(','))
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

// ── Dérivation des URLs ──────────────────────────────────────────────────────
// Toute la logique de résolution vit dans scripts/qa-db-url.mjs, afin d'appliquer
// exactement la même règle que src/database/env.ts : `DB_ENV` puis
// `DATABASE_URL_<ENV>`. Hardcoder DATABASE_URL_LOCAL serait un bug.

// ── Garde-fous ───────────────────────────────────────────────────────────────
/** Garde-fou 1 + 2 : nom conforme à la liste blanche ET non protégé. */
function assertName(dbName) {
  if (!NAME_RE.test(dbName)) {
    fail(`nom de base hors liste blanche : « ${dbName} » (attendu : ${NAME_RE.source})`);
  }
  const used = configuredDbNames();
  if (used.has(dbName)) {
    fail(`refus catégorique : « ${dbName} » est une base réellement utilisée (${[...used].join(', ')})`);
  }
}

// ── Connexion ────────────────────────────────────────────────────────────────
async function connect(connectionString = adminUrl()) {
  const client = new pg.Client({ connectionString });
  await client.connect();
  return client;
}

async function listQaDatabases(client) {
  const { rows } = await client.query(
    "select datname from pg_database where datname like 'atlaselle\\_qa\\_%' escape '\\' order by 1"
  );
  return rows.map((r) => r.datname);
}

async function dropDatabase(client, dbName) {
  assertName(dbName);
  log(`suppression ${dbName}`);
  await client.query(`drop database if exists "${dbName}" with (force)`);
}

async function dropAll(client) {
  const databases = await listQaDatabases(client);
  if (databases.length === 0) {
    log('aucune base atlaselle_qa_* à supprimer');
    return 0;
  }
  for (const dbName of databases) await dropDatabase(client, dbName);
  log(`${databases.length} base(s) supprimée(s)`);
  return databases.length;
}

// ── Verrou de run ────────────────────────────────────────────────────────────
function pidAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function acquireLock() {
  if (existsSync(LOCK_FILE)) {
    const pid = Number(readFileSync(LOCK_FILE, 'utf8').trim().split('\n')[0]);
    if (Number.isFinite(pid) && pid !== process.pid && pidAlive(pid)) {
      fail(
        `un autre qa-db est déjà en cours (PID ${pid}). Les bases ${PREFIX}* sont ` +
          `partagées : deux runs simultanés se supprimeraient mutuellement.`
      );
    }
  }
  mkdirSync(path.dirname(LOCK_FILE), { recursive: true });
  writeFileSync(LOCK_FILE, `${process.pid}\n${new Date().toISOString()}\n`, 'utf8');
}

function releaseLock() {
  try {
    if (!existsSync(LOCK_FILE)) return;
    const pid = Number(readFileSync(LOCK_FILE, 'utf8').trim().split('\n')[0]);
    if (pid === process.pid) rmSync(LOCK_FILE, { force: true });
  } catch {
    /* sera nettoyé au prochain run */
  }
}

// ── Scripts de base ( lancés via process.execPath : portable Windows ) ────────
function runNodeScript(scriptRelPath, dbName, label) {
  let tsxCli;
  try {
    tsxCli = require.resolve('tsx/cli');
  } catch {
    fail('tsx introuvable (dépendance de développement manquante ?)');
  }

  const started = Date.now();
  const result = spawnSync(process.execPath, [tsxCli, path.join(ROOT, scriptRelPath)], {
    cwd: ROOT,
    stdio: 'inherit',
    // `src/database/env.ts` charge .env SANS override : l'environnement du
    // processus l'emporte. On garde le DB_ENV du développeur et on ne
    // surcharge que la variable d'URL de cet env — forcer `DB_ENV=LOCAL`
    // ferait travailler la QA sur une autre base que l'application.
    env: { ...process.env, ...laneEnv(dbName) },
  });

  const seconds = ((Date.now() - started) / 1000).toFixed(1);
  if (result.status !== 0) fail(`${label} a échoué (code ${result.status}) après ${seconds}s`);
  log(`${label} terminé en ${seconds}s`);
}

// ── Commandes ────────────────────────────────────────────────────────────────
async function cmdDrop() {
  const client = await connect();
  try {
    await dropAll(client);
  } finally {
    await client.end();
  }
}

async function cmdStatus() {
  const client = await connect();
  try {
    const databases = await listQaDatabases(client);
    log(`bases ${PREFIX}* : ${databases.length ? databases.join(', ') : '(aucune)'}`);
    log(
      `source (jamais modifiée) : DB_ENV=${activeDbEnv()} → ${new URL(sourceUrl()).pathname.slice(1)}`
    );
    log(`verrou : ${existsSync(LOCK_FILE) ? readFileSync(LOCK_FILE, 'utf8').trim().split('\n')[0] : '(aucun)'}`);
  } finally {
    await client.end();
  }
}

async function cmdPrepare() {
  acquireLock();
  const client = await connect();

  // Un run précédent interrompu a pu laisser des bases : on repart de zéro.
  await dropAll(client);

  try {
    log(
      `source (jamais modifiée) : DB_ENV=${activeDbEnv()} → ${new URL(sourceUrl()).pathname.slice(1)}`
    );

    log(`création de ${TEMPLATE_DB}`);
    await client.query(`create database "${TEMPLATE_DB}"`);
    assertName(TEMPLATE_DB);

    runNodeScript('src/database/commands/db.migrate.ts', TEMPLATE_DB, 'migrate');
    runNodeScript('src/database/commands/db.infra.ts', TEMPLATE_DB, 'infra');
    runNodeScript('src/database/commands/db.seed.ts', TEMPLATE_DB, 'seed');

    // CREATE DATABASE … TEMPLATE échoue si une session est encore connectée au
    // modèle (le processus seed vient de sortir, mais on ne fait pas confiance).
    await client.query(
      `select pg_terminate_backend(pid) from pg_stat_activity
        where datname = $1 and pid <> pg_backend_pid()`,
      [TEMPLATE_DB]
    );

    const cloneStarted = Date.now();
    for (const lane of lanes) {
      const dbName = `${PREFIX}${lane}`;
      assertName(dbName);
      await client.query(`create database "${dbName}" template "${TEMPLATE_DB}"`);
      log(`clone ${dbName}`);
    }
    log(`${lanes.length} clone(s) en ${((Date.now() - cloneStarted) / 1000).toFixed(1)}s`);

    await verifyClone(`${PREFIX}${lanes[0]}`);

    await dropDatabase(client, TEMPLATE_DB);
    log(`${TEMPLATE_DB} supprimée après clonage`);

    log('bases prêtes :');
    for (const lane of lanes) log(`  ${PREFIX}${lane}`);
  } catch (err) {
    console.error(`[qa-db] échec du provisionnement : ${err?.message ?? err}`);
    await dropAll(client).catch(() => {});
    await client.end();
    releaseLock();
    process.exit(1);
  }

  await client.end();
  releaseLock();
}

/** Vérifie qu'un clone est opérationnel : tables présentes + données seedées. */
async function verifyClone(dbName) {
  const target = await connect(urlForDb(dbName));
  try {
    const { rows } = await target.query(
      `select
         (select count(*)::int from information_schema.tables
           where table_schema = 'public') as tables,
         (select count(*)::int from pages) as pages`
    );
    const { tables, pages } = rows[0];
    if (tables === 0) throw new Error(`le clone ${dbName} ne contient aucune table`);
    if (pages === 0) throw new Error(`le clone ${dbName} ne contient aucune page seedée`);
    log(`contrôle ${dbName} : ${tables} tables, ${pages} pages seedées`);
  } finally {
    await target.end();
  }
}

// ── Garde-fous signaux : interrupted prepare must not leave orphan DBs ────────
// (P3.7) Sans cela, un Ctrl+C pendant le seed laisserait un modèle à moitié
// peuplé et les clones d'un run précédent traîneraient.
if (command === 'prepare' && !keepDbs) {
  let interrupted = false;
  const onSignal = (signal) => {
    if (interrupted) return;
    interrupted = true;
    console.error(`\n[qa-db] ${signal} reçu — nettoyage des bases ${PREFIX}*`);
    const cleanup = spawnSync(process.execPath, [path.join(__dirname, 'qa-db.mjs'), 'drop'], {
      cwd: ROOT,
      stdio: 'inherit',
    });
    process.exit(cleanup.status === 0 ? 130 : 1);
  };
  process.on('SIGINT', () => onSignal('SIGINT'));
  process.on('SIGTERM', () => onSignal('SIGTERM'));
  process.on('uncaughtException', (err) => {
    console.error(`[qa-db] exception non rattrapée : ${err?.message ?? err}`);
    onSignal('uncaughtException');
  });
}

// ── Point d'entrée ───────────────────────────────────────────────────────────
switch (command) {
  case 'prepare':
    await cmdPrepare();
    break;
  case 'drop':
    await cmdDrop();
    releaseLock();
    break;
  case 'status':
    await cmdStatus();
    releaseLock();
    break;
  default:
    fail(`commande inconnue : « ${command} » (attendu : prepare | drop | status)`);
}
