#!/usr/bin/env node
/**
 * Fusionne les rapports Playwright `blob` produits par plusieurs voies.
 *
 * ## Pourquoi ce script existe
 *
 * Deux contraintes de l'outillage Playwright 1.63 se contredisent :
 *
 *  1. le reporter `blob` **vide son `outputDir` au démarrage** — deux voies qui
 *     partagent le même dossier s'effacent mutuellement ;
 *  2. `playwright merge-reports` **ne cherche pas récursivement** les `.zip`,
 *     il en attend tous dans un seul dossier plat.
 *
 * D'où la solution retenue : chaque voie écrit dans son propre sous-dossier
 * (`<blobRoot>/<lane>/report.zip`, voir `playwright.config.ts`), et ce script
 * rassemble les blobs dans un dossier plat avant de lancer la fusion.
 *
 * ## Garde-fou anti-faux-positif
 *
 * Si une voie échoue, se fait annuler, ou n'upload pas son artefact, la fusion
 * produirait un rapport **silencieusement incomplet** — et un rapport vert qui
 * ne couvre pas tous les navigateurs. On refuse donc de fusionner si le nombre
 * de blobs est inférieur à celui attendu (`--expect=N` ou `EXPECTED_BLOBS`).
 *
 * ## Usage
 *
 *   node scripts/merge-playwright-blobs.mjs --expect=3
 *   node scripts/merge-playwright-blobs.mjs --root=tests/reports/qa/playwright/blob
 */

import { existsSync, mkdirSync, readdirSync, rmSync, copyFileSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';
import process from 'node:process';

const require = createRequire(import.meta.url);

/**
 * Résout le CLI de Playwright de façon portable (Windows + pnpm).
 * `require.resolve('playwright')` et `playwright/cli.js` échouent avec pnpm, et
 * `@playwright/test/cli.js` n'est pas exporté : on passe donc par le point
 * d'entrée du paquet, dont le `cli.js` est le voisin.
 */
function resolvePlaywrightCli() {
  const main = require.resolve('@playwright/test');
  const candidate = path.join(path.dirname(main), 'cli.js');
  if (!existsSync(candidate)) {
    throw new Error(`cli.js introuvable à côté de ${main}`);
  }
  return candidate;
}

const argv = process.argv.slice(2);
const argOf = (name) => {
  const hit = argv.find((a) => a === `--${name}` || a.startsWith(`--${name}=`));
  if (!hit) return undefined;
  return hit.includes('=') ? hit.split('=').slice(1).join('=') : argv[argv.indexOf(hit) + 1];
};

const root = path.resolve(argOf('root') ?? 'tests/reports/qa/playwright/blob');
const staging = path.resolve(argOf('staging') ?? 'tests/reports/qa/playwright/_merged');
const expectedRaw = argOf('expect') ?? process.env.EXPECTED_BLOBS;
const expected = expectedRaw === undefined ? undefined : Number(expectedRaw);

const log = (msg) => console.log(`[merge-blobs] ${msg}`);

if (!existsSync(root)) {
  console.error(`[merge-blobs] aucun dossier de blobs : ${root}`);
  process.exit(1);
}

/** Collecte récursive des .zip sous `dir`. */
function collect(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...collect(full));
    else if (entry.isFile() && entry.name.endsWith('.zip')) out.push(full);
  }
  return out;
}

const blobs = collect(root).sort();

log(`dossier racine : ${path.relative(process.cwd(), root) || '.'}`);
log(`blobs trouvés  : ${blobs.length}`);
for (const b of blobs) log(`  - ${path.relative(root, b)}`);

// ── Garde-fou : ne jamais produire un rapport partiel présenté comme complet ──
if (expected !== undefined && blobs.length < expected) {
  console.error(
    `[merge-blobs] REFUS DE FUSIONNER — ${blobs.length} blob(s) pour ${expected} voie(s) attendues.\n` +
      `  Une voie a probablement été annulée ou n'a pas produit son rapport.\n` +
      `  Fusionner maintenant donnerait un rapport VERT mais INCOMPLET.`,
  );
  process.exit(1);
}

if (blobs.length === 0) {
  console.error('[merge-blobs] aucun blob à fusionner.');
  process.exit(1);
}

// ── Mise à plat dans un dossier de travail dédié ──
rmSync(staging, { recursive: true, force: true });
mkdirSync(staging, { recursive: true });

blobs.forEach((b, i) => {
  const name = `report-${String(i + 1).padStart(2, '0')}-${path.basename(b, '.zip')}.zip`;
  copyFileSync(b, path.join(staging, name));
});
log(`${blobs.length} blob(s) copié(s) dans ${path.relative(process.cwd(), staging)}`);

// ── Fusion via l'outil officiel ──
let cli;
try {
  cli = resolvePlaywrightCli();
} catch (err) {
  console.error(`[merge-blobs] ${err.message}`);
  process.exit(1);
}

log('lancement de playwright merge-reports…');
const result = spawnSync(process.execPath, [cli, 'merge-reports', '--config=playwright.merge.config.ts', staging], {
  stdio: 'inherit',
  env: process.env,
});

if (result.error) {
  console.error(`[merge-blobs] échec du lancement : ${result.error.message}`);
  process.exit(1);
}
if (result.status !== 0) {
  console.error(`[merge-blobs] merge-reports a échoué (code ${result.status}).`);
  process.exit(result.status ?? 1);
}

// ── Contrôle final : le rapport fusionné doit couvrir toutes les voies ──
const mergedPath = path.resolve('tests/reports/playwright-results.json');
if (!existsSync(mergedPath)) {
  console.error('[merge-blobs] le rapport fusionné est absent.');
  process.exit(1);
}

const merged = JSON.parse(readFileSync(mergedPath, 'utf8'));
const stats = merged.stats ?? {};
const byProject = {};
for (const suite of merged.suites ?? []) {
  (function walk(node) {
    for (const spec of node.specs ?? []) {
      for (const test of spec.tests ?? []) {
        byProject[test.projectName] = (byProject[test.projectName] ?? 0) + 1;
      }
    }
    for (const child of node.suites ?? []) walk(child);
  })(suite);
}

log('rapport fusionné :');
log(`  total    : ${stats.expected + stats.unexpected + stats.flaky + (stats.skipped ?? 0)}`);
log(`  passed   : ${stats.expected ?? 0}`);
log(`  failed   : ${stats.unexpected ?? 0}`);
log(`  skipped  : ${stats.skipped ?? 0}`);
log(`  projets  : ${Object.entries(byProject).map(([k, v]) => `${k}=${v}`).join(', ')}`);

const projectCount = Object.keys(byProject).length;
if (expected !== undefined && projectCount < expected) {
  console.error(
    `[merge-blobs] REFUS — ${projectCount} projet(s) dans le rapport fusionné pour ${expected} attendu(s).`,
  );
  process.exit(1);
}

log('OK');
