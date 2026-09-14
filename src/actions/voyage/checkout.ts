import { ActionError, defineAction } from "astro:actions";
import { z } from "astro/zod";
import { LOCALES } from "@i18n/config";
import { initiateCheckout as runCheckoutTunnel } from "@/modules/payments/domain/payment-service";
import { getValidCheckoutSession } from "@/modules/payments/domain/checkout-service";
import { normalizeEmail } from "@/modules/travelers/domain/traveler-email";
import { assertVoyagePermission, auditVoyage } from "./_helpers";

const initiateSchema = z.object({
  checkoutSessionId: z.string().uuid(),
  travelerEmail: z.string().trim().email().max(320),
  roomType: z.enum(["shared", "single"]).default("shared"),
  agreementVersionId: z.string().max(160).nullable().optional(),
  locale: z.enum(LOCALES).default("en"),
});

// Initialise le tunnel : hold → snapshot → session provider (TODO §13.4).
export const initiateCheckout = defineAction({
  input: initiateSchema,
  handler: async (input, context) => {
    const origin = new URL(context.request.url).origin;
    const valid = await getValidCheckoutSession(input.checkoutSessionId);
    if (!valid) {
      throw new ActionError({ code: "GONE", message: "[CHECKOUT_EXPIRED] Lien de paiement expiré ou invalide." });
    }
    const result = await runCheckoutTunnel({
      checkoutSessionId: input.checkoutSessionId,
      travelerEmail: normalizeEmail(input.travelerEmail),
      roomType: input.roomType,
      agreementVersionId: input.agreementVersionId ?? null,
      successUrl: `${origin}/${input.locale}/booking-confirmed?session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${origin}/${input.locale}/checkout/${input.checkoutSessionId}`,
    });
    return result;
  },
});

const cancelSchema = z.object({ reservationId: z.string().uuid() });

// Annulation manuelle (admin/support) : politique + inventaire + audit (TODO §13.6).
export const cancelReservation = defineAction({
  input: cancelSchema,
  handler: async (input, context) => {
    const user = await assertVoyagePermission(context, { reservation: ["cancel"] });
    const { cancelReservation } = await import("@/modules/reservations/domain/reservation-service");
    const updated = await cancelReservation(input.reservationId);
    if (!updated) throw new ActionError({ code: "NOT_FOUND", message: "Réservation introuvable." });
    auditVoyage(context, user.id, "RESERVATION_CANCEL", { resource: "reservations", resourceId: input.reservationId });
    return { success: true };
  },
});
