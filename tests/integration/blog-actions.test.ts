import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest';

// `astro:actions` is a virtual module resolved only by the Astro build pipeline.
// In tests we provide the minimal shim (defineAction passthrough + ActionError).
// This is NOT a data mock — the real database, resolvers, audit and cache run.
vi.mock('astro:actions', () => {
  class ActionError extends Error {
    code: string;
    constructor({ code, message }: { code: string; message: string }) {
      super(message);
      this.code = code;
    }
  }
  return { ActionError, defineAction: (def: any) => def };
});

import { getDrizzle } from '@database/drizzle';
import { eq } from 'drizzle-orm';
import { blogPosts, blogReports, blogPostRevisions, blogPostTranslations, blogPostViewStats, user } from '@database/schemas';
import { listBlogPostRevisions } from '@/actions/blog/post';
import { updateBlogReport, getBlogModerationQueue } from '@/actions/blog/moderation';
import { resolveBlogInternalLink } from '@/actions/blog/internal-link';
import { checkBlogPostLinks } from '@/actions/blog/check-links';
import { recordBlogPostView } from '@/actions/blog/view';
import { resetRateLimiter } from '@/lib/rate-limit';
import type { Locale } from '@i18n/config';

// `defineAction` returns a typed callable; in tests we invoke `.handler` directly.
const listRevisions = (listBlogPostRevisions as any).handler as (i: any, c: any) => Promise<any>;
const updateReport = (updateBlogReport as any).handler as (i: any, c: any) => Promise<any>;
const getQueue = (getBlogModerationQueue as any).handler as (i: any, c: any) => Promise<any>;
const resolveLink = (resolveBlogInternalLink as any).handler as (i: any, c: any) => Promise<any>;
const checkLinks = (checkBlogPostLinks as any).handler as (i: any, c: any) => Promise<any>;
const recordView = (recordBlogPostView as any).handler as (i: any, c: any) => Promise<any>;

/**
 * Real integration tests against the seeded test database.
 * No DB mocking: the actions run against the actual Postgres instance,
 * exercising real queries, RBAC (admin bypass), audit and cache invalidation.
 * Only the ActionAPIContext is constructed locally (it is the caller, not data).
 */

function adminCtx(userId: string) {
  return {
    locals: { user: { id: userId, role: 'admin', email: 'admin@test.com', banned: false } },
    request: { headers: new Headers() },
    clientAddress: '127.0.0.1',
  } as any;
}

const db = getDrizzle();

describe('blog actions — integration (real DB)', () => {
  let globalPostId: string;
  let globalPostSlug: string;
  let realUserId: string;
  let pendingReportId: string;
  let seededPostId: string | null = null;
  let helpers: Awaited<ReturnType<typeof import('../helpers/auth').getTestHelpers>>;

  // Fixed IDs so the seed is idempotent across reruns (no skipIf, no skips).
  const SEED_POST_ID = 'c0ffee00-0000-4000-8000-000000000001';
  const SEED_POST_SLUG = 'test-blog-actions-post';
  const SEED_REVISION_ID = 'c0ffee00-0000-4000-8000-000000000002';
  const SEED_REPORT_ID = 'c0ffee00-0000-4000-8000-000000000003';

  beforeAll(async () => {
    // Dedicated admin user (never hijack another row — parallel suites share the DB).
    const { getTestHelpers } = await import('../helpers/auth');
    helpers = await getTestHelpers();
    const created = helpers.createUser({
      email: `blog-actions-admin-${Date.now()}@test.com`,
      name: 'Blog Actions Admin',
      emailVerified: true,
    });
    const saved = await helpers.saveUser(created);
    realUserId = saved.id;
    await db.update(user).set({ role: "admin" }).where(eq(user.id, realUserId));

    // Prefer a seeded FR post; otherwise create a deterministic one (always runs).
    const [seeded] = await db
      .select({ id: blogPosts.id, slug: blogPostTranslations.slug })
      .from(blogPosts)
      .innerJoin(blogPostTranslations, eq(blogPostTranslations.postId, blogPosts.id))
      .where(eq(blogPostTranslations.locale, 'fr'))
      .limit(1);
    if (seeded) {
      globalPostId = seeded.id;
      globalPostSlug = seeded.slug;
    } else {
      const now = new Date();
      await db.insert(blogPosts).values({
        id: SEED_POST_ID,
        authorId: realUserId,
        slug: SEED_POST_SLUG,
        status: 'PUBLISHED',
        publishedAt: now,
        updatedBy: realUserId,
      }).onConflictDoNothing();
      await db.insert(blogPostTranslations).values({
        postId: SEED_POST_ID,
        locale: 'fr',
        title: 'Blog actions seed post',
        slug: SEED_POST_SLUG,
        content: '<p>Seed content for blog action tests.</p>',
      }).onConflictDoNothing();
      globalPostId = SEED_POST_ID;
      globalPostSlug = SEED_POST_SLUG;
      seededPostId = SEED_POST_ID;
    }

    // Deterministic revision + PENDING report so every test below runs (no skips).
    await db.insert(blogPostRevisions).values({
      id: SEED_REVISION_ID,
      postId: globalPostId,
      authorId: realUserId,
      locale: 'fr',
      title: 'Seed revision',
      slug: globalPostSlug,
      content: '<p>Seed revision.</p>',
      status: 'PUBLISHED',
    }).onConflictDoNothing();
    await db.insert(blogReports).values({
      id: SEED_REPORT_ID,
      postId: globalPostId,
      reason: 'SPAM',
      description: 'Seed PENDING report for blog action tests.',
      status: 'PENDING',
    }).onConflictDoNothing();
    // Reset to PENDING in case a previous run resolved it.
    await db.update(blogReports).set({ status: 'PENDING', resolvedBy: null, resolvedAt: null }).where(eq(blogReports.id, SEED_REPORT_ID));
    pendingReportId = SEED_REPORT_ID;
  });

  afterAll(async () => {
    await db.delete(blogReports).where(eq(blogReports.id, SEED_REPORT_ID)).catch(() => {});
    await db.delete(blogPostRevisions).where(eq(blogPostRevisions.id, SEED_REVISION_ID)).catch(() => {});
    if (seededPostId) {
      await db.delete(blogPostTranslations).where(eq(blogPostTranslations.postId, seededPostId)).catch(() => {});
      await db.delete(blogPosts).where(eq(blogPosts.id, seededPostId)).catch(() => {});
    }
    await helpers.deleteUser(realUserId).catch(() => {});
  });

  it('listBlogPostRevisions returns revisions for a seeded post', async () => {
    const revisions = await listRevisions(
      { postId: globalPostId },
      adminCtx(realUserId),
    );
    expect(Array.isArray(revisions)).toBe(true);
    expect(revisions.length).toBeGreaterThan(0);
    // ordered by createdAt desc
    for (let i = 1; i < revisions.length; i++) {
      expect(new Date(revisions[i - 1].createdAt).getTime()).toBeGreaterThanOrEqual(
        new Date(revisions[i].createdAt).getTime(),
      );
    }
  });

  it('getBlogModerationQueue returns pending items', async () => {
    const queue = await getQueue(
      { page: 1, limit: 20 },
      adminCtx(realUserId),
    );
    expect(queue).toHaveProperty('comments');
    expect(queue).toHaveProperty('reviews');
    expect(queue).toHaveProperty('reports');
    expect(Array.isArray(queue.comments)).toBe(true);
    expect(Array.isArray(queue.reviews)).toBe(true);
    expect(Array.isArray(queue.reports)).toBe(true);
  });

  it('updateBlogReport resolves a PENDING report and persists it', async () => {
    const res = await updateReport(
      { reportId: pendingReportId, status: 'RESOLVED' },
      adminCtx(realUserId),
    );
    expect(res.success).toBe(true);

    const [updated] = await db
      .select({ status: blogReports.status, resolvedBy: blogReports.resolvedBy })
      .from(blogReports)
      .where(eq(blogReports.id, pendingReportId))
      .limit(1);
    expect(updated.status).toBe('RESOLVED');
    expect(updated.resolvedBy).toBe(realUserId);
  });

  it('resolveBlogInternalLink resolves a real slug', async () => {
    const res = await resolveLink(
      { target: globalPostSlug, mode: 'resolve', locale: 'fr' as Locale },
      adminCtx(realUserId),
    );
    expect(res.resolution.exists).toBe(true);
    expect(res.resolution.href).toContain('/fr/blog/');
  });

  it('resolveBlogInternalLink searches posts', async () => {
    const res = await resolveLink(
      { target: '', mode: 'search', query: 'Annecy', locale: 'fr' as Locale },
      adminCtx(realUserId),
    );
    expect(Array.isArray(res.results)).toBe(true);
    expect(res.results.length).toBeGreaterThan(0);
  });

  it('checkBlogPostLinks returns a structured report for a real post', async () => {
    const res = await checkLinks(
      { postId: globalPostId, locale: 'fr' as Locale },
      adminCtx(realUserId),
    );
    expect(res).toHaveProperty('deadExplicit');
    expect(res).toHaveProperty('deadInline');
    expect(Array.isArray(res.deadExplicit)).toBe(true);
    expect(Array.isArray(res.deadInline)).toBe(true);
  });

  describe('recordBlogPostView (real DB, real cookies)', () => {
    beforeEach(() => {
      // The rate limiter uses an in-memory store shared across the test process;
      // reset it so each test starts from a clean dedupe window.
      resetRateLimiter();
    });

    function anonCtx() {
      const cookies = new Map<string, string>();
      return {
        locals: {},
        request: { headers: new Headers({ 'user-agent': 'Mozilla/5.0' }) },
        clientAddress: '127.0.0.1',
        cookies: {
          get: (name: string) => (cookies.has(name) ? { value: cookies.get(name) } : undefined),
          set: (name: string, value: string) => {
            cookies.set(name, value);
          },
        },
      } as any;
    }
    function userCtx(userId: string) {
      return {
        locals: { user: { id: userId, role: 'user', email: 'user@test.com', banned: false }, session: { id: 'sess-real' } },
        request: { headers: new Headers({ 'user-agent': 'Mozilla/5.0' }) },
        clientAddress: '127.0.0.1',
        cookies: {
          get: () => undefined,
          set: () => {},
        },
      } as any;
    }

    it('increments viewCount and writes a view stat row for an anonymous visitor', async () => {
      const [before] = await db
        .select({ viewCount: blogPosts.viewCount })
        .from(blogPosts)
        .where(eq(blogPosts.id, globalPostId))
        .limit(1);

      const ctx = anonCtx();
      const res = await recordView({ postId: globalPostId, referrer: 'https://example.com' }, ctx);
      expect(res).toEqual({ recorded: true });

      const [after] = await db
        .select({ viewCount: blogPosts.viewCount })
        .from(blogPosts)
        .where(eq(blogPosts.id, globalPostId))
        .limit(1);
      expect(after.viewCount).toBe(before.viewCount + 1);

      const stats = await db
        .select({ sessionId: blogPostViewStats.sessionId, referrer: blogPostViewStats.referrer })
        .from(blogPostViewStats)
        .where(eq(blogPostViewStats.postId, globalPostId));
      const anon = stats.find((s) => s.sessionId?.startsWith('anon:'));
      expect(anon).toBeDefined();
      expect(anon?.referrer).toBe('https://example.com');
    });

    it('attributes a logged-in view to the session id, not an anon cookie', async () => {
      const ctx = userCtx(realUserId);
      const res = await recordView({ postId: globalPostId }, ctx);
      expect(res).toEqual({ recorded: true });

      const stats = await db
        .select({ sessionId: blogPostViewStats.sessionId })
        .from(blogPostViewStats)
        .where(eq(blogPostViewStats.postId, globalPostId));
      expect(stats.map((s) => s.sessionId)).toContain('sess-real');
    });
  });
});
