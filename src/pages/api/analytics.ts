import type { APIRoute } from "astro";
import { z } from "astro/zod";
import { checkRateLimit } from "@/lib/rate-limit";
import { extractIp } from "@/lib/audit";
import { isAnalyticsEvent, sanitizeAnalyticsProps } from "@/lib/analytics";

export const prerender = false;

const bodySchema = z.object({
  event: z.string().max(64),
  props: z.record(z.unknown()).optional(),
});

// POST /api/analytics — collecte agrégée, allowlist stricte, jamais de PII.
export const POST: APIRoute = async ({ request, clientAddress }) => {
  const ip = extractIp(request.headers, clientAddress);
  const rl = checkRateLimit(ip ? `analytics:${ip}` : "analytics:__global__", { window: 60, max: 60 });
  if (!rl.allowed) return Response.json({ error: "RATE_LIMITED" }, { status: 429 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "VALIDATION_ERROR" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success || !isAnalyticsEvent(parsed.data.event)) {
    return Response.json({ error: "VALIDATION_ERROR" }, { status: 400 });
  }
  console.log(
    JSON.stringify({
      type: "analytics",
      event: parsed.data.event,
      ...sanitizeAnalyticsProps(parsed.data.props as Record<string, unknown> | undefined),
      timestamp: new Date().toISOString(),
    }),
  );
  return Response.json({ ok: true });
};
