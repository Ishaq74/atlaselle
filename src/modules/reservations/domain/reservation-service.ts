import { and, eq, lte, sql } from "drizzle-orm";
import { getDrizzle } from "@database/drizzle";
import { invalidateCache } from "@database/cache";
import { reservations, reservationPriceSnapshots, outboxEvents } from "@database/schemas";
import { getDepartureById } from "@/modules/departures/repositories/departure.repository";
import { cancelOpenCheckoutsForReservation } from "@/modules/payments/repositories/payment.repository";
import { getReservationById } from "@/modules/reservations/repositories/reservation.repository";
import { assertTransitionReservation } from "./reservation-transitions";
import type { ReservationStatus } from "@database/schemas/reservations.schema";
import type { PricingBreakdown } from "@/modules/pricing/domain/pricing";
import { subtractCalendarMonths } from "@/modules/pricing/domain/pricing";
import { quoteCancellation } from "./cancellation-policy";
import { emitOutboxEvent } from "@/modules/outbox/domain/outbox";
import { promoteNextWaitlistApplicant } from "@/modules/applications/domain/waitlist-service";

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

type Db = ReturnType<typeof getDrizzle>;
type Transaction = Parameters<Parameters<Db["transaction"]>[0]>[0];
type DbScope = Db | Transaction;

// Crée la réservation + snapshot immuable du prix (TODO §12.3).
// Rejoue le numéro en cas de collision d'unicité (aléatoire 6 chars).
export async function createReservation(input: CreateReservationInput) {
  const db = getDrizzle();
  const departure = await getDepartureById(input.departureId, db);
  const configuredDueDate = departure?.balanceDueDate ?? subtractCalendarMonths(departure?.startDate, 2);
  const balanceDueDate = configuredDueDate && configuredDueDate < new Date() ? new Date() : configuredDueDate;
  let lastError: unknown = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
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
          balanceDueDate,
          agreementVersionId: input.agreementVersionId ?? null,
          acceptedAt: input.agreementVersionId ? new Date() : null,
        })
        .returning();
      if (!created) throw new Error("Reservation creation failed");
      await db.insert(reservationPriceSnapshots).values({ reservationId: created.id, snapshot: { ...input.quote } });
      return created;
    } catch (err) {
      // Contrainte d'unicité du numéro : on rejoue, le reste remonte.
      if (isUniqueViolation(err) && attempt < 2) {
        lastError = err;
        continue;
      }
      throw err;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Reservation creation failed");
}

function isUniqueViolation(err: unknown): boolean {
  const e = err as { code?: string; cause?: { code?: string } | null } | null;
  return e?.code === "23505" || e?.cause?.code === "23505";
}

export async function confirmReservation(reservationId: string, paidAmount: number, dbOverride?: DbScope) {
  return applyPaymentToReservation(reservationId, paidAmount, dbOverride);
}

// Paiements cumulatifs (acompte puis solde, TODO §12.1) :
// awaiting_payment → confirmed (solde restant) → completed (soldée).
export async function applyPaymentToReservation(reservationId: string, paidAmount: number, dbOverride?: DbScope) {
  const db = dbOverride ?? getDrizzle();
  const current = await getReservationById(reservationId, db);
  if (!current) throw new Error("Reservation introuvable.");
  if (!Number.isInteger(paidAmount) || paidAmount <= 0 || paidAmount > current.amountDue) {
    throw new Error("Montant du paiement invalide pour le solde restant.");
  }
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
    .set({
      status,
      amountPaid,
      amountDue,
      confirmedAt: current.confirmedAt ?? new Date(),
      ...(from === "awaiting_payment" && amountDue > 0 && current.balanceDueDate && current.balanceDueDate < new Date()
        ? { balanceDueDate: new Date() }
        : {}),
    })
    .where(eq(reservations.id, reservationId))
    .returning();
  return updated;
}

// Annulation : politique (dates), inventaire et notifications gérés par
// l'appelant/l'outbox. Retourne le remboursement éligible (à exécuter via
// refund-service). Ne rembourse jamais silencieusement plus que le payé.
export async function cancelReservation(reservationId: string, now = new Date()) {
  const db = getDrizzle();
  const current = await getReservationById(reservationId, db);
  if (!current) throw new Error("Reservation introuvable.");
  assertTransitionReservation(current.status as ReservationStatus, "cancelled");
  const departure = await getDepartureById(current.departureId, db);
  const quote = departure ? quoteCancellation(departure.startDate, current.amountPaid, now) : null;
  const [updated] = await db
    .update(reservations)
    .set({ status: "cancelled", cancelledAt: now })
    .where(eq(reservations.id, reservationId))
    .returning();
  // Les liens checkout ouverts ne doivent plus aboutir sur un dossier annulé.
  await cancelOpenCheckoutsForReservation(reservationId, db);
  // L'annulation libère la place.
  await invalidateCache("trip:");
  await invalidateCache("trips:list");
  await emitOutboxEvent({
    eventType: "reservation.cancelled",
    aggregateType: "reservation",
    aggregateId: reservationId,
    payload: { reservationId, refundAmount: quote?.refundAmount ?? 0, tier: quote?.tier ?? "none" },
  });
  if (updated) await promoteNextWaitlistApplicant(current.departureId, now);
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
  let updated = 0;
  for (const row of due) {
    const changed = await db.transaction(async (tx) => {
      const [reservation] = await tx
        .update(reservations)
        .set({ status: "balance_due" })
        .where(and(eq(reservations.id, row.id), eq(reservations.status, "confirmed"), sql`${reservations.amountDue} > 0`))
        .returning({ id: reservations.id });
      if (!reservation) return false;
      await tx.insert(outboxEvents).values({
        eventType: "reservation.balance_due",
        aggregateType: "reservation",
        aggregateId: reservation.id,
        payload: { reservationId: reservation.id },
      });
      return true;
    });
    if (changed) updated += 1;
  }
  return updated;
}
