import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool, type PoolClient } from 'pg';
import * as schema from './schemas';
import { getDbUrl, getPoolConfig } from './env';
import { shutdownCache } from './cache';

export type DrizzleDB = NodePgDatabase<typeof schema>;
export interface DbActorContext {
  userId: string | null;
  isAdmin?: boolean;
}

// ─── Pool singleton ──────────────────────────────────────────────────
let instance: { pool: Pool; db: DrizzleDB; isHealthy: boolean } | null = null;

function buildPgStartupOptions(statementTimeout?: number, idleInTransactionTimeout?: number): string | undefined {
  const options: string[] = [];

  if (statementTimeout) {
    options.push(`-c statement_timeout=${Number(statementTimeout)}`);
  }

  if (idleInTransactionTimeout) {
    options.push(`-c idle_in_transaction_session_timeout=${Number(idleInTransactionTimeout)}`);
  }

  return options.length > 0 ? options.join(' ') : undefined;
}

function createPool(): { pool: Pool; db: DrizzleDB; isHealthy: boolean } {
  const url = getDbUrl();
  const poolConfig = getPoolConfig();

  // Extract non-standard pool options before passing to pg.
  // Session timeouts are applied at connection startup to avoid racing the
  // first query with an async client.query() inside Pool.on('connect').
  const { statement_timeout, idle_in_transaction_session_timeout, ...pgPoolConfig } = poolConfig;

  const p = new Pool({
    connectionString: url,
    ssl: url.includes('sslmode=require')
      ? { rejectUnauthorized: true, ...(process.env.DATABASE_CA_CERT ? { ca: process.env.DATABASE_CA_CERT } : {}) }
      : undefined,
    options: buildPgStartupOptions(statement_timeout, idle_in_transaction_session_timeout),
    ...pgPoolConfig,
  });

  const entry = { pool: p, db: drizzle(p, { schema }), isHealthy: true };

  p.on('error', (err) => {
    console.error('[DB] Erreur de pool inattendue:', err.stack ?? err.message);
    entry.isHealthy = false;
  });

  return entry;
}

function getPool(): Pool {
  if (instance && instance.isHealthy) return instance.pool;

  if (instance && !instance.isHealthy) {
    console.warn('[DB] Pool marked unhealthy — recreating');
    instance.pool.end().catch((err) => {
      console.error('[DB] Error ending unhealthy pool:', err);
    });
    instance = null;
  }

  instance = createPool();
  return instance.pool;
}

// ─── Public API ──────────────────────────────────────────────────────
export function getDrizzle(): DrizzleDB {
  if (instance) return instance.db;
  getPool(); // initializes instance
  return instance!.db;
}

/**
 * Returns a Proxy that always delegates to the current Drizzle instance.
 * Use this when you need a long-lived reference that survives pool recreation
 * (e.g. for better-auth's drizzleAdapter which captures db at init time).
 */
export function getLazyDrizzle(): DrizzleDB {
  return new Proxy({} as DrizzleDB, {
    get(_target, prop, receiver) {
      const current = getDrizzle();
      const value = Reflect.get(current, prop, receiver);
      return typeof value === 'function' ? value.bind(current) : value;
    },
  });
}

export async function getPgClient(): Promise<PoolClient> {
  return getPool().connect();
}

/**
 * Execute a block with per-request SQL context stored in LOCAL settings.
 *
 * This is the foundation required for future PostgreSQL RLS policies.
 * The settings live only for the current transaction and never leak back to
 * the pool once the client is released.
 *
 * Includes a per-transaction statement_timeout (default 30 s) to prevent
 * runaway queries from holding a connection indefinitely.
 */
export async function withDbActorContext<T>(
  actor: DbActorContext,
  fn: (db: DrizzleDB, client: PoolClient) => Promise<T>,
  options?: { statementTimeoutMs?: number },
): Promise<T> {
  const client = await getPgClient();
  const db = drizzle(client, { schema });
  const raw = options?.statementTimeoutMs ?? 30_000;
  const timeout = Number.isFinite(raw) ? Math.max(1000, Math.min(300_000, raw)) : 30_000;

  // Un client n'est rendu au pool QUE si sa transaction a proprement abouti.
  // Si l'échec vient du réseau (socket coupé : c'est exactement ce que fait
  // Playwright en annulant une requête), le client est potentiellement encore
  // « busy » et son état est inconnu. Le réinjecter dans le pool le prête à la
  // requête suivante, qui se heurte à un client déjà en cours d'exécution :
  // d'où l'avertissement pg « Calling client.query() when the client is
  // already executing a query », et un état transactionnel fantôme.
  //
  // `release(true)` détruit le client : le pool en crée un neuf. C'est le
  // comportement documenté de node-postgres pour un client corrompu.
  let poisoned = false;

  try {
    await client.query('BEGIN');
    // `SET LOCAL` is a utility command: the parser stops at the parameter token
    // (SQLSTATE 42601) because utility statements do not accept bind parameters.
    // set_config(..., is_local => true) is the parameterizable equivalent of
    // SET LOCAL: the setting lives only for the current transaction and never
    // leaks back to the pool once the client is released. The value stays bound.
    await client.query('SELECT set_config($1, $2, true)', ['statement_timeout', `${timeout}`]);
    await client.query('SELECT set_config($1, $2, true)', ['app.current_user_id', actor.userId ?? '']);
    await client.query('SELECT set_config($1, $2, true)', ['app.is_admin', actor.isAdmin ? 'true' : 'false']);

    const result = await fn(db, client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    poisoned = true;
    try {
      await client.query('ROLLBACK');
    } catch {
      // Le ROLLBACK a lui-même échoué : la connexion est morte, on ne tente
      // rien de plus. Le client sera détruit ci-dessous.
      poisoned = true;
    }
    throw error;
  } finally {
    client.release(poisoned);
  }
}

export async function checkConnection(): Promise<{ ok: boolean; latency: number; error?: unknown }> {
  const start = Date.now();
  let client: PoolClient | null = null;
  let healthy = false;
  try {
    client = await getPgClient();
    await client.query('SELECT 1');
    healthy = true;
    return { ok: true, latency: Date.now() - start };
  } catch (err) {
    return { ok: false, latency: Date.now() - start, error: err };
  } finally {
    // Même règle qu'`withDbActorContext` : un client dont la requête a échoué
    // est détruit, pas renvoyé au pool. Ici la sonde sert précisément à
    // détecter une connexion morte — la remettre en circulation propagerait
    // la panne à la requête suivante.
    client?.release(healthy ? false : true);
  }
}

export async function shutdownDb(): Promise<void> {
  shutdownCache();
  if (instance) {
    await instance.pool.end();
    instance = null;
  }
}

// Graceful shutdown — drain the pool on process termination signals
for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.on(signal, () => {
    console.log(`[DB] Received ${signal} — closing pool`);
    shutdownDb()
      .catch((err) => console.error('[DB] Error during shutdown:', err))
      .finally(() => process.exit(0));
  });
}

export { schema };