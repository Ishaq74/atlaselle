import { z } from "zod";
import type { AmountType } from "@database/schemas/departures.schema";

// TODO §12.2 — PricingService 100 % piloté admin, montants en centimes.
// Pur (aucune dépendance Astro/DB) : recalculé serveur au checkout + webhook.
export const pricingRulesSchema = z
  .object({
    earlyBirdPercent: z.number().int().min(0).max(100).optional(),
    earlyBirdBefore: z.string().optional(),
    groupDiscounts: z
      .array(z.object({ minTravelers: z.number().int().positive(), percent: z.number().int().min(0).max(100) }))
      .optional(),
  })
  .catchall(z.unknown())
  .default({});

export type PricingRules = z.infer<typeof pricingRulesSchema>;

export type RoomType = "shared" | "single";

export interface PricingInput {
  priceAmount: number;
  currency: string;
  depositType: AmountType;
  depositAmount: number;
  depositPercent: number;
  singleSupplementType: AmountType;
  singleSupplementAmount: number;
  taxType: AmountType;
  taxAmount: number;
  feeType: AmountType;
  feeAmount: number;
  discountType: AmountType;
  discountAmount: number;
  roomType: RoomType;
  pricingRules?: unknown;
}

export interface PriceQuoteOptions {
  /** Date d'évaluation (défaut : maintenant) — borne earlyBirdBefore. */
  now?: Date;
  /** Voyageurs du dossier (défaut : 1) — seuils groupDiscounts. */
  travelerCount?: number;
}

export interface PricingBreakdown {
  baseAmount: number;
  supplementAmount: number;
  discountAmount: number;
  taxAmount: number;
  feeAmount: number;
  totalAmount: number;
  depositAmount: number;
  balanceAmount: number;
  currency: string;
}

/** fixed → montant tel quel, percent → % de la base (arrondi), none → 0. */
export function computeLine(type: AmountType, amount: number, percent: number, base: number): number {
  if (type === "fixed") return Math.max(0, Math.round(amount));
  if (type === "percent") return Math.max(0, Math.round((base * Math.max(0, percent)) / 100));
  return 0;
}

export function priceQuote(input: PricingInput, opts?: PriceQuoteOptions): PricingBreakdown {
  const rules = pricingRulesSchema.parse(input.pricingRules ?? {});
  const now = opts?.now ?? new Date();
  const base = Math.max(0, Math.round(input.priceAmount));
  const supplement = input.roomType === "single"
    ? computeLine(input.singleSupplementType, input.singleSupplementAmount, 0, base)
    : 0;
  let discount = computeLine(input.discountType, input.discountAmount, 0, base);
  if (typeof rules.earlyBirdPercent === "number" && rules.earlyBirdPercent > 0) {
    // earlyBirdBefore optionnelle : passée → plus d'early bird (date invalide → on applique, compat).
    const before = rules.earlyBirdBefore ? new Date(rules.earlyBirdBefore) : null;
    if (!before || Number.isNaN(before.getTime()) || now.getTime() <= before.getTime()) {
      discount += Math.round((base * rules.earlyBirdPercent) / 100);
    }
  }
  // Remise groupe : meilleur palier atteint (un seul), jamais cumulée.
  const count = Math.max(1, Math.floor(opts?.travelerCount ?? 1));
  let groupPercent = 0;
  for (const tier of rules.groupDiscounts ?? []) {
    if (count >= tier.minTravelers && tier.percent > groupPercent) groupPercent = tier.percent;
  }
  if (groupPercent > 0) discount += Math.round((base * groupPercent) / 100);
  const subtotal = Math.max(0, base + supplement - discount);
  const tax = computeLine(input.taxType, input.taxAmount, 0, subtotal);
  const fee = computeLine(input.feeType, input.feeAmount, 0, subtotal);
  const total = subtotal + tax + fee;
  const deposit = Math.min(total, computeLine(input.depositType, input.depositAmount, input.depositPercent, total));
  return {
    baseAmount: base,
    supplementAmount: supplement,
    discountAmount: Math.min(discount, base + supplement),
    taxAmount: tax,
    feeAmount: fee,
    totalAmount: total,
    depositAmount: deposit,
    balanceAmount: total - deposit,
    currency: input.currency,
  };
}
