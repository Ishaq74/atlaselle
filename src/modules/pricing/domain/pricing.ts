import { z } from "zod";
import type { AmountType } from "@database/schemas/departures.schema";

// TODO §12.2 — PricingService 100 % piloté admin, montants en centimes.
// Pur (aucune dépendance Astro/DB) : recalculé serveur au checkout + webhook.
export const pricingRulesSchema = z
  .object({
    earlyBirdPercent: z.number().int().min(0).max(100).optional(),
    earlyBirdBefore: z.string().optional(),
    // Early bird : toutes les bornes DÉFINIES doivent être satisfaites
    // (intersection) — relative au départ (mois) et/ou absolue (before).
    earlyBirdMonths: z.number().int().min(1).max(24).optional(),
    // Remise en centimes alternative au % : exactement l'un des deux (refine).
    earlyBirdAmountFixed: z.number().int().min(0).optional(),
    // Fenêtre active ⇒ acompte écrasé à la totalité (full_payment côté payments,
    // qui bascule tout seul dès que l'acompte ≥ total).
    earlyBirdFullPayment: z.boolean().optional(),
    groupDiscounts: z
      .array(z.object({ minTravelers: z.number().int().positive(), percent: z.number().int().min(0).max(100) }))
      .optional(),
  })
  .catchall(z.unknown())
  .refine((rules) => rules.earlyBirdPercent === undefined || rules.earlyBirdAmountFixed === undefined, {
    path: ["earlyBirdAmountFixed"],
    message: "earlyBirdPercent et earlyBirdAmountFixed sont exclusifs l'un de l'autre.",
  })
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
  /** Début du départ — requis pour la borne relative earlyBirdMonths
   *  (fail-closed sinon : remise early bird jamais appliquée par accident). */
  startDate?: Date | string | null;
  pricingRules?: unknown;
}

export interface PriceQuoteOptions {
  /** Date d'évaluation (défaut : maintenant) — bornes earlyBirdBefore/earlyBirdMonths. */
  now?: Date;
  /** Voyageurs du dossier (défaut : 1) — seuils groupDiscounts. */
  travelerCount?: number;
}

/** Résumé early bird pour les affichages (booking card) — présent uniquement
 *  quand le départ porte des règles early bird, actif ou fenêtre expirée. */
export interface EarlyBirdQuote {
  /** Fenêtre satisfaite à la date d'évaluation. */
  active: boolean;
  /** Contribution early bird au calcul (centimes) — 0 si inactive. */
  discountAmount: number;
  /** Fenêtre active ⇒ acompte écrasé à la totalité (réservation soldée directe). */
  fullPayment: boolean;
  /** Fin de fenêtre effective (ISO), null si illimitée. */
  until: string | null;
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
  earlyBird?: EarlyBirdQuote;
}

/** fixed → montant tel quel, percent → % de la base (arrondi), none → 0. */
export function computeLine(type: AmountType, amount: number, percent: number, base: number): number {
  if (type === "fixed") return Math.max(0, Math.round(amount));
  if (type === "percent") return Math.max(0, Math.round((base * Math.max(0, percent)) / 100));
  return 0;
}

/**
 * Borne relative early bird : `startDate` moins N mois calendaires, avec clamp
 * sur le dernier jour du mois (31 janv − 1 mois → 28/29 févr, pas de débordement
 * setMonth). Arithmétique en coordonnées UTC : déterministe quel que soit le
 * fuseau du serveur. Retourne null si le départ est absent/invalide (fail-closed).
 */
export function subtractCalendarMonths(startDate: Date | string | null | undefined, months: number): Date | null {
  if (startDate == null) return null;
  const start = startDate instanceof Date ? startDate : new Date(startDate);
  if (Number.isNaN(start.getTime())) return null;
  const d = new Date(start.getTime());
  const day = d.getUTCDate();
  d.setUTCDate(1); // neutralise le jour pour éviter le roulement setUTCMonth (31 janv → 3 mars)
  d.setUTCMonth(d.getUTCMonth() - months);
  const lastDay = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, lastDay));
  return d;
}

export function priceQuote(input: PricingInput, opts?: PriceQuoteOptions): PricingBreakdown {
  const rules = pricingRulesSchema.parse(input.pricingRules ?? {});
  const now = opts?.now ?? new Date();
  const base = Math.max(0, Math.round(input.priceAmount));
  const supplement = input.roomType === "single"
    ? computeLine(input.singleSupplementType, input.singleSupplementAmount, 0, base)
    : 0;
  let discount = computeLine(input.discountType, input.discountAmount, 0, base);

  // Early bird : % OU montant fixe (mutuellement exclusifs, règle Zod).
  const ebPercent = rules.earlyBirdPercent ?? 0;
  const ebFixed = rules.earlyBirdAmountFixed;
  const ebSource = ebPercent > 0 || ebFixed !== undefined;
  let ebActive = false;
  let ebContribution = 0;
  let ebUntil: Date | null = null;
  if (ebSource) {
    let eligible = true;
    // Borne absolue (comportement historique conservé) : absente/invalide → n'exclut pas.
    const before = rules.earlyBirdBefore ? new Date(rules.earlyBirdBefore) : null;
    if (before !== null && !Number.isNaN(before.getTime())) {
      if (now.getTime() > before.getTime()) eligible = false;
      else ebUntil = before;
    }
    // Borne relative : startDate manquant/invalide → fail-closed (jamais actif).
    if (eligible && rules.earlyBirdMonths !== undefined) {
      const start = subtractCalendarMonths(input.startDate, rules.earlyBirdMonths);
      if (start === null || now.getTime() > start.getTime()) eligible = false;
      else ebUntil = ebUntil !== null && ebUntil.getTime() < start.getTime() ? ebUntil : start;
    }
    if (eligible) {
      ebActive = true;
      ebContribution = ebPercent > 0 ? Math.round((base * ebPercent) / 100) : Math.round(Math.max(0, ebFixed ?? 0));
      discount += ebContribution;
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
  // Early bird + paiement intégral : l'acompte vaut le total → charges la
  // totalité d'un coup (payments bascule `full_payment` seul), solde 0.
  const fullPayment = ebActive && rules.earlyBirdFullPayment === true;
  const deposit = fullPayment ? total : Math.min(total, computeLine(input.depositType, input.depositAmount, input.depositPercent, total));
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
    // Exposé aux affichages uniquement quand des règles early bird existent.
    ...(ebSource
      ? {
          earlyBird: {
            active: ebActive,
            discountAmount: Math.min(ebContribution, Math.max(0, base + supplement)),
            fullPayment,
            until: ebUntil !== null ? ebUntil.toISOString() : null,
          },
        }
      : {}),
  };
}
