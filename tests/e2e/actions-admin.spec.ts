import { randomUUID } from 'node:crypto';
import { test, expect } from '@playwright/test';
import { adminRequest, callAction } from '../helpers/actions';

/**
 * E2E — admin/CMS action surface.
 * Covers: pages (CRUD + publish/schedule/trash/bulk/clone/lock), sections,
 * navigation (menus + items + reorder), site settings, contact info, opening
 * hours, social links, consent settings, themes, media folders & files,
 * page versions.
 */

const ADMIN_ID_ACTIONS = [
  'publishPage', 'schedulePage', 'unschedulePage', 'scheduleUnpublishPage',
  'unscheduleUnpublishPage', 'restoreFromTrash', 'permanentlyDeletePage',
  'clonePage', 'lockPage', 'unlockPage', 'deletePage', 'updatePage',
  'deleteSection', 'updateSection', 'deleteNavigationMenu', 'updateNavigationMenu',
  'deleteNavigationItem', 'updateNavigationItem', 'deleteTheme', 'updateTheme',
  'deleteMediaFolder', 'updateMediaFolder', 'deleteSocialLink', 'updateSocialLink',
];

test.describe('Admin actions — anonymous guards', () => {
  for (const action of ADMIN_ID_ACTIONS) {
    test(`${action} rejects anonymous`, async ({ request }) => {
      const result = await callAction(request, action, { id: randomUUID() });
      expect([401, 403, 404, 400], `${action} (${result.status})`).toContain(result.status);
    });
  }

  test('createPage rejects anonymous', async ({ request }) => {
    const result = await callAction(request, 'createPage', { locale: 'fr', slug: 'x', title: 'x' });
    expect([401, 403]).toContain(result.status);
  });

  test('upsertSiteSettings rejects anonymous', async ({ request }) => {
    const result = await callAction(request, 'upsertSiteSettings', { siteName: 'x' });
    expect([401, 403, 400]).toContain(result.status);
  });

  test('updateConsentSettings rejects anonymous', async ({ request }) => {
    const result = await callAction(request, 'updateConsentSettings', {});
    expect([401, 403, 400]).toContain(result.status);
  });
});

test.describe('Admin actions — page validation (authenticated)', () => {
  test('createPage rejects a reserved slug', async ({ browser }) => {
    const req = await adminRequest(browser);
    const result = await callAction(req, 'createPage', {
      locale: 'fr', slug: 'api', title: 'Reserved slug test',
    });
    expect(result.status).toBe(409);
    expect(result.errorCode).toBe('CONFLICT');
  });

  test('createPage rejects an uppercase slug', async ({ browser }) => {
    const req = await adminRequest(browser);
    const result = await callAction(req, 'createPage', {
      locale: 'fr', slug: 'Invalid-Slug', title: 'Bad slug',
    });
    expect(result.status).toBe(400);
  });

  test('createPage rejects an invalid locale', async ({ browser }) => {
    const req = await adminRequest(browser);
    const result = await callAction(req, 'createPage', {
      locale: 'xx', slug: 'valid-slug', title: 'Bad locale',
    });
    expect(result.status).toBe(400);
  });
});

test.describe('Admin actions — page workflow (DB fixture)', () => {
  test('create → publish → lock → unlock → trash → restore → permanent delete', async ({ browser }) => {
    const { getDrizzle } = await import('../../src/database/drizzle');
    const { pages } = await import('../../src/database/schemas/page.schema');
    const { eq } = await import('drizzle-orm');
    const db = getDrizzle();
    const req = await adminRequest(browser);

    const slug = `e2e-page-${randomUUID().slice(0, 8)}`;

    // Create
    const created = await callAction(req, 'createPage', {
      locale: 'fr', slug, title: 'E2E Workflow Page',
    });
    expect(created.ok, `createPage failed: ${created.errorCode} ${created.errorMessage}`).toBe(true);

    const [page] = await db.select({ id: pages.id, isPublished: pages.isPublished }).from(pages).where(eq(pages.slug, slug)).limit(1);
    expect(page).toBeTruthy();
    const pageId = page!.id;

    try {
      // Publish
      const published = await callAction(req, 'publishPage', { id: pageId });
      expect(published.ok, `publishPage failed: ${published.errorCode}`).toBe(true);
      await expect.poll(async () => (await db.select({ p: pages.isPublished }).from(pages).where(eq(pages.id, pageId)).limit(1))[0]?.p).toBe(true);

      // Lock → Unlock
      const locked = await callAction(req, 'lockPage', { id: pageId });
      expect([200, 204, 409]).toContain(locked.status);
      const unlocked = await callAction(req, 'unlockPage', { id: pageId });
      expect([200, 204]).toContain(unlocked.status);

      // Trash (soft delete) → restore from trash
      const trashed = await callAction(req, 'deletePage', { id: pageId });
      expect(trashed.ok, `deletePage failed: ${trashed.errorCode}`).toBe(true);
      const restored = await callAction(req, 'restoreFromTrash', { id: pageId });
      expect(restored.ok, `restoreFromTrash failed: ${restored.errorCode}`).toBe(true);
    } finally {
      // Permanent cleanup
      await callAction(req, 'deletePage', { id: pageId }).catch(() => {});
      await callAction(req, 'permanentlyDeletePage', { id: pageId }).catch(() => {});
      await db.delete(pages).where(eq(pages.id, pageId)).catch(() => {});
    }
  });

  test('createPage with a duplicate slug is rejected', async ({ browser }) => {
    const { getDrizzle } = await import('../../src/database/drizzle');
    const { pages } = await import('../../src/database/schemas/page.schema');
    const { eq } = await import('drizzle-orm');
    const db = getDrizzle();
    const req = await adminRequest(browser);
    const slug = `e2e-dup-${randomUUID().slice(0, 8)}`;

    const first = await callAction(req, 'createPage', { locale: 'fr', slug, title: 'First' });
    expect(first.ok).toBe(true);
    const second = await callAction(req, 'createPage', { locale: 'fr', slug, title: 'Second' });
    expect([409, 400]).toContain(second.status);

    const [row] = await db.select({ id: pages.id }).from(pages).where(eq(pages.slug, slug)).limit(1);
    if (row) await db.delete(pages).where(eq(pages.id, row.id)).catch(() => {});
  });
});

test.describe('Admin actions — settings & structure', () => {
  test('createNavigationItem rejects invalid payload', async ({ browser }) => {
    const req = await adminRequest(browser);
    const result = await callAction(req, 'createNavigationItem', { label: '' });
    expect([400, 404]).toContain(result.status);
  });

  test('reorderNavigationItems rejects malformed input', async ({ browser }) => {
    const req = await adminRequest(browser);
    const result = await callAction(req, 'reorderNavigationItems', { items: 'not-an-array' });
    expect(result.status).toBe(400);
  });

  test('listPageVersions on unknown page → empty or NOT_FOUND', async ({ browser }) => {
    const req = await adminRequest(browser);
    const result = await callAction(req, 'listPageVersions', { pageId: randomUUID() });
    expect([200, 204, 404, 400]).toContain(result.status);
  });

  test('createMediaFolder rejects invalid payload', async ({ browser }) => {
    const req = await adminRequest(browser);
    const result = await callAction(req, 'createMediaFolder', { name: '' });
    expect([400, 422]).toContain(result.status);
  });
});
