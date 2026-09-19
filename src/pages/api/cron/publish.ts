import type { APIRoute } from "astro";
import { runPagePublishCron } from "@database/loaders/page.loader";
import { timingSafeEqual } from "node:crypto";

export const prerender = false;

const CRON_SECRET = process.env.CRON_SECRET;

function isAuthorized(request: Request): boolean {
  if (!CRON_SECRET) {
    // No secret configured — reject all requests in production.
    // In dev/test, allow only when no proxy is involved (direct loopback).
    if (process.env.NODE_ENV === "production") return false;
    const forwarded = request.headers.get("x-forwarded-for");
    if (forwarded) return false;
    return true;
  }
  const bearer = request.headers.get("authorization");
  const token = bearer?.startsWith("Bearer ") ? bearer.slice(7) : "";
  if (token.length !== CRON_SECRET.length) return false;
  return timingSafeEqual(Buffer.from(token), Buffer.from(CRON_SECRET));
}

/**
 * POST /api/cron/publish
 *
 * Handles three scheduled tasks via loader (couche service) :
 * 1. Auto-publish pages where scheduledAt <= now
 * 2. Auto-unpublish pages where scheduledUnpublishAt <= now
 * 3. Auto-purge trashed pages older than 30 days
 *
 * Call from external cron (e.g. every minute) or container scheduler.
 */
export const POST: APIRoute = async ({ request }) => {
  if (!isAuthorized(request)) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const results = await runPagePublishCron(new Date());

  return new Response(JSON.stringify({ ok: true, ...results }), {
    status: 200,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
};
