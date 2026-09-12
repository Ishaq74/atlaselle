import rss from "@astrojs/rss";
import type { APIRoute } from "astro";
import { eq } from "drizzle-orm";
import { getDrizzle } from "@database/drizzle";
import { organization } from "@database/schemas";
import { getBlogPosts } from "@database/loaders/blog.loader";
import { LOCALES, DEFAULT_LOCALE, type Locale } from "@i18n/config";
import { getCommonTranslations } from "@i18n/utils";
import { buildBlogPostUrl } from "@/lib/blog/utils";

export const prerender = false;

/**
 * GET /[lang]/organizations/[slug]/blog/rss.xml
 * RSS feed of an organization-scoped blog, across all locales.
 */
export const GET: APIRoute = async (context) => {
  const orgSlug = context.params.slug;
  if (!orgSlug) {
    return new Response("Not found", { status: 404 });
  }

  const db = getDrizzle();
  const [org] = await db
    .select({ id: organization.id, name: organization.name, slug: organization.slug })
    .from(organization)
    .where(eq(organization.slug, orgSlug))
    .limit(1);

  if (!org) {
    return new Response("Not found", { status: 404 });
  }

  const common = await getCommonTranslations(DEFAULT_LOCALE);
  const allItems: {
    title: string;
    link: string;
    pubDate?: Date;
    description?: string;
  }[] = [];

  for (const loc of LOCALES) {
    try {
      let page = 1;
      for (;;) {
        const { items, meta } = await getBlogPosts(org.id, loc as Locale, {
          page,
          limit: 100,
          sortBy: "publishedAt",
          sortOrder: "desc",
        });
        for (const item of items) {
          if (!item.translation) continue;
          const categorySlug = item.categories[0]?.slug ?? null;
          allItems.push({
            title: item.translation.title,
            link: buildBlogPostUrl(loc as Locale, org.slug, item.translation.slug, categorySlug),
            pubDate: item.post.publishedAt ?? undefined,
            description: item.translation.excerpt ?? undefined,
          });
        }
        if (!meta.hasNextPage) break;
        page += 1;
      }
    } catch (err) {
      console.error(`[rss:org] Failed to load blog posts for locale "${loc}":`, err);
    }
  }

  return rss({
    title: `${org.name} — ${common.rss.title}`,
    description: common.rss.description,
    site: context.site!,
    items: allItems,
    customData: LOCALES.map((loc) => `<language>${loc}</language>`).join(""),
  });
};
