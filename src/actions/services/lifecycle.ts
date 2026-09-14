import { ActionError, defineAction, type ActionAPIContext } from "astro:actions";
import { and, asc, desc, eq } from "drizzle-orm";
import { z } from "astro/zod";
import { getDrizzle } from "@database/drizzle";
import { services, serviceTranslations, serviceRevisions, serviceCategoryLinks, serviceTagLinks, serviceMedia, serviceAvailability, serviceSeo, serviceLocks, serviceAttributeValues } from "@database/schemas";
import { LOCALES, type Locale } from "@i18n/config";
import { assertServicePermission, assertServiceExists, assertServiceLockOwner } from "./_helpers";
import { assertServiceRevisionRestore, assertValidServiceTransition } from "@/modules/services/workflow";
import type { ServiceStatus } from "@/modules/services/domain";
import { auditService, invalidateServicesCache } from "./_helpers";
import { createServiceNotification } from "./notification";
import { getServiceNotificationTranslations } from "@/modules/services/i18n/notifications";
import { getServiceTranslations } from "@/modules/services/i18n";

const lifecycleInput = z.object({ id: z.uuid() });
type LifecycleAuditAction = "SERVICE_PUBLISH" | "SERVICE_UNPUBLISH" | "SERVICE_ARCHIVE" | "SERVICE_RESTORE" | "SERVICE_DELETE";
type LifecyclePermission = "publish" | "update" | "delete";

function requestLocale(headers: Headers): Locale {
  const candidate = headers.get("accept-language")?.split(",", 1)[0]?.split("-", 1)[0] ?? "fr";
  return (LOCALES as readonly string[]).includes(candidate) ? candidate as Locale : "fr";
}
async function uniqueServiceSlug(sourceSlug: string): Promise<string> { const rows = await getDrizzle().select({ slug: services.slug }).from(services); const used = new Set(rows.map((row) => row.slug)); const base = `${sourceSlug}-copy`; let candidate = base; let suffix = 2; while (used.has(candidate)) candidate = `${base}-${suffix++}`; return candidate; }
async function uniqueTranslationSlug(locale: Locale, sourceSlug: string): Promise<string> { const rows = await getDrizzle().select({ slug: serviceTranslations.slug }).from(serviceTranslations).where(eq(serviceTranslations.locale, locale)); const used = new Set(rows.map((row) => row.slug)); const base = `${sourceSlug}-copy`; let candidate = base; let suffix = 2; while (used.has(candidate)) candidate = `${base}-${suffix++}`; return candidate; }

async function transitionService(id: string, to: ServiceStatus, context: ActionAPIContext, permission: LifecyclePermission, auditAction: LifecycleAuditAction) {
  const user = await assertServicePermission(context, { service: [permission] });
  const current = await assertServiceExists(id);
  assertValidServiceTransition(current.status as ServiceStatus, to);
  await assertServiceLockOwner(id, user.id, context.locals.session?.id);
  await getDrizzle().transaction(async (tx) => { await tx.update(services).set({ status: to, publishedAt: to === "PUBLISHED" ? new Date() : null, updatedBy: user.id }).where(eq(services.id, id)); });
  if (to === "PUBLISHED") { const locale = requestLocale(context.request.headers); const t = getServiceNotificationTranslations(locale); await createServiceNotification({ recipientId: current.providerId, serviceId: id, actorId: user.id, type: "SERVICE_PUBLISHED", title: t.publishedTitle, message: t.publishedMessage, locale }); }
  auditService(context, user.id, auditAction, { resource: "services", resourceId: id, metadata: { from: current.status, to } });
  invalidateServicesCache();
  return { success: true };
}

export const publishService = defineAction({ input: lifecycleInput, handler: (input, context) => transitionService(input.id, "PUBLISHED", context, "publish", "SERVICE_PUBLISH") });
export const unpublishService = defineAction({ input: lifecycleInput, handler: (input, context) => transitionService(input.id, "DRAFT", context, "publish", "SERVICE_UNPUBLISH") });
export const archiveService = defineAction({ input: lifecycleInput, handler: (input, context) => transitionService(input.id, "ARCHIVED", context, "update", "SERVICE_ARCHIVE") });
export const restoreService = defineAction({ input: lifecycleInput, handler: (input, context) => transitionService(input.id, "DRAFT", context, "update", "SERVICE_RESTORE") });
export const deleteService = defineAction({ input: lifecycleInput, handler: (input, context) => transitionService(input.id, "DELETED", context, "delete", "SERVICE_DELETE") });

export const duplicateService = defineAction({ input: lifecycleInput, handler: async (input, context) => {
  const user = await assertServicePermission(context, { service: ["create"] }); const source = await assertServiceExists(input.id); await assertServiceLockOwner(input.id, user.id, context.locals.session?.id); const db = getDrizzle();
  const [translations, categories, tags, media, availability, seo, attributes] = await Promise.all([
    db.select().from(serviceTranslations).where(eq(serviceTranslations.serviceId, source.id)).orderBy(asc(serviceTranslations.locale)),
    db.select().from(serviceCategoryLinks).where(eq(serviceCategoryLinks.serviceId, source.id)), db.select().from(serviceTagLinks).where(eq(serviceTagLinks.serviceId, source.id)), db.select().from(serviceMedia).where(eq(serviceMedia.serviceId, source.id)), db.select().from(serviceAvailability).where(eq(serviceAvailability.serviceId, source.id)), db.select().from(serviceSeo).where(eq(serviceSeo.serviceId, source.id)), db.select().from(serviceAttributeValues).where(eq(serviceAttributeValues.serviceId, source.id)),
  ]);
  if (!translations.length) throw new ActionError({ code: "BAD_REQUEST", message: "Un service doit posséder au moins une traduction avant duplication." });
  const serviceSlug = await uniqueServiceSlug(source.slug); const translationSlugs = new Map<Locale, string>(); for (const translation of translations) translationSlugs.set(translation.locale, await uniqueTranslationSlug(translation.locale, translation.slug));
  let duplicateId = "";
  await db.transaction(async (tx) => {
    const [created] = await tx.insert(services).values({ providerId: source.providerId, slug: serviceSlug, status: "DRAFT", coverImageId: source.coverImageId, priceMinor: source.priceMinor, currency: source.currency, durationMinutes: source.durationMinutes, maxParticipants: source.maxParticipants, isMobile: source.isMobile, isFeatured: false, seoScore: null, publishedAt: null, updatedBy: user.id }).returning({ id: services.id });
    if (!created) throw new ActionError({ code: "INTERNAL_SERVER_ERROR", message: "Impossible de dupliquer le service." });
    duplicateId = created.id;
    for (const translation of translations) await tx.insert(serviceTranslations).values({ serviceId: duplicateId, locale: translation.locale, title: translation.title, slug: translationSlugs.get(translation.locale)!, excerpt: translation.excerpt, content: translation.content, locationLabel: translation.locationLabel, locationAddress: translation.locationAddress, metaTitle: translation.metaTitle, metaDescription: translation.metaDescription, metaKeywords: translation.metaKeywords, canonicalUrl: null, ogTitle: translation.ogTitle, ogDescription: translation.ogDescription, ogImageId: translation.ogImageId });
    if (categories.length) await tx.insert(serviceCategoryLinks).values(categories.map((row) => ({ serviceId: duplicateId, categoryId: row.categoryId })));
    if (tags.length) await tx.insert(serviceTagLinks).values(tags.map((row) => ({ serviceId: duplicateId, tagId: row.tagId })));
    if (media.length) await tx.insert(serviceMedia).values(media.map((row) => ({ serviceId: duplicateId, mediaId: row.mediaId, kind: row.kind, altText: row.altText, caption: row.caption, sortOrder: row.sortOrder })));
    if (availability.length) await tx.insert(serviceAvailability).values(availability.map((row) => ({ serviceId: duplicateId, dayOfWeek: row.dayOfWeek, startTime: row.startTime, endTime: row.endTime, timezone: row.timezone, maxParticipants: row.maxParticipants })));
    if (seo.length) await tx.insert(serviceSeo).values(seo.map((row) => ({ serviceId: duplicateId, locale: row.locale, focusKeyword: row.focusKeyword, focusKeywordScore: null, readabilityScore: null, metaRobots: row.metaRobots, metaOgType: row.metaOgType, metaOgLocale: row.metaOgLocale, schemaMarkup: row.schemaMarkup })));
    if (attributes.length) await tx.insert(serviceAttributeValues).values(attributes.map((row) => ({ serviceId: duplicateId, definitionId: row.definitionId, stringValue: row.stringValue, numberValue: row.numberValue, booleanValue: row.booleanValue, selectedValue: row.selectedValue })));
    const first = translations[0]; await tx.insert(serviceRevisions).values({ serviceId: duplicateId, authorId: user.id, locale: first.locale, title: first.title, slug: translationSlugs.get(first.locale)!, content: first.content, excerpt: first.excerpt, status: "DRAFT", revisionNote: "Duplication" });
  });
  auditService(context, user.id, "SERVICE_DUPLICATE", { resource: "services", resourceId: duplicateId, metadata: { duplicatedFrom: source.id } }); invalidateServicesCache(); return { id: duplicateId };
} });

export const lockService = defineAction({ input: lifecycleInput, handler: async (input, context) => { const user = await assertServicePermission(context, { service: ["update"] }); await assertServiceExists(input.id); const db = getDrizzle(); const existing = (await db.select().from(serviceLocks).where(eq(serviceLocks.serviceId, input.id)).limit(1))[0]; const now = new Date(); const sessionId = context.locals.session?.id ?? ""; if (existing && existing.expiresAt > now && (existing.userId !== user.id || existing.sessionId !== sessionId)) throw new ActionError({ code: "CONFLICT", message: getServiceTranslations(requestLocale(context.request.headers)).admin.errors.conflict }); const expiresAt = new Date(Date.now() + 30 * 60 * 1000); await db.insert(serviceLocks).values({ serviceId: input.id, userId: user.id, sessionId, expiresAt }).onConflictDoUpdate({ target: serviceLocks.serviceId, set: { userId: user.id, sessionId, lockedAt: now, expiresAt } }); auditService(context, user.id, "SERVICE_LOCK", { resource: "services", resourceId: input.id }); return { success: true, expiresAt }; } });
export const unlockService = defineAction({ input: lifecycleInput, handler: async (input, context) => { const user = await assertServicePermission(context, { service: ["update"] }); await assertServiceExists(input.id); await getDrizzle().delete(serviceLocks).where(and(eq(serviceLocks.serviceId, input.id), eq(serviceLocks.userId, user.id), eq(serviceLocks.sessionId, context.locals.session?.id ?? ""))); auditService(context, user.id, "SERVICE_UNLOCK", { resource: "services", resourceId: input.id }); return { success: true }; } });
export const listServiceRevisions = defineAction({ input: lifecycleInput, handler: async (input, context) => { await assertServicePermission(context, { service: ["read"] }); await assertServiceExists(input.id); return getDrizzle().select().from(serviceRevisions).where(eq(serviceRevisions.serviceId, input.id)).orderBy(desc(serviceRevisions.createdAt)).limit(50); } });
export const restoreServiceRevision = defineAction({ input: z.object({ revisionId: z.uuid(), serviceId: z.uuid() }), handler: async (input, context) => {
  const current = await assertServiceExists(input.serviceId); const db = getDrizzle(); const [revision] = await db.select().from(serviceRevisions).where(and(eq(serviceRevisions.id, input.revisionId), eq(serviceRevisions.serviceId, input.serviceId))).limit(1); const locale = requestLocale(context.request.headers);
  if (!revision) throw new ActionError({ code: "NOT_FOUND", message: getServiceTranslations(locale).admin.errors.notFound }); const user = await assertServicePermission(context, { service: [revision.status === "PUBLISHED" ? "publish" : "update"] }); await assertServiceLockOwner(input.serviceId, user.id, context.locals.session?.id); assertServiceRevisionRestore(current.status as ServiceStatus, revision.status as ServiceStatus);
  await db.transaction(async (tx) => { await tx.update(services).set({ status: revision.status, publishedAt: revision.status === "PUBLISHED" ? (current.status === "PUBLISHED" ? current.publishedAt : new Date()) : null, updatedBy: user.id }).where(eq(services.id, input.serviceId)); await tx.insert(serviceTranslations).values({ serviceId: input.serviceId, locale: revision.locale, title: revision.title, slug: revision.slug, content: revision.content, excerpt: revision.excerpt, metaTitle: revision.title }).onConflictDoUpdate({ target: [serviceTranslations.serviceId, serviceTranslations.locale], set: { title: revision.title, slug: revision.slug, content: revision.content, excerpt: revision.excerpt, metaTitle: revision.title } }); await tx.insert(serviceRevisions).values({ serviceId: input.serviceId, authorId: user.id, locale: revision.locale, title: revision.title, slug: revision.slug, content: revision.content, excerpt: revision.excerpt, status: revision.status, revisionNote: "Revision restore" }); });
  if (revision.status === "PUBLISHED") { const t = getServiceNotificationTranslations(locale); await createServiceNotification({ recipientId: current.providerId, serviceId: input.serviceId, actorId: user.id, type: "SERVICE_PUBLISHED", title: t.publishedTitle, message: t.publishedMessage, locale }); }
  auditService(context, user.id, "SERVICE_REVISION_RESTORE", { resource: "services", resourceId: input.serviceId, metadata: { restoredRevisionId: input.revisionId } }); invalidateServicesCache(); return { success: true };
} });
