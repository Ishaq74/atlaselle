import type { TripStatus } from "@database/schemas/trips.schema";
import { transitionRefused } from "@/modules/state-machines/domain/transition-refusal";

// TODO §8.3 — transitions explicites uniquement (jamais updateTrip({ status })).
export const TRIP_TRANSITIONS: Record<TripStatus, TripStatus[]> = {
  draft: ["review"],
  review: ["approved", "draft"],
  approved: ["published"],
  published: ["unpublished", "archived"],
  unpublished: ["published", "archived"],
  archived: ["unpublished"],
};

export function canTransitionTrip(from: TripStatus, to: TripStatus): boolean {
  return TRIP_TRANSITIONS[from]?.includes(to) ?? false;
}

export function assertTransitionTrip(from: TripStatus, to: TripStatus): void {
  if (!canTransitionTrip(from, to)) {
    throw transitionRefused("voyage", from, to);
  }
}
