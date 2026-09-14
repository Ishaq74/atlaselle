import { randomUUID } from "node:crypto";

/**
 * Corrélation transverse (TODO §20.4) : chaque requête porte un requestId
 * (middleware → `Astro.locals.requestId` → logs, actions, services, jobs, emails, paiements).
 * Jamais de données sensibles dedans — c'est un UUID opaque.
 */

export function newRequestId(): string {
  try {
    return randomUUID();
  } catch {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 14)}`;
  }
}

export function getRequestId(locals: { requestId?: string | null } | undefined | null): string | null {
  const id = locals?.requestId;
  return typeof id === "string" && id.length > 0 ? id : null;
}

/** Préfixe de log avec requestId : `[req:abc] message`. */
export function withRequestId(requestId: string | null | undefined, message: string): string {
  return requestId ? `[req:${requestId}] ${message}` : message;
}
