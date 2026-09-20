export type TripEngagementWorkflowState = "PENDING" | "APPROVED" | "REJECTED" | "SPAM" | "TRASH" | "REVIEWED" | "RESOLVED";

export const TRIP_COMMENT_WORKFLOW: Record<string, string[]> = {
  PENDING: ["APPROVED", "REJECTED", "SPAM", "TRASH"],
  APPROVED: ["REJECTED", "SPAM", "TRASH"],
  REJECTED: ["APPROVED", "SPAM", "TRASH", "PENDING"],
  SPAM: ["APPROVED", "REJECTED", "TRASH"],
  TRASH: ["PENDING"],
};

export const TRIP_REVIEW_WORKFLOW: Record<string, string[]> = {
  PENDING: ["APPROVED", "REJECTED", "SPAM"],
  APPROVED: ["REJECTED", "SPAM"],
  REJECTED: ["APPROVED", "SPAM", "PENDING"],
  SPAM: ["APPROVED", "REJECTED"],
};

export const TRIP_REPORT_WORKFLOW: Record<string, string[]> = {
  PENDING: ["REVIEWED", "RESOLVED", "REJECTED"],
  REVIEWED: ["RESOLVED", "REJECTED", "PENDING"],
  RESOLVED: ["REVIEWED"],
  REJECTED: ["REVIEWED"],
};

export function canTransitionEngagement(workflow: Record<string, string[]>, from: string, to: string): boolean {
  return workflow[from]?.includes(to) ?? false;
}

export function assertEngagementTransition(workflow: Record<string, string[]>, from: string, to: string): void {
  if (!canTransitionEngagement(workflow, from, to)) {
    throw new Error(`Invalid engagement transition: ${from} → ${to}`);
  }
}
