// Politique d'annulation V1 (reflète les policies provisoires seedées 47) :
// ≥ 45 j avant départ → 100 % du payé ; 15–45 j → 50 % ; < 15 j → 0.
// Pure et testée — montants en centimes.
export interface CancellationQuote {
  daysBeforeDeparture: number;
  refundPercent: number;
  refundAmount: number;
  tier: "free" | "half" | "none";
}

export function quoteCancellation(departureStart: Date, amountPaid: number, now = new Date()): CancellationQuote {
  const daysBeforeDeparture = Math.ceil((departureStart.getTime() - now.getTime()) / 86_400_000);
  const paid = Math.max(0, Math.round(amountPaid));
  if (daysBeforeDeparture >= 45) {
    return { daysBeforeDeparture, refundPercent: 100, refundAmount: paid, tier: "free" };
  }
  if (daysBeforeDeparture >= 15) {
    return { daysBeforeDeparture, refundPercent: 50, refundAmount: Math.round(paid / 2), tier: "half" };
  }
  return { daysBeforeDeparture, refundPercent: 0, refundAmount: 0, tier: "none" };
}
