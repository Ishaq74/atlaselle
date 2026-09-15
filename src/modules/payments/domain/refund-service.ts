import { eq } from "drizzle-orm";
import { getDrizzle } from "@database/drizzle";
import { payments, reservations } from "@database/schemas";
import { newIdempotencyKey } from "./payment-transitions";
import { selectPaymentProvider } from "./providers";
import { emitOutboxEvent } from "@/modules/outbox/domain/outbox";

export interface RefundResult {
  refunded: boolean;
  amount: number;
  providerRefundId: string | null;
}

// Rembourse le paiement soldé d'une réservation (total ou partiel).
// Utilisé par l'action finance ET par l'annulation (politique).
export async function refundReservationPayments(reservationId: string, amount?: number): Promise<RefundResult> {
  const db = getDrizzle();
  const [reservation] = await db.select().from(reservations).where(eq(reservations.id, reservationId)).limit(1);
  if (!reservation) throw new Error("Reservation introuvable.");
  const paid = await db.select().from(payments).where(eq(payments.reservationId, reservationId));
  const target = paid.find((p) => p.status === "paid" || p.status === "partially_refunded");
  if (!target?.providerPaymentId) throw new Error("Aucun paiement remboursable.");
  const refundAmount = amount ?? target.amount;
  if (refundAmount <= 0 || refundAmount > target.amount) throw new Error("Montant de remboursement invalide.");

  const { providerRefundId } = await selectPaymentProvider().createRefund({
    providerPaymentId: target.providerPaymentId,
    amount: refundAmount,
    idempotencyKey: newIdempotencyKey(),
  });
  const full = refundAmount >= target.amount;
  await db.transaction(async (tx) => {
    await tx
      .update(payments)
      .set({ status: full ? "refunded" : "partially_refunded" })
      .where(eq(payments.id, target.id));
    if (full) {
      await tx.update(reservations).set({ status: "refunded" }).where(eq(reservations.id, reservationId));
    }
  });
  await emitOutboxEvent({
    eventType: "payment.refunded",
    aggregateType: "payment",
    aggregateId: target.id,
    payload: { paymentId: target.id, reservationId, amount: refundAmount, providerRefundId },
  });
  return { refunded: true, amount: refundAmount, providerRefundId };
}
