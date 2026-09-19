import type { APIRoute } from "astro";
import { isValidLocale } from "@i18n/utils";
import { checkRateLimit } from "@/lib/rate-limit";
import { DEFAULT_LOCALE } from "@i18n/config";
import { buildTsQuery, getRegconfig } from "@/core/search";
import { searchContent } from "@database/loaders/search.loader";
export { buildTsQuery, getRegconfig };

export const prerender = false;
const ERROR_CODES = { QUERY_TOO_SHORT: "QUERY_TOO_SHORT", INVALID_LOCALE: "INVALID_LOCALE", RATE_LIMITED: "RATE_LIMITED" } as const;

export const GET: APIRoute = async ({ url, clientAddress }) => {
  const q = url.searchParams.get("q")?.trim();
  const locale = url.searchParams.get("locale") ?? DEFAULT_LOCALE;
  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "20", 10) || 20, 100);
  if (!q || q.length < 2) return new Response(JSON.stringify({ error: ERROR_CODES.QUERY_TOO_SHORT }), { status: 400, headers: { "Content-Type": "application/json" } });
  if (!isValidLocale(locale)) return new Response(JSON.stringify({ error: ERROR_CODES.INVALID_LOCALE }), { status: 400, headers: { "Content-Type": "application/json" } });
  const clientKey = clientAddress?.trim() ? clientAddress : "unknown";
  const rl = checkRateLimit(`search:${clientKey}`, { window: 60, max: 60 });
  if (!rl.allowed) return new Response(JSON.stringify({ error: ERROR_CODES.RATE_LIMITED }), { status: 429, headers: { "Content-Type": "application/json", "Retry-After": String(Math.ceil((rl.resetAt - Date.now()) / 1000)) } });

  const tsQuery = buildTsQuery(q);
  if (!tsQuery) return new Response(JSON.stringify({ error: ERROR_CODES.QUERY_TOO_SHORT }), { status: 400, headers: { "Content-Type": "application/json" } });

  const results = await searchContent(q, locale, limit);

  return new Response(JSON.stringify({
    query: q,
    locale,
    count: results.length,
    results,
  }), { status: 200, headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=60" } });
};
