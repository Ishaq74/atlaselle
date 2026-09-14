// Codes métier stables (TODO §23.3). Pur, sans dépendance Astro —
// utilisable par les domain services. Libellés transport dans voyage-errors.
export const VOYAGE_ERROR_CODES = [
  "APPLICATION_CLOSED",
  "APPLICATION_DEADLINE_PASSED",
  "APPLICATION_EMAIL_CONFLICT",
  "DEPARTURE_SOLD_OUT",
  "CHECKOUT_EXPIRED",
  "PAYMENT_FAILED",
  "PAYMENT_AMOUNT_MISMATCH",
  "RESERVATION_ALREADY_CONFIRMED",
] as const;

export type VoyageErrorCode = (typeof VOYAGE_ERROR_CODES)[number];

/** Erreur de service portant un code (Error.cause-free, sérialisable). */
export function codedError(code: VoyageErrorCode, message: string): Error & { code: VoyageErrorCode } {
  return Object.assign(new Error(`[${code}] ${message}`), { code });
}

export function isVoyageErrorCode(value: unknown): value is VoyageErrorCode {
  return typeof value === "string" && (VOYAGE_ERROR_CODES as readonly string[]).includes(value);
}
