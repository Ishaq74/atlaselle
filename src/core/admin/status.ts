/**
 * Shared status → Badge tone mapping for admin lists, so every resource uses
 * the same semantic colour language instead of raw palette classes.
 */
export type StatusTone = "success" | "warning" | "error" | "secondary" | "info";

const TONES: Record<string, StatusTone> = {
  // trips
  published: "success",
  approved: "success",
  draft: "secondary",
  review: "warning",
  unpublished: "secondary",
  archived: "secondary",
  // applications
  submitted: "info",
  under_review: "warning",
  contact_required: "warning",
  declined: "error",
  withdrawn: "secondary",
  expired: "secondary",
  // reservations
  pending: "warning",
  awaiting_payment: "warning",
  confirmed: "success",
  balance_due: "warning",
  completed: "success",
  cancelled: "error",
  refunded: "secondary",
  // payments
  created: "secondary",
  authorized: "info",
  paid: "success",
  failed: "error",
  partially_refunded: "warning",
  // email deliveries
  queued: "secondary",
  sending: "info",
  sent: "success",
  retrying: "warning",
  dead_letter: "error",
};

export function statusTone(status: string): StatusTone {
  const key = status.toLowerCase();
  return TONES[key] ?? TONES[key.replace(/\s+/g, "_")] ?? "secondary";
}
