import { ActionError, defineAction } from "astro:actions";
import { eq } from "drizzle-orm";
import { z } from "astro/zod";
import { getDrizzle } from "@database/drizzle";
import { reservations } from "@database/schemas";
import { LOCALES } from "@i18n/config";
import { refundReservationPayments } from "@/modules/payments/domain/refund-service";
import { initiateBalancePayment } from "@/modules/payments/domain/payment-service";
import { assertVoyagePermission, auditVoyage } from "./_helpers";

const refundSchema = z.object({
  reservationId: z.string().uuid(),
  amount: z.number().int().positive().optional(),
});

// Remboursement (finance) : provider → transaction → audit (TODO §13.6).
// Ré-authentification admin requise côté UI avant appel.
export const refundPayment = defineAction({
  input: refundSchema,
  handler: async (input, context) => {
    const user = await assertVoyagePermission(context, { payment: ["refund"] });
    const [reservation] = await getDrizzle().select().from(reservations).where(eq(reservations.id, input.reservationId)).limit(1);
    if (!reservation) throw new ActionError({ code: "NOT_FOUND", message: "Réservation introuvable." });
    const result = await refundReservationPayments(input.reservationId, input.amount);
    auditVoyage(context, user.id, "PAYMENT_REFUND", {
      resource: "reservations",
      resourceId: input.reservationId,
      metadata: { amount: result.amount, providerRefundId: result.providerRefundId },
    });
    return { success: true, providerRefundId: result.providerRefundId };
  },
});

const payBalanceSchema = z.object({
  reservationId: z.string().uuid(),
  travelerEmail: z.string().trim().email().max(320),
  locale: z.enum(LOCALES).default("en"),
});

// Règlement du solde (TODO §13.6).
export const payBalance = defineAction({
  input: payBalanceSchema,
  handler: async (input, context) => {
    const origin = new URL(context.request.url).origin;
    return initiateBalancePayment({
      reservationId: input.reservationId,
      travelerEmail: input.travelerEmail,
      successUrl: `${origin}/${input.locale}/booking-confirmed?session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${origin}/${input.locale}/booking-confirmed`,
    });
  },
});
