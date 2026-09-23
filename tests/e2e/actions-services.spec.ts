import { randomUUID } from 'node:crypto';
import { test, expect } from '@playwright/test';
import { adminRequest, callAction } from '../helpers/actions';

/**
 * E2E — services action surface.
 * Covers: service CRUD, lifecycle state machine, taxonomy (categories/tags),
 * availability, engagement (reviews/comments/reports/reactions/favorites),
 * media gallery, moderation, notifications, attributes, views, internal links.
 */

const SERVICE_ID_ACTIONS = [
  'publishService', 'unpublishService', 'archiveService', 'restoreService',
  'deleteService', 'duplicateService', 'lockService', 'unlockService',
  'listServiceRevisions', 'restoreServiceRevision',
];

test.describe('Service actions — anonymous guards', () => {
  for (const action of SERVICE_ID_ACTIONS) {
    test(`${action} rejects anonymous`, async ({ request }) => {
      const result = await callAction(request, action, { id: randomUUID() });
      expect([401, 403, 404, 400], `${action} (${result.status})`).toContain(result.status);
    });
  }

  test('createService rejects anonymous', async ({ request }) => {
    const result = await callAction(request, 'createService', { slug: 'x' });
    expect([401, 403, 400]).toContain(result.status);
  });

  test('createServiceCategory rejects anonymous', async ({ request }) => {
    const result = await callAction(request, 'createServiceCategory', { slug: 'x' });
    expect([401, 403, 400]).toContain(result.status);
  });

  test('moderateServiceComment rejects anonymous', async ({ request }) => {
    const result = await callAction(request, 'moderateServiceComment', {
      commentId: randomUUID(), moderationAction: 'APPROVE',
    });
    expect([401, 403, 400]).toContain(result.status);
  });
});

test.describe('Service actions — input validation', () => {
  test('createServiceReview rejects out-of-range rating', async ({ request }) => {
    const result = await callAction(request, 'createServiceReview', {
      serviceId: randomUUID(), rating: 42, content: 'Top!',
    });
    expect([400, 401]).toContain(result.status);
  });

  test('createServiceComment rejects empty content', async ({ request }) => {
    const result = await callAction(request, 'createServiceComment', {
      serviceId: randomUUID(), content: '',
    });
    expect([400, 401]).toContain(result.status);
  });

  test('toggleServiceReaction rejects invalid reaction', async ({ request }) => {
    const result = await callAction(request, 'toggleServiceReaction', {
      serviceId: randomUUID(), reactionType: 'NOPE',
    });
    expect([400, 401, 404]).toContain(result.status);
  });

  test('createServiceReport rejects invalid reason', async ({ request }) => {
    const result = await callAction(request, 'createServiceReport', {
      serviceId: randomUUID(), reason: 'NOT_A_REASON',
    });
    expect([400, 401]).toContain(result.status);
  });
});

test.describe('Service actions — lifecycle state machine (DB fixture)', () => {
  test('DRAFT → PUBLISHED → DRAFT → ARCHIVED → DRAFT via actions', async ({ browser }) => {
    const { getDrizzle, schema } = await import('../../src/database/drizzle');
    const { eq } = await import('drizzle-orm');
    const db = getDrizzle();
    const [seedUser] = await db.select({ id: schema.user.id }).from(schema.user).where(eq(schema.user.email, 'e2e-seed@test.com')).limit(1);
    if (!seedUser) throw new Error('Seed user not found');

    const serviceId = randomUUID();
    const slug = `e2e-actions-${randomUUID().slice(0, 8)}`;
    await db.insert(schema.services).values({ id: serviceId, providerId: seedUser.id, slug, status: 'DRAFT', updatedBy: seedUser.id });
    await db.insert(schema.serviceTranslations).values({
      serviceId, locale: 'fr', title: 'E2E Actions Service', slug,
      content: '<p>x</p>', excerpt: 'x', metaTitle: 'x', metaDescription: 'x',
    });

    const readStatus = async () => {
      const [row] = await db.select({ status: schema.services.status }).from(schema.services).where(eq(schema.services.id, serviceId)).limit(1);
      return row?.status;
    };

    try {
      const req = await adminRequest(browser);
      const transitions: Array<[string, string]> = [
        ['publishService', 'PUBLISHED'],
        ['unpublishService', 'DRAFT'],
        ['archiveService', 'ARCHIVED'],
        ['restoreService', 'DRAFT'],
      ];
      for (const [action, expected] of transitions) {
        const result = await callAction(req, action, { id: serviceId });
        expect(result.ok, `${action} failed: ${result.errorCode} ${result.errorMessage}`).toBe(true);
        await expect.poll(readStatus, { message: `status after ${action}` }).toBe(expected);
      }
    } finally {
      await db.delete(schema.services).where(eq(schema.services.id, serviceId)).catch(() => {});
    }
  });

  test('publishService on unknown id → NOT_FOUND', async ({ browser }) => {
    const req = await adminRequest(browser);
    const result = await callAction(req, 'publishService', { id: randomUUID() });
    expect([404, 400]).toContain(result.status);
  });
});

test.describe('Service actions — notifications & views', () => {
  test('markAllServiceNotificationsRead succeeds for a signed-in user', async ({ browser }) => {
    const req = await adminRequest(browser);
    const result = await callAction(req, 'markAllServiceNotificationsRead', {});
    expect([200, 204]).toContain(result.status);
  });

  test('recordServiceView never 500s', async ({ request }) => {
    const result = await callAction(request, 'recordServiceView', { serviceId: randomUUID() });
    expect(result.status).toBeLessThan(500);
  });
});
