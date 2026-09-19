import type { APIRoute } from "astro";
import { selectPaymentProvider, mockPaymentIdForSession } from "@/modules/payments/domain/providers";
import { processProviderSuccess } from "@/modules/payments/domain/payment-service";
import { loadMockCallbackContext } from "@/modules/reservations/loaders/booking.loader";

export const prerender = false;

// Callback du provider mock (dev/tests/E2E uniquement — 404 si provider ≠ mock).
// Simule le retour Jacket + webhook Stripe : ?session=<providerSessionId>.
export const GET: APIRoute = async ({ request, redirect }) => {
  if (selectPaymentProvider().name !== "mock") {
    return new Response("Not Found", { status: 404 });
  }
  const url = new URL(request.url);
  const session = url.searchParams.get("session") ?? "";
  const ctx = await loadMockCallbackContext(session);
  if (!ctx) return new Response("Not Found", { status: 404 });

  await processProviderSuccess({
    outcome: "checkout.completed",
    providerPaymentId: mockPaymentIdForSession(session),
    amount: ctx.payment.amount,
    currency: ctx.payment.currency,
    idempotencyKey: ctx.payment.idempotencyKey,
    raw: { mock: true, session },
  });

  return redirect(`/${ctx.locale}/booking-confirmed?session_id=${encodeURIComponent(session)}`, 302);
};
