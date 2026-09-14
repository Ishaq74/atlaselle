import type { APIRoute } from "astro";
import { selectPaymentProvider } from "@/modules/payments/domain/providers";
import { processProviderSuccess, failPaymentByProviderId } from "@/modules/payments/domain/payment-service";

export const prerender = false;

// Webhook provider (Stripe) : signature → idempotence → montants → transaction (TODO §13.3).
// Toujours 200 après traitement (sinon le provider réessaie) ; 400 = signature invalide.
export const POST: APIRoute = async ({ request }) => {
  const provider = selectPaymentProvider();
  if (provider.name !== "stripe") {
    return new Response("Not Found", { status: 404 });
  }
  const rawBody = await request.text();
  const signature = request.headers.get("stripe-signature");
  let event;
  try {
    event = await provider.verifyWebhook(rawBody, signature);
  } catch {
    return new Response("Bad Request", { status: 400 });
  }
  try {
    if (event.outcome === "checkout.completed") {
      await processProviderSuccess(event);
    } else {
      await failPaymentByProviderId(event.providerPaymentId);
    }
  } catch (err) {
    console.error("[payments] Webhook processing failed:", err);
  }
  return new Response("OK", { status: 200 });
};
