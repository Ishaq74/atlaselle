import type { APIRoute } from "astro";
import { timingSafeEqual } from "node:crypto";
import { expireHolds } from "@/modules/availability/domain/availability-service";
import { expireCheckoutSessions } from "@/modules/payments/domain/checkout-service";
import { processEmailOutboxBatch } from "@/modules/email-voyage/domain/voyage-email-worker";
import { sendBalanceReminders, sendTripReminders } from "@/modules/email-voyage/domain/reminders";

export const prerender = false;

const CRON_SECRET = process.env.CRON_SECRET;

function isAuthorized(request: Request): boolean {
  if (!CRON_SECRET) {
    if (process.env.NODE_ENV === "production") return false;
    if (request.headers.get("x-forwarded-for")) return false;
    return true;
  }
  const bearer = request.headers.get("authorization");
  const token = bearer?.startsWith("Bearer ") ? bearer.slice(7) : "";
  if (token.length !== CRON_SECRET.length) return false;
  return timingSafeEqual(Buffer.from(token), Buffer.from(CRON_SECRET));
}

// POST /api/cron/voyage — jobs voyage (TODO §14.2) : expirations + file email + rappels.
export const POST: APIRoute = async ({ request }) => {
  if (!isAuthorized(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const expiredHolds = await expireHolds();
  const expiredCheckouts = await expireCheckoutSessions();
  const outbox = await processEmailOutboxBatch();
  const balanceReminders = await sendBalanceReminders();
  const tripReminders = await sendTripReminders();
  return Response.json({ expiredHolds, expiredCheckouts, outbox, balanceReminders, tripReminders });
};
