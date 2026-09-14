import type { DepartureStatus } from "@database/schemas/departures.schema";

// TODO §8.4 — statut de publication (Trip) ≠ statut de disponibilité (Departure).
export const DEPARTURE_TRANSITIONS: Record<DepartureStatus, DepartureStatus[]> = {
  draft: ["open"],
  open: ["limited", "waitlist", "closed", "cancelled"],
  limited: ["open", "waitlist", "closed"],
  waitlist: ["open", "closed"],
  closed: ["completed"],
  cancelled: [],
  completed: [],
};

export function canTransitionDeparture(from: DepartureStatus, to: DepartureStatus): boolean {
  return DEPARTURE_TRANSITIONS[from]?.includes(to) ?? false;
}

export function assertTransitionDeparture(from: DepartureStatus, to: DepartureStatus): void {
  if (!canTransitionDeparture(from, to)) {
    throw new Error(`Invalid departure transition: ${from} → ${to}`);
  }
}
