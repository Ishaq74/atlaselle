import path from 'node:path';
import { getDbUrl, getConnectionLabel, isProd, maskUrl } from '../env';
import { createBackup, runRestoreDrill, withDatabase } from './_backup';
import { c, logTarget, formatPgError } from './_utils';

function argValue(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  return index !== -1 ? process.argv[index + 1] : undefined;
}

async function main() {
  console.log(c.cyan(c.bold(`\n═══════════════════════════════════════════════════════`)));
  console.log(c.cyan(c.bold(`   🧪 Test de restauration — ${getConnectionLabel()}`)));
  console.log(c.cyan(c.bold(`═══════════════════════════════════════════════════════\n`)));
  logTarget();

  const sourceUrl = getDbUrl();
  const explicitAdmin = process.env.RESTORE_TEST_ADMIN_URL;

  // La base jetable est créée sur le serveur de l'URL d'administration. En PROD on
  // n'ajoute jamais de charge ni de données dupliquées sur le serveur de production.
  if (isProd() && !explicitAdmin) {
    console.error(c.red('[restore-test] DB_ENV=PROD : définissez RESTORE_TEST_ADMIN_URL vers un serveur de test distinct (jamais le serveur de production).'));
    process.exit(1);
  }
  const adminUrl = explicitAdmin ?? withDatabase(sourceUrl, 'postgres');
  console.log(c.dim(`  Serveur de restauration : ${maskUrl(adminUrl)}`));

  const log = (message: string) => console.log(c.dim(`  ${message}`));
  const given = argValue('--file');
  let file: string;
  if (given) {
    file = path.resolve(given);
  } else {
    const backup = await createBackup({ url: sourceUrl, dir: path.resolve(process.env.BACKUP_DIR ?? 'backups'), log });
    file = backup.file;
  }

  const result = await runRestoreDrill({ file, adminUrl, keep: process.argv.includes('--keep'), log });

  console.log('');
  console.log(`  ${result.tables} tables · ${result.rows} lignes restaurées · pg_restore ${result.restoreDurationMs} ms · total ${result.totalDurationMs} ms`);
  if (!result.ok) {
    console.error(c.red(c.bold('\n❌ Restauration NON conforme :')));
    for (const diff of result.diffs) console.error(c.red(`  - ${diff}`));
    process.exit(1);
  }
  console.log(c.green(c.bold('\n✔️  Restauration conforme : comptes de lignes et journal des migrations identiques à la source.')));
  console.log(c.dim('  Reportez la durée mesurée dans le journal des exercices (docs/operations/backup-restore-rollback.md §7).'));
}

main().catch((error: unknown) => {
  console.error(c.red(`[restore-test] Échec : ${formatPgError(error)}`));
  process.exit(1);
});
