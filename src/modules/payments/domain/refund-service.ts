import { eq } from "drizzle-orm";
import { getDrizzle } from "@database/drizzle";
import { invalidateCache } from "@database/cache";
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
// Concurrence : la ligne paiement est verrouillée (FOR UPDATE) pendant toute
// l'opération — deux remboursements simultanés ne peuvent pas dépasser le payé
// (le second attend, relit le cumul et échoue sur le plafond).
export async function refundReservationPayments(reservationId: string, amount?: number): Promise<RefundResult> {
  const db = getDrizzle();
  const [reservation] = await db.select().from(reservations).where(eq(reservations.id, reservationId)).limit(1);
  if (!reservation) throw new Error("Reservation introuvable.");
  const outcome = await db.transaction(async (tx) => {
    const paid = await tx.select().from(payments).where(eq(payments.reservationId, reservationId)).for("update");
    const target = paid.find((p) => p.status === "paid" || p.status === "partially_refunded");
    if (!target?.providerPaymentId) throw new Error("Aucun paiement remboursable.");
    // Plafond sur le RESTANT (pas le total) : deux partiels ne doivent jamais
    // dépasser le payé. Suivi cumulé en metadata (pas de table de refunds en V1).
    const alreadyRefunded = Number((target.metadata as Record<string, unknown> | null)?.refundedAmount ?? 0);
    const remaining = target.amount - alreadyRefunded;
    const refundAmount = amount ?? remaining;
    if (refundAmount <= 0 || refundAmount > remaining) throw new Error("Montant de remboursement invalide.");

    const { providerRefundId } = await selectPaymentProvider().createRefund({
      providerPaymentId: target.providerPaymentId,
      amount: refundAmount,
      idempotencyKey: newIdempotencyKey(),
    });
    const refundedTotal = alreadyRefunded + refundAmount;
    const full = refundedTotal >= target.amount;
    await tx
      .update(payments)
      .set({
        status: full ? "refunded" : "partially_refunded",
        metadata: { ...((target.metadata as Record<string, unknown> | null) ?? {}), refundedAmount: refundedTotal },
      })
      .where(eq(payments.id, target.id));
    if (full) {
      await tx.update(reservations).set({ status: "refunded" }).where(eq(reservations.id, reservationId));
    }
    return { target, refundAmount, providerRefundId, full };
  });
  await emitOutboxEvent({
    eventType: "payment.refunded",
    aggregateType: "payment",
    aggregateId: outcome.target.id,
    payload: { paymentId: outcome.target.id, reservationId, amount: outcome.refundAmount, providerRefundId: outcome.providerRefundId },
  });
  // Un remboursement total libère la place.
  await invalidateCache("trip:");
  await invalidateCache("trips:list");
  return { refunded: true, amount: outcome.refundAmount, providerRefundId: outcome.providerRefundId };
}
