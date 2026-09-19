import { ActionError, defineAction } from "astro:actions";
import { eq } from "drizzle-orm";
import { z } from "astro/zod";
import { getDrizzle } from "@database/drizzle";
import { reservations } from "@database/schemas";
import { LOCALES } from "@i18n/config";
import { refundReservationPayments } from "@/modules/payments/domain/refund-service";
import { initiateBalancePayment } from "@/modules/payments/domain/payment-service";
import { toActionError } from "@/lib/voyage-errors";
import { assertVoyagePermission, auditVoyage } from "./_helpers";

export const paymentRefundInput = z.object({
  reservationId: z.uuid(),
  amount: z.number().int().positive().optional(),
});

// Remboursement (finance) : provider → transaction → audit (TODO §13.6).
// Ré-authentification admin requise côté UI avant appel.
export const refundPayment = defineAction({
  input: paymentRefundInput,
  handler: async (input, context) => {
    const user = await assertVoyagePermission(context, { payment: ["refund"] });
    const [reservation] = await getDrizzle().select().from(reservations).where(eq(reservations.id, input.reservationId)).limit(1);
    if (!reservation) throw new ActionError({ code: "NOT_FOUND", message: "Réservation introuvable." });
    let result: { success?: boolean; amount?: number; providerRefundId: string | null };
    try {
      const refunded = await refundReservationPayments(input.reservationId, input.amount);
      result = { success: true, amount: refunded.amount, providerRefundId: refunded.providerRefundId };
    } catch (err) {
      if (err instanceof ActionError) throw err;
      throw new ActionError({ code: "BAD_REQUEST", message: err instanceof Error ? err.message : "Remboursement impossible." });
    }
    auditVoyage(context, user.id, "PAYMENT_REFUND", {
      resource: "reservations",
      resourceId: input.reservationId,
      metadata: { amount: result.amount, providerRefundId: result.providerRefundId },
    });
    return { success: true, providerRefundId: result.providerRefundId };
  },
});

export const payBalanceInput = z.object({
  reservationId: z.uuid(),
  travelerEmail: z.string().trim().check(z.email()).max(320),
  // Preuve de consentement CGV (cf. checkoutInitiateInput).
  termsAccepted: z.literal(true),
  locale: z.enum(LOCALES).default("en"),
});

// Règlement du solde (TODO §13.6).
export const payBalance = defineAction({
  input: payBalanceInput,
  handler: async (input, context) => {
    const origin = new URL(context.request.url).origin;
    try {
      return await initiateBalancePayment({
        reservationId: input.reservationId,
        travelerEmail: input.travelerEmail,
        successUrl: `${origin}/${input.locale}/booking-confirmed?session_id={CHECKOUT_SESSION_ID}`,
        cancelUrl: `${origin}/${input.locale}/booking-confirmed`,
      });
    } catch (err) {
      throw toActionError(err);
    }
  },
});
