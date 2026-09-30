/**
 * Lance pa11y-ci en parallèle, par POUVELLEMENT DE PROCESSUS.
 *
 * Pourquoi pas `concurrency` dans `.pa11yci.cjs` :
 * pa11y-ci utilise UNE instance Chrome unique partagée par tous les tests
 * (`testBrowser`, lib/pa11y-ci.js). Avec `concurrency: 4`, la mesure donnait
 * 140 s au lieu de 462 s — mais seules 32 des 112 pages étaient auditées, les
 * autres échouant sur « Protocol error (Target.closeTarget) » : un worker
 * fermait l'onglet d'un autre. Le gain était une illusion.
 *
 * Chaque PROCESSE a son propre Chrome, donc aucune contention. Les tranches
 * sont réparties par tours (round-robin) et non par blocs : les pages d'un même
 * domaine ne se retrouvent pas dans la même tranche, ce qui equilibre la charge
 * si un domaine est plus lent qu'un autre.
 *
 * La couverture est intégrale : les 112 URL passent, réparties entre N
 * processus.
 *
 *   node tests/a11y/run-pa11y-parallel.cjs [--jobs N] [--out fichier.json]
 */

import { spawn } from "node:child_process";
import { writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

// ─── Configuration ────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const jobsFlag = args.indexOf("--jobs");
const outFlag = args.indexOf("--out");

const JOBS = Math.max(1, jobsFlag !== -1 ? Number(args[jobsFlag + 1]) : 4);
const OUT = outFlag !== -1 ? args[outFlag + 1] : "tests/reports/pa11y-results.json";

const configUrl = pathToFileURL(resolve(".pa11yci.cjs")).href;
// Un `.cjs` chargé dynamiquement arrive sous `default` : `module.exports` n'est
// pas exposé à plat. Les deux lectures sont tentées par sécurité.
const configModule = await import(configUrl);
const pa11yConfig = configModule.default ?? configModule;
// Les URL sont à la RACINE de l'export, les options dans `defaults`.
const allUrls = pa11yConfig.urls;

if (!Array.isArray(allUrls) || allUrls.length === 0) {
  console.error("[pa11y] .pa11yci.cjs n'expose aucune URL");
  process.exit(1);
}

// ─── Découpe round-robin ──────────────────────────────────────────────────
// Le tour equilibré évite qu'une tranche hérite de tout un domaine lent.
const buckets = Array.from({ length: JOBS }, () => []);
allUrls.forEach((entry, i) => buckets[i % JOBS].push(entry));

// ─── Fichiers de config par tranche ───────────────────────────────────────
// pa11y-ci lit ses URL depuis le fichier de config : on lui en écrit un par
// tranche, qui réutilise TOUS les réglages (standard, runners, chrome, ignore).
const shardFiles = buckets.map((urls, i) => {
  const file = resolve(`.pa11yci.shard-${i}.cjs`);
  const modulePath = JSON.stringify(resolve(".pa11yci.cjs"));
writeFileSync(
    file,
    `// Généré par tests/a11y/run-pa11y-parallel.mjs — tranche ${i + 1}/${JOBS}.
// Ne pas modifier : régénéré à chaque run.
const base = require(${modulePath});
// Les URL sont à la racine de l'export, pas dans \`defaults\` : pa11y-ci lit
// \`urls\` comme option de premier niveau.
module.exports = { urls: ${JSON.stringify(urls, null, 2)}, defaults: base.defaults };
`,
    "utf8",
  );
  return file;
});

console.log(
  `[pa11y] ${allUrls.length} URL réparties sur ${JOBS} processus : ` +
    buckets.map((b) => b.length).join(" + "),
);

// ─── Exécution parallèle ─────────────────────────────────────────────────
function runShard(file, index) {
  return new Promise((resolvePromise) => {
    const started = Date.now();
    const child = spawn(
      "npx",
      ["pa11y-ci", "--config", file, "--json"],
      { shell: true, cwd: process.cwd(), maxBuffer: 32 * 1024 * 1024 },
    );

    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => {
      stdout += d;
    });
    child.stderr.on("data", (d) => {
      stderr += d;
    });

    child.on("close", () => {
      // pa11y-ci sort en erreur dès qu'une page échoue, mais son stdout
      // contient alors quand même le JSON complet : on ne se fie pas au code.
      const at = stdout.indexOf("{");
      if (at === -1) {
        console.error(`[pa11y] tranche ${index + 1} : aucune sortie JSON`);
        console.error(stderr.slice(0, 500));
        resolvePromise({ ok: false, results: {}, errors: 0 });
        return;
      }
      let parsed;
      try {
        parsed = JSON.parse(stdout.slice(at));
      } catch {
        console.error(`[pa11y] tranche ${index + 1} : JSON illisible`);
        resolvePromise({ ok: false, results: {}, errors: 0 });
        return;
      }
      const seconds = ((Date.now() - started) / 1000).toFixed(1);
      console.log(
        `[pa11y] tranche ${index + 1} terminée en ${seconds}s — ` +
          `${Object.keys(parsed.results ?? {}).length} pages`,
      );
      resolvePromise({
        ok: true,
        results: parsed.results ?? {},
        errors: parsed.errors ?? 0,
      });
    });
  });
}

const shards = await Promise.all(shardFiles.map((f, i) => runShard(f, i)));

// ─── Fusion ───────────────────────────────────────────────────────────────
// Schéma aligné sur la sortie de pa11y-ci : { total, passes, errors, results }.
// tests/a11y/run.cjs (savePa11yReport) lit `passes` et `errors` pour l'affichage
// et déduit le code de sortie de `errors` — sans `passes`, le rapport affichait
// « 0/N » même quand tout passait.
const merged = { total: allUrls.length, passes: 0, errors: 0, results: {} };
for (const shard of shards) {
  Object.assign(merged.results, shard.results);
}

const audited = Object.keys(merged.results).length;
console.log(`[pa11y] ${audited}/${allUrls.length} pages auditées`);

if (audited !== allUrls.length) {
  // Garde-fou : on ne veut jamais produire un rapport « vert » qui n'a en
  // réalité audité qu'un tiers des pages.
  console.error(
    `[pa11y] INCOMPLET — ${allUrls.length - audited} page(s) manquante(s). ` +
      "Le rapport ne doit pas être considéré comme valide.",
  );
  process.exit(1);
}

// Une page est en échec si son tableau d'issues est non vide (sémantique pa11y-ci).
// On recalcule à partir de `results` plutôt que de sommer les erreurs des tranches :
// c'est la seule source qui garantisse la cohérence du rapport affiché.
const failing = Object.values(merged.results).filter(
  (issues) => Array.isArray(issues) && issues.length > 0,
).length;
merged.passes = audited - failing;
merged.errors = failing;

writeFileSync(OUT, JSON.stringify(merged), "utf8");
console.log(
  `[pa11y] rapport fusionné : ${OUT} (${merged.passes}/${merged.total} pages sans erreur)`,
);

for (const file of shardFiles) {
  try {
    (await import("node:fs")).unlinkSync(file);
  } catch {
    /* fichier déjà supprimé */
  }
}

process.exit(failing > 0 ? 1 : 0);
