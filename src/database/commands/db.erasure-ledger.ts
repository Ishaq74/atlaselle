import path from 'node:path';
import { getPgClient, shutdownDb } from '../drizzle';
import { getConnectionLabel } from '../env';
import { ledgerPath, planAuditImport, readLedger, recordErasure, type AuditDeletion } from '@/lib/erasure-ledger';
import { c, formatPgError, logTarget } from './_utils';

function argValue(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  return index !== -1 ? process.argv[index + 1] : undefined;
}

async function main() {
  const importAudit = process.argv.includes('--import-audit');
  console.log(c.cyan(c.bold(`\n═══════════════════════════════════════════════════════`)));
  console.log(c.cyan(c.bold(`   🧾 Registre d'effacements RGPD — ${getConnectionLabel()}`)));
  console.log(c.cyan(c.bold(`═══════════════════════════════════════════════════════\n`)));

  const file = argValue('--ledger') ? path.resolve(argValue('--ledger') as string) : ledgerPath({ ...process.env, NODE_ENV: 'production' });
  if (file === null) throw new Error('Chemin du registre indéterminé.');
  console.log(c.dim(`  Registre : ${file}`));

  let { entries, problems } = await readLedger(file);

  if (importAudit) {
    logTarget();
    const client = await getPgClient();
    let rows: AuditDeletion[];
    try {
      const result = await client.query<{ user_id: string | null; resource: string | null; resource_id: string | null; created_at: Date }>(
        `SELECT user_id, resource, resource_id, created_at FROM audit_log WHERE action = 'USER_DELETE' ORDER BY created_at ASC`,
      );
      rows = result.rows.map((r) => ({ userId: r.user_id, resource: r.resource, resourceId: r.resource_id, createdAt: r.created_at }));
    } finally {
      client.release();
    }
    const plan = planAuditImport(rows, entries);
    for (const entry of plan.toAdd) {
      await recordErasure({ kind: entry.kind, subject: entry.subject, actor: entry.actor, source: 'audit-import', at: new Date(entry.at) }, file);
    }
    console.log(`  Audit : ${rows.length} effacement(s) trouvé(s) — ${plan.toAdd.length} ajouté(s), ${plan.alreadyInLedger} déjà au registre, ${plan.skipped.length} ignoré(s).`);
    for (const reason of plan.skipped) console.log(c.yellow(`    ⚠ ${reason}`));
    if (rows.length > 0 && plan.toAdd.length === 0 && plan.alreadyInLedger === 0) console.log(c.yellow('    Rien d\'exploitable dans l\'audit.'));
    ({ entries, problems } = await readLedger(file));
  }

  const byKind = entries.reduce<Record<string, number>>((acc, e) => ({ ...acc, [e.kind]: (acc[e.kind] ?? 0) + 1 }), {});
  console.log(`\n  ${entries.length} entrée(s) valide(s) ${Object.entries(byKind).map(([k, n]) => `· ${k} : ${n}`).join(' ')}`);
  if (problems.length > 0) {
    console.error(c.red(c.bold('\n❌ Registre altéré ou incomplet :')));
    for (const problem of problems) console.error(c.red(`  - ${problem}`));
    process.exit(1);
  }
  console.log(c.green(c.bold('\n✔️  Registre intègre (sommes de contrôle vérifiées).')));
  console.log(c.dim('  Sauvegardez ce fichier avec les sauvegardes de base (docs/database/erasure-ledger.md).'));
}

main()
  .catch((error: unknown) => {
    console.error(c.red(`[erasure-ledger] Échec : ${formatPgError(error)}`));
    process.exitCode = 1;
  })
  .finally(() => shutdownDb());
