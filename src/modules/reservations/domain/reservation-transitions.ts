import type { ReservationStatus } from "@database/schemas/reservations.schema";

// TODO §12.1 — le prix confirmé est immuable (snapshot).
export const RESERVATION_TRANSITIONS: Record<ReservationStatus, ReservationStatus[]> = {
  pending: ["awaiting_payment", "cancelled"],
  awaiting_payment: ["confirmed", "cancelled", "pending"],
  confirmed: ["balance_due", "completed", "cancelled"],
  balance_due: ["completed", "cancelled"],
  completed: ["refunded"],
  cancelled: ["refunded"],
  refunded: [],
};

export function canTransitionReservation(from: ReservationStatus, to: ReservationStatus): boolean {
  return RESERVATION_TRANSITIONS[from]?.includes(to) ?? false;
}

export function assertTransitionReservation(from: ReservationStatus, to: ReservationStatus): void {
  if (!canTransitionReservation(from, to)) {
    throw new Error(`Invalid reservation transition: ${from} → ${to}`);
  }
}
