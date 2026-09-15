import type { APIRoute } from "astro";
import { selectPaymentProvider, UnhandledWebhookError } from "@/modules/payments/domain/providers";
import { processProviderSuccess, failPaymentByProviderId } from "@/modules/payments/domain/payment-service";

export const prerender = false;

// Webhook provider (Stripe) : signature → idempotence → montants → transaction (TODO §13.3).
// 200 après traitement (sinon retries) ; 400 = signature invalide ;
// événements valides non gérés = 200 sans effet (pas de retry inutile).
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
  } catch (err) {
    if (err instanceof UnhandledWebhookError) {
      console.info(`[payments] ${err.message}`);
      return new Response("OK", { status: 200 });
    }
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
