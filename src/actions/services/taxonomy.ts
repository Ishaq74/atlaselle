import { defineAction, ActionError } from "astro:actions";
import { and, eq } from "drizzle-orm";
import { z } from "astro/zod";
import { getDrizzle } from "@database/drizzle";
import { serviceCategories, serviceCategoryTranslations, serviceTags, serviceTagTranslations } from "@database/schemas";
import { assertAcyclicParent } from "@/core/taxonomy";
import { assertServicePermission, assertServiceCategoryExists, assertServiceTagExists } from "./_helpers";
import { invalidateServicesCache, auditService } from "./_helpers";

const localeSchema = z.enum(["fr", "en", "es", "ar"]);
const slugSchema = z.string().trim().min(1).max(160).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const categoryInput = z.object({ locale: localeSchema, name: z.string().trim().min(1).max(120), slug: slugSchema, description: z.string().trim().max(500).optional().nullable(), parentId: z.uuid().optional().nullable(), clearParent: z.boolean().default(false), icon: z.string().trim().max(120).optional().nullable(), color: z.string().trim().max(32).optional().nullable(), sortOrder: z.coerce.number().int().min(0).max(100_000).default(0) });
const tagInput = z.object({ locale: localeSchema, name: z.string().trim().min(1).max(120), slug: slugSchema, color: z.string().trim().max(32).optional().nullable() });

export const createServiceCategory = defineAction({ input: categoryInput, handler: async (input, context) => {
  const user = await assertServicePermission(context, { serviceCategory: ["create"] }); if (input.parentId) await assertServiceCategoryExists(input.parentId);
  const db = getDrizzle(); const siblings = await db.select({ id: serviceCategories.id, parentId: serviceCategories.parentId }).from(serviceCategories); assertAcyclicParent(siblings, null, input.parentId ?? null);
  let id = ""; await db.transaction(async (tx) => { const [row] = await tx.insert(serviceCategories).values({ parentId: input.parentId ?? null, slug: input.slug, icon: input.icon ?? null, color: input.color ?? null, sortOrder: input.sortOrder }).returning({ id: serviceCategories.id }); id = row.id; await tx.insert(serviceCategoryTranslations).values({ categoryId: row.id, locale: input.locale, name: input.name, slug: input.slug, description: input.description ?? null }); });
  auditService(context, user.id, "SERVICE_CATEGORY_CREATE", { resource: "serviceCategories", resourceId: id, metadata: { locale: input.locale } }); invalidateServicesCache(); return { id };
} });

export const updateServiceCategory = defineAction({ input: categoryInput.extend({ id: z.uuid() }), handler: async (input, context) => {
  const user = await assertServicePermission(context, { serviceCategory: ["update"] }); await assertServiceCategoryExists(input.id); if (input.parentId) await assertServiceCategoryExists(input.parentId);
  const db = getDrizzle(); const [current] = await db.select({ id: serviceCategories.id, parentId: serviceCategories.parentId }).from(serviceCategories).where(eq(serviceCategories.id, input.id)).limit(1); if (!current) throw new ActionError({ code: "NOT_FOUND", message: "Catégorie introuvable." });
  const nextParentId = input.parentId !== undefined ? input.parentId : (input.clearParent ? null : current.parentId); const nodes = await db.select({ id: serviceCategories.id, parentId: serviceCategories.parentId }).from(serviceCategories); assertAcyclicParent(nodes, input.id, nextParentId ?? null);
  await db.transaction(async (tx) => { await tx.update(serviceCategories).set({ parentId: nextParentId ?? null, icon: input.icon ?? null, color: input.color ?? null, sortOrder: input.sortOrder }).where(eq(serviceCategories.id, input.id)); const [translation] = await tx.select({ id: serviceCategoryTranslations.id }).from(serviceCategoryTranslations).where(and(eq(serviceCategoryTranslations.categoryId, input.id), eq(serviceCategoryTranslations.locale, input.locale))).limit(1); if (translation) await tx.update(serviceCategoryTranslations).set({ name: input.name, slug: input.slug, description: input.description ?? null }).where(eq(serviceCategoryTranslations.id, translation.id)); else await tx.insert(serviceCategoryTranslations).values({ categoryId: input.id, locale: input.locale, name: input.name, slug: input.slug, description: input.description ?? null }); });
  auditService(context, user.id, "SERVICE_CATEGORY_UPDATE", { resource: "serviceCategories", resourceId: input.id, metadata: { locale: input.locale } }); invalidateServicesCache(); return { id: input.id };
} });

export const deleteServiceCategory = defineAction({ input: z.object({ id: z.uuid() }), handler: async (input, context) => {
  const user = await assertServicePermission(context, { serviceCategory: ["delete"] }); await assertServiceCategoryExists(input.id); const db = getDrizzle(); const child = await db.select({ id: serviceCategories.id }).from(serviceCategories).where(eq(serviceCategories.parentId, input.id)).limit(1); if (child.length) throw new ActionError({ code: "CONFLICT", message: "Cette catégorie possède des sous-catégories." }); await db.delete(serviceCategories).where(eq(serviceCategories.id, input.id)); auditService(context, user.id, "SERVICE_CATEGORY_DELETE", { resource: "serviceCategories", resourceId: input.id, metadata: {} }); invalidateServicesCache(); return { success: true };
} });

export const createServiceTag = defineAction({ input: tagInput, handler: async (input, context) => {
  const user = await assertServicePermission(context, { serviceTag: ["create"] }); const db = getDrizzle(); let id = ""; await db.transaction(async (tx) => { const [row] = await tx.insert(serviceTags).values({ slug: input.slug, color: input.color ?? null }).returning({ id: serviceTags.id }); id = row.id; await tx.insert(serviceTagTranslations).values({ tagId: row.id, locale: input.locale, name: input.name, slug: input.slug }); }); auditService(context, user.id, "SERVICE_TAG_CREATE", { resource: "serviceTags", resourceId: id, metadata: { locale: input.locale } }); invalidateServicesCache(); return { id };
} });

export const updateServiceTag = defineAction({ input: tagInput.extend({ id: z.uuid() }), handler: async (input, context) => {
  const user = await assertServicePermission(context, { serviceTag: ["update"] }); await assertServiceTagExists(input.id); const db = getDrizzle();
  const [tag] = await db.select({ id: serviceTags.id }).from(serviceTags).where(eq(serviceTags.id, input.id)).limit(1); if (!tag) throw new ActionError({ code: "NOT_FOUND", message: "Tag introuvable." });
  await db.transaction(async (tx) => { await tx.update(serviceTags).set({ color: input.color ?? null }).where(eq(serviceTags.id, input.id)); const [translation] = await tx.select({ id: serviceTagTranslations.id }).from(serviceTagTranslations).where(and(eq(serviceTagTranslations.tagId, input.id), eq(serviceTagTranslations.locale, input.locale))).limit(1); if (translation) await tx.update(serviceTagTranslations).set({ name: input.name, slug: input.slug }).where(eq(serviceTagTranslations.id, translation.id)); else await tx.insert(serviceTagTranslations).values({ tagId: input.id, locale: input.locale, name: input.name, slug: input.slug }); });
  auditService(context, user.id, "SERVICE_TAG_UPDATE", { resource: "serviceTags", resourceId: input.id, metadata: { locale: input.locale } }); invalidateServicesCache(); return { id: input.id };
} });

export const deleteServiceTag = defineAction({ input: z.object({ id: z.uuid() }), handler: async (input, context) => { const user = await assertServicePermission(context, { serviceTag: ["delete"] }); await assertServiceTagExists(input.id); await getDrizzle().delete(serviceTags).where(eq(serviceTags.id, input.id)); auditService(context, user.id, "SERVICE_TAG_DELETE", { resource: "serviceTags", resourceId: input.id, metadata: {} }); invalidateServicesCache(); return { success: true }; } });
