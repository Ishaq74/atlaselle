import { auth } from "@/lib/auth";
import { LOCALES } from "@/i18n/config";
import { resolveLocalizedRoute } from "@/i18n/routes";
import { newRequestId } from "@/lib/request-id";
import { bootstrapModules } from "@/lib/cms/bootstrap";
import { defineMiddleware } from "astro:middleware";

export const onRequest = defineMiddleware(async (context, next) => {
  bootstrapModules();

  // ─── Request ID — corrélation transverse (TODO §20.4, opaque, sans PII) ──
  const incomingId = context.request.headers.get("x-request-id")?.trim().slice(0, 128);
  context.locals.requestId = incomingId || newRequestId();

  // ─── Locale guard — reject invalid [lang] segments with 404 ─────
  // URLs canoniques en minuscules : /EN/.. et /Fr/.. redirigent (301) vers la
  // forme canonique au lieu de servir le même contenu en double.
  const url = new URL(context.request.url);
  const pathSegments = url.pathname.split('/').filter(Boolean);
  const maybeLang = pathSegments[0];
  if (maybeLang && /^[A-Za-z]{2}$/.test(maybeLang)) {
    const lower = maybeLang.toLowerCase();
    if (!(LOCALES as readonly string[]).includes(lower)) {
      return new Response('Not Found', { status: 404 });
    }
    if (lower !== maybeLang) {
      return Response.redirect(`${url.origin}/${lower}${url.pathname.slice(3)}${url.search}`, 301);
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
      new Promise<null>((resolve) => setTimeout(() => { timedOut = true; resolve(null); }, 5000)),
    ]);
  } catch (err) {
    console.error('[middleware] Session check failed:', err);
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
    console.warn('[middleware] Session check timed out (5s) — returning 503');
    return new Response(JSON.stringify({ error: 'Service temporarily unavailable' }), {
      status: 503,
      headers: { 'Retry-After': '5', 'Content-Type': 'application/json' },
    });
  }

  if (isAuthed) {
    context.locals.user = isAuthed.user;
    context.locals.session = isAuthed.session;
  } else {
    context.locals.user = null;
    context.locals.session = null;
  }

  const response = await next();
  const lowerPath = url.pathname.toLowerCase();
  if (lowerPath.startsWith('/uploads/') && (lowerPath.endsWith('.svg') || lowerPath.endsWith('.svgz'))) {
    response.headers.set('Content-Disposition', 'attachment');
    response.headers.set('Content-Type', 'image/svg+xml');
  }

  const securityHeaders: Record<string, string> = {
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

  for (const [key, value] of Object.entries(securityHeaders)) response.headers.set(key, value);
  response.headers.set('X-Request-Id', context.locals.requestId);
  return response;
});
