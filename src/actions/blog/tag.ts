import { defineAction, ActionError } from "astro:actions";
import { z } from "astro/zod";
import { eq, and, isNull, or } from "drizzle-orm";
import { getDrizzle } from "@database/drizzle";
import { blogTags, blogTagTranslations, blogPostTags } from "@database/schemas";
import { invalidateCache } from "@database/cache";
import { DEFAULT_LOCALE, type Locale } from "@i18n/config";
import { blogTagFormSchema, blogTagUpdateSchema } from "@/lib/blog/validation";
import {
  assertBlogPermission,
  assertBlogTagExists,
  blogRateLimit,
  auditBlog,
} from "./_helpers";

async function assertBaseTagSlugAvailable(
  slug: string,
  currentTagId?: string,
) {
  const db = getDrizzle();
  const [existing] = await db
    .select({ id: blogTags.id })
    .from(blogTags)
    .where(eq(blogTags.slug, slug))
    .limit(1);

  if (existing && existing.id !== currentTagId) {
    throw new ActionError({
      code: "CONFLICT",
      message: `Un autre tag utilise déjà le slug « ${slug} » comme slug canonique.`,
    });
  }
}

async function assertLocalizedTagSlugAvailable(
  locale: Locale,
  slug: string,
  currentTagId?: string,
) {
  const db = getDrizzle();
  const [existing] = await db
    .select({ id: blogTags.id })
    .from(blogTags)
    .leftJoin(
      blogTagTranslations,
      and(eq(blogTagTranslations.tagId, blogTags.id), eq(blogTagTranslations.locale, locale)),
    )
    .where(
      or(
        eq(blogTagTranslations.slug, slug),
        and(isNull(blogTagTranslations.id), eq(blogTags.slug, slug)),
      ),
    )
    .limit(1);

  if (existing && existing.id !== currentTagId) {
    throw new ActionError({
      code: "CONFLICT",
      message: `Un autre tag utilise déjà le slug « ${slug} » pour la locale « ${locale} ».`,
    });
  }
}

export const createBlogTag = defineAction({
  input: blogTagFormSchema,
  handler: async (input, context) => {
    const user = await assertBlogPermission(context, { blogTag: ["create"] });
    blogRateLimit(context, user.id, "tag-create");

    const db = getDrizzle();

    await assertBaseTagSlugAvailable(input.slug);
    await assertLocalizedTagSlugAvailable(input.locale, input.slug);

    const [tag] = await db
      .insert(blogTags)
      .values({
        slug: input.slug,
        color: input.color,
      })
      .returning();

    await db.insert(blogTagTranslations).values({
      tagId: tag.id,
      locale: input.locale,
      name: input.name,
      slug: input.slug,
    });

    auditBlog(context, user.id, "BLOG_TAG_CREATE", {
      resource: "blog_tags",
      resourceId: tag.id,
      metadata: { locale: input.locale, slug: input.slug },
    });

    invalidateCache("blog:tags");
    return { id: tag.id, slug: input.slug };
  },
});

export const updateBlogTag = defineAction({
  input: blogTagUpdateSchema,
  handler: async (input, context) => {
    const user = await assertBlogPermission(context, { blogTag: ["update"] });
    blogRateLimit(context, user.id, "tag-update");

    const { id, ...data } = input;
    await assertBlogTagExists(id);

    const db = getDrizzle();

    if (data.slug) {
      if (!data.locale || data.locale === DEFAULT_LOCALE) {
        await assertBaseTagSlugAvailable(data.slug, id);
      }

      if (data.locale) {
        await assertLocalizedTagSlugAvailable(data.locale, data.slug, id);
      }
    }

    await db
      .update(blogTags)
      .set({
        ...((data.slug !== undefined && (!data.locale || data.locale === DEFAULT_LOCALE))
          ? { slug: data.slug }
          : {}),
        color: data.color,
      })
      .where(eq(blogTags.id, id));

    if (data.locale) {
      const [translation] = await db
        .select()
        .from(blogTagTranslations)
        .where(and(eq(blogTagTranslations.tagId, id), eq(blogTagTranslations.locale, data.locale)))
        .limit(1);

      if (translation) {
        await db
          .update(blogTagTranslations)
          .set({ name: data.name, slug: data.slug })
          .where(eq(blogTagTranslations.id, translation.id));
      } else {
        await db.insert(blogTagTranslations).values({
          tagId: id,
          locale: data.locale,
          name: data.name!,
          slug: data.slug!,
        });
      }
    }

    auditBlog(context, user.id, "BLOG_TAG_UPDATE", {
      resource: "blog_tags",
      resourceId: id,
      metadata: { locale: data.locale, slug: data.slug },
    });

    invalidateCache("blog:tags");
    return { id };
  },
});

export const deleteBlogTag = defineAction({
  input: z.object({
    id: z.uuid(),
  }),
  handler: async (input, context) => {
    const user = await assertBlogPermission(context, { blogTag: ["delete"] });
    blogRateLimit(context, user.id, "tag-delete");

    await assertBlogTagExists(input.id);
    const db = getDrizzle();

    await db.delete(blogPostTags).where(eq(blogPostTags.tagId, input.id));
    await db.delete(blogTags).where(eq(blogTags.id, input.id));

    auditBlog(context, user.id, "BLOG_TAG_DELETE", {
      resource: "blog_tags",
      resourceId: input.id,
      metadata: {},
    });

    invalidateCache("blog:tags");
    return { success: true };
  },
});
