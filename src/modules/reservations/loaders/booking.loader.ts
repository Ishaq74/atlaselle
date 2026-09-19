import { getDrizzle } from "@database/drizzle";
import { getReservationById } from "@/modules/reservations/repositories/reservation.repository";
import { isValidLocale } from "@/i18n/utils";
import type { Locale } from "@/i18n/config";
import { getValidCheckoutSession } from "@/modules/payments/domain/checkout-service";
import { quoteForDeparture } from "@/modules/pricing/domain/pricing-service";
import type { PricingBreakdown, RoomType } from "@/modules/pricing/domain/pricing";

export interface BookingConfirmationDTO {
  reservationId: string;
  reservationNumber: string;
  status: string;
  totalAmount: number;
  amountPaid: number;
  currency: string;
  tripTitle: string;
}

// Confirmation par session provider (lien succès, sans PII dans l'URL).
export async function loadBookingByProviderSession(
  locale: Locale,
  providerSessionId: string,
): Promise<BookingConfirmationDTO | null> {
  if (!isValidLocale(locale) || !providerSessionId) return null;
  const db = getDrizzle();
  const { getCheckoutByProviderSessionId } = await import("@/modules/payments/repositories/payment.repository");
  const checkout = await getCheckoutByProviderSessionId(providerSessionId, db);
  if (!checkout?.reservationId) return null;
  const reservation = await getReservationById(checkout.reservationId, db);
  if (!reservation) return null;
  const { getTripTitle } = await import("@/modules/trips/repositories/trip.repository");
  const title = await getTripTitle(reservation.tripId, db);
  return {
    reservationId: reservation.id,
    reservationNumber: reservation.reservationNumber,
    status: reservation.status,
    totalAmount: reservation.totalAmount,
    amountPaid: reservation.amountPaid,
    currency: reservation.currency,
    tripTitle: title ?? reservation.tripId,
  };
}

export interface CheckoutPageDTO {
  sessionId: string;
  applicationId: string;
  departureId: string;
  tripTitle: string;
  startDate: Date;
  endDate: Date;
  quote: PricingBreakdown;
}

/**
 * Contexte du callback mock (dev/tests uniquement) : checkout + paiement + réservation + locale voyageur.
 * Couche loader — l'endpoint ne fait que transport + garde provider.
 */
export async function loadMockCallbackContext(providerSessionId: string): Promise<{
  reservationId: string;
  payment: { amount: number; currency: string; idempotencyKey: string };
  locale: Locale;
} | null> {
  if (!providerSessionId) return null;
  const db = getDrizzle();
  const { getCheckoutByProviderSessionId, getPaymentByReservationId } = await import("@/modules/payments/repositories/payment.repository");
  const checkout = await getCheckoutByProviderSessionId(providerSessionId, db);
  if (!checkout?.reservationId) return null;
  const payment = await getPaymentByReservationId(checkout.reservationId, db);
  if (!payment) return null;
  const reservation = await getReservationById(checkout.reservationId, db);
  const { getTravelerById } = await import("@/modules/travelers/repositories/traveler.repository");
  const traveler = reservation ? await getTravelerById(reservation.travelerId, db) : null;
  const locale: Locale = traveler && isValidLocale(traveler.locale) ? traveler.locale : "en";
  return { reservationId: checkout.reservationId, payment: { amount: payment.amount, currency: payment.currency, idempotencyKey: payment.idempotencyKey }, locale };
}

// Données d'affichage du checkout : session valide + devis serveur.
export async function loadCheckoutPage(
  locale: Locale,
  sessionId: string,
  roomType: RoomType = "shared",
): Promise<CheckoutPageDTO | null> {
  if (!isValidLocale(locale)) return null;
  const valid = await getValidCheckoutSession(sessionId);
  if (!valid) return null;
  const db = getDrizzle();
  const { getDepartureById } = await import("@/modules/departures/repositories/departure.repository");
  const dep = await getDepartureById(valid.session.departureId, db);
  if (!dep) return null;
  const quote = await quoteForDeparture(dep.id, roomType);
  if (!quote) return null;
  const { getTripTitle } = await import("@/modules/trips/repositories/trip.repository");
  const title = await getTripTitle(valid.application.tripId, db);
  return {
    sessionId: valid.session.id,
    applicationId: valid.application.id,
    departureId: dep.id,
    tripTitle: title ?? valid.application.tripId,
    startDate: dep.startDate,
    endDate: dep.endDate,
    quote,
  };
}
