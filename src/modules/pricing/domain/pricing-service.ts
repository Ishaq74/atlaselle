import { getDrizzle } from "@database/drizzle";
import { getDepartureById } from "@/modules/departures/repositories/departure.repository";
import { priceQuote, type PriceQuoteOptions, type PricingBreakdown, type RoomType } from "./pricing";

// Façade serveur : lit le Departure et délègue au moteur pur (TODO §12.2).
// Prix toujours recalculé serveur (checkout + webhook), jamais depuis le client.
// P1-4 : `dbOverride` optionnel pour injection Tx/tests.
export async function quoteForDeparture(
  departureId: string,
  roomType: RoomType = "shared",
  opts?: PriceQuoteOptions,
  dbOverride?: ReturnType<typeof getDrizzle>,
): Promise<PricingBreakdown | null> {
  const db = dbOverride ?? getDrizzle();
  const dep = await getDepartureById(departureId, db);
  if (!dep) return null;
  return priceQuote({
    priceAmount: dep.priceAmount,
    currency: dep.currency,
    depositType: dep.depositType,
    depositAmount: dep.depositAmount,
    depositPercent: dep.depositPercent,
    singleSupplementType: dep.singleSupplementType,
    singleSupplementAmount: dep.singleSupplementAmount,
    taxType: dep.taxType,
    taxAmount: dep.taxAmount,
    feeType: dep.feeType,
    feeAmount: dep.feeAmount,
    discountType: dep.discountType,
    discountAmount: dep.discountAmount,
    roomType,
    pricingRules: dep.pricingRules,
  }, opts);
}
