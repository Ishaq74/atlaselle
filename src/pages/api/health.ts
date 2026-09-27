import type { APIRoute } from "astro";
import { createHash, timingSafeEqual } from "node:crypto";
import { access, constants } from "node:fs/promises";
import { checkConnection } from "@database/drizzle";
import { getCacheStats } from "@database/cache";
import { checkSmtpConfig } from "@/smtp/env";

export const prerender = false;

const startedAt = Date.now();
const HEALTH_TOKEN = process.env.HEALTH_TOKEN;
const VERSION = "0.0.1";
const BEARER_PREFIX = "Bearer ";

if (!HEALTH_TOKEN) {
  console.error('[health] HEALTH_TOKEN is not set — GET /api/health denies every caller (401). Set HEALTH_TOKEN to expose the probe payload.');
}

/**
 * Autorisation explicite : un jeton configuré et présenté, sinon refus.
 * L'absence d'un en-tête de proxy ne prouve rien — l'absence d'en-tête est
 * décidée par l'appelant, et un port exposé n'est pas un loopback.
 * Les deux empreintes ont une longueur fixe : la comparaison reste constante
 * sans exposer la longueur du secret et ne peut pas lever sur un jeton
 * multi-octets de longueur différente.
 */
function isAuthorized(request: Request): boolean {
  if (typeof HEALTH_TOKEN !== 'string' || HEALTH_TOKEN.length === 0) return false;
  const header = request.headers.get('authorization');
  if (header === null || !header.startsWith(BEARER_PREFIX)) return false;
  const presented = header.slice(BEARER_PREFIX.length);
  if (presented.length === 0) return false;
  return timingSafeEqual(
    createHash('sha256').update(presented, 'utf8').digest(),
    createHash('sha256').update(HEALTH_TOKEN, 'utf8').digest(),
  );
}

function jsonResponse(body: Record<string, unknown>, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
}

export const GET: APIRoute = async ({ request }) => {
  // Portail unique : le corps nominal et le corps d'erreur 503 sont tous deux
  // produits après ce test, jamais avant.
  if (!isAuthorized(request)) {
    return jsonResponse({ error: 'Unauthorized' }, 401);
  }
  try {
    const [db, smtp, uploadsOk] = await Promise.all([
      checkConnection(),
      Promise.resolve(checkSmtpConfig()),
      access('public/uploads', constants.W_OK).then(() => true, () => false),
    ]);
    const cache = getCacheStats();

    const allOk = db.ok && smtp.ok && uploadsOk;

    return jsonResponse({
      status: allOk ? "ok" : "degraded",
      version: VERSION,
      uptime: Math.floor((Date.now() - startedAt) / 1000),
      timestamp: new Date().toISOString(),
      db: { ok: db.ok },
      smtp: { ok: smtp.ok, provider: smtp.provider },
      disk: { uploadsWritable: uploadsOk },
      cache: { size: cache.size, hits: cache.hits, misses: cache.misses },
    }, allOk ? 200 : 503);
  } catch (err) {
    console.error('[health] Check failed:', err);
    return jsonResponse({
      status: "error",
      version: VERSION,
      uptime: Math.floor((Date.now() - startedAt) / 1000),
      timestamp: new Date().toISOString(),
      db: { ok: false },
      smtp: { ok: false, provider: 'unknown' },
      disk: { uploadsWritable: false },
    }, 503);
  }
};
