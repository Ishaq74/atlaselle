import type { APIRoute } from "astro";
import { eq } from "drizzle-orm";
import { getDrizzle } from "@database/drizzle";
import { checkoutSessions } from "@database/schemas";
import { payments } from "@database/schemas";
import { reservations } from "@database/schemas";
import { travelers } from "@database/schemas";
import { selectPaymentProvider, mockPaymentIdForSession } from "@/modules/payments/domain/providers";
import { processProviderSuccess } from "@/modules/payments/domain/payment-service";

export const prerender = false;

// Callback du provider mock (dev/tests/E2E uniquement — 404 si provider ≠ mock).
// Simule le retour Jacket + webhook Stripe : ?session=<providerSessionId>.
export const GET: APIRoute = async ({ request, redirect }) => {
  if (selectPaymentProvider().name !== "mock") {
    return new Response("Not Found", { status: 404 });
  }
  const url = new URL(request.url);
  const session = url.searchParams.get("session") ?? "";
  const db = getDrizzle();
  const [checkout] = await db
    .select()
    .from(checkoutSessions)
    .where(eq(checkoutSessions.providerSessionId, session))
    .limit(1);
  if (!checkout?.reservationId) return new Response("Not Found", { status: 404 });
  const [payment] = await db.select().from(payments).where(eq(payments.reservationId, checkout.reservationId)).limit(1);
  if (!payment) return new Response("Not Found", { status: 404 });

  await processProviderSuccess({
    outcome: "checkout.completed",
    providerPaymentId: mockPaymentIdForSession(session),
    amount: payment.amount,
    currency: payment.currency,
    idempotencyKey: payment.idempotencyKey,
    raw: { mock: true, session },
  });

  const [reservation] = await db.select().from(reservations).where(eq(reservations.id, checkout.reservationId!)).limit(1);
  const [traveler] = reservation
    ? await db.select().from(travelers).where(eq(travelers.id, reservation.travelerId)).limit(1)
    : [];
  const locale = traveler?.locale ?? "en";
  return redirect(`/${locale}/booking-confirmed?session_id=${encodeURIComponent(session)}`, 302);
};
