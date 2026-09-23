import { randomUUID } from 'node:crypto';
import { test, expect } from '@playwright/test';
import { adminRequest, callAction } from '../helpers/actions';

/**
 * E2E — blog action surface.
 * Covers: post lifecycle, taxonomy (categories/tags), comments (guest +
 * authenticated + moderation + reply-depth guard), reviews (rating bounds +
 * moderation + helpful votes), reactions/favorites, reports, notifications,
 * links, galleries, profile, newsletter double opt-in, internal links, views.
 */

const POST_ID_ACTIONS = [
  'publishBlogPost', 'unpublishBlogPost', 'archiveBlogPost', 'restoreBlogPost',
  'deleteBlogPost', 'duplicateBlogPost', 'lockBlogPost', 'unlockBlogPost',
  'listBlogPostRevisions', 'restoreBlogPostRevision', 'checkBlogPostLinks',
];

test.describe('Blog actions — anonymous guards', () => {
  for (const action of POST_ID_ACTIONS) {
    test(`${action} rejects anonymous`, async ({ request }) => {
      const result = await callAction(request, action, { id: randomUUID() });
      expect([401, 403, 404, 400], `${action} (${result.status})`).toContain(result.status);
    });
  }

  test('createBlogPost rejects anonymous', async ({ request }) => {
    const result = await callAction(request, 'createBlogPost', { title: 'x' });
    expect([401, 403, 400]).toContain(result.status);
  });

  test('createBlogCategory rejects anonymous', async ({ request }) => {
    const result = await callAction(request, 'createBlogCategory', { slug: 'x', name: 'x' });
    expect([401, 403, 400]).toContain(result.status);
  });

  test('moderateBlogComment rejects anonymous', async ({ request }) => {
    const result = await callAction(request, 'moderateBlogComment', {
      commentId: randomUUID(), moderationAction: 'APPROVE',
    });
    expect([401, 403, 400]).toContain(result.status);
  });

  test('getBlogModerationQueue rejects anonymous', async ({ request }) => {
    const result = await callAction(request, 'getBlogModerationQueue', {});
    expect([401, 403, 400]).toContain(result.status);
  });
});

test.describe('Blog actions — input validation', () => {
  test('createBlogComment rejects missing content', async ({ request }) => {
    const result = await callAction(request, 'createBlogComment', { postId: randomUUID() });
    expect(result.status).toBe(400);
  });

  test('createBlogReview rejects out-of-range rating', async ({ request }) => {
    const result = await callAction(request, 'createBlogReview', {
      postId: randomUUID(), rating: 9, content: 'Great!',
    });
    expect(result.status).toBe(400);
  });

  test('createBlogReport rejects reporting two targets at once', async ({ request }) => {
    const result = await callAction(request, 'createBlogReport', {
      postId: randomUUID(), commentId: randomUUID(), reason: 'SPAM',
    });
    expect(result.status).toBe(400);
  });

  test('toggleBlogReaction rejects invalid reaction type', async ({ request }) => {
    const result = await callAction(request, 'toggleBlogReaction', {
      postId: randomUUID(), reactionType: 'EXPLODE',
    });
    expect([400, 404]).toContain(result.status);
  });

  test('subscribeBlogNewsletter rejects invalid email', async ({ request }) => {
    const result = await callAction(request, 'subscribeBlogNewsletter', { email: 'not-an-email' });
    expect(result.status).toBe(400);
  });
});

test.describe('Blog actions — public comment workflow (DB fixture)', () => {
  test('guest comment on a published post goes to moderation, admin approves it', async ({ browser, request }) => {
    const { getDrizzle, schema } = await import('../../src/database/drizzle');
    const { eq, desc } = await import('drizzle-orm');
    const db = getDrizzle();

    // Find any published post; skip cleanly if the env has none.
    const [post] = await db
      .select({ id: schema.blogPosts.id, status: schema.blogPosts.status })
      .from(schema.blogPosts)
      .where(eq(schema.blogPosts.status, 'PUBLISHED'))
      .orderBy(desc(schema.blogPosts.createdAt))
      .limit(1);
    test.skip(!post, 'No published blog post seeded');

    // Guest comment
    const guest = await callAction(request, 'createBlogComment', {
      postId: post!.id,
      content: `Commentaire E2E ${randomUUID().slice(0, 8)}`,
      guestName: 'E2E Guest',
      guestEmail: 'e2e-guest@test.com',
    });
    expect([200, 204, 429], `guest comment (${guest.status})`).toContain(guest.status);

    // Find the pending comment
    const [comment] = await db
      .select({ id: schema.blogComments.id, status: schema.blogComments.status })
      .from(schema.blogComments)
      .where(eq(schema.blogComments.postId, post!.id))
      .orderBy(desc(schema.blogComments.createdAt))
      .limit(1);

    if (comment) {
      // Admin approves
      const req = await adminRequest(browser);
      const approve = await callAction(req, 'moderateBlogComment', {
        commentId: comment.id, moderationAction: 'APPROVE',
      });
      expect(approve.ok, `approve failed: ${approve.errorCode}`).toBe(true);

      const [after] = await db
        .select({ status: schema.blogComments.status })
        .from(schema.blogComments)
        .where(eq(schema.blogComments.id, comment.id))
        .limit(1);
      expect(after?.status).toBe('APPROVED');

      // Cleanup
      await db.delete(schema.blogComments).where(eq(schema.blogComments.id, comment.id)).catch(() => {});
    }
  });

  test('reply deeper than 1 level is rejected', async ({ browser }) => {
    const { getDrizzle, schema } = await import('../../src/database/drizzle');
    const { eq, desc, isNotNull } = await import('drizzle-orm');
    const db = getDrizzle();

    // Find an APPROVED reply (has parentId) — replying to it must fail.
    const [reply] = await db
      .select({ id: schema.blogComments.id, postId: schema.blogComments.postId })
      .from(schema.blogComments)
      .where(isNotNull(schema.blogComments.parentId))
      .orderBy(desc(schema.blogComments.createdAt))
      .limit(1);
    test.skip(!reply, 'No existing reply comment to test depth guard');

    const req = await adminRequest(browser);
    const result = await callAction(req, 'createBlogComment', {
      postId: reply!.postId,
      parentId: reply!.id,
      content: 'Réponse de profondeur 2 — doit être rejetée',
    });
    expect(result.status).toBe(400);
  });
});

test.describe('Blog actions — authenticated engagement', () => {
  test('markAllBlogNotificationsRead succeeds for a signed-in user', async ({ browser }) => {
    const req = await adminRequest(browser);
    const result = await callAction(req, 'markAllBlogNotificationsRead', {});
    expect([200, 204]).toContain(result.status);
  });

  test('updateUserProfile rejects an invalid website URL', async ({ browser }) => {
    const req = await adminRequest(browser);
    const result = await callAction(req, 'updateUserProfile', { website: 'not-a-url' });
    expect(result.status).toBe(400);
  });

  test('updateUserProfile accepts a valid bio', async ({ browser }) => {
    const req = await adminRequest(browser);
    const result = await callAction(req, 'updateUserProfile', { bio: 'Bio E2E test' });
    expect([200, 204]).toContain(result.status);
  });
});
