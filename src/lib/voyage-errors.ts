import { ActionError } from "astro:actions";
import type { VoyageErrorCode } from "./voyage-codes";

// Astro n'accepte que des codes HTTP dans ActionError : le code domaine
// voyage en préfixe `[CODE]` du message (convention repo).
type TransportCode = "BAD_REQUEST" | "CONFLICT" | "GONE" | "NOT_FOUND" | "FORBIDDEN" | "UNAUTHORIZED" | "INTERNAL_SERVER_ERROR" | "TOO_MANY_REQUESTS";

export function domainError(transport: TransportCode, code: VoyageErrorCode, message: string): ActionError {
  return new ActionError({ code: transport, message: `[${code}] ${message}` });
}
