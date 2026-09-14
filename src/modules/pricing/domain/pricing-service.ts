import { eq } from "drizzle-orm";
import { getDrizzle } from "@database/drizzle";
import { departures } from "@database/schemas";
import { priceQuote, type PricingBreakdown, type RoomType } from "./pricing";

// Façade serveur : lit le Departure et délègue au moteur pur (TODO §12.2).
// Prix toujours recalculé serveur (checkout + webhook), jamais depuis le client.
export async function quoteForDeparture(
  departureId: string,
  roomType: RoomType = "shared",
): Promise<PricingBreakdown | null> {
  const [dep] = await getDrizzle().select().from(departures).where(eq(departures.id, departureId)).limit(1);
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
  });
}
