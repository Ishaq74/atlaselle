// TODO §11.1 — déduplication sans fusion auto : UNIQUE(email) insensible
// à la casse + normalisation à l'écriture. Conflit → réutiliser si vérifié,
// sinon APPLICATION_EMAIL_CONFLICT.
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export type EmailConflictResolution =
  | { action: "reuse"; travelerId: string }
  | { action: "conflict"; code: "APPLICATION_EMAIL_CONFLICT" };

export function resolveEmailConflict(existing: { id: string; emailVerifiedAt: Date | null } | null): EmailConflictResolution | null {
  if (!existing) return null;
  if (existing.emailVerifiedAt) return { action: "reuse", travelerId: existing.id };
  return { action: "conflict", code: "APPLICATION_EMAIL_CONFLICT" };
}
