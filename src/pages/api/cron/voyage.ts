import type { APIRoute } from "astro";
import { timingSafeEqual } from "node:crypto";
import { expireHolds, purgeTerminalHolds } from "@/modules/availability/domain/availability-service";
import { expireCheckoutSessions, purgeExpiredCheckoutSessions } from "@/modules/payments/domain/checkout-service";
import { expireApplications } from "@/modules/applications/domain/application-service";
import { markBalanceDue } from "@/modules/reservations/domain/reservation-service";
import { processEmailOutboxBatch } from "@/modules/email-voyage/domain/voyage-email-worker";
import { sendBalanceReminders, sendTripReminders } from "@/modules/email-voyage/domain/reminders";
import { purgeOldOutbox } from "@/modules/outbox/domain/retention";

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
// Chaque job est isolé : la panne de l'un n'empêche pas les autres (erreurs
// regroupées dans `errors`, contrat additif — les compteurs restent des nombres).
export const POST: APIRoute = async ({ request }) => {
  if (!isAuthorized(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const errors: Record<string, string> = {};
  async function run<T>(name: string, fallback: T, fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (err) {
      errors[name] = err instanceof Error ? err.message : "unknown";
      return fallback;
    }
  }
  const expiredHolds = await run("expireHolds", 0, () => expireHolds());
  const expiredCheckouts = await run("expireCheckouts", 0, () => expireCheckoutSessions());
  const expiredApplications = await run("expireApplications", 0, () => expireApplications());
  const balanceDueMarked = await run("balanceDueMarked", 0, () => markBalanceDue());
  const outbox = await run("outbox", { done: 0, failed: 0, skipped: 0 }, () => processEmailOutboxBatch());
  const balanceReminders = await run("balanceReminders", 0, () => sendBalanceReminders());
  const tripReminders = await run("tripReminders", { preparation: 0, pre: 0, post: 0 }, () => sendTripReminders());
  const retention = await run("retention", { outbox: 0, checkouts: 0, holds: 0 }, async () => ({
    outbox: await purgeOldOutbox(),
    checkouts: await purgeExpiredCheckoutSessions(),
    holds: await purgeTerminalHolds(),
  }));
  return Response.json({ expiredHolds, expiredCheckouts, expiredApplications, balanceDueMarked, outbox, balanceReminders, tripReminders, retention, errors });
};
