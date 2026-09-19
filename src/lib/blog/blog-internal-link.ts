import type { Locale } from "@i18n/config";
import { getDrizzle } from "@database/drizzle";
import { eq, and, ilike } from "drizzle-orm";
import { blogPosts, blogPostTranslations } from "@database/schemas";
import { getBlogPostBySlug, getBlogValidLinkTargets } from "@database/loaders/blog.loader";
import { buildBlogPostUrl } from "@/lib/blog/utils";
import { publishedScope } from "@database/loaders/blog.loader";
import type { InternalLinkResolver, InternalLinkResolution } from "@/lib/content/internal-link-resolver";

interface Ctx {
  locale: string;
  limit?: number;
}

/**
 * Blog internal-link resolver. Registered into the shared content registry so
 * the generic ContentEditor / RichContent can resolve & validate blog links
 * without being coupled to the blog module.
 */
export const blogInternalLinkResolver: InternalLinkResolver = {
  name: "blog",

  async resolve(target: string, ctx: Ctx): Promise<InternalLinkResolution> {
    const locale = ctx.locale as Locale;
    const post = await getBlogPostBySlug(locale, target);
    if (!post || !post.translation) {
      return { href: "#", title: null, exists: false };
    }
    const categorySlug = post.categories[0]?.slug ?? null;
    const href = buildBlogPostUrl(locale, post.translation.slug, categorySlug);
    return { href, title: post.translation.title, exists: true };
  },

  async listValidTargets(ctx: Ctx): Promise<Set<string>> {
    return getBlogValidLinkTargets(ctx.locale as Locale);
  },

  async search(query: string, ctx: Ctx) {
    const db = getDrizzle();
    const locale = ctx.locale as Locale;
    const limit = Math.min(20, Math.max(1, ctx.limit ?? 10));
    const q = `%${query}%`;
    const rows = await db
      .select({
        id: blogPosts.id,
        slug: blogPostTranslations.slug,
        title: blogPostTranslations.title,
      })
      .from(blogPostTranslations)
      .innerJoin(blogPosts, eq(blogPosts.id, blogPostTranslations.postId))
      .where(
        and(
          eq(blogPostTranslations.locale, locale),
          publishedScope(blogPosts),
          ilike(blogPostTranslations.title, q),
        ),
      )
      .limit(limit);

    return rows.map((r) => {
      const categorySlug = null; // search results don't carry category; resolve() is used for exact href
      const href = buildBlogPostUrl(locale, r.slug, categorySlug);
      return { id: r.id, label: r.title, href };
    });
  },
};
