import { auth } from "@/lib/auth";
import { LOCALES } from "@/i18n/config";
import { resolveLocalizedRoute } from "@/i18n/routes";
import { newRequestId } from "@/lib/request-id";
import { bootstrapModules } from "@/lib/cms/bootstrap";
import { extractIp, logAuditEvent, type AuditAction } from "@/lib/audit";
import { handleFormFallback } from "@/lib/form-fallback/handler";
import { captureError, captureEvent, initMonitoring } from "@/lib/monitoring";
import { FLASH_COOKIE, decodeFlash } from "@/lib/form-fallback/flash";
import { defineMiddleware } from "astro:middleware";
import type { APIContext, MiddlewareNext } from "astro";

const REQUEST_ID_UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const LANG_SEGMENT_RE = /^[A-Za-z]{2}$/;
const SESSION_TIMEOUT_MS = 5000;
const SESSION_RETRY_AFTER = '5';
const SESSION_UNAVAILABLE_BODY = JSON.stringify({ error: 'Service temporarily unavailable' });
const HOST_VALUE_MAX_LENGTH = 128;
const NON_HOST_CHARS_RE = /[^a-z0-9.:_-]/gi;
const FORWARDED_PROTOCOL_RE = /^[a-z][a-z0-9+.-]*$/i;

const SECURITY_HEADERS: Readonly<Record<string, string>> = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'X-XSS-Protection': '0',
  'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Resource-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'credentialless',
};

// "INFRA_PROXY_HEADER_REJECTED" est membre de l'union AuditAction de
// src/lib/audit.ts : l'annotation ci-dessous lie la constante à l'union, sans cast.
const FORWARDED_PROXY_HEADER_REJECTED: AuditAction = 'INFRA_PROXY_HEADER_REJECTED';

function applySecurityHeaders(response: Response, requestId: string): void {
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) response.headers.set(key, value);
  response.headers.set('X-Request-Id', requestId);
}

function firstForwardedValue(header: string | null): string | null {
  const first = header?.split(',')[0]?.trim() ?? '';
  return first.length > 0 ? first : null;
}

function sanitizeHostValue(value: string): string | null {
  const cleaned = value.replace(NON_HOST_CHARS_RE, '').slice(0, HOST_VALUE_MAX_LENGTH);
  return cleaned.length > 0 ? cleaned : null;
}

function normalizeForwardedHost(raw: string, protocol: string): string | null {
  if (/[/\\]/.test(raw)) return null;
  const candidate = `${protocol}//${raw}`;
  if (!URL.canParse(candidate)) return null;
  try {
    return new URL(candidate).host;
  } catch {
    return null;
  }
}

// Même source que la configuration : `allowedDomains` est dérivé de
// siteUrl.hostname, lui-même dérivé de process.env.SITE_URL.
function configuredSiteHost(): string | null {
  const raw = process.env.SITE_URL;
  if (!raw) return null;
  try {
    return sanitizeHostValue(new URL(raw).hostname);
  } catch {
    return null;
  }
}

interface ForwardedRejection {
  header: 'x-forwarded-host' | 'x-forwarded-proto';
  reason: 'not_applied' | 'malformed';
  forwarded: string | null;
}

/**
 * `security.allowedDomains` n'est pas lisible depuis le code applicatif : Astro
 * l'applique en amont et retombe silencieusement sur l'hôte du socket quand la
 * validation échoue. On compare donc la valeur annoncée par le proxy à l'URL
 * effectivement résolue — une valeur non appliquée est une valeur rejetée.
 */
function detectRejectedForwardedHeader(request: Request, url: URL): ForwardedRejection | null {
  const rawHost = firstForwardedValue(request.headers.get('x-forwarded-host'));
  if (rawHost !== null) {
    const normalized = normalizeForwardedHost(rawHost, url.protocol);
    if (normalized === null) return { header: 'x-forwarded-host', reason: 'malformed', forwarded: null };
    if (normalized !== url.host) return { header: 'x-forwarded-host', reason: 'not_applied', forwarded: normalized };
  }

  const rawProto = firstForwardedValue(request.headers.get('x-forwarded-proto'));
  if (rawProto !== null) {
    const normalized = FORWARDED_PROTOCOL_RE.test(rawProto) ? `${rawProto.toLowerCase()}:` : null;
    if (normalized === null) return { header: 'x-forwarded-proto', reason: 'malformed', forwarded: null };
    if (normalized !== url.protocol) return { header: 'x-forwarded-proto', reason: 'not_applied', forwarded: normalized };
  }

  return null;
}

function reportRejectedForwardedHeaders(context: APIContext, url: URL): void {
  const rejection = detectRejectedForwardedHeader(context.request, url);
  if (rejection === null) return;
  void logAuditEvent({
    action: FORWARDED_PROXY_HEADER_REJECTED,
    resource: 'infra',
    resourceId: 'forwarded-headers',
    ipAddress: extractIp(context.request.headers, context.clientAddress),
    metadata: {
      header: rejection.header,
      reason: rejection.reason,
      forwardedValue: rejection.forwarded === null ? null : sanitizeHostValue(rejection.forwarded),
      resolvedHost: sanitizeHostValue(url.host),
      resolvedProtocol: url.protocol,
      configuredSiteHost: configuredSiteHost(),
      requestId: context.locals.requestId,
    },
  }).catch(() => {});
}

async function runRequestChain(context: APIContext, next: MiddlewareNext, url: URL): Promise<Response> {
  // ─── Locale guard — reject invalid [lang] segments with 404 ─────
  // URLs canoniques en minuscules : /EN/.. et /Fr/.. redirigent (301) vers la
  // forme canonique au lieu de servir le même contenu en double.
  const pathSegments = url.pathname.split('/').filter(Boolean);
  const maybeLang = pathSegments[0];
  if (maybeLang && LANG_SEGMENT_RE.test(maybeLang)) {
    const lower = maybeLang.toLowerCase();
    if (!(LOCALES as readonly string[]).includes(lower)) {
      return new Response('Not Found', { status: 404 });
    }
    if (lower !== maybeLang) {
      const location = `${url.origin}/${lower}${url.pathname.slice(3)}${url.search}`;
      // Response.redirect() renvoie une Response à headers immuables (guard
      // "immutable") : headers.set() y lève. La 301 est donc construite ici.
      return new Response(null, { status: 301, headers: { Location: location } });
    }
  }

  // ─── Localized segments rewrite (voyages/viajes → trips, candidature/postulacion → apply) ──
  // Les URLs canoniques localisées (TODO Annexe A) sont servies par les routes physiques
  // [lang]/trips et [lang]/apply. L'URL reste localisée (canonique + hreflang intacts).
  const rewritten = resolveLocalizedRoute(url.pathname);
  if (rewritten) return context.rewrite(rewritten + url.search);

  let timedOut = false;
  let isAuthed: Awaited<ReturnType<typeof auth.api.getSession>> | null = null;
  const sessionPromise = auth.api.getSession({ headers: context.request.headers });

  try {
    isAuthed = await Promise.race([
      sessionPromise,
      new Promise<null>((resolve) => setTimeout(() => { timedOut = true; resolve(null); }, SESSION_TIMEOUT_MS)),
    ]);
  } catch (err) {
    console.error('[middleware] Session check failed:', err);
    captureError(err, { requestId: context.locals.requestId, path: url.pathname, tags: { source: 'session-check' } });
    isAuthed = null;
  }

  // Prevent unhandled rejection from the orphaned getSession promise.
  // The pool-level statement_timeout (30s) bounds how long the leaked query can run.
  // NOTE: When better-auth supports AbortController signal, use it to cancel the
  // orphaned promise instead of letting it run in the background.
  sessionPromise.catch((err) => {
    if (timedOut) console.warn('[middleware] Orphaned session check failed after timeout:', err);
  });

  if (timedOut) {
    console.warn(`[middleware] Session check timed out (${SESSION_TIMEOUT_MS / 1000}s) — returning 503`);
    captureEvent('Session check timed out (database unavailable?)', { requestId: context.locals.requestId, path: url.pathname, tags: { source: 'session-check' } });
    return new Response(SESSION_UNAVAILABLE_BODY, {
      status: 503,
      headers: { 'Retry-After': SESSION_RETRY_AFTER, 'Content-Type': 'application/json' },
    });
  }

  if (isAuthed) {
    context.locals.user = isAuthed.user;
    context.locals.session = isAuthed.session;
  } else {
    context.locals.user = null;
    context.locals.session = null;
  }

  // Soumission native d'un formulaire (sans JavaScript) : traitée ici, après la
  // session, pour que l'action voie `locals.user` comme pour un appel RPC.
  const fallback = await handleFormFallback(context, url);
  if (fallback) return fallback;

  // Message flash d'une soumission native : lu et supprimé ici (avant le rendu en
  // streaming, après lequel un cookie ne peut plus être modifié).
  if (context.request.method === 'GET' && context.request.headers.get('accept')?.includes('text/html')) {
    const rawFlash = context.cookies.get(FLASH_COOKIE)?.value;
    if (rawFlash !== undefined) {
      context.locals.flash = decodeFlash(rawFlash);
      context.cookies.delete(FLASH_COOKIE, { path: '/' });
    }
  }

  let response: Response;
  try {
    response = await next();
  } catch (error) {
    // Exception non gérée d'une page ou d'un endpoint : signalée (si le suivi est actif) puis relancée telle quelle.
    captureError(error, { requestId: context.locals.requestId, userId: context.locals.user?.id ?? null, path: url.pathname, tags: { source: 'request' } });
    throw error;
  }
  if (response.status >= 500) {
    // Réponse 5xx produite sans exception (endpoint qui renvoie 500, base indisponible) : un événement au message fixe
    captureEvent(`HTTP ${response.status} response`, {
      requestId: context.locals.requestId,
      userId: context.locals.user?.id ?? null,
      path: url.pathname,
      tags: { source: 'response', status: String(response.status), method: context.request.method },
    });
  }
  const lowerPath = url.pathname.toLowerCase();
  if (lowerPath.startsWith('/uploads/') && (lowerPath.endsWith('.svg') || lowerPath.endsWith('.svgz'))) {
    response.headers.set('Content-Disposition', 'attachment');
    response.headers.set('Content-Type', 'image/svg+xml');
  }

  return response;
}

export const onRequest = defineMiddleware(async (context, next) => {
  bootstrapModules();
  // Idempotent et sans effet sans SENTRY_DSN : capte aussi les exceptions non gérées du processus.
  initMonitoring();

  // ─── Request ID — corrélation transverse (TODO §20.4, opaque, sans PII) ──
  // P0-M9 : n'accepte que les UUID valides, sinon régénère (anti-poisoning/collision).
  const rawIncoming = context.request.headers.get("x-request-id")?.trim() ?? "";
  context.locals.requestId = REQUEST_ID_UUID_RE.test(rawIncoming) ? rawIncoming : newRequestId();

  const url = context.url;

  reportRejectedForwardedHeaders(context, url);

  // Aucune sortie précoce ne court-circuite applySecurityHeaders : 404 locale,
  // 301 de canonicalisation, rewrite, 503 de session et rendu passent tous par
  // le même point d'application des en-têtes.
  const response = await runRequestChain(context, next, url);

  applySecurityHeaders(response, context.locals.requestId);
  return response;
});
