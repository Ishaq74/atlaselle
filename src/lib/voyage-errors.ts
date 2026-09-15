import { ActionError } from "astro:actions";
import { isVoyageErrorCode, type VoyageErrorCode } from "./voyage-codes";

// Astro n'accepte que des codes HTTP dans ActionError : le code domaine
// voyage en préfixe `[CODE]` du message (convention repo).
type TransportCode = "BAD_REQUEST" | "CONFLICT" | "GONE" | "NOT_FOUND" | "FORBIDDEN" | "UNAUTHORIZED" | "INTERNAL_SERVER_ERROR" | "TOO_MANY_REQUESTS";

export function domainError(transport: TransportCode, code: VoyageErrorCode, message: string): ActionError {
  return new ActionError({ code: transport, message: `[${code}] ${message}` });
}

const TRANSPORT_BY_CODE: Record<VoyageErrorCode, TransportCode> = {
  APPLICATION_CLOSED: "BAD_REQUEST",
  APPLICATION_DEADLINE_PASSED: "BAD_REQUEST",
  APPLICATION_EMAIL_CONFLICT: "CONFLICT",
  DEPARTURE_SOLD_OUT: "CONFLICT",
  CHECKOUT_EXPIRED: "GONE",
  PAYMENT_FAILED: "BAD_REQUEST",
  PAYMENT_AMOUNT_MISMATCH: "BAD_REQUEST",
  RESERVATION_ALREADY_CONFIRMED: "CONFLICT",
};

// Convertit une erreur de service (codedError) en ActionError typée.
// Les ActionError passent telles quelles ; le reste devient BAD_REQUEST.
export function toActionError(err: unknown): ActionError {
  if (err instanceof ActionError) return err;
  const code = (err as { code?: unknown } | null)?.code;
  if (isVoyageErrorCode(code)) {
    return domainError(TRANSPORT_BY_CODE[code], code, err instanceof Error ? err.message.replace(/^\[[A-Z_]+\] /, "") : code);
  }
  return new ActionError({ code: "BAD_REQUEST", message: err instanceof Error ? err.message : "Requête invalide." });
}
