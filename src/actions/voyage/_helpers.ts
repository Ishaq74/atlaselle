import { ActionError, type ActionAPIContext } from "astro:actions";
import { eq } from "drizzle-orm";
import { getDrizzle } from "@database/drizzle";
import { trips, tripLocks } from "@database/schemas";
import { logAuditEvent, extractIp, type AuditAction } from "@/lib/audit";
import { checkRateLimit } from "@/lib/rate-limit";
import { invalidateCache } from "@database/cache";
import type { statement } from "@/lib/permissions";

export type VoyagePermissions = { [K in keyof typeof statement]?: (typeof statement)[K][number][] };
type VoyagePermissionContext = Pick<ActionAPIContext, "locals" | "request">;

export async function hasVoyagePermission(context: VoyagePermissionContext, permissions: VoyagePermissions): Promise<boolean> {
  const currentUser = context.locals.user;
  if (!currentUser || currentUser.banned) return false;
  try {
    const { auth } = await import("@/lib/auth");
    const result = await auth.api.userHasPermission({ body: { userId: currentUser.id, permissions: permissions as Record<string, string[]> } });
    return result.success;
  } catch {
    return false;
  }
}

export async function assertVoyagePermission(context: ActionAPIContext, permissions: VoyagePermissions) {
  const currentUser = context.locals.user;
  if (!currentUser) throw new ActionError({ code: "UNAUTHORIZED", message: "Vous devez être connecté pour effectuer cette action." });
  if (currentUser.banned) throw new ActionError({ code: "FORBIDDEN", message: "Compte suspendu." });
  if (!(await hasVoyagePermission(context, permissions))) throw new ActionError({ code: "FORBIDDEN", message: "Permissions insuffisantes." });
  return currentUser;
}

export async function assertTripExists(tripId: string) {
  const [trip] = await getDrizzle().select().from(trips).where(eq(trips.id, tripId)).limit(1);
  if (!trip) throw new ActionError({ code: "NOT_FOUND", message: "Voyage introuvable." });
  return trip;
}

export async function assertPublishedTripExists(tripId: string) {
  const trip = await assertTripExists(tripId);
  if (trip.status !== "published") throw new ActionError({ code: "NOT_FOUND", message: "Voyage introuvable." });
  return trip;
}

export async function assertTripLockOwner(tripId: string, userId: string, sessionId?: string | null): Promise<void> {
  const [lock] = await getDrizzle().select().from(tripLocks).where(eq(tripLocks.tripId, tripId)).limit(1);
  if (!lock) return;
  if (lock.expiresAt <= new Date()) {
    await getDrizzle().delete(tripLocks).where(eq(tripLocks.tripId, tripId));
    return;
  }
  if (lock.userId !== userId || (sessionId != null && lock.sessionId !== sessionId)) {
    throw new ActionError({ code: "CONFLICT", message: "Ce voyage est verrouillé par un autre éditeur." });
  }
}

export function voyageRateLimit(_context: ActionAPIContext, userId: string, scope: string, opts = { window: 60, max: 30 }) {
  const result = checkRateLimit(`voyage-${scope.replace(/:/g, "_")}:${userId}`, opts);
  if (!result.allowed) throw new ActionError({ code: "TOO_MANY_REQUESTS", message: "Trop de requêtes. Veuillez réessayer dans quelques instants." });
}

export function voyagePublicRateLimit(context: ActionAPIContext, scope: string, opts = { window: 300, max: 5 }) {
  const ip = extractIp(context.request.headers, context.clientAddress);
  const key = ip ? `voyage-${scope.replace(/:/g, "_")}:${ip}` : `voyage-${scope.replace(/:/g, "_")}:__global__`;
  const result = checkRateLimit(key, ip ? opts : { window: opts.window, max: Math.max(1, Math.floor(opts.max / 3)) });
  if (!result.allowed) throw new ActionError({ code: "TOO_MANY_REQUESTS", message: "Trop de requêtes. Veuillez réessayer dans quelques instants." });
}

// Verrouillage optimiste (TODO §16.8) : rejette les écritures sur version
// obsolète — jamais d'écrasement silencieux. Comparaison à la seconde
// (PostgreSQL stocke la microseconde, JS la milliseconde).
export function assertFresh(currentUpdatedAt: Date, expected: string | null | undefined, label: string): void {
  if (expected == null || expected === "") return;
  const sameSecond = Math.floor(new Date(expected).getTime() / 1000) === Math.floor(currentUpdatedAt.getTime() / 1000);
  if (!sameSecond) {
    throw new ActionError({
      code: "CONFLICT",
      message: `${label} : votre version est obsolète, rechargez avant de modifier.`,
    });
  }
}

export function auditVoyage(
  context: Pick<ActionAPIContext, "request" | "locals">,
  userId: string,
  action: AuditAction,
  extra: { resource?: string | null; resourceId?: string | null; metadata?: Record<string, unknown> | null } = {},
): void {
  const headers = context.request.headers;
  const requestId = (context.locals as { requestId?: string | null } | undefined)?.requestId ?? null;
  void logAuditEvent({
    userId,
    action,
    resource: extra.resource ?? null,
    resourceId: extra.resourceId ?? null,
    metadata: { ...(extra.metadata ?? {}), ...(requestId ? { requestId } : {}) },
    ipAddress: extractIp(headers),
    userAgent: headers.get("user-agent"),
  });
}

export function invalidateVoyageCache(): void {
  invalidateCache("trip:");
  invalidateCache("trips:list");
  invalidateCache("voyage:moderation:");
  invalidateCache("voyage:reporting:");
}
