import { ActionError, type ActionAPIContext } from "astro:actions";
import { eq } from "drizzle-orm";
import { getDrizzle } from "@database/drizzle";
import { mediaFiles, serviceCategories, serviceTags, services } from "@database/schemas";
import { serviceLocks } from "@database/schemas";
import { checkRateLimit } from "@/lib/rate-limit";
import { logAuditEvent, extractIp, type AuditAction } from "@/lib/audit";
import { invalidateCache } from "@database/cache";
import type { statement } from "@/lib/permissions";

export type ServicePermissions = { [K in keyof typeof statement]?: (typeof statement)[K][number][] };
type ServicePermissionContext = Pick<ActionAPIContext, "locals" | "request">;

export async function hasServicePermission(context: ServicePermissionContext, permissions: ServicePermissions): Promise<boolean> {
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

export async function assertServicePermission(context: ActionAPIContext, permissions: ServicePermissions) {
  const currentUser = context.locals.user;
  if (!currentUser) throw new ActionError({ code: "UNAUTHORIZED", message: "Vous devez être connecté pour effectuer cette action." });
  if (currentUser.banned) throw new ActionError({ code: "FORBIDDEN", message: "Compte suspendu." });
  if (!(await hasServicePermission(context, permissions))) throw new ActionError({ code: "FORBIDDEN", message: "Permissions insuffisantes." });
  return currentUser;
}

export async function assertServiceExists(serviceId: string) {
  const [service] = await getDrizzle().select().from(services).where(eq(services.id, serviceId)).limit(1);
  if (!service) throw new ActionError({ code: "NOT_FOUND", message: "Service introuvable." });
  return service;
}

export async function assertPublishedServiceExists(serviceId: string) {
  const service = await assertServiceExists(serviceId);
  if (service.status !== "PUBLISHED") throw new ActionError({ code: "NOT_FOUND", message: "Service introuvable." });
  return service;
}

export async function assertServiceCategoryExists(categoryId: string) {
  const [category] = await getDrizzle().select().from(serviceCategories).where(eq(serviceCategories.id, categoryId)).limit(1);
  if (!category) throw new ActionError({ code: "NOT_FOUND", message: "Catégorie introuvable." });
  return category;
}

export async function assertServiceTagExists(tagId: string) {
  const [tag] = await getDrizzle().select().from(serviceTags).where(eq(serviceTags.id, tagId)).limit(1);
  if (!tag) throw new ActionError({ code: "NOT_FOUND", message: "Tag introuvable." });
  return tag;
}

export async function assertServiceMediaExists(mediaId: string) {
  const [media] = await getDrizzle().select().from(mediaFiles).where(eq(mediaFiles.id, mediaId)).limit(1);
  if (!media) throw new ActionError({ code: "NOT_FOUND", message: "Média introuvable." });
  return media;
}

export async function assertServiceLockOwner(serviceId: string, userId: string, sessionId?: string | null): Promise<void> {
  const [lock] = await getDrizzle().select().from(serviceLocks).where(eq(serviceLocks.serviceId, serviceId)).limit(1);
  if (!lock) return;
  if (lock.expiresAt <= new Date()) {
    await getDrizzle().delete(serviceLocks).where(eq(serviceLocks.serviceId, serviceId));
    return;
  }
  if (lock.userId !== userId || (sessionId != null && lock.sessionId !== sessionId)) {
    throw new ActionError({ code: "CONFLICT", message: "Ce service est verrouillé par un autre éditeur." });
  }
}

export function serviceRateLimit(_context: ActionAPIContext, userId: string, scope: string) {
  const result = checkRateLimit(`service-${scope.replace(/:/g, "_")}:${userId}`, { window: 60, max: 30 });
  if (!result.allowed) throw new ActionError({ code: "TOO_MANY_REQUESTS", message: "Trop de requêtes. Veuillez réessayer dans quelques instants." });
}

export function auditService(context: ActionAPIContext, userId: string, action: AuditAction, opts?: { resource?: string; resourceId?: string; metadata?: Record<string, unknown> }) {
  void logAuditEvent({ userId, action, resource: opts?.resource ?? null, resourceId: opts?.resourceId ?? null, metadata: opts?.metadata ?? null, ipAddress: extractIp(context.request.headers, context.clientAddress), userAgent: context.request.headers.get("user-agent") }).catch(() => {});
}

export function invalidateServicesCache() {
  for (const prefix of ["services:service:", "services:list:", "services:category:", "services:categories:", "services:tags:", "services:search:"]) invalidateCache(prefix);
}
