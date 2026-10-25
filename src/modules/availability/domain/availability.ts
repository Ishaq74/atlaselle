// TODO §10 — math pures de disponibilité.
// Source de vérité : capacityMax. confirmed + held(actifs non expirés) ≤ max.
export interface SeatCounts {
  capacityMax: number;
  confirmedSeats: number;
  heldSeats: number;
}

export function availableSeats(counts: SeatCounts): number {
  return Math.max(0, counts.capacityMax - counts.confirmedSeats - counts.heldSeats);
}

/**
 * Rareté marketing (bandeau d'urgence) : sous ce seuil de places restantes,
 * on signale la raréfaction au lieu d'afficher un compteur. Non marketing
 * au-delà (3+), ni au complet (0 : déjà liste d'intérêt côté page).
 */
export const SCARCITY_THRESHOLD = 2;

export function isLastSeats(remaining: number): boolean {
  return Number.isInteger(remaining) && remaining > 0 && remaining <= SCARCITY_THRESHOLD;
}

export function canHold(counts: SeatCounts, quantity: number): boolean {
  return Number.isInteger(quantity) && quantity > 0 && availableSeats(counts) >= quantity;
}

export interface HoldLike {
  status: string;
  expiresAt: Date;
}

export function isHoldActive(hold: HoldLike, now: Date): boolean {
  return hold.status === "active" && hold.expiresAt.getTime() > now.getTime();
}

export function countActiveHolds(holds: HoldLike[], now: Date): number {
  return holds.filter((h) => isHoldActive(h, now)).length;
}
