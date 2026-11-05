/**
 * Vérifie le branchement du suivi d'erreurs : envoie UN événement de test (et un check-in du moniteur de cron
 * de test) vers le projet Sentry configuré, puis attend l'envoi.
 *
 *   SENTRY_DSN=... pnpm monitoring:check
 *
 * À lancer une fois après avoir renseigné les variables d'environnement (docs/operations/monitoring.md §4).
 * L'événement n'embarque aucune donnée applicative.
 */
import 'dotenv/config';
import { captureEvent, flushMonitoring, isMonitoringEnabled, monitoringConfig, startCronCheckIn } from '../src/lib/monitoring';

async function main(): Promise<void> {
  const config = monitoringConfig({ ...process.env, SENTRY_ENABLE_IN_TEST: 'true' });
  if (!config || !isMonitoringEnabled()) {
    console.error('✖ Suivi désactivé : SENTRY_DSN absent ou invalide (attendu : https://<clé>@o<id>.ingest.<région>.sentry.io/<projet>).');
    process.exit(1);
  }
  const host = new URL(config.dsn).host;
  console.log(`Projet : ${host}`);
  console.log(`Environnement : ${config.environment} · release : ${config.release ?? '(non définie)'}`);
  if (!/\.de\.sentry\.io$|\.eu\./.test(host) && /sentry\.io$/.test(host)) {
    console.warn('⚠ Ce DSN ne semble pas être en région UE (.de.sentry.io). Vérifier la localisation des données (RGPD).');
  }

  const sent = captureEvent('Vérification du suivi d\'erreurs (pnpm monitoring:check)', {
    level: 'info',
    tags: { source: 'monitoring-check' },
  });
  const checkIn = startCronCheckIn('monitoring-check', '0 0 1 1 *', { marginMinutes: 60 });
  checkIn.done(true);
  await flushMonitoring(8000);

  if (!sent) {
    console.error('✖ L\'événement n\'a pas pu être mis en file.');
    process.exit(1);
  }
  console.log('✔ Événement de test envoyé. Le retrouver dans Sentry > Issues (étiquette source:monitoring-check).');
}

main().catch((error: unknown) => {
  console.error('✖ Échec :', error instanceof Error ? error.message : error);
  process.exit(1);
});
