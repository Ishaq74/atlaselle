import path from 'node:path';
import { getDbUrl, getConnectionLabel, maskUrl } from '../env';
import { createBackup } from './_backup';
import { c, logTarget, formatPgError } from './_utils';

async function main() {
  console.log(c.cyan(c.bold(`\n═══════════════════════════════════════════════════════`)));
  console.log(c.cyan(c.bold(`   💾 Sauvegarde logique — ${getConnectionLabel()}`)));
  console.log(c.cyan(c.bold(`═══════════════════════════════════════════════════════\n`)));
  logTarget();

  const dir = path.resolve(process.env.BACKUP_DIR ?? 'backups');
  const { file, manifest } = await createBackup({
    url: getDbUrl(),
    dir,
    log: (message) => console.log(c.dim(`  ${message}`)),
  });

  const tables = Object.keys(manifest.snapshot.tables).length;
  const rows = Object.values(manifest.snapshot.tables).reduce((sum, n) => sum + n, 0);
  console.log(c.green(c.bold(`\n✔️  Sauvegarde créée : ${file}`)));
  console.log(`  ${(manifest.bytes / 1024 / 1024).toFixed(2)} Mo · ${tables} tables · ${rows} lignes · ${manifest.snapshot.migrations.length} migration(s) · ${manifest.dumpDurationMs} ms`);
  console.log(`  SHA-256 : ${manifest.sha256}`);
  console.log(c.yellow(`  ⚠️  Ce fichier contient des données personnelles : chiffrez-le et déplacez-le hors du serveur (docs/operations/backup-restore-rollback.md).`));
  console.log(c.dim(`  Source : ${maskUrl(getDbUrl())}`));
}

main().catch((error: unknown) => {
  console.error(c.red(`[backup] Échec : ${formatPgError(error)}`));
  process.exit(1);
});
