import { defineAction, ActionError } from "astro:actions";
import { z } from "astro/zod";
import { eq } from "drizzle-orm";
import { getDrizzle } from "@database/drizzle";
import { blogPostLinks } from "@database/schemas";
import { blogLinkFormSchema, blogLinkUpdateSchema } from "@/lib/blog/validation";
import {
  assertBlogPermission,
  assertBlogPostExists,
  blogRateLimit,
  auditBlog,
  invalidateBlogCache,
} from "./_helpers";

export const createBlogLink = defineAction({
  input: blogLinkFormSchema,
  handler: async (input, context) => {
    const user = await assertBlogPermission(context, { blog: ["update"] });
    blogRateLimit(context, user.id, "link-create");

    await assertBlogPostExists(input.sourcePostId);
    await assertBlogPostExists(input.targetPostId);
    if (input.sourcePostId === input.targetPostId) {
      throw new ActionError({
        code: "BAD_REQUEST",
        message: "Un article ne peut pas être lié à lui-même.",
      });
    }

    const db = getDrizzle();

    const [link] = await db
      .insert(blogPostLinks)
      .values({
        sourcePostId: input.sourcePostId,
        targetPostId: input.targetPostId,
        linkType: input.linkType,
        sortOrder: input.sortOrder,
      })
      .returning();

    auditBlog(context, user.id, "BLOG_LINK_CREATE", {
      resource: "blog_post_links",
      resourceId: link.id,
      metadata: { sourcePostId: input.sourcePostId, targetPostId: input.targetPostId, linkType: input.linkType },
    });

    invalidateBlogCache();
    return { id: link.id };
  },
});

export const updateBlogLink = defineAction({
  input: blogLinkUpdateSchema,
  handler: async (input, context) => {
    const user = await assertBlogPermission(context, { blog: ["update"] });
    blogRateLimit(context, user.id, "link-update");

    const db = getDrizzle();
    const [link] = await db
      .select()
      .from(blogPostLinks)
      .where(eq(blogPostLinks.id, input.id))
      .limit(1);
    if (!link) throw new ActionError({ code: "NOT_FOUND", message: "Lien introuvable." });

    await assertBlogPostExists(link.sourcePostId);

    await db
      .update(blogPostLinks)
      .set({
        ...(input.linkType ? { linkType: input.linkType } : {}),
        ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
      })
      .where(eq(blogPostLinks.id, input.id));

    auditBlog(context, user.id, "BLOG_LINK_UPDATE", {
      resource: "blog_post_links",
      resourceId: input.id,
      metadata: { linkType: input.linkType, sortOrder: input.sortOrder },
    });

    invalidateBlogCache();
    return { success: true };
  },
});

export const deleteBlogLink = defineAction({
  input: z.object({
    id: z.uuid(),
  }),
  handler: async (input, context) => {
    const user = await assertBlogPermission(context, { blog: ["update"] });
    blogRateLimit(context, user.id, "link-delete");

    const db = getDrizzle();
    const [link] = await db
      .select()
      .from(blogPostLinks)
      .where(eq(blogPostLinks.id, input.id))
      .limit(1);
    if (!link) throw new ActionError({ code: "NOT_FOUND", message: "Lien introuvable." });

    await assertBlogPostExists(link.sourcePostId);

    await db.delete(blogPostLinks).where(eq(blogPostLinks.id, input.id));

    auditBlog(context, user.id, "BLOG_LINK_DELETE", {
      resource: "blog_post_links",
      resourceId: input.id,
      metadata: { sourcePostId: link.sourcePostId, targetPostId: link.targetPostId },
    });

    invalidateBlogCache();
    return { success: true };
  },
});
