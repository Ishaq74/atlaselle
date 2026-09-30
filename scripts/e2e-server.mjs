/**
 * E2E preview server launcher (Playwright webServer).
 *
 * Root cause this works around — Astro >= 7.2 `astro preview` auto-detects
 * "agentic" terminals (am-i-vibing: TERM_PROGRAM=vscode, etc.) and forks
 * itself into a DETACHED background daemon:
 *
 *   node_modules/astro/dist/cli/preview/index.js
 *     const agentDetected = !process.env.ASTRO_PREVIEW_BACKGROUND && isRunByAgent();
 *     const wantsBackground = !!flags.background || agentDetected;
 *
 * The foreground process then exits immediately, so Playwright's webServer
 * probe reports "Process from config.webServer exited early" / times out,
 * while the untracked daemon keeps holding port 4322.
 *
 * The official opt-out is the ASTRO_PREVIEW_BACKGROUND env var (any value),
 * but it does NOT reliably reach the astro process through the pnpm script
 * chain (`pnpm preview` -> pnpm shim -> astro). This script therefore spawns
 * the astro CLI entrypoint DIRECTLY (`node node_modules/astro/bin/astro.mjs`)
 * with the variable forced into the child environment — no shell, no pnpm
 * shim, no propagation ambiguity.
 *
 * It also performs pre-flight cleanup: kills any orphaned listener on the
 * E2E port (leftover daemon from a previous run) and removes the stale
 * .astro/preview.json lock, so a crashed earlier run can never block tests.
 *
 * ## Isolation entre voies (E2E_LANE)
 *
 * `.astro/preview.json` est un lock PARTAGÉ : il ne décrit qu'un seul serveur.
 * En mode voie, le tuer reviendrait à tuer le serveur d'une autre voie (risque
 * R4). La manipulation du lock est donc désactivée dès que `E2E_LANE` est
 * défini ; seul le nettoyage par PORT reste actif, et il est sans danger car
 * chaque voie écoute sur un port distinct.
 */

import { spawn, execSync } from 'node:child_process';
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Port d'écoute.
 *
 * Surchargeable par `E2E_PORT` : l'orchestrateur `scripts/qa.mjs` donne à chaque
 * voie son propre port (4322, 4323, 4324…), sinon deux voies se disputeraient le
 * même bind et la seconde tuerait le serveur de la première. Sans variable, le
 * comportement est inchangé : 4322.
 */
const PORT = Number(process.env.E2E_PORT ?? 4322);
const HOST = 'localhost';
/**
 * Voie courante (nom de lane). Vide en exécution simple.
 * Quand il est défini, le lock partagé `.astro/preview.json` n'est pas touché.
 */
const LANE = process.env.E2E_LANE ?? '';
const PREVIEW_LOCK = resolve('.astro/preview.json');
const COMPRESSED_SERVER = resolve('scripts/serve-compressed.mjs');

function killPid(pid, reason) {
  try {
    process.kill(pid, 'SIGTERM');
    console.log(`[e2e-server] killed leftover process ${pid} (${reason})`);
  } catch {
    // Already dead — fine.
  }
}

/**
 * Free the E2E port and remove any stale preview lock from a previous run.
 *
 * Le lock `.astro/preview.json` est SAUF en mode voie : il est partagé par toutes
 * les voies, et tuer le PID qu'il contient reviendrait à arrêter le serveur
 * d'une autre voie. Le nettoyage par port, lui, reste toujours actif et reste
 * sûr puisque chaque voie a son propre port.
 */
function preflightCleanup() {
  if (LANE === '' && existsSync(PREVIEW_LOCK)) {
    try {
      const lock = JSON.parse(readFileSync(PREVIEW_LOCK, 'utf8'));
      if (lock && typeof lock.pid === 'number' && lock.pid !== process.pid) {
        killPid(lock.pid, 'stale .astro/preview.json lock');
      }
    } catch {
      // Unreadable lock — just delete it.
    }
    rmSync(PREVIEW_LOCK, { force: true });
  } else if (LANE !== '') {
    console.log(`[e2e-server] voie « ${LANE} » : lock .astro/preview.json laissé intact (partagé)`);
  }

  if (process.platform === 'win32') {
    try {
      const out = execSync('netstat -ano -p tcp', { encoding: 'utf8' });
      const pids = new Set();
      for (const line of out.split('\n')) {
        // e.g. "  TCP    127.0.0.1:4322    0.0.0.0:0    LISTENING    12568"
        if (line.includes(`:${PORT}`) && line.includes('LISTENING')) {
          const pid = Number(line.trim().split(/\s+/).pop());
          if (Number.isInteger(pid) && pid > 0 && pid !== process.pid) pids.add(pid);
        }
      }
      for (const pid of pids) killPid(pid, `orphan listening on port ${PORT}`);
    } catch {
      // netstat unavailable — the spawn below will fail loudly if the port is taken.
    }
  }
}

preflightCleanup();

const child = spawn(
  process.execPath, // current node binary
  // Compressed SSR server (gzip) — no astro CLI, so no background
  // daemonization possible; ASTRO_PREVIEW_BACKGROUND stays as a safeguard.
  [COMPRESSED_SERVER],
  {
    stdio: 'inherit',
    env: {
      ...process.env,
      NODE_ENV: 'test',
      // Official Astro opt-out from the background-daemon mode. Forced here,
      // directly in the child environment — bypasses the pnpm shim chain.
      ASTRO_PREVIEW_BACKGROUND: '0',
      TRUST_PROXY: 'true',
      HOST,
      PORT: String(PORT),
      // En mode voie, better-auth doit connaître l'ORIGINE réellement servie,
      // sinon il rejettera les requêtes mutantes (Origin / CSRF) comme provenant
      // d'une origine étrangère (risque R5). En exécution simple on ne touche à
      // rien : BETTER_AUTH_URL reste celui de l'environnement, donc exactement
      // le comportement d'avant.
      ...(LANE !== '' ? { BETTER_AUTH_URL: `http://${HOST}:${PORT}` } : {}),
    },
  },
);

// Playwright kills the webServer process when done; make sure the astro
// child never outlives us (no orphan daemon squatting the port afterwards).
const shutdown = () => {
  if (!child.killed) child.kill('SIGTERM');
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
process.on('exit', shutdown);

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
  } else {
    process.exit(code ?? 1);
  }
});
