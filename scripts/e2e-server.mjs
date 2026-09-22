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
 */

import { spawn, execSync } from 'node:child_process';
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';

const PORT = 4322;
const HOST = 'localhost';
const PREVIEW_LOCK = resolve('.astro/preview.json');
const ASTRO_BIN = resolve('node_modules/astro/bin/astro.mjs');

function killPid(pid, reason) {
  try {
    process.kill(pid, 'SIGTERM');
    console.log(`[e2e-server] killed leftover process ${pid} (${reason})`);
  } catch {
    // Already dead — fine.
  }
}

/** Free the E2E port and remove any stale preview lock from a previous run. */
function preflightCleanup() {
  if (existsSync(PREVIEW_LOCK)) {
    try {
      const lock = JSON.parse(readFileSync(PREVIEW_LOCK, 'utf8'));
      if (lock && typeof lock.pid === 'number' && lock.pid !== process.pid) {
        killPid(lock.pid, 'stale .astro/preview.json lock');
      }
    } catch {
      // Unreadable lock — just delete it.
    }
    rmSync(PREVIEW_LOCK, { force: true });
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
  [ASTRO_BIN, 'preview', '--host', HOST, '--port', String(PORT)],
  {
    stdio: 'inherit',
    env: {
      ...process.env,
      NODE_ENV: 'test',
      // Official Astro opt-out from the background-daemon mode. Forced here,
      // directly in the child environment — bypasses the pnpm shim chain.
      ASTRO_PREVIEW_BACKGROUND: '0',
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
