import { eq, and, asc, or, lte, isNull } from "drizzle-orm";
import { getDrizzle } from "@database/drizzle";
import { cached } from "@database/cache";
import { pages, pageSections } from "@database/schemas";
import { isValidLocale } from "@i18n/utils";

export interface PageWithSections {
  page: typeof pages.$inferSelect;
  sections: (typeof pageSections.$inferSelect)[];
}

/**
 * Load a published CMS page by locale and slug, including its visible sections.
 */
export const getPage = cached(
  (locale: string, slug: string) => `page:${locale}:${slug}`,
  async (
    locale: string,
    slug: string,
  ): Promise<PageWithSections | null> => {
  if (!isValidLocale(locale)) return null;
  const db = getDrizzle();
  const now = new Date();

  const [page] = await db
    .select()
    .from(pages)
    .where(
      and(
        eq(pages.locale, locale),
        eq(pages.slug, slug),
        isNull(pages.deletedAt),
        or(
          eq(pages.isPublished, true),
          lte(pages.scheduledAt, now),
        ),
      ),
    )
    .limit(1);

  if (!page) return null;

  // Lazy-update: if the page was served via scheduled publishing, persist the
  // published state so the admin UI stays consistent.
  if (!page.isPublished && page.scheduledAt && page.scheduledAt <= now) {
    try {
      await db
        .update(pages)
        .set({ isPublished: true, publishedAt: page.scheduledAt, scheduledAt: null })
        .where(eq(pages.id, page.id));
    } catch (err: unknown) {
      console.error('[page.loader] Lazy-update for scheduled publish failed:', err);
    }
  }

  const sections = await db
    .select()
    .from(pageSections)
    .where(
      and(
        eq(pageSections.pageId, page.id),
        eq(pageSections.isVisible, true),
      ),
    )
    .orderBy(asc(pageSections.sortOrder))
    .limit(200);

  return { page, sections };
  },
);

/**
 * List all published CMS pages for a locale (for sitemap, nav, etc.).
 */
export const getPagesList = cached(
  (locale: string) => `page:list:${locale}`,
  async (locale: string) => {
    if (!isValidLocale(locale)) return [];
    const db = getDrizzle();
    const now = new Date();
    return db
      .select({
        id: pages.id,
        slug: pages.slug,
        title: pages.title,
        sortOrder: pages.sortOrder,
        publishedAt: pages.publishedAt,
      })
      .from(pages)
      .where(
        and(
          eq(pages.locale, locale),
          isNull(pages.deletedAt),
          or(
            eq(pages.isPublished, true),
            lte(pages.scheduledAt, now),
          ),
        ),
      )
      .orderBy(asc(pages.sortOrder))
      .limit(500);
  },
);

/**
 * Admin: get a page row by ID (frais, brouillon inclus).
 */
export async function getAdminPageById(pageId: string): Promise<(typeof pages.$inferSelect) | null> {
  const db = getDrizzle();
  const [row] = await db.select().from(pages).where(eq(pages.id, pageId)).limit(1);
  return row ?? null;
}

/**
 * Admin: list sections of a page (frais, toutes visibilités).
 */
export async function getAdminPageSections(pageId: string) {
  const db = getDrizzle();
  return db
    .select()
    .from(pageSections)
    .where(eq(pageSections.pageId, pageId))
    .orderBy(asc(pageSections.sortOrder))
    .limit(200);
}

/**
 * Admin: paginated pages list with section counts (frais).
 */
export async function getAdminPagesList(page: number, perPage: number) {
  const { count } = await import("drizzle-orm");
  const db = getDrizzle();
  const safePage = Math.max(1, Math.min(page, 200));
  const safePerPage = Math.max(1, Math.min(perPage, 100));
  const offset = Math.min((safePage - 1) * safePerPage, 10_000);
  const [rows, [total]] = await Promise.all([
    db
      .select({
        id: pages.id,
        locale: pages.locale,
        title: pages.title,
        slug: pages.slug,
        template: pages.template,
        metaTitle: pages.metaTitle,
        metaDescription: pages.metaDescription,
        ogImage: pages.ogImage,
        isPublished: pages.isPublished,
        publishedAt: pages.publishedAt,
        sortOrder: pages.sortOrder,
        lockedBy: pages.lockedBy,
        lockedAt: pages.lockedAt,
        createdAt: pages.createdAt,
        updatedAt: pages.updatedAt,
        sectionCount: count(pageSections.id),
      })
      .from(pages)
      .leftJoin(pageSections, eq(pages.id, pageSections.pageId))
      .groupBy(pages.id)
      .orderBy(asc(pages.locale), asc(pages.sortOrder))
      .limit(safePerPage)
      .offset(offset),
    db.select({ value: count() }).from(pages),
  ]);
  return { rows, total: total?.value ?? 0 };
}

export interface CmsExportPage {
  locale: string;
  slug: string;
  title: string;
  metaTitle: string | null;
  metaDescription: string | null;
  ogImage: string | null;
  canonical: string | null;
  robots: string | null;
  template: string;
  isPublished: boolean;
  publishedAt: string | null;
  sortOrder: number;
  sections: { type: string; content: unknown; sortOrder: number; isVisible: boolean }[];
}

/**
 * Admin: exporte tout le CMS (pages + sections, hors soft-deleted).
 */
export async function exportCmsContent(): Promise<{ version: 1; exportedAt: string; pages: CmsExportPage[] }> {
  const { asc, isNull } = await import("drizzle-orm");
  const db = getDrizzle();
  const [allPages, allSections] = await Promise.all([
    db.select().from(pages).where(isNull(pages.deletedAt)).orderBy(asc(pages.locale), asc(pages.sortOrder)),
    db.select().from(pageSections).orderBy(asc(pageSections.pageId), asc(pageSections.sortOrder)),
  ]);
  const sectionsByPage = new Map<string, typeof allSections>();
  for (const section of allSections) {
    const list = sectionsByPage.get(section.pageId) ?? [];
    list.push(section);
    sectionsByPage.set(section.pageId, list);
  }
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    pages: allPages.map((page) => ({
      locale: page.locale,
      slug: page.slug,
      title: page.title,
      metaTitle: page.metaTitle,
      metaDescription: page.metaDescription,
      ogImage: page.ogImage,
      canonical: page.canonical,
      robots: page.robots,
      template: page.template,
      isPublished: page.isPublished,
      publishedAt: page.publishedAt?.toISOString() ?? null,
      sortOrder: page.sortOrder,
      sections: (sectionsByPage.get(page.id) ?? []).map((s) => ({
        type: s.type,
        content: s.content,
        sortOrder: s.sortOrder,
        isVisible: s.isVisible,
      })),
    })),
  };
}

export interface CmsImportPage {
  locale: string;
  slug: string;
  title: string;
  metaTitle?: string | null;
  metaDescription?: string | null;
  ogImage?: string | null;
  canonical?: string | null;
  robots?: string | null;
  template?: string;
  isPublished?: boolean;
  publishedAt?: string | null;
  sortOrder?: number;
  sections?: { type: string; content: unknown; sortOrder: number; isVisible: boolean }[];
}

/**
 * Admin: importe du contenu CMS (upsert par locale+slug, sections remplacées).
 */
export async function importCmsContent(input: { pages: CmsImportPage[] }, userId: string): Promise<{ created: number; updated: number; skipped: number }> {
  const { eq, and } = await import("drizzle-orm");
  const db = getDrizzle();
  let created = 0;
  let updated = 0;
  let skipped = 0;
  for (const pageData of input.pages) {
    const { sections = [], publishedAt, ...pageFields } = pageData;
    const [existing] = await db
      .select({ id: pages.id })
      .from(pages)
      .where(and(eq(pages.locale, pageFields.locale), eq(pages.slug, pageFields.slug)))
      .limit(1);
    try {
      if (existing) {
        await db
          .update(pages)
          .set({ ...pageFields, template: pageFields.template ?? "default", sortOrder: pageFields.sortOrder ?? 0, isPublished: pageFields.isPublished ?? false, publishedAt: publishedAt ? new Date(publishedAt) : null, updatedBy: userId })
          .where(eq(pages.id, existing.id));
        if (sections.length > 0) {
          await db.delete(pageSections).where(eq(pageSections.pageId, existing.id));
          await db.insert(pageSections).values(
            sections.map((s) => ({ pageId: existing.id, type: s.type, content: s.content, sortOrder: s.sortOrder, isVisible: s.isVisible, updatedBy: userId })),
          );
        }
        updated++;
      } else {
        const [newPage] = await db
          .insert(pages)
          .values({ ...pageFields, template: pageFields.template ?? "default", sortOrder: pageFields.sortOrder ?? 0, isPublished: pageFields.isPublished ?? false, publishedAt: publishedAt ? new Date(publishedAt) : null, updatedBy: userId })
          .returning({ id: pages.id });
        if (sections.length > 0 && newPage) {
          await db.insert(pageSections).values(
            sections.map((s) => ({ pageId: newPage.id, type: s.type, content: s.content, sortOrder: s.sortOrder, isVisible: s.isVisible, updatedBy: userId })),
          );
        }
        created++;
      }
    } catch (err: unknown) {
      console.error(`[content-import] Failed to import page ${pageFields.locale}/${pageFields.slug}:`, err);
      skipped++;
    }
  }
  const { invalidateCache } = await import("@database/cache");
  await invalidateCache("page:");
  return { created, updated, skipped };
}

/**
 * Admin: exécute le cron de publication (publish + unpublish + purge 30j).
 */
export async function runPagePublishCron(now: Date = new Date()): Promise<{ published: number; unpublished: number; purged: number }> {
  const { and, lte, eq, isNull, isNotNull, lt } = await import("drizzle-orm");
  const db = getDrizzle();
  const results = { published: 0, unpublished: 0, purged: 0 };
  try {
    const published = await db.update(pages).set({ isPublished: true, publishedAt: now, scheduledAt: null }).where(and(isNotNull(pages.scheduledAt), lte(pages.scheduledAt, now), eq(pages.isPublished, false), isNull(pages.deletedAt))).returning({ id: pages.id });
    results.published = published.length;
  } catch (err) {
    console.error("[cron/publish] Auto-publish failed:", err);
  }
  try {
    const unpublished = await db.update(pages).set({ isPublished: false, scheduledUnpublishAt: null }).where(and(isNotNull(pages.scheduledUnpublishAt), lte(pages.scheduledUnpublishAt, now), eq(pages.isPublished, true), isNull(pages.deletedAt))).returning({ id: pages.id });
    results.unpublished = unpublished.length;
  } catch (err) {
    console.error("[cron/publish] Auto-unpublish failed:", err);
  }
  try {
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const purged = await db.delete(pages).where(and(isNotNull(pages.deletedAt), lt(pages.deletedAt, thirtyDaysAgo))).returning({ id: pages.id });
    results.purged = purged.length;
  } catch (err) {
    console.error("[cron/publish] Trash purge failed:", err);
  }
  if (results.published > 0 || results.unpublished > 0 || results.purged > 0) {
    const { invalidateCache } = await import("@database/cache");
    await invalidateCache("page:");
  }
  return results;
}

/**
 * Load a CMS page by ID (draft or published) for admin preview.
 * NOT cached — always returns fresh data.
 */
export async function getPagePreview(pageId: string): Promise<PageWithSections | null> {
  const db = getDrizzle();

  const [page] = await db
    .select()
    .from(pages)
    .where(eq(pages.id, pageId))
    .limit(1);

  if (!page) return null;

  const sections = await db
    .select()
    .from(pageSections)
    .where(eq(pageSections.pageId, page.id))
    .orderBy(asc(pageSections.sortOrder))
    .limit(200);

  return { page, sections };
}
