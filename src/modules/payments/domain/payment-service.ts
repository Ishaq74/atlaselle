import { and, eq } from "drizzle-orm";
import { getDrizzle } from "@database/drizzle";
import { payments, checkoutSessions } from "@database/schemas";
import { seatHolds } from "@database/schemas/departures.schema";
import { reservations } from "@database/schemas";
import { applications } from "@database/schemas";
import { travelers } from "@database/schemas";
import { quoteForDeparture } from "@/modules/pricing/domain/pricing-service";
import type { RoomType } from "@/modules/pricing/domain/pricing";
import { holdSeats, convertHold, releaseHold } from "@/modules/availability/domain/availability-service";
import { createReservation, confirmReservation } from "@/modules/reservations/domain/reservation-service";
import { markCheckoutCompleted } from "./checkout-service";
import { newIdempotencyKey } from "./payment-transitions";
import { selectPaymentProvider, type ProviderWebhookEvent } from "./providers";
import { emitOutboxEvent } from "@/modules/outbox/domain/outbox";
import { codedError } from "@/lib/voyage-codes";

// Tunnel : hold → snapshot prix → session provider (TODO §13.4).
// Hold orphelin en cas d'échec provider : expiré par job (TTL 30 min).
export async function initiateCheckout(input: {
  checkoutSessionId: string;
  travelerEmail: string;
  roomType?: RoomType;
  agreementVersionId?: string | null;
  successUrl: string;
  cancelUrl: string;
}): Promise<{ reservationId: string; checkoutUrl: string }> {
  const db = getDrizzle();
  const [checkout] = await db.select().from(checkoutSessions).where(eq(checkoutSessions.id, input.checkoutSessionId)).limit(1);
  if (!checkout || checkout.status !== "open" || checkout.expiresAt.getTime() <= Date.now()) {
    throw codedError("CHECKOUT_EXPIRED", "Lien de paiement expiré ou invalide.");
  }
  const [application] = await db.select().from(applications).where(eq(applications.id, checkout.applicationId)).limit(1);
  if (!application || application.status !== "approved") {
    throw codedError("CHECKOUT_EXPIRED", "Candidature non approuvée.");
  }
  const [traveler] = await db.select().from(travelers).where(eq(travelers.id, application.travelerId)).limit(1);
  if (!traveler || traveler.email.toLowerCase() !== input.travelerEmail.trim().toLowerCase()) {
    throw codedError("CHECKOUT_EXPIRED", "Email ne correspondant pas au dossier.");
  }
  if (checkout.reservationId) {
    const [existing] = await db.select().from(reservations).where(eq(reservations.id, checkout.reservationId)).limit(1);
    if (existing && (existing.status === "confirmed" || existing.status === "awaiting_payment")) {
      throw codedError("RESERVATION_ALREADY_CONFIRMED", "Réservation déjà en cours.");
    }
  }

  const quote = await quoteForDeparture(checkout.departureId, input.roomType ?? "shared");
  if (!quote) throw codedError("CHECKOUT_EXPIRED", "Départ introuvable.");
  const hold = await holdSeats(checkout.departureId, { applicationId: application.id, quantity: 1 });

  try {
    const reservation = await createReservation({
      travelerId: traveler.id,
      tripId: application.tripId,
      departureId: application.departureId,
      applicationId: application.id,
      quote,
      agreementVersionId: input.agreementVersionId ?? null,
    });
    const idempotencyKey = newIdempotencyKey();
    const [payment] = await db
      .insert(payments)
      .values({
        reservationId: reservation.id,
        provider: selectPaymentProvider().name,
        type: "full_payment",
        amount: quote.totalAmount,
        currency: quote.currency,
        idempotencyKey,
      })
      .returning();
    if (!payment) throw new Error("Payment creation failed");

    await db
      .update(reservations)
      .set({ status: "awaiting_payment" })
      .where(eq(reservations.id, reservation.id));
    await db
      .update(checkoutSessions)
      .set({ reservationId: reservation.id })
      .where(eq(checkoutSessions.id, checkout.id));

    const provider = selectPaymentProvider();
    const session = await provider.createCheckoutSession({
      amount: quote.totalAmount,
      currency: quote.currency,
      idempotencyKey,
      reservationId: reservation.id,
      customerEmail: traveler.email,
      successUrl: input.successUrl,
      cancelUrl: input.cancelUrl,
    });
    await db
      .update(checkoutSessions)
      .set({ providerSessionId: session.providerSessionId })
      .where(eq(checkoutSessions.id, checkout.id));
    return { reservationId: reservation.id, checkoutUrl: session.checkoutUrl };
  } catch (err) {
    await releaseHold(hold.id).catch(() => {});
    throw err;
  }
}

// Webhook : vérifié, idempotent, montants re-vérifiés (TODO §13.3).
// Webhook dupliqué → 1 paiement, 1 confirmation (retourne { duplicate: true }).
export async function processProviderSuccess(event: ProviderWebhookEvent): Promise<{ reservationId: string; duplicate: boolean }> {
  const db = getDrizzle();
  const [payment] = await db
    .select()
    .from(payments)
    .where(eq(payments.providerPaymentId, event.providerPaymentId))
    .limit(1);
  const target = payment
    ?? (event.idempotencyKey
      ? (await db.select().from(payments).where(eq(payments.idempotencyKey, event.idempotencyKey)).limit(1))[0]
      : undefined);
  if (!target) throw codedError("PAYMENT_FAILED", "Paiement introuvable pour cet événement.");
  if (target.status === "paid") return { reservationId: target.reservationId, duplicate: true };
  if (target.amount !== event.amount || target.currency !== event.currency) {
    await db.update(payments).set({ status: "failed", failedAt: new Date() }).where(eq(payments.id, target.id));
    throw codedError("PAYMENT_AMOUNT_MISMATCH", "Montant du paiement différent du montant réservé.");
  }
  const [reservation] = await db.select().from(reservations).where(eq(reservations.id, target.reservationId)).limit(1);
  if (!reservation) throw codedError("PAYMENT_FAILED", "Réservation introuvable.");

  await db
    .update(payments)
    .set({ status: "paid", providerPaymentId: event.providerPaymentId, paidAt: new Date() })
    .where(eq(payments.id, target.id));
  await confirmReservation(reservation.id, event.amount);
  await markCheckoutCompletedForReservation(reservation.id);

  const [application] = reservation.applicationId
    ? await db.select().from(applications).where(eq(applications.id, reservation.applicationId)).limit(1)
    : [undefined];
  if (application) {
    // Convertit les holds actifs de la candidature (les autres expirent par TTL).
    const holds = await db
      .select({ id: seatHolds.id })
      .from(seatHolds)
      .where(and(eq(seatHolds.applicationId, application.id), eq(seatHolds.status, "active")));
    for (const h of holds) await convertHold(h.id);
  }
  await emitOutboxEvent({
    eventType: "payment.received",
    aggregateType: "payment",
    aggregateId: target.id,
    payload: { paymentId: target.id, reservationId: reservation.id, amount: event.amount, currency: event.currency },
  });
  await emitOutboxEvent({
    eventType: "booking.confirmed",
    aggregateType: "reservation",
    aggregateId: reservation.id,
    payload: { reservationId: reservation.id },
  });
  return { reservationId: reservation.id, duplicate: false };
}

async function markCheckoutCompletedForReservation(reservationId: string): Promise<void> {
  const db = getDrizzle();
  const rows = await db.select().from(checkoutSessions).where(eq(checkoutSessions.reservationId, reservationId));
  for (const row of rows) {
    if (row.status === "open") await markCheckoutCompleted(row.id, reservationId);
  }
}

export async function failPaymentByProviderId(providerPaymentId: string): Promise<void> {
  await getDrizzle()
    .update(payments)
    .set({ status: "failed", failedAt: new Date() })
    .where(eq(payments.providerPaymentId, providerPaymentId));
}
