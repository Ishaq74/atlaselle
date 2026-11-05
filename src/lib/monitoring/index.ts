/**
 * Suivi d'erreurs (Sentry), côté serveur uniquement. Docs : docs/operations/monitoring.md.
 *
 * - Inactif sans `SENTRY_DSN` (et en test) : toutes les fonctions sont des no-op, aucun import du SDK.
 * - Jamais bloquant : aucune fonction exportée ne lève, ne retarde une réponse, ni ne modifie le comportement.
 * - Données personnelles : collecte coupée à la source (`dataCollection`) + `scrubEvent` sur chaque événement (./scrub.ts).
 * - Seules les erreurs INATTENDUES remontent (`isExpectedError` filtre refus métier, validation, droits).
 */
import { isExpectedError, scrubEvent, stripQuery, type ScrubbableEvent } from './scrub';

type SentryModule = typeof import('@sentry/node');

export interface MonitoringConfig {
  dsn: string;
  environment: string;
  release: string | undefined;
  tracesSampleRate: number;
}

export interface CaptureContext {
  /** Étiquettes indexables (valeurs courtes, jamais de donnée personnelle). */
  tags?: Record<string, string>;
  /** Identifiant de requête (X-Request-Id), pour retrouver la requête dans les journaux. */
  requestId?: string | null;
  /** Compte connecté : identifiant OPAQUE uniquement. */
  userId?: string | null;
  /** Chemin sans paramètres. */
  path?: string | null;
  level?: 'fatal' | 'error' | 'warning' | 'info';
  /** Signale même une erreur « attendue » (ex. code métier PAYMENT_FAILED dans un webhook : anomalie, pas refus utilisateur). */
  alwaysReport?: boolean;
}

/** Lit la configuration ; `null` = suivi désactivé. Pure (l'environnement est un paramètre). */
export function monitoringConfig(env: NodeJS.ProcessEnv = process.env): MonitoringConfig | null {
  const dsn = env.SENTRY_DSN?.trim();
  if (!dsn) return null;
  if (env.NODE_ENV === 'test' && env.SENTRY_ENABLE_IN_TEST !== 'true') return null;
  try {
    const url = new URL(dsn);
    if (!/^https?:$/.test(url.protocol) || !url.username) return null;
  } catch {
    return null;
  }
  const rate = Number.parseFloat(env.SENTRY_TRACES_SAMPLE_RATE ?? '');
  return {
    dsn,
    environment: env.SENTRY_ENVIRONMENT?.trim() || (env.NODE_ENV === 'production' ? 'production' : 'development'),
    release: env.SENTRY_RELEASE?.trim() || undefined,
    tracesSampleRate: Number.isFinite(rate) ? Math.min(Math.max(rate, 0), 1) : 0,
  };
}

export function isMonitoringEnabled(): boolean {
  return monitoringConfig() !== null;
}

// Intégrations retirées : elles embarquent des arguments de logs et des URLs sortantes (identifiants Stripe, etc.).
const DROPPED_INTEGRATIONS = new Set(['Console', 'Http', 'NodeFetch']);

let sdk: Promise<SentryModule | null> | null = null;

function loadSdk(): Promise<SentryModule | null> {
  const config = monitoringConfig();
  if (!config) return Promise.resolve(null);
  sdk ??= import('@sentry/node')
    .then((Sentry) => {
      Sentry.init({
        dsn: config.dsn,
        environment: config.environment,
        release: config.release,
        // Le SDK v11 collecte tout par défaut : on coupe à la source, `scrubEvent` est la seconde barrière.
        dataCollection: { userInfo: false, cookies: false, httpHeaders: false, httpBodies: [], urlQueryParams: false },
        includeServerName: false,
        tracesSampleRate: config.tracesSampleRate,
        // "static" : sinon beforeSendTransaction est ignoré (flux de spans) et les transactions échapperaient au nettoyage.
        traceLifecycle: 'static',
        maxBreadcrumbs: 30,
        normalizeDepth: 4,
        integrations: (defaults) => defaults.filter((integration) => !DROPPED_INTEGRATIONS.has(integration.name)),
        initialScope: { tags: { app: 'atlaselle' } },
        beforeSend: (event) => scrubEvent(event as unknown as ScrubbableEvent) as unknown as typeof event,
        beforeSendTransaction: (event) => scrubEvent(event as unknown as ScrubbableEvent) as unknown as typeof event,
      });
      return Sentry;
    })
    .catch((error: unknown) => {
      console.error('[monitoring] Initialisation de Sentry impossible — suivi désactivé :', error instanceof Error ? error.message : error);
      return null;
    });
  return sdk;
}

/** Initialise le SDK dès le démarrage (capte aussi les exceptions non gérées du processus). Idempotent. */
export function initMonitoring(): void {
  void loadSdk();
}

// Une même erreur peut traverser plusieurs couches (action → middleware) : on ne la compte qu'une fois.
const reported = new WeakSet<object>();

/** Signale une erreur INATTENDUE. Ne lève jamais, ne bloque jamais. Renvoie `true` si elle a été transmise au SDK. */
export function captureError(error: unknown, context: CaptureContext = {}): boolean {
  try {
    if (!isMonitoringEnabled() || (!context.alwaysReport && isExpectedError(error))) return false;
    if (error !== null && typeof error === 'object') {
      if (reported.has(error)) return false;
      reported.add(error);
    }
    void loadSdk().then((Sentry) => {
      if (!Sentry) return;
      Sentry.withScope((scope) => {
        applyContext(scope, context);
        Sentry.captureException(error);
      });
    }).catch(() => {});
    return true;
  } catch {
    return false;
  }
}

/** Signale un événement qui n'est pas une exception (ex. e-mail en dead-letter, 5xx sans exception). */
export function captureEvent(message: string, context: CaptureContext = {}): boolean {
  try {
    if (!isMonitoringEnabled()) return false;
    void loadSdk().then((Sentry) => {
      if (!Sentry) return;
      Sentry.withScope((scope) => {
        applyContext(scope, context);
        Sentry.captureMessage(message, context.level ?? 'error');
      });
    }).catch(() => {});
    return true;
  } catch {
    return false;
  }
}

function applyContext(scope: import('@sentry/node').Scope, context: CaptureContext): void {
  if (context.level) scope.setLevel(context.level);
  if (context.requestId) scope.setTag('request_id', context.requestId);
  if (context.path) scope.setTag('path', stripQuery(context.path).slice(0, 200));
  if (context.userId) scope.setUser({ id: context.userId });
  for (const [key, value] of Object.entries(context.tags ?? {})) scope.setTag(key, value.slice(0, 200));
}

export interface CronCheckIn {
  /** Termine l'exécution : `ok` = succès, sinon incident (le moniteur alerte aussi si aucune exécution n'arrive). */
  done(ok: boolean): void;
}

const NOOP_CHECK_IN: CronCheckIn = { done: () => {} };

/**
 * Surveillance d'une tâche planifiée (Sentry Crons) : une alerte part si l'exécution échoue OU n'arrive pas à l'heure.
 * `schedule` doit correspondre à la planification réelle (.github/workflows/voyage-cron.yml).
 */
export function startCronCheckIn(slug: string, schedule: string, options: { marginMinutes?: number; maxRuntimeMinutes?: number } = {}): CronCheckIn {
  try {
    if (!isMonitoringEnabled()) return NOOP_CHECK_IN;
    const startedAt = Date.now();
    const monitorConfig = {
      schedule: { type: 'crontab' as const, value: schedule },
      checkinMargin: options.marginMinutes ?? 10,
      maxRuntime: options.maxRuntimeMinutes ?? 5,
      timezone: 'UTC',
      failureIssueThreshold: 1,
      recoveryThreshold: 1,
    };
    const started = loadSdk().then((Sentry) =>
      Sentry ? Sentry.captureCheckIn({ monitorSlug: slug, status: 'in_progress' }, monitorConfig) : null,
    ).catch(() => null);
    let finished = false;
    return {
      done(ok: boolean) {
        if (finished) return;
        finished = true;
        void Promise.all([started, loadSdk()]).then(([checkInId, Sentry]) => {
          if (!Sentry || !checkInId) return;
          Sentry.captureCheckIn(
            { checkInId, monitorSlug: slug, status: ok ? 'ok' : 'error', duration: (Date.now() - startedAt) / 1000 },
            monitorConfig,
          );
        }).catch(() => {});
      },
    };
  } catch {
    return NOOP_CHECK_IN;
  }
}

/** Vide la file d'envoi (arrêt propre, tests). N'attend jamais plus que `timeoutMs`. */
export async function flushMonitoring(timeoutMs = 2000): Promise<void> {
  try {
    const Sentry = await loadSdk();
    if (Sentry) await Sentry.flush(timeoutMs);
  } catch {
    /* le suivi d'erreurs ne doit jamais faire échouer l'appelant */
  }
}

/** Réinitialise l'état interne (tests uniquement). */
export function resetMonitoringForTests(): void {
  sdk = null;
}
