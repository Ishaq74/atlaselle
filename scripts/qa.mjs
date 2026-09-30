#!/usr/bin/env node
/**
 * Cross-platform QA orchestrator (single entry point for `pnpm qa` / `qa:offline`).
 *
 * Goals:
 *  1. Keep check / build / lint VISIBLE — every command runs with stdio:'inherit'
 *     so its output is printed live in the terminal (nothing is hidden in a script).
 *  2. Persist a report file for EVERY gate, not just tests:
 *       - tests/reports/check-report.txt   (astro check)
 *       - tests/reports/lint-report.txt    (eslint)
 *       - tests/reports/vitest-report.txt  (unit/integration)
 *       - tests/reports/playwright-report.txt (e2e, full mode)
 *       - tests/reports/pa11y-report.txt + lighthouse-report.txt (a11y, full mode)
 *       - tests/reports/qa-report.txt + qa-report.json (global aggregator)
 *  3. Fix the stale-report bug: previously `pnpm test && pnpm test:report` would
 *     short-circuit test:report when tests failed, leaving a fresh JSON next to a
 *     stale TXT. Here every report is regenerated right after its source, even on
 *     failure. The run still exits non-zero if any gate fails.
 *  4. **Never touch the development database.** Every stage that needs a database
 *     (Vitest, each E2E lane, a11y) runs against its own disposable clone
 *     `atlaselle_qa_*`, provisioned once by `scripts/qa-db.mjs` and dropped in a
 *     `finally`.
 *  5. **Run the E2E browsers in parallel**, one lane per browser. The wall-clock
 *     time becomes the slowest lane (Firefox ≈ 18 min) instead of the sum of the
 *     three (≈ 45 min). Scenarios are never split, so no test is cut in half —
 *     see `scripts/qa-lanes.mjs` for why sharding by test file was rejected.
 *
 * Usage:
 *   node scripts/qa.mjs offline            # check + build + lint + vitest + reports
 *   node scripts/qa.mjs full               # + e2e lanes + a11y + reports
 *   node scripts/qa.mjs full --lanes=2     # 2 lanes instead of 3
 *   node scripts/qa.mjs full --serial      # 1 lane: historical behaviour
 *   node scripts/qa.mjs full --only=firefox
 *   node scripts/qa.mjs full --keep-dbs    # keep atlaselle_qa_* for debugging
 *
 * Escape hatch: `--serial` (or `--lanes=1`) reproduces the old sequential run.
 */

import { spawn, spawnSync } from 'node:child_process';
import { writeFileSync, mkdirSync, rmSync, appendFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import process from 'node:process';
import { createRequire } from 'node:module';
import path from 'node:path';
import { config as loadDotenv } from 'dotenv';
import { buildLanes, describeLanes, laneDbName, VITEST_LANE, A11Y_LANE } from './qa-lanes.mjs';
import { activeDbEnv, laneEnv, sourceUrl } from './qa-db-url.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const REPORTS_DIR = resolve(ROOT, 'tests/reports');
const QA_DIR = resolve(REPORTS_DIR, 'qa');
const LOGS_DIR = resolve(QA_DIR, 'logs');
const require = createRequire(import.meta.url);

// Le pipeline a besoin de connaître la base source (DB_ENV → DATABASE_URL_<ENV>)
// pour dériver les URLs des bases jetables. Les sous-commandes `pnpm …` chargent
// .env chacune de leur côté, mais pas ce processus parent : il faut donc le
// charger ici. `dotenv` n'écrase pas les variables déjà présentes.
loadDotenv({ path: path.join(ROOT, '.env') });

mkdirSync(REPORTS_DIR, { recursive: true });

// ── Arguments ────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const positional = argv.find((a) => !a.startsWith('-'));
const mode = positional === 'full' ? 'full' : 'offline';
const offline = mode === 'offline';

const flagValue = (name) => {
  const hit = argv.find((a) => a === `--${name}` || a.startsWith(`--${name}=`));
  if (!hit) return undefined;
  return hit.includes('=') ? hit.split('=').slice(1).join('=') : true;
};

const serial = argv.includes('--serial');
const requestedLanes = serial ? 1 : Number(flagValue('lanes') ?? 3);
const only = typeof flagValue('only') === 'string' ? flagValue('only') : undefined;
const keepDbs = flagValue('keep-dbs') === true || flagValue('keep-dbs') === 'true';

const lanes = buildLanes({ lanes: requestedLanes, only });
const laneNames = lanes.map((l) => l.name);

// ── Helpers ──────────────────────────────────────────────────────────────────
const hr = '═'.repeat(82);

/** Run a command with live output. Returns its exit code. */
function run(cmd, extraEnv = {}) {
  console.log(`\n${hr}\n▶ ${cmd}\n${hr}`);
  const result = spawnSync(cmd, {
    cwd: ROOT,
    stdio: 'inherit',
    env: { ...process.env, ...extraEnv },
    shell: true,
  });
  return typeof result.status === 'number' ? result.status : 1;
}

/** Run a command and capture its combined output to a report file. Returns exit code. */
function runCaptured(cmd, outFile, extraEnv = {}) {
  console.log(`\n${hr}\n▶ ${cmd}  →  ${outFile}\n${hr}`);
  const result = spawnSync(cmd, {
    cwd: ROOT,
    encoding: 'utf8',
    env: { ...process.env, ...extraEnv },
    shell: true,
  });
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
  writeFileSync(outFile, output, 'utf-8');
  return typeof result.status === 'number' ? result.status : 1;
}

/** Run a Node script (no shell) — portable on Windows, unlike `pnpm` via shim. */
function runNodeScript(scriptRelPath, args = [], extraEnv = {}) {
  const result = spawnSync(process.execPath, [resolve(ROOT, scriptRelPath), ...args], {
    cwd: ROOT,
    stdio: 'inherit',
    env: { ...process.env, ...extraEnv },
  });
  return typeof result.status === 'number' ? result.status : 1;
}

/**
 * Résout le CLI Playwright de façon portable.
 * `require.resolve('playwright')` échoue avec pnpm et `@playwright/test/cli.js`
 * n'est pas exporté : on passe par le point d'entrée, dont cli.js est le voisin.
 */
function playwrightCli() {
  const main = require.resolve('@playwright/test');
  return resolve(dirname(main), 'cli.js');
}

/** Tue un arbre de processus (Windows : taskkill /T /F ; ailleurs : groupes). */
function killTree(pid) {
  try {
    if (process.platform === 'win32') {
      spawnSync('taskkill', ['/pid', String(pid), '/T', '/F'], { stdio: 'ignore' });
    } else {
      process.kill(-pid, 'SIGTERM');
    }
  } catch {
    /* déjà mort */
  }
}

/** PIDs des voies en cours, pour un arrêt propre sur Ctrl+C. */
const runningLanes = new Set();
let interrupted = false;

function onInterrupt(signal) {
  if (interrupted) return;
  interrupted = true;
  console.error(`\n[qa] ${signal} reçu — arrêt des voies en cours…`);
  for (const pid of runningLanes) killTree(pid);
  if (!keepDbs) {
    console.error('[qa] nettoyage des bases atlaselle_qa_*…');
    runNodeScript('scripts/qa-db.mjs', ['drop']);
  }
  process.exit(130);
}

process.on('SIGINT', () => onInterrupt('SIGINT'));
process.on('SIGTERM', () => onInterrupt('SIGTERM'));

/**
 * Lance une voie E2E.
 *
 * Chaque voie écrit son rapport `blob` dans SON sous-dossier (obligatoire : le
 * reporter blob vide son outputDir au démarrage, donc deux voies partageant un
 * dossier s'effaceraient). La sortie complète est dans
 * `tests/reports/qa/logs/<voie>.log`, le terminal ne montre que des lignes
 * préfixées pour ne pas mélanger trois flux.
 */
function runLane(lane) {
  const logFile = resolve(LOGS_DIR, `${lane.name}.log`);
  mkdirSync(dirname(logFile), { recursive: true });
  writeFileSync(logFile, '', 'utf-8');

  const projectArgs = lane.projects.flatMap((p) => ['--project', p]);

  // AUCUN `--reporter` en ligne de commande : le flag CLI REMPLACERait le tableau
  // `reporter` de playwright.config.ts, et donc notre `outputDir` par voie — le
  // blob irait dans `blob-report/` et les voies s'écraseraient. C'est
  // E2E_BLOB=1 qui déclenche le reporter blob configuré.
  const args = [playwrightCli(), 'test', ...projectArgs];

  console.log(
    `[${lane.name}] ▶ ${lane.projects.join(', ')} sur le port ${lane.port} (base ${laneDbName(lane.name)})`
  );

  return new Promise((resolveLane) => {
    const child = spawn(process.execPath, args, {
      cwd: ROOT,
      env: {
        ...process.env,
        E2E_LANE: lane.name,
        E2E_PORT: String(lane.port),
        E2E_BLOB: '1',
        // Chemin RELATIF : playwright.config.ts le résout depuis la racine du
        // dépôt, et concatène le nom de la voie pour obtenir un dossier unique.
        E2E_BLOB_DIR: 'tests/reports/qa/playwright/blob',
        // Le build a déjà été fait une fois par ce pipeline ; le rejouer dans
        // chaque voie coûterait ~30 s × N et servirait le même dist/.
        E2E_SKIP_BUILD: '1',
        // Chaque voie a SA propre base : c'est ce qui empêche deux voies de se
        // supprimer mutuellement `e2e-seed@test.com` (global-setup le recrée).
        // `laneEnvFor` conserve le DB_ENV du développeur et ne surcharge que
        // l'URL — jamais de DATABASE_URL_LOCAL en dur.
        ...laneEnvFor(lane.name),
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    runningLanes.add(child.pid);
    const started = Date.now();
    let pending = '';

    const relay = (chunk) => {
      appendFileSync(logFile, chunk);
      pending += chunk;
      const lines = pending.split(/\r?\n/);
      pending = lines.pop() ?? '';
      for (const line of lines) {
        // On ne remonte que ce qui est utile en direct : progression et erreurs.
        if (/^\s*(\d+\)|✓|✘|Error|Running \d+|passed|failed|skipped)/.test(line) || /›/.test(line)) {
          console.log(`[${lane.name}] ${line}`);
        }
      }
    };

    child.stdout.on('data', relay);
    child.stderr.on('data', relay);

    const finish = (code) => {
      if (pending) appendFileSync(logFile, pending);
      runningLanes.delete(child.pid);
      const seconds = Math.round((Date.now() - started) / 60);
      console.log(`[${lane.name}] terminé en ${seconds} min (code ${code}) — log : ${logFile}`);
      resolveLane(code);
    };

    child.on('error', (err) => {
      console.error(`[${lane.name}] impossible de démarrer : ${err.message}`);
      finish(1);
    });
    child.on('close', (code) => finish(typeof code === 'number' ? code : 1));
  });
}

// ── Nettoyage ────────────────────────────────────────────────────────────────
rmSync(resolve(QA_DIR, 'playwright'), { recursive: true, force: true });
mkdirSync(LOGS_DIR, { recursive: true });

const qaDb = (...args) => runNodeScript('scripts/qa-db.mjs', args);

// ── 1) Gates de validation (visibles + captés) ──────────────────────────────
const checkCode = runCaptured('pnpm check', resolve(REPORTS_DIR, 'check-report.txt'));
const buildCode = run('pnpm build');
const lintCode = runCaptured('pnpm lint', resolve(REPORTS_DIR, 'lint-report.txt'));

// ── 2) Unit + integration sur une base jetable ───────────────────────────────
// MÊME EN MODE OFFLINE : les tests unitaires écrivent en base, donc ils doivent
// tourner sur un clone jetable. Ne pas provisionner ici reviendrait à faire
// pointer Vitest vers une base `atlaselle_qa_unit` inexistante.
const dbLanes = offline ? [VITEST_LANE] : [...laneNames, VITEST_LANE, A11Y_LANE];
console.log(`\n${hr}\n▶ provisionnement des bases QA : ${dbLanes.join(', ')}\n${hr}`);
console.log(
  `  source : DB_ENV=${activeDbEnv()} → ${new URL(sourceUrl()).pathname.slice(1)} (jamais modifiée)`
);
const dbPrepared = qaDb('prepare', `--lanes=${dbLanes.join(',')}`) === 0;

const testCode = runCaptured('pnpm test -- --coverage', resolve(REPORTS_DIR, 'test-report.txt'), laneEnvFor(VITEST_LANE));
run('pnpm test:report'); // ALWAYS regenerate vitest-report.txt from JSON

// ── 3) E2E + accessibilité (mode full uniquement) ───────────────────────────
let e2eCode = 0;
if (!offline) {
  if (dbPrepared) {
    console.log(`\n${hr}\n▶ E2E — ${lanes.length} voie(s) en parallèle\n${hr}\n${describeLanes(lanes)}`);
    const results = await Promise.all(lanes.map((lane) => runLane(lane)));
    e2eCode = results.find((c) => c !== 0) ?? 0;

    // Fusion des rapports blob. --expect : si une voie n'a rien produit, on
    // refuse de fabriquer un rapport « vert » mais incomplet.
    const mergeCode = runNodeScript('scripts/merge-playwright-blobs.mjs', [
      `--expect=${lanes.length}`,
      `--root=${resolve(QA_DIR, 'playwright/blob')}`,
    ]);
    if (mergeCode !== 0) e2eCode = e2eCode || mergeCode;
  } else {
    console.error('[qa] provisionnement des bases impossible : E2E annulé proprement.');
    e2eCode = 1;
  }

  run('pnpm test:e2e:report'); // ALWAYS regenerate playwright-report.txt

  // a11y TOUT SEUL : les scores Lighthouse sont faussés par la charge CPU, et
  // tests/a11y/run.cjs tue tout ce qui écoute sur 4321 (jamais un port de voie).
  console.log('\n[qa] accessibilité — en solo, sur sa propre base jetable');
  // `run` et non `runCaptured` : tests/a11y/run.cjs écrit déjà ses propres
  // rapports (pa11y, lighthouse). Aucun fichier supplémentaire n'est nécessaire.
  run('pnpm a11y', laneEnvFor(A11Y_LANE));
}

// ── 4) Rapport global ────────────────────────────────────────────────────────
const reportCode = run(`pnpm qa:report${offline ? ' --scope=offline' : ''}`);

// ── 5) Nettoyage des bases (toujours, même en cas d'échec ou d'interruption) ─
if (dbPrepared && !keepDbs) {
  console.log(`\n${hr}\n▶ suppression des bases QA jetables\n${hr}`);
  qaDb('drop');
}

// ── 6) Verdict ───────────────────────────────────────────────────────────────
const gateCode = [checkCode, buildCode, lintCode].find((c) => c !== 0) ?? 0;
const finalCode =
  gateCode !== 0
    ? gateCode
    : testCode !== 0
      ? testCode
      : offline
        ? reportCode
        : e2eCode !== 0
          ? e2eCode
          : reportCode;

console.log(`\n${hr}`);
console.log(
  `${finalCode === 0 ? '✅ QA PASSED' : '❌ QA FAILED'} (exit ${finalCode})` +
    `  [check:${checkCode} build:${buildCode} lint:${lintCode} test:${testCode}` +
    `${offline ? '' : ` e2e:${e2eCode} (${lanes.length} voie(s))`} report:${reportCode}]`,
);
console.log(hr);
process.exit(finalCode);

/**
 * Variables d'environnement pointant un sous-processus sur une base jetable.
 *
 * On conserve le `DB_ENV` du développeur et on ne surcharge que la variable
 * d'URL correspondante : forcer `DB_ENV=LOCAL` ferait travailler la QA sur une
 * autre base que celle que l'application utilise réellement.
 */
function laneEnvFor(name) {
  return laneEnv(laneDbName(name));
}
