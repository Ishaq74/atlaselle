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

/**
 * Rattachement d'un dossier non vérifié à un compte vérifié ("claim", TODO §11.1
 * : pas de fusion auto). Un compte vérifié PROUVE qu'il possède l'email : il
 * peut donc réclamer un dossier fantôme pré-authentification ou le sien.
 * Un dossier déjà rattaché à un AUTRE compte reste protégé (anti-spam).
 */
export function canClaimTraveler(
  existing: { userId: string | null },
  sessionUserId: string | null | undefined,
): boolean {
  // `!= null` volontaire : null ET undefined (session absente) excluront le claim.
  return sessionUserId != null && (existing.userId === null || existing.userId === sessionUserId);
}
