import { and, eq, lte, sql } from "drizzle-orm";
import { getDrizzle } from "@database/drizzle";
import { reservations, reservationPriceSnapshots } from "@database/schemas";
import { departures } from "@database/schemas/departures.schema";
import { assertTransitionReservation } from "./reservation-transitions";
import type { ReservationStatus } from "@database/schemas/reservations.schema";
import type { PricingBreakdown } from "@/modules/pricing/domain/pricing";
import { quoteCancellation } from "./cancellation-policy";
import { emitOutboxEvent } from "@/modules/outbox/domain/outbox";

// Numéro lisible unique : ATL-2027-XXXXXX.
export function newReservationNumber(now = new Date()): string {
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase().padEnd(6, "0");
  return `ATL-${now.getUTCFullYear()}-${rand}`;
}

export interface CreateReservationInput {
  travelerId: string;
  tripId: string;
  departureId: string;
  applicationId?: string | null;
  quote: PricingBreakdown;
  agreementVersionId?: string | null;
}

// Crée la réservation + snapshot immuable du prix (TODO §12.3).
export async function createReservation(input: CreateReservationInput) {
  const db = getDrizzle();
  const [created] = await db
    .insert(reservations)
    .values({
      reservationNumber: newReservationNumber(),
      travelerId: input.travelerId,
      tripId: input.tripId,
      departureId: input.departureId,
      applicationId: input.applicationId ?? null,
      status: "pending",
      currency: input.quote.currency,
      baseAmount: input.quote.baseAmount,
      singleSupplementAmount: input.quote.supplementAmount,
      discountAmount: input.quote.discountAmount,
      taxAmount: input.quote.taxAmount,
      feeAmount: input.quote.feeAmount,
      totalAmount: input.quote.totalAmount,
      amountPaid: 0,
      amountDue: input.quote.totalAmount,
      agreementVersionId: input.agreementVersionId ?? null,
      acceptedAt: input.agreementVersionId ? new Date() : null,
    })
    .returning();
  if (!created) throw new Error("Reservation creation failed");
  await db.insert(reservationPriceSnapshots).values({ reservationId: created.id, snapshot: { ...input.quote } });
  return created;
}

export async function confirmReservation(reservationId: string, paidAmount: number) {
  return applyPaymentToReservation(reservationId, paidAmount);
}

// Paiements cumulatifs (acompte puis solde, TODO §12.1) :
// awaiting_payment → confirmed (solde restant) → completed (soldée).
export async function applyPaymentToReservation(reservationId: string, paidAmount: number) {
  const db = getDrizzle();
  const [current] = await db.select().from(reservations).where(eq(reservations.id, reservationId)).limit(1);
  if (!current) throw new Error("Reservation introuvable.");
  const from = current.status as ReservationStatus;
  const amountPaid = current.amountPaid + paidAmount;
  const amountDue = Math.max(0, current.totalAmount - amountPaid);
  let status: ReservationStatus;
  if (from === "awaiting_payment") {
    assertTransitionReservation(from, "confirmed");
    status = amountDue > 0 ? "confirmed" : "completed";
  } else if (from === "confirmed" || from === "balance_due") {
    status = amountDue > 0 ? from : "completed";
    if (status !== from) assertTransitionReservation(from, status);
  } else {
    throw new Error(`Paiement impossible sur réservation ${from}.`);
  }
  const [updated] = await db
    .update(reservations)
    .set({ status, amountPaid, amountDue, confirmedAt: current.confirmedAt ?? new Date() })
    .where(eq(reservations.id, reservationId))
    .returning();
  return updated;
}

// Annulation : politique (dates), inventaire et notifications gérés par
// l'appelant/l'outbox. Retourne le remboursement éligible (à exécuter via
// refund-service). Ne rembourse jamais silencieusement plus que le payé.
export async function cancelReservation(reservationId: string, now = new Date()) {
  const db = getDrizzle();
  const [current] = await db.select().from(reservations).where(eq(reservations.id, reservationId)).limit(1);
  if (!current) throw new Error("Reservation introuvable.");
  assertTransitionReservation(current.status as ReservationStatus, "cancelled");
  const [departure] = await db.select().from(departures).where(eq(departures.id, current.departureId)).limit(1);
  const quote = departure ? quoteCancellation(departure.startDate, current.amountPaid, now) : null;
  const [updated] = await db
    .update(reservations)
    .set({ status: "cancelled", cancelledAt: now })
    .where(eq(reservations.id, reservationId))
    .returning();
  await emitOutboxEvent({
    eventType: "reservation.cancelled",
    aggregateType: "reservation",
    aggregateId: reservationId,
    payload: { reservationId, refundAmount: quote?.refundAmount ?? 0, tier: quote?.tier ?? "none" },
  });
  return { reservation: updated, refundAmount: quote?.refundAmount ?? 0, tier: quote?.tier ?? "none" as const };
}

// Soldes échus : confirmed → balance_due quand balanceDueDate passée (job).
export async function markBalanceDue(now = new Date()): Promise<number> {
  const db = getDrizzle();
  const due = await db
    .select({ id: reservations.id })
    .from(reservations)
    .where(
      and(
        eq(reservations.status, "confirmed"),
        lte(reservations.balanceDueDate, now),
        sql`${reservations.amountDue} > 0`,
      ),
    );
  for (const row of due) {
    await db.update(reservations).set({ status: "balance_due" }).where(eq(reservations.id, row.id));
  }
  return due.length;
}
