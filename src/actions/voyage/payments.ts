import { ActionError, defineAction } from "astro:actions";
import { eq } from "drizzle-orm";
import { z } from "astro/zod";
import { getDrizzle } from "@database/drizzle";
import { payments, reservations } from "@database/schemas";
import { LOCALES } from "@i18n/config";
import { newIdempotencyKey } from "@/modules/payments/domain/payment-transitions";
import { selectPaymentProvider } from "@/modules/payments/domain/providers";
import { initiateBalancePayment } from "@/modules/payments/domain/payment-service";
import { emitOutboxEvent } from "@/modules/outbox/domain/outbox";
import { assertVoyagePermission, auditVoyage } from "./_helpers";

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
    const db = getDrizzle();
    const [reservation] = await db.select().from(reservations).where(eq(reservations.id, input.reservationId)).limit(1);
    if (!reservation) throw new ActionError({ code: "NOT_FOUND", message: "Réservation introuvable." });
    const paid = await db
      .select()
      .from(payments)
      .where(eq(payments.reservationId, input.reservationId));
    const paidPayment = paid.find((p) => p.status === "paid" || p.status === "partially_refunded");
    if (!paidPayment?.providerPaymentId) {
      throw new ActionError({ code: "BAD_REQUEST", message: "Aucun paiement remboursable." });
    }
    const amount = input.amount ?? paidPayment.amount;
    if (amount <= 0 || amount > paidPayment.amount) {
      throw new ActionError({ code: "BAD_REQUEST", message: "Montant de remboursement invalide." });
    }
    const provider = selectPaymentProvider();
    const { providerRefundId } = await provider.createRefund({
      providerPaymentId: paidPayment.providerPaymentId,
      amount,
      idempotencyKey: newIdempotencyKey(),
    });
    const full = amount >= paidPayment.amount;
    await db.transaction(async (tx) => {
      await tx
        .update(payments)
        .set({ status: full ? "refunded" : "partially_refunded" })
        .where(eq(payments.id, paidPayment.id));
      if (full) {
        await tx.update(reservations).set({ status: "refunded" }).where(eq(reservations.id, reservation.id));
      }
    });
    await emitOutboxEvent({
      eventType: "payment.refunded",
      aggregateType: "payment",
      aggregateId: paidPayment.id,
      payload: { paymentId: paidPayment.id, reservationId: reservation.id, amount, providerRefundId },
    });
    auditVoyage(context, user.id, "PAYMENT_REFUND", {
      resource: "payments",
      resourceId: paidPayment.id,
      metadata: { reservationId: reservation.id, amount, providerRefundId },
    });
    return { success: true, providerRefundId };
  },
});
