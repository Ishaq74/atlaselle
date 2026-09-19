import type { statement } from "@/lib/permissions";

export type ServicePermissions = { [K in keyof typeof statement]?: (typeof statement)[K][number][] };

type MinimalActor = { id: string; banned?: boolean | null };
type MinimalContext = { locals: { user?: MinimalActor | null } };

export async function hasServicePermission(context: MinimalContext, permissions: ServicePermissions): Promise<boolean> {
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

function serviceError(code: string, message: string): Error & { code: string } {
  return Object.assign(new Error(message), { code });
}

export async function assertServicePermission(context: MinimalContext, permissions: ServicePermissions) {
  const currentUser = context.locals.user;
  if (!currentUser) throw serviceError("UNAUTHORIZED", "Vous devez être connecté pour effectuer cette action.");
  if (currentUser.banned) throw serviceError("FORBIDDEN", "Compte suspendu.");
  if (!(await hasServicePermission(context, permissions))) throw serviceError("FORBIDDEN", "Permissions insuffisantes.");
  return currentUser;
}

export async function assertServiceExists(serviceId: string) {
  const { getDrizzle } = await import("@database/drizzle");
  const { services } = await import("@database/schemas");
  const { eq } = await import("drizzle-orm");
  const [service] = await getDrizzle().select().from(services).where(eq(services.id, serviceId)).limit(1);
  if (!service) throw serviceError("NOT_FOUND", "Service introuvable.");
  return service;
}

export async function assertPublishedServiceExists(serviceId: string) {
  const service = await assertServiceExists(serviceId);
  if (service.status !== "PUBLISHED") throw serviceError("NOT_FOUND", "Service introuvable.");
  return service;
}

export async function assertServiceLockOwner(serviceId: string, userId: string, sessionId: string | null | undefined) {
  const { getDrizzle } = await import("@database/drizzle");
  const { serviceLocks } = await import("@database/schemas");
  const { eq } = await import("drizzle-orm");
  const [lock] = await getDrizzle().select({ userId: serviceLocks.userId, sessionId: serviceLocks.sessionId, expiresAt: serviceLocks.expiresAt }).from(serviceLocks).where(eq(serviceLocks.serviceId, serviceId)).limit(1);
  if (!lock || lock.expiresAt <= new Date()) return;
  if (lock.userId !== userId || (sessionId && lock.sessionId !== sessionId)) throw serviceError("CONFLICT", "Ce service est actuellement verrouillé par un autre éditeur.");
}

async function assertRowIn(table: "serviceCategories" | "serviceTags" | "mediaFiles", id: string, notFound: string) {
  const { getDrizzle } = await import("@database/drizzle");
  const schemas = await import("@database/schemas");
  const { eq } = await import("drizzle-orm");
  const t = schemas[table];
  const [row] = await getDrizzle().select().from(t).where(eq(t.id, id)).limit(1);
  if (!row) throw serviceError("NOT_FOUND", notFound);
  return row;
}

export async function assertServiceCategoryExists(categoryId: string) {
  return assertRowIn("serviceCategories", categoryId, "Catégorie introuvable.");
}

export async function assertServiceTagExists(tagId: string) {
  return assertRowIn("serviceTags", tagId, "Tag introuvable.");
}

export async function assertServiceMediaExists(mediaId: string) {
  return assertRowIn("mediaFiles", mediaId, "Média introuvable.");
}
