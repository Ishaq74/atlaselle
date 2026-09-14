import type { ApplicationStatus } from "@database/schemas/applications.schema";

// TODO §11.3 — chaque décision crée un enregistrement (jamais d'écrasement).
export const APPLICATION_TRANSITIONS: Record<ApplicationStatus, ApplicationStatus[]> = {
  draft: ["submitted", "withdrawn"],
  submitted: ["under_review", "withdrawn", "expired"],
  under_review: ["contact_required", "approved", "declined", "expired"],
  contact_required: ["under_review", "approved", "declined", "expired"],
  approved: [],
  declined: [],
  withdrawn: [],
  expired: [],
};

export function canTransitionApplication(from: ApplicationStatus, to: ApplicationStatus): boolean {
  return APPLICATION_TRANSITIONS[from]?.includes(to) ?? false;
}

export function assertTransitionApplication(from: ApplicationStatus, to: ApplicationStatus): void {
  if (!canTransitionApplication(from, to)) {
    throw new Error(`Invalid application transition: ${from} → ${to}`);
  }
}
