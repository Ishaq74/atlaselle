import { and, desc, eq, gt, inArray, isNotNull, lte } from "drizzle-orm";
import { getDrizzle } from "@database/drizzle";
import { invalidateCache } from "@database/cache";
import { applications, payments, checkoutSessions, seatHolds, waitlistEntries, reservations, outboxEvents } from "@database/schemas";
import { getCheckoutById } from "@/modules/payments/repositories/payment.repository";
import { getApplicationById } from "@/modules/applications/repositories/application.repository";
import { getTravelerById } from "@/modules/travelers/repositories/traveler.repository";
import { getReservationById, markReservationAwaitingPayment } from "@/modules/reservations/repositories/reservation.repository";
import { lockDepartureForUpdate } from "@/modules/departures/repositories/departure.repository";
import { quoteForDeparture } from "@/modules/pricing/domain/pricing-service";
import type { RoomType } from "@/modules/pricing/domain/pricing";
import { holdSeats, holdSeatsInTransaction, releaseHold } from "@/modules/availability/domain/availability-service";
import { applyPaymentToReservation, createReservation } from "@/modules/reservations/domain/reservation-service";
import { newIdempotencyKey } from "./payment-transitions";
import { selectPaymentProvider, type ProviderWebhookEvent } from "./providers";
import { emitOutboxEvent } from "@/modules/outbox/domain/outbox";
import { codedError } from "@/lib/voyage-codes";
import { enqueueWaitlist, promoteWaitlist } from "@/modules/applications/domain/waitlist-service";
import { assertTransitionReservation } from "@/modules/reservations/domain/reservation-transitions";

const PAYMENT_SESSION_TTL_MINUTES = 35;
const PAYMENT_HOLD_BUFFER_MINUTES = 5;
// Une tentative de paiement (session provider + marge) non aboutie après ce délai est libérée.
export const PAYMENT_ATTEMPT_TTL_MINUTES = PAYMENT_SESSION_TTL_MINUTES + PAYMENT_HOLD_BUFFER_MINUTES;

// Tunnel : hold → snapshot prix → session provider (TODO §13.4).
// Hold orphelin : TTL standard de 30 min, prolongé jusqu'à 5 min après expiration du checkout provider.
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
  let hold: Awaited<ReturnType<typeof holdSeats>>;
  try {
    const [offered] = await db
      .select({ id: waitlistEntries.id })
      .from(waitlistEntries)
      .where(and(eq(waitlistEntries.applicationId, application.id), eq(waitlistEntries.status, "offered")))
      .limit(1);
    hold = await holdSeats(checkout.departureId, { applicationId: application.id, quantity: 1, allowWaitlist: Boolean(offered) });
  } catch (err) {
    if ((err as { code?: string } | null)?.code !== "DEPARTURE_SOLD_OUT") throw err;
    await enqueueWaitlist(application.id, checkout.departureId);
    await db
      .update(checkoutSessions)
      .set({ status: "expired" })
      .where(and(eq(checkoutSessions.id, checkout.id), eq(checkoutSessions.status, "open")));
    throw codedError("DEPARTURE_SOLD_OUT", "Le départ est complet. Votre demande a été ajoutée à la liste d’attente.");
  }

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
    const paymentCreatedAt = new Date();
    const providerExpiresAt = new Date(paymentCreatedAt.getTime() + PAYMENT_SESSION_TTL_MINUTES * 60_000);
    const attemptExpiresAt = new Date(paymentCreatedAt.getTime() + PAYMENT_ATTEMPT_TTL_MINUTES * 60_000);
    await db.transaction(async (tx) => {
      const [offer] = await tx
        .select({ id: waitlistEntries.id })
        .from(waitlistEntries)
        .where(and(eq(waitlistEntries.applicationId, application.id), eq(waitlistEntries.status, "offered")))
        .limit(1);
      // Proposition de liste d'attente : le hold reste garanti jusqu'à l'échéance de l'offre
      // (jamais raccourci par la tentative de paiement) ; le lien checkout garde l'échéance de l'offre.
      // Hors proposition : hold et checkout suivent la tentative de paiement.
      await tx
        .update(seatHolds)
        .set({ expiresAt: offer && hold.expiresAt > attemptExpiresAt ? hold.expiresAt : attemptExpiresAt })
        .where(and(eq(seatHolds.id, hold.id), eq(seatHolds.status, "active")));
      await tx
        .update(checkoutSessions)
        .set(offer ? { reservationId: reservation.id } : { reservationId: reservation.id, expiresAt: attemptExpiresAt })
        .where(and(eq(checkoutSessions.id, checkout.id), eq(checkoutSessions.status, "open")));
    });

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
        expiresAt: providerExpiresAt,
      });
    } catch (err) {
      await db.transaction(async (tx) => {
        await tx.delete(payments).where(eq(payments.id, payment.id));
        await tx.delete(reservations).where(eq(reservations.id, reservation.id));
        const [offer] = await tx
          .select({ id: waitlistEntries.id })
          .from(waitlistEntries)
          .where(and(eq(waitlistEntries.applicationId, application.id), eq(waitlistEntries.status, "offered")))
          .limit(1);
        // Une défaillance du prestataire n'annule pas une proposition encore valide : le candidat peut réessayer.
        await tx
          .update(checkoutSessions)
          .set({
            reservationId: null,
            status: "open",
            ...(offer ? {} : { expiresAt: new Date(Date.now() + 7 * 24 * 3600_000) }),
          })
          .where(eq(checkoutSessions.id, checkout.id));
      });
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
      payload: {
        checkoutSessionId: checkout.id,
        applicationId: application.id,
        reservationId: reservation.id,
        checkoutUrl: session.checkoutUrl,
      },
    });
    // Les places affichées changent dès le hold.
    await invalidateCache("trip:");
    await invalidateCache("trips:list");
    return { reservationId: reservation.id, checkoutUrl: session.checkoutUrl };
  } catch (err) {
    const [activeOffer] = await db
      .select({ id: waitlistEntries.id })
      .from(waitlistEntries)
      .where(and(eq(waitlistEntries.applicationId, application.id), eq(waitlistEntries.status, "offered")))
      .limit(1)
      .catch(() => []);
    // Le hold d'une proposition encore valide est conservé : il expire avec l'offre.
    if (!activeOffer) await releaseHold(hold.id).catch(() => {});
    await invalidateCache("trip:");
    await invalidateCache("trips:list");
    throw err;
  }
}

// Webhook : vérifié, idempotent, montants re-vérifiés (TODO §13.3).
// Webhook dupliqué → 1 paiement, 1 confirmation (retourne { duplicate: true }).
export async function processProviderSuccess(event: ProviderWebhookEvent): Promise<{ reservationId: string; duplicate: boolean }> {
  const db = getDrizzle();
  const result = await db.transaction(async (tx) => {
    const [byKey] = event.idempotencyKey
      ? await tx.select().from(payments).where(eq(payments.idempotencyKey, event.idempotencyKey)).for("update").limit(1)
      : [];
    const [byProviderId] = !byKey
      ? await tx.select().from(payments).where(eq(payments.providerPaymentId, event.providerPaymentId)).for("update").limit(1)
      : [];
    const target = byKey ?? byProviderId;
    if (!target) return { kind: "missing" as const };
    if (target.providerPaymentId && target.providerPaymentId !== event.providerPaymentId) {
      return { kind: "missing" as const };
    }
    if (["cancelled", "refunded", "partially_refunded"].includes(target.status)) {
      return { kind: "duplicate" as const, reservationId: target.reservationId };
    }
    if (target.status === "paid") {
      return {
        kind: (target.metadata as Record<string, unknown> | null)?.lateRefundRequired === true
          ? "late-refund" as const
          : "duplicate" as const,
        reservationId: target.reservationId,
        paymentId: target.id,
      };
    }
    if (target.amount !== event.amount || target.currency !== event.currency) {
      await tx.update(payments).set({ status: "failed", failedAt: new Date() }).where(eq(payments.id, target.id));
      return { kind: "mismatch" as const };
    }
    const [reservation] = await tx
      .select()
      .from(reservations)
      .where(eq(reservations.id, target.reservationId))
      .for("update")
      .limit(1);
    if (!reservation) return { kind: "missing" as const };
    const departure = await lockDepartureForUpdate(reservation.departureId, tx);
    if (!departure) return { kind: "missing" as const };

    const now = new Date();
    const paymentMetadata = (target.metadata as Record<string, unknown> | null) ?? {};
    const paymentUpdate = await tx
      .update(payments)
      .set({ status: "paid", providerPaymentId: event.providerPaymentId, paidAt: now })
      .where(and(eq(payments.id, target.id), eq(payments.status, target.status)))
      .returning({ id: payments.id });
    if (!paymentUpdate.length) return { kind: "duplicate" as const, reservationId: reservation.id };

    let lateRefund =
      event.amount > reservation.amountDue ||
      !["awaiting_payment", "confirmed", "balance_due"].includes(reservation.status);
    let holdId: string | null = null;
    if (!lateRefund && reservation.status === "awaiting_payment") {
      const activeHolds = reservation.applicationId
        ? await tx
            .select()
            .from(seatHolds)
            .where(
              and(
                eq(seatHolds.applicationId, reservation.applicationId),
                eq(seatHolds.departureId, reservation.departureId),
                eq(seatHolds.status, "active"),
                gt(seatHolds.expiresAt, now),
              ),
            )
            .for("update")
        : [];
      if (activeHolds.length > 0) {
        holdId = activeHolds[0]!.id;
      } else {
        const [waitlistOffer] = reservation.applicationId
          ? await tx
              .select({ id: waitlistEntries.id, status: waitlistEntries.status })
              .from(waitlistEntries)
              .where(eq(waitlistEntries.applicationId, reservation.applicationId))
              .limit(1)
          : [];
        try {
          const acquired = await holdSeatsInTransaction(
            reservation.departureId,
            {
              applicationId: reservation.applicationId,
              quantity: 1,
              now,
              allowWaitlist: waitlistOffer?.status === "offered",
            },
            tx,
          );
          holdId = acquired.id;
          lateRefund = false;
        } catch (err) {
          if ((err as { code?: string } | null)?.code !== "DEPARTURE_SOLD_OUT") throw err;
        }
      }
    } else if (event.amount > reservation.amountDue) {
      lateRefund = true;
    }

    if (lateRefund) {
      const refundKey = `late-refund-${target.id}`;
      await tx
        .update(payments)
        .set({
          metadata: { ...paymentMetadata, lateRefundRequired: true, lateRefundIdempotencyKey: refundKey },
        })
        .where(eq(payments.id, target.id));
      if (reservation.status === "awaiting_payment") {
        await tx.update(reservations)
          .set({ status: "cancelled", cancelledAt: now })
          .where(eq(reservations.id, reservation.id));
      }
      if (reservation.applicationId) {
        await tx
          .update(seatHolds)
          .set({ status: "released", releasedAt: now })
          .where(and(eq(seatHolds.applicationId, reservation.applicationId), eq(seatHolds.status, "active")));
        await tx
          .update(waitlistEntries)
          .set({ status: "expired", updatedAt: now })
          .where(and(eq(waitlistEntries.applicationId, reservation.applicationId), eq(waitlistEntries.status, "offered")));
      }
      await tx
        .update(checkoutSessions)
        .set({ status: "expired" })
        .where(and(eq(checkoutSessions.reservationId, reservation.id), eq(checkoutSessions.status, "open")));
      return { kind: "late-refund" as const, reservationId: reservation.id, paymentId: target.id };
    }

    await applyPaymentToReservation(reservation.id, event.amount, tx);
    if (holdId && !reservation.applicationId) {
      await tx
        .update(seatHolds)
        .set({ status: "converted" })
        .where(and(eq(seatHolds.id, holdId), eq(seatHolds.status, "active")));
    }
    if (reservation.applicationId) {
      await tx
        .update(seatHolds)
        .set({ status: "converted" })
        .where(
          and(
            eq(seatHolds.applicationId, reservation.applicationId),
            eq(seatHolds.status, "active"),
            gt(seatHolds.expiresAt, now),
          ),
        );
      await tx
        .update(waitlistEntries)
        .set({ status: "promoted", promotedAt: now, updatedAt: now })
        .where(and(eq(waitlistEntries.applicationId, reservation.applicationId), eq(waitlistEntries.status, "offered")));
    }
    await tx
      .update(checkoutSessions)
      .set({ status: "completed", reservationId: reservation.id })
      .where(and(eq(checkoutSessions.reservationId, reservation.id), eq(checkoutSessions.status, "open")));
    await tx.insert(outboxEvents).values({
      eventType: "payment.received",
      aggregateType: "payment",
      aggregateId: target.id,
      payload: { paymentId: target.id, reservationId: reservation.id, amount: event.amount, currency: event.currency },
    });
    if (reservation.status === "awaiting_payment") {
      await tx.insert(outboxEvents).values({
        eventType: "booking.confirmed",
        aggregateType: "reservation",
        aggregateId: reservation.id,
        payload: { reservationId: reservation.id },
      });
    }
    return { kind: "processed" as const, reservationId: reservation.id };
  });

  if (result.kind === "missing") throw codedError("PAYMENT_FAILED", "Paiement introuvable pour cet événement.");
  if (result.kind === "mismatch") throw codedError("PAYMENT_AMOUNT_MISMATCH", "Montant du paiement différent du montant réservé.");
  if (result.kind === "late-refund") {
    await refundLatePayment(result.paymentId);
    await invalidateCache("trip:");
    await invalidateCache("trips:list");
    return { reservationId: result.reservationId, duplicate: false };
  }
  if (result.kind === "processed") {
    await invalidateCache("trip:");
    await invalidateCache("trips:list");
  }
  return { reservationId: result.reservationId, duplicate: result.kind === "duplicate" };
}

async function refundLatePayment(paymentId: string): Promise<void> {
  const db = getDrizzle();
  const [payment] = await db.select().from(payments).where(eq(payments.id, paymentId)).limit(1);
  if (!payment || payment.status !== "paid" || !payment.providerPaymentId) return;
  const metadata = (payment.metadata as Record<string, unknown> | null) ?? {};
  if (metadata.lateRefundRequired !== true) return;
  const refundKey = typeof metadata.lateRefundIdempotencyKey === "string"
    ? metadata.lateRefundIdempotencyKey
    : `late-refund-${payment.id}`;
  const refund = await selectPaymentProvider().createRefund({
    providerPaymentId: payment.providerPaymentId,
    amount: payment.amount,
    idempotencyKey: refundKey,
  });
  await db.transaction(async (tx) => {
    const [locked] = await tx.select().from(payments).where(eq(payments.id, payment.id)).for("update").limit(1);
    const lockedMetadata = (locked?.metadata as Record<string, unknown> | null) ?? {};
    if (!locked || locked.status !== "paid" || lockedMetadata.lateRefundRequired !== true) return;
    await tx
      .update(payments)
      .set({
        status: "refunded",
        metadata: { ...lockedMetadata, lateRefundRequired: false, lateRefundProviderId: refund.providerRefundId },
      })
      .where(eq(payments.id, locked.id));
    const [reservation] = await tx
      .select()
      .from(reservations)
      .where(eq(reservations.id, locked.reservationId))
      .for("update")
      .limit(1);
    if (reservation?.status === "cancelled") {
      await tx.update(reservations)
        .set({ status: "refunded" })
        .where(eq(reservations.id, reservation.id));
    }
    await tx.insert(outboxEvents).values({
      eventType: "payment.refunded",
      aggregateType: "payment",
      aggregateId: locked.id,
      payload: { paymentId: locked.id, reservationId: locked.reservationId, amount: locked.amount, providerRefundId: refund.providerRefundId },
    });
  });
}

export async function failPaymentByProviderId(
  providerPaymentId: string,
  idempotencyKey?: string,
  providerSessionId?: string,
  checkoutExpired = false,
): Promise<void> {
  const db = getDrizzle();
  const result = await db.transaction(async (tx) => {
    const [byKey] = idempotencyKey
      ? await tx.select().from(payments).where(eq(payments.idempotencyKey, idempotencyKey)).for("update").limit(1)
      : [];
    const [byProviderId] = !byKey && providerPaymentId !== "unknown"
      ? await tx.select().from(payments).where(eq(payments.providerPaymentId, providerPaymentId)).for("update").limit(1)
      : [];
    const [checkout] = !byKey && !byProviderId && providerSessionId
      ? await tx.select().from(checkoutSessions).where(eq(checkoutSessions.providerSessionId, providerSessionId)).limit(1)
      : [];
    const [byCheckout] = checkout?.reservationId
      ? await tx.select().from(payments).where(eq(payments.reservationId, checkout.reservationId)).orderBy(payments.createdAt).for("update").limit(1)
      : [];
    const target = byKey ?? byProviderId ?? byCheckout;
    if (!target || target.status === "paid" || target.status === "refunded") return null;
    await tx
      .update(payments)
      .set({ status: "failed", failedAt: new Date() })
      .where(eq(payments.id, target.id));
    if (!checkoutExpired) return null;

    const [reservation] = await tx
      .select()
      .from(reservations)
      .where(eq(reservations.id, target.reservationId))
      .for("update")
      .limit(1);
    if (!reservation) return null;
    await lockDepartureForUpdate(reservation.departureId, tx);
    return releaseUnpaidAttemptInTransaction(tx, reservation, new Date());
  });
  if (result?.released) {
    await invalidateCache("trip:");
    await invalidateCache("trips:list");
    await promoteWaitlist(result.departureId);
  }
}

type Tx = Parameters<Parameters<ReturnType<typeof getDrizzle>["transaction"]>[0]>[0];

// Libère une tentative de paiement non aboutie (session provider expirée ou webhook d'expiration).
// Appelé sous verrou de la réservation et du départ ; idempotent (statut re-vérifié).
// - réservation annulée (jamais confirmée), paiement en attente marqué échoué ;
// - proposition de liste d'attente encore valide : hold conservé, lien rouvert pour réessayer ;
// - proposition échue : expirée + place libérée ;
// - candidature classique : hold libéré et nouveau lien checkout (TTL 7 j) si elle est toujours approuvée.
async function releaseUnpaidAttemptInTransaction(
  tx: Tx,
  reservation: typeof reservations.$inferSelect,
  now: Date,
): Promise<{ departureId: string; released: boolean }> {
  const departureId = reservation.departureId;
  if (reservation.status !== "awaiting_payment" && reservation.status !== "pending") {
    return { departureId, released: false };
  }
  const [paid] = await tx
    .select({ id: payments.id })
    .from(payments)
    .where(and(eq(payments.reservationId, reservation.id), inArray(payments.status, ["paid", "authorized"])))
    .limit(1);
  if (paid) return { departureId, released: false };

  assertTransitionReservation(reservation.status, "cancelled");
  await tx.update(reservations).set({ status: "cancelled", cancelledAt: now }).where(eq(reservations.id, reservation.id));
  await tx
    .update(payments)
    .set({ status: "failed", failedAt: now })
    .where(and(eq(payments.reservationId, reservation.id), inArray(payments.status, ["created", "pending"])));

  const applicationId = reservation.applicationId;
  if (!applicationId) {
    await tx
      .update(checkoutSessions)
      .set({ status: "expired" })
      .where(and(eq(checkoutSessions.reservationId, reservation.id), eq(checkoutSessions.status, "open")));
    return { departureId, released: true };
  }

  const [offer] = await tx
    .select()
    .from(waitlistEntries)
    .where(and(eq(waitlistEntries.applicationId, applicationId), eq(waitlistEntries.status, "offered")))
    .for("update")
    .limit(1);
  if (offer && offer.expiresAt && offer.expiresAt > now) {
    await tx
      .update(checkoutSessions)
      .set({ reservationId: null, status: "open", expiresAt: offer.expiresAt })
      .where(and(eq(checkoutSessions.reservationId, reservation.id), inArray(checkoutSessions.status, ["open", "expired"])));
    return { departureId, released: false };
  }

  await tx
    .update(seatHolds)
    .set({ status: "expired", releasedAt: now })
    .where(and(eq(seatHolds.applicationId, applicationId), eq(seatHolds.status, "active")));
  await tx
    .update(checkoutSessions)
    .set({ status: "expired" })
    .where(and(eq(checkoutSessions.reservationId, reservation.id), eq(checkoutSessions.status, "open")));

  if (offer) {
    await tx
      .update(waitlistEntries)
      .set({ status: "expired", updatedAt: now })
      .where(and(eq(waitlistEntries.id, offer.id), eq(waitlistEntries.status, "offered")));
    await tx.insert(outboxEvents).values({
      eventType: "waitlist.offer_expired",
      aggregateType: "application",
      aggregateId: applicationId,
      payload: { applicationId, departureId },
    });
    return { departureId, released: true };
  }

  const [application] = await tx.select({ status: applications.status }).from(applications).where(eq(applications.id, applicationId)).limit(1);
  if (application?.status === "approved") {
    const [session] = await tx
      .insert(checkoutSessions)
      .values({ applicationId, departureId, expiresAt: new Date(now.getTime() + 7 * 24 * 3600_000) })
      .returning({ id: checkoutSessions.id, expiresAt: checkoutSessions.expiresAt });
    if (session) {
      await tx.insert(outboxEvents).values({
        eventType: "application.approved",
        aggregateType: "application",
        aggregateId: applicationId,
        payload: { applicationId, checkoutSessionId: session.id, expiresAt: session.expiresAt.toISOString() },
      });
    }
  }
  return { departureId, released: true };
}

// Job : tentatives de paiement abandonnées (session provider expirée sans webhook d'expiration
// ni paiement) → réservation annulée, hold libéré, liste d'attente notifiée. Idempotent.
export async function expireStalePaymentAttempts(now = new Date()): Promise<number> {
  const db = getDrizzle();
  const cutoff = new Date(now.getTime() - PAYMENT_ATTEMPT_TTL_MINUTES * 60_000);
  const candidates = await db
    .select({ id: reservations.id, departureId: reservations.departureId })
    .from(reservations)
    .where(
      and(
        inArray(reservations.status, ["pending", "awaiting_payment"]),
        isNotNull(reservations.applicationId),
        lte(reservations.createdAt, cutoff),
      ),
    );
  let released = 0;
  const departures = new Set<string>();
  for (const candidate of candidates) {
    const [latest] = await db
      .select({ createdAt: payments.createdAt })
      .from(payments)
      .where(eq(payments.reservationId, candidate.id))
      .orderBy(desc(payments.createdAt))
      .limit(1);
    if (latest && latest.createdAt > cutoff) continue;
    const result = await db.transaction(async (tx) => {
      const [reservation] = await tx.select().from(reservations).where(eq(reservations.id, candidate.id)).for("update").limit(1);
      if (!reservation) return null;
      await lockDepartureForUpdate(reservation.departureId, tx);
      return releaseUnpaidAttemptInTransaction(tx, reservation, now);
    });
    if (result?.released) {
      released += 1;
      departures.add(result.departureId);
    }
  }
  if (released > 0) {
    await invalidateCache("trip:");
    await invalidateCache("trips:list");
  }
  for (const departureId of departures) await promoteWaitlist(departureId, now);
  return released;
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
  // La page de retour et le callback mock retrouvent la réservation par cette session.
  await db
    .update(payments)
    .set({ metadata: { ...(payment.metadata ?? {}), providerSessionId: session.providerSessionId } })
    .where(eq(payments.id, payment.id));
  return { paymentId: payment.id, checkoutUrl: session.checkoutUrl };
}
