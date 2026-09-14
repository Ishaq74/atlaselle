import { eq } from "drizzle-orm";
import { getDrizzle } from "@database/drizzle";
import { reservations } from "@database/schemas";
import { checkoutSessions } from "@database/schemas";
import { departures } from "@database/schemas";
import { tripTranslations } from "@database/schemas";
import { isValidLocale } from "@/i18n/utils";
import type { Locale } from "@/i18n/config";
import { getValidCheckoutSession } from "@/modules/payments/domain/checkout-service";
import { quoteForDeparture } from "@/modules/pricing/domain/pricing-service";
import type { PricingBreakdown, RoomType } from "@/modules/pricing/domain/pricing";

export interface BookingConfirmationDTO {
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
  const [checkout] = await db
    .select()
    .from(checkoutSessions)
    .where(eq(checkoutSessions.providerSessionId, providerSessionId))
    .limit(1);
  if (!checkout?.reservationId) return null;
  const [reservation] = await db.select().from(reservations).where(eq(reservations.id, checkout.reservationId)).limit(1);
  if (!reservation) return null;
  const [tr] = await db
    .select({ title: tripTranslations.title })
    .from(tripTranslations)
    .where(eq(tripTranslations.tripId, reservation.tripId));
  return {
    reservationNumber: reservation.reservationNumber,
    status: reservation.status,
    totalAmount: reservation.totalAmount,
    amountPaid: reservation.amountPaid,
    currency: reservation.currency,
    tripTitle: tr?.title ?? reservation.tripId,
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
  const [dep] = await db.select().from(departures).where(eq(departures.id, valid.session.departureId)).limit(1);
  if (!dep) return null;
  const quote = await quoteForDeparture(dep.id, roomType);
  if (!quote) return null;
  const [tr] = await db
    .select({ title: tripTranslations.title })
    .from(tripTranslations)
    .where(eq(tripTranslations.tripId, valid.application.tripId));
  return {
    sessionId: valid.session.id,
    applicationId: valid.application.id,
    departureId: dep.id,
    tripTitle: tr?.title ?? valid.application.tripId,
    startDate: dep.startDate,
    endDate: dep.endDate,
    quote,
  };
}
