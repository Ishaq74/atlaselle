import path from 'node:path';
import { getDrizzle, shutdownDb } from '../drizzle';
import { getConnectionLabel } from '../env';
import { ledgerPath, readLedger } from '@/lib/erasure-ledger';
import { replayErasures, type ReplayOutcome } from './_erasure';
import { c, confirmProd, formatPgError, logTarget } from './_utils';

function argValue(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  return index !== -1 ? process.argv[index + 1] : undefined;
}

const LABEL: Record<ReplayOutcome, string> = {
  applied: 'effacé',
  already: 'déjà effacé',
  absent: 'absent de cette base',
  error: 'ERREUR',
};

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  console.log(c.cyan(c.bold(`\n═══════════════════════════════════════════════════════`)));
  console.log(c.cyan(c.bold(`   🧾 Rejeu des effacements RGPD — ${getConnectionLabel()}${dryRun ? ' (simulation)' : ''}`)));
  console.log(c.cyan(c.bold(`═══════════════════════════════════════════════════════\n`)));
  logTarget();

  const file = argValue('--ledger') ? path.resolve(argValue('--ledger') as string) : ledgerPath({ ...process.env, NODE_ENV: 'production' });
  if (file === null) throw new Error('Chemin du registre indéterminé.');
  console.log(c.dim(`  Registre : ${file}`));

  const { entries, problems } = await readLedger(file);
  if (problems.length > 0) {
    console.error(c.red(c.bold('\n❌ Registre altéré ou incomplet :')));
    for (const problem of problems) console.error(c.red(`  - ${problem}`));
  }
  if (entries.length === 0) {
    console.log(c.yellow(problems.length > 0 ? '\nAucune entrée exploitable.' : "\nRegistre vide ou absent : rien à rejouer. Vérifiez que c'est bien le registre de PRODUCTION (docs/database/erasure-ledger.md)."));
    process.exit(problems.length > 0 ? 1 : 0);
  }

  if (!dryRun) await confirmProd('rejeu des effacements RGPD');
  const rows = await replayErasures(entries, { db: getDrizzle(), dryRun });

  const counts: Record<ReplayOutcome, number> = { applied: 0, already: 0, absent: 0, error: 0 };
  for (const row of rows) {
    counts[row.outcome]++;
    const subject = `${row.entry.kind} ${row.entry.subject}`;
    if (row.outcome === 'error') console.error(c.red(`  ✘ ${subject} : ${row.error}`));
    else if (row.outcome === 'applied') console.log(c.green(`  ✔ ${subject} : ${dryRun ? 'serait effacé' : LABEL.applied}`));
    for (const warning of row.warnings) console.log(c.yellow(`    ⚠ ${subject} : ${warning} — à examiner`));
  }

  console.log(`\n  ${rows.length} entrée(s) : ${counts.applied} ${dryRun ? 'à effacer' : 'effacée(s)'}, ${counts.already} déjà effacée(s), ${counts.absent} absente(s) de cette base, ${counts.error} erreur(s).`);
  if (counts.error > 0 || problems.length > 0) {
    console.error(c.red(c.bold('\n❌ Rejeu incomplet : corrigez puis relancez (le rejeu est idempotent).')));
    process.exit(1);
  }
  console.log(c.green(c.bold(`\n✔️  ${dryRun ? 'Simulation terminée.' : 'Effacements rejoués : aucune donnée effacée ne subsiste dans cette base.'}`)));
}

main()
  .catch((error: unknown) => {
    console.error(c.red(`[replay-erasures] Échec : ${formatPgError(error)}`));
    process.exitCode = 1;
  })
  .finally(() => shutdownDb());
