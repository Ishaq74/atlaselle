import { defineAction, ActionError } from "astro:actions";
import { z } from "astro/zod";
import { eq, and, or, isNull } from "drizzle-orm";
import { getDrizzle } from "@database/drizzle";
import { blogCategories, blogCategoryTranslations, blogPostCategories } from "@database/schemas";
import { invalidateCache } from "@database/cache";
import { DEFAULT_LOCALE, type Locale } from "@i18n/config";
import { blogCategoryFormSchema, blogCategoryUpdateSchema } from "@/lib/blog/validation";
import { assertAcyclicParent } from "@/lib/cms/taxonomy";
import { assertBlogPermission, assertBlogCategoryExists, blogRateLimit, auditBlog } from "./_helpers";

async function assertBaseCategorySlugAvailable(slug: string, currentCategoryId?: string) {
  const db = getDrizzle();
  const [existing] = await db.select({ id: blogCategories.id }).from(blogCategories).where(eq(blogCategories.slug, slug)).limit(1);
  if (existing && existing.id !== currentCategoryId) throw new ActionError({ code: "CONFLICT", message: `Une autre catégorie utilise déjà le slug « ${slug} » comme slug canonique.` });
}

async function assertLocalizedCategorySlugAvailable(locale: Locale, slug: string, currentCategoryId?: string) {
  const db = getDrizzle();
  const [existing] = await db.select({ id: blogCategories.id }).from(blogCategories).leftJoin(blogCategoryTranslations, and(eq(blogCategoryTranslations.categoryId, blogCategories.id), eq(blogCategoryTranslations.locale, locale))).where(or(eq(blogCategoryTranslations.slug, slug), and(isNull(blogCategoryTranslations.id), eq(blogCategories.slug, slug)))).limit(1);
  if (existing && existing.id !== currentCategoryId) throw new ActionError({ code: "CONFLICT", message: `Une autre catégorie utilise déjà le slug « ${slug} » pour la locale « ${locale} ».` });
}

async function assertCategoryParentIsAcyclic(categoryId: string | null, parentId: string | null) {
  if (!parentId) return;
  const db = getDrizzle();
  const rows = await db
    .select({ id: blogCategories.id, parentId: blogCategories.parentId })
    .from(blogCategories);
  try {
    assertAcyclicParent(rows, categoryId, parentId);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid taxonomy hierarchy.";
    throw new ActionError({ code: "BAD_REQUEST", message });
  }
}

export const createBlogCategory = defineAction({
  input: blogCategoryFormSchema,
  handler: async (input, context) => {
    const user = await assertBlogPermission(context, { blogCategory: ["create"] });
    blogRateLimit(context, user.id, "category-create");
    await assertCategoryParentIsAcyclic(null, input.parentId ?? null);
    await assertBaseCategorySlugAvailable(input.slug);
    await assertLocalizedCategorySlugAvailable(input.locale, input.slug);
    const db = getDrizzle();
    const category = await db.transaction(async (tx) => {
      const [created] = await tx.insert(blogCategories).values({ parentId: input.parentId, slug: input.slug, icon: input.icon, color: input.color, sortOrder: input.sortOrder ?? 0 }).returning();
      await tx.insert(blogCategoryTranslations).values({ categoryId: created.id, locale: input.locale, name: input.name, slug: input.slug, description: input.description, metaTitle: input.metaTitle, metaDescription: input.metaDescription });
      return created;
    });
    auditBlog(context, user.id, "BLOG_CATEGORY_CREATE", { resource: "blog_categories", resourceId: category.id, metadata: { locale: input.locale, slug: input.slug } });
    invalidateCache("blog:categories");
    return { id: category.id, slug: input.slug };
  },
});

export const updateBlogCategory = defineAction({
  input: blogCategoryUpdateSchema,
  handler: async (input, context) => {
    const user = await assertBlogPermission(context, { blogCategory: ["update"] });
    blogRateLimit(context, user.id, "category-update");
    const { id, ...data } = input;
    await assertBlogCategoryExists(id);
    await assertCategoryParentIsAcyclic(id, data.parentId ?? null);
    if (data.slug) {
      if (!data.locale || data.locale === DEFAULT_LOCALE) await assertBaseCategorySlugAvailable(data.slug, id);
      if (data.locale) await assertLocalizedCategorySlugAvailable(data.locale, data.slug, id);
    }
    const db = getDrizzle();
    await db.transaction(async (tx) => {
      await tx.update(blogCategories).set({ parentId: data.parentId, ...((data.slug !== undefined && (!data.locale || data.locale === DEFAULT_LOCALE)) ? { slug: data.slug } : {}), icon: data.icon, color: data.color, sortOrder: data.sortOrder }).where(eq(blogCategories.id, id));
      if (data.locale) {
        const [translation] = await tx.select().from(blogCategoryTranslations).where(and(eq(blogCategoryTranslations.categoryId, id), eq(blogCategoryTranslations.locale, data.locale))).limit(1);
        if (translation) await tx.update(blogCategoryTranslations).set({ name: data.name, slug: data.slug, description: data.description, metaTitle: data.metaTitle, metaDescription: data.metaDescription }).where(eq(blogCategoryTranslations.id, translation.id));
        else await tx.insert(blogCategoryTranslations).values({ categoryId: id, locale: data.locale, name: data.name!, slug: data.slug!, description: data.description, metaTitle: data.metaTitle, metaDescription: data.metaDescription });
      }
    });
    auditBlog(context, user.id, "BLOG_CATEGORY_UPDATE", { resource: "blog_categories", resourceId: id, metadata: { locale: data.locale, slug: data.slug } });
    invalidateCache("blog:categories");
    return { id };
  },
});

export const deleteBlogCategory = defineAction({
  input: z.object({ id: z.uuid(), reassignToId: z.uuid().optional() }),
  handler: async (input, context) => {
    const user = await assertBlogPermission(context, { blogCategory: ["delete"] });
    blogRateLimit(context, user.id, "category-delete");
    await assertBlogCategoryExists(input.id);
    if (input.reassignToId) await assertBlogCategoryExists(input.reassignToId);
    const db = getDrizzle();
    await db.transaction(async (tx) => {
      if (input.reassignToId) {
        const affected = await tx.select({ postId: blogPostCategories.postId }).from(blogPostCategories).where(eq(blogPostCategories.categoryId, input.id));
        if (affected.length) {
          await tx.delete(blogPostCategories).where(eq(blogPostCategories.categoryId, input.id));
          await tx.insert(blogPostCategories).values(affected.map(({ postId }) => ({ postId, categoryId: input.reassignToId! }))).onConflictDoNothing();
        }
      }
      await tx.delete(blogCategories).where(eq(blogCategories.id, input.id));
    });
    auditBlog(context, user.id, "BLOG_CATEGORY_DELETE", { resource: "blog_categories", resourceId: input.id, metadata: { reassignToId: input.reassignToId } });
    invalidateCache("blog:categories");
    return { success: true };
  },
});
