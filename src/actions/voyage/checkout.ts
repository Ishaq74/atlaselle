import { ActionError, defineAction } from "astro:actions";
import { z } from "astro/zod";
import { eq } from "drizzle-orm";
import { LOCALES } from "@i18n/config";
import { getDrizzle } from "@database/drizzle";
import { policyVersions } from "@database/schemas";
import { initiateCheckout as runCheckoutTunnel } from "@/modules/payments/domain/payment-service";
import { getValidCheckoutSession } from "@/modules/payments/domain/checkout-service";
import { normalizeEmail } from "@/modules/travelers/domain/traveler-email";
import { toActionError } from "@/lib/voyage-errors";
import { cancelReservation as cancelReservationService } from "@/modules/reservations/domain/reservation-service";
import { refundReservationPayments } from "@/modules/payments/domain/refund-service";
import { assertVoyagePermission, auditVoyage } from "./_helpers";

export const checkoutInitiateInput = z.object({
  checkoutSessionId: z.uuid(),
  travelerEmail: z.string().trim().check(z.email()).max(320),
  roomType: z.enum(["shared", "single"]).default("shared"),
  agreementVersionId: z.string().max(160).nullable().optional(),
  // Preuve de consentement CGV : le client envoie l'état réel de la case
  // (le navigateur bloque l'envoi si décochée, le serveur l'exige).
  termsAccepted: z.literal(true),
  locale: z.enum(LOCALES).default("en"),
});

// Initialise le tunnel : hold → snapshot → session provider (TODO §13.4).
export const initiateCheckout = defineAction({
  input: checkoutInitiateInput,
  handler: async (input, context) => {
    const origin = new URL(context.request.url).origin;
    const valid = await getValidCheckoutSession(input.checkoutSessionId);
    if (!valid) {
      throw new ActionError({ code: "GONE", message: "[CHECKOUT_EXPIRED] Lien de paiement expiré ou invalide." });
    }
    if (input.agreementVersionId != null) {
      const [version] = await getDrizzle()
        .select({ id: policyVersions.id })
        .from(policyVersions)
        .where(eq(policyVersions.id, input.agreementVersionId))
        .limit(1);
      if (!version) {
        throw new ActionError({ code: "BAD_REQUEST", message: "Version des conditions introuvable." });
      }
    }
    try {
      const result = await runCheckoutTunnel({
        checkoutSessionId: input.checkoutSessionId,
        travelerEmail: normalizeEmail(input.travelerEmail),
        roomType: input.roomType,
        agreementVersionId: input.agreementVersionId ?? null,
        successUrl: `${origin}/${input.locale}/booking-confirmed?session_id={CHECKOUT_SESSION_ID}`,
        cancelUrl: `${origin}/${input.locale}/checkout/${input.checkoutSessionId}`,
      });
      return result;
    } catch (err) {
      throw toActionError(err);
    }
  },
});

const cancelSchema = z.object({ reservationId: z.uuid() });

// Annulation manuelle (admin/support) : politique + remboursement éligible
// automatique via provider + audit (TODO §13.6).
export const cancelReservation = defineAction({
  input: cancelSchema,
  handler: async (input, context) => {
    const user = await assertVoyagePermission(context, { reservation: ["cancel"] });
    let cancelled: { reservation: { id: string } | null; refundAmount: number };
    try {
      cancelled = await cancelReservationService(input.reservationId);
    } catch (err) {
      if (err instanceof Error && err.message.includes("introuvable")) {
        throw new ActionError({ code: "NOT_FOUND", message: "Réservation introuvable." });
      }
      throw toActionError(err);
    }
    const { reservation, refundAmount } = cancelled;
    if (!reservation) throw new ActionError({ code: "NOT_FOUND", message: "Réservation introuvable." });
    let providerRefundId: string | null = null;
    if (refundAmount > 0) {
      try {
        const refunded = await refundReservationPayments(input.reservationId, refundAmount);
        providerRefundId = refunded.providerRefundId;
      } catch (err) {
        // Remboursement à traiter manuellement (finance alertée via audit).
        auditVoyage(context, user.id, "PAYMENT_REFUND", {
          resource: "reservations",
          resourceId: input.reservationId,
          metadata: { manualRefundRequired: true, refundAmount, error: err instanceof Error ? err.message : "unknown" },
        });
      }
    }
    auditVoyage(context, user.id, "RESERVATION_CANCEL", {
      resource: "reservations",
      resourceId: input.reservationId,
      metadata: { refundAmount, providerRefundId },
    });
    return { success: true, refundAmount, providerRefundId };
  },
});
