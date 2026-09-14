import { ActionError, type ActionAPIContext } from "astro:actions";
import { eq } from "drizzle-orm";
import { getDrizzle } from "@database/drizzle";
import { trips } from "@database/schemas";
import { logAuditEvent, extractIp, type AuditAction } from "@/lib/audit";
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

export function auditVoyage(
  context: Pick<ActionAPIContext, "request">,
  userId: string,
  action: AuditAction,
  extra: { resource?: string | null; resourceId?: string | null; metadata?: Record<string, unknown> | null } = {},
): void {
  const headers = context.request.headers;
  void logAuditEvent({
    userId,
    action,
    resource: extra.resource ?? null,
    resourceId: extra.resourceId ?? null,
    metadata: extra.metadata ?? null,
    ipAddress: extractIp(headers),
    userAgent: headers.get("user-agent"),
  });
}

export function invalidateVoyageCache(): void {
  invalidateCache("trip:");
  invalidateCache("trips:list");
}
