import { eq } from "drizzle-orm";
import { getDrizzle } from "@database/drizzle";
import { invalidateCache } from "@database/cache";
import { payments, checkoutSessions } from "@database/schemas";
import { getCheckoutById, getPaymentByProviderId, getPaymentByIdempotencyKey } from "@/modules/payments/repositories/payment.repository";
import { getApplicationById } from "@/modules/applications/repositories/application.repository";
import { getTravelerById } from "@/modules/travelers/repositories/traveler.repository";
import { deleteReservationById, getReservationById, markReservationAwaitingPayment } from "@/modules/reservations/repositories/reservation.repository";
import { getActiveHoldIdsByApplication } from "@/modules/departures/repositories/departure.repository";
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
  const checkout = await getCheckoutById(input.checkoutSessionId, db);
  if (!checkout || checkout.status !== "open" || checkout.expiresAt.getTime() <= Date.now()) {
    throw codedError("CHECKOUT_EXPIRED", "Lien de paiement expiré ou invalide.");
  }
  const application = await getApplicationById(checkout.applicationId, db);
  if (!application || application.status !== "approved") {
    throw codedError("CHECKOUT_EXPIRED", "Candidature non approuvée.");
  }
  const traveler = await getTravelerById(application.travelerId, db);
  if (!traveler || traveler.email.toLowerCase() !== input.travelerEmail.trim().toLowerCase()) {
    throw codedError("CHECKOUT_EXPIRED", "Email ne correspondant pas au dossier.");
  }
  if (checkout.reservationId) {
    const existing = await getReservationById(checkout.reservationId, db);
    if (existing && (existing.status === "confirmed" || existing.status === "awaiting_payment")) {
      throw codedError("RESERVATION_ALREADY_CONFIRMED", "Réservation déjà en cours.");
    }
  }

  const quote = await quoteForDeparture(checkout.departureId, input.roomType ?? "shared");
  if (!quote) throw codedError("CHECKOUT_EXPIRED", "Départ introuvable.");
  // Acompte d'abord si paramétré, sinon totalité (TODO §12.2).
  const chargeNow = quote.depositAmount > 0 && quote.depositAmount < quote.totalAmount ? quote.depositAmount : quote.totalAmount;
  const paymentType = chargeNow < quote.totalAmount ? "deposit" : "full_payment";
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
        type: paymentType,
        amount: chargeNow,
        currency: quote.currency,
        idempotencyKey,
      })
      .returning();
    if (!payment) throw new Error("Payment creation failed");

    await markReservationAwaitingPayment(reservation.id, db);
    await db
      .update(checkoutSessions)
      .set({ reservationId: reservation.id })
      .where(eq(checkoutSessions.id, checkout.id));

    const provider = selectPaymentProvider();
    let session;
    try {
      session = await provider.createCheckoutSession({
        amount: chargeNow,
        currency: quote.currency,
        idempotencyKey,
        reservationId: reservation.id,
        customerEmail: traveler.email,
        successUrl: input.successUrl,
        cancelUrl: input.cancelUrl,
      });
    } catch (err) {
      // Échec provider : on ne laisse ni réservation ni paiement orphelins
      // (sinon un doublon à chaque nouvel essai). Snapshots en cascade.
      // Le hold est libéré dans le catch externe.
      await db
        .update(checkoutSessions)
        .set({ reservationId: null })
        .where(eq(checkoutSessions.id, checkout.id))
        .catch(() => {});
      if (payment) await db.delete(payments).where(eq(payments.id, payment.id)).catch(() => {});
      await deleteReservationById(reservation.id, db).catch(() => {});
      throw err;
    }
    await db
      .update(checkoutSessions)
      .set({ providerSessionId: session.providerSessionId })
      .where(eq(checkoutSessions.id, checkout.id));
    await emitOutboxEvent({
      eventType: "checkout.started",
      aggregateType: "checkout",
      aggregateId: checkout.id,
      payload: { checkoutSessionId: checkout.id, applicationId: application.id, reservationId: reservation.id },
    });
    // Les places affichées changent dès le hold.
    await invalidateCache("trip:");
    await invalidateCache("trips:list");
    return { reservationId: reservation.id, checkoutUrl: session.checkoutUrl };
  } catch (err) {
    await releaseHold(hold.id).catch(() => {});
    await invalidateCache("trip:");
    await invalidateCache("trips:list");
    throw err;
  }
}

// Webhook : vérifié, idempotent, montants re-vérifiés (TODO §13.3).
// Webhook dupliqué → 1 paiement, 1 confirmation (retourne { duplicate: true }).
export async function processProviderSuccess(event: ProviderWebhookEvent): Promise<{ reservationId: string; duplicate: boolean }> {
  const db = getDrizzle();
  const payment = await getPaymentByProviderId(event.providerPaymentId, db);
  const target = payment
    ?? (event.idempotencyKey
      ? await getPaymentByIdempotencyKey(event.idempotencyKey, db) ?? undefined
      : undefined);
  if (!target) throw codedError("PAYMENT_FAILED", "Paiement introuvable pour cet événement.");
  if (target.status === "paid") return { reservationId: target.reservationId, duplicate: true };
  if (target.amount !== event.amount || target.currency !== event.currency) {
    await db.update(payments).set({ status: "failed", failedAt: new Date() }).where(eq(payments.id, target.id));
    throw codedError("PAYMENT_AMOUNT_MISMATCH", "Montant du paiement différent du montant réservé.");
  }
  const reservation = await getReservationById(target.reservationId, db);
  if (!reservation) throw codedError("PAYMENT_FAILED", "Réservation introuvable.");

  await db
    .update(payments)
    .set({ status: "paid", providerPaymentId: event.providerPaymentId, paidAt: new Date() })
    .where(eq(payments.id, target.id));
  await confirmReservation(reservation.id, event.amount);
  await markCheckoutCompletedForReservation(reservation.id);

  const application = reservation.applicationId
    ? await getApplicationById(reservation.applicationId, db)
    : null;
  if (application) {
    // Convertit les holds actifs de la candidature (les autres expirent par TTL).
    const holds = await getActiveHoldIdsByApplication(application.id, db);
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
  // Une place vient d'être confirmée : purger les fiches/listes cachées.
  await invalidateCache("trip:");
  await invalidateCache("trips:list");
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

// Solde : pas de hold (places déjà converties), session provider directe (TODO §13.6).
export async function initiateBalancePayment(input: {
  reservationId: string;
  travelerEmail: string;
  successUrl: string;
  cancelUrl: string;
}): Promise<{ paymentId: string; checkoutUrl: string }> {
  const db = getDrizzle();
  const reservation = await getReservationById(input.reservationId, db);
  if (!reservation || (reservation.status !== "confirmed" && reservation.status !== "balance_due")) {
    throw codedError("CHECKOUT_EXPIRED", "Aucun solde à régler sur cette réservation.");
  }
  if (reservation.amountDue <= 0) {
    throw codedError("RESERVATION_ALREADY_CONFIRMED", "Réservation déjà soldée.");
  }
  const traveler = await getTravelerById(reservation.travelerId, db);
  if (!traveler || traveler.email.toLowerCase() !== input.travelerEmail.trim().toLowerCase()) {
    throw codedError("CHECKOUT_EXPIRED", "Email ne correspondant pas au dossier.");
  }
  const idempotencyKey = newIdempotencyKey();
  const [payment] = await db
    .insert(payments)
    .values({
      reservationId: reservation.id,
      provider: selectPaymentProvider().name,
      type: "balance",
      amount: reservation.amountDue,
      currency: reservation.currency,
      idempotencyKey,
    })
    .returning();
  if (!payment) throw new Error("Payment creation failed");
  let session;
  try {
    session = await selectPaymentProvider().createCheckoutSession({
      amount: reservation.amountDue,
      currency: reservation.currency,
      idempotencyKey,
      reservationId: reservation.id,
      customerEmail: traveler.email,
      successUrl: input.successUrl,
      cancelUrl: input.cancelUrl,
    });
  } catch (err) {
    // Pas de paiement orphelin en `created` : marqué échoué (visible, non réutilisé).
    await db.update(payments).set({ status: "failed", failedAt: new Date() }).where(eq(payments.id, payment.id)).catch(() => {});
    throw err;
  }
  return { paymentId: payment.id, checkoutUrl: session.checkoutUrl };
}
