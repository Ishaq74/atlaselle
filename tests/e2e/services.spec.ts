import { randomUUID } from 'node:crypto';
import { test, expect } from '@playwright/test';
import { SEED_EMAIL, SEED_PASSWORD } from './global-setup';

// Single-tenant (TODO §30.3 hors périmètre) : surfaces globales uniquement.

type StorageState = Awaited<ReturnType<import('@playwright/test').BrowserContext['storageState']>>;
const BASE_URL = 'http://localhost:4322';
const LOCALES = ['fr', 'en', 'es', 'ar'] as const;

type ServiceStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED' | 'DELETED';
interface SeedState {
  globalServiceId: string; draftServiceId: string; globalServiceSlug: string; draftServiceSlug: string; globalServiceTitle: string; draftServiceTitle: string; globalCategoryId: string; globalCategorySlug: string;
}

let db: Awaited<ReturnType<typeof import('../../src/database/drizzle').getDrizzle>> | null = null;
let schema: typeof import('../../src/database/drizzle').schema | null = null;
let eqOp: typeof import('drizzle-orm').eq;
let adminStorageState: StorageState | null = null;
let seeded: SeedState;

function parseSetCookie(header: string) { const [pair] = header.split(';'); const separator = pair.indexOf('='); return { name: pair.slice(0, separator), value: pair.slice(separator + 1), url: BASE_URL }; }
async function createAdminStorageState(browser: import('@playwright/test').Browser) {
  const context = await browser.newContext();
  const response = await fetch(`${BASE_URL}/api/auth/sign-in/email`, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: BASE_URL }, body: JSON.stringify({ email: SEED_EMAIL, password: SEED_PASSWORD }), redirect: 'manual' });
  const setCookie = response.headers.getSetCookie(); if (!setCookie.length) throw new Error('No session cookie returned for seeded admin user');
  await context.addCookies(setCookie.map(parseSetCookie)); const state = await context.storageState(); await context.close(); return state;
}
async function serviceStatus(serviceId: string): Promise<ServiceStatus> { const [row] = await db!.select({ status: schema!.services.status }).from(schema!.services).where(eqOp(schema!.services.id, serviceId)).limit(1); if (!row) throw new Error(`Service ${serviceId} not found`); return row.status as ServiceStatus; }

test.describe.serial('Services surfaces', () => {
  test.beforeAll(async () => {
    const unique = randomUUID().slice(0, 8);
    const globalServiceId = randomUUID(); const draftServiceId = randomUUID(); const globalCategoryId = randomUUID();
    const globalServiceSlug = `e2e-global-service-${unique}`; const draftServiceSlug = `e2e-draft-service-${unique}`; const globalCategorySlug = `e2e-global-service-category-${unique}`;
    const globalServiceTitle = `E2E Global Service ${unique}`; const draftServiceTitle = `E2E Draft Service ${unique}`;
    const drizzleMod = await import('../../src/database/drizzle'); const orm = await import('drizzle-orm'); db = drizzleMod.getDrizzle(); schema = drizzleMod.schema; eqOp = orm.eq;
    const { getTestHelpers } = await import('../helpers/auth');
    const helpers = await getTestHelpers(); const [seedUser] = await db.select({ id: schema.user.id }).from(schema.user).where(eqOp(schema.user.email, SEED_EMAIL)).limit(1); if (!seedUser) throw new Error(`Seed user not found for ${SEED_EMAIL}`);
    void helpers;
    const publishedAt = new Date();
    await db.insert(schema.services).values([
      { id: globalServiceId, organizationId: null, providerId: seedUser.id, slug: globalServiceSlug, status: 'PUBLISHED', publishedAt, updatedBy: seedUser.id, priceMinor: 2500, currency: 'EUR', durationMinutes: 60, maxParticipants: 4 },
      { id: draftServiceId, organizationId: null, providerId: seedUser.id, slug: draftServiceSlug, status: 'DRAFT', publishedAt: null, updatedBy: seedUser.id, priceMinor: 3500, currency: 'EUR', durationMinutes: 75, maxParticipants: 3 },
    ]);
    const translationRows: Array<typeof import("../../src/database/schemas").serviceTranslations.$inferInsert> = [];
    for (const locale of LOCALES) {
      translationRows.push({ serviceId: globalServiceId, locale, title: `${globalServiceTitle} ${locale}`, slug: `${globalServiceSlug}-${locale}`, content: `<p>${globalServiceTitle} ${locale} content.</p>`, excerpt: `${globalServiceTitle} excerpt.`, metaTitle: globalServiceTitle, metaDescription: `${globalServiceTitle} description.` });
      translationRows.push({ serviceId: draftServiceId, locale, title: `${draftServiceTitle} ${locale}`, slug: `${draftServiceSlug}-${locale}`, content: `<p>${draftServiceTitle} ${locale} content.</p>`, excerpt: `${draftServiceTitle} excerpt.`, metaTitle: draftServiceTitle, metaDescription: `${draftServiceTitle} description.` });
    }
    await db.insert(schema.serviceTranslations).values(translationRows);
    await db.insert(schema.serviceCategories).values([{ id: globalCategoryId, organizationId: null, slug: globalCategorySlug }]);
    const categoryTranslations: Array<typeof import("../../src/database/schemas").serviceCategoryTranslations.$inferInsert> = [];
    for (const locale of LOCALES) { categoryTranslations.push({ categoryId: globalCategoryId, locale, name: `Global Services ${locale}`, slug: `${globalCategorySlug}-${locale}` }); }
    await db.insert(schema.serviceCategoryTranslations).values(categoryTranslations);
    await db.insert(schema.serviceCategoryLinks).values([{ serviceId: globalServiceId, categoryId: globalCategoryId }, { serviceId: draftServiceId, categoryId: globalCategoryId }]);
    seeded = { globalServiceId, draftServiceId, globalServiceSlug, draftServiceSlug, globalServiceTitle, draftServiceTitle, globalCategoryId, globalCategorySlug };
  });

  test.beforeAll(async ({ browser }) => { adminStorageState = await createAdminStorageState(browser); });
  test.afterAll(async () => {
    if (!seeded || !db || !schema) return;
    for (const id of [seeded.globalServiceId, seeded.draftServiceId]) await db.delete(schema.services).where(eqOp(schema.services.id, id)).catch(() => {});
    await db.delete(schema.serviceCategories).where(eqOp(schema.serviceCategories.id, seeded.globalCategoryId)).catch(() => {});
  });

  test('global public list, category and detail stay canonical', async ({ page }) => {
    const listResponse = await page.goto(`/fr/services?search=${encodeURIComponent(seeded.globalServiceTitle + ' fr')}`, { waitUntil: 'networkidle' }); expect(listResponse?.status()).toBe(200); await expect(page.getByRole('link', { name: `${seeded.globalServiceTitle} fr` }).first()).toBeVisible();
    const categoryResponse = await page.goto(`/fr/services/${seeded.globalCategorySlug}-fr`, { waitUntil: 'networkidle' }); expect(categoryResponse?.status()).toBe(200); await expect(page.getByRole('heading', { name: 'Global Services fr' })).toBeVisible();
    const detail = await page.goto(`/fr/services/${seeded.globalServiceSlug}-fr`, { waitUntil: 'networkidle' }); expect(detail?.status()).toBe(200); await expect(page.getByRole('heading', { name: `${seeded.globalServiceTitle} fr` })).toBeVisible();
    const canonical = await page.goto(`/fr/services/${seeded.globalCategorySlug}-fr/${seeded.globalServiceSlug}-fr`, { waitUntil: 'networkidle' }); expect(canonical?.status()).toBe(200); await expect(page).toHaveURL(new RegExp(`/fr/services/${seeded.globalCategorySlug}-fr/${seeded.globalServiceSlug}-fr$`));
    const wrongCategory = await page.goto(`/fr/services/not-the-category/${seeded.globalServiceSlug}-fr`, { waitUntil: 'networkidle' }); expect(wrongCategory?.status()).toBeGreaterThanOrEqual(300); await expect(page).toHaveURL(new RegExp(`/fr/services/${seeded.globalCategorySlug}-fr/${seeded.globalServiceSlug}-fr$`));
  });

  for (const locale of LOCALES) test(`renders localized public service in ${locale}`, async ({ page }) => { const response = await page.goto(`/${locale}/services/${seeded.globalServiceSlug}-${locale}`, { waitUntil: 'networkidle' }); expect(response?.status()).toBe(200); await expect(page.getByRole('heading', { name: `${seeded.globalServiceTitle} ${locale}` })).toBeVisible(); if (locale === 'ar') await expect(page.locator('html')).toHaveAttribute('dir', 'rtl'); });

  test('global admin exposes the resource grammar', async ({ browser }) => {
    const context = await browser.newContext({ storageState: adminStorageState ?? undefined }); const page = await context.newPage();
    const globalResponse = await page.goto('/fr/admin/services', { waitUntil: 'networkidle' }); expect(globalResponse?.status()).toBe(200); await expect(page.getByRole('heading', { name: /Services/i }).first()).toBeVisible(); await expect(page.getByRole('link', { name: `${seeded.globalServiceTitle} fr` }).first()).toBeVisible();
    await expect(page.locator('[data-services-admin-workspace]')).toHaveAttribute('data-organization-id', ''); await context.close();
  });

  test('global admin create surface and localized editor are reachable', async ({ browser }) => {
    const context = await browser.newContext({ storageState: adminStorageState ?? undefined }); const page = await context.newPage();
    const response = await page.goto('/fr/admin/services/new', { waitUntil: 'networkidle' }); expect(response?.status()).toBe(200); await expect(page.getByRole('heading', { name: /service/i }).first()).toBeVisible(); await expect(page.locator('[data-service-form]')).toBeVisible();
    await page.goto(`/fr/admin/services/${seeded.draftServiceId}/edit`, { waitUntil: 'networkidle' }); expect(page.url()).toContain(`/fr/admin/services/${seeded.draftServiceId}/edit`); await expect(page.locator('[data-service-form]')).toBeVisible(); await expect(page.getByRole('link', { name: /EN|English/i }).first()).toBeVisible(); await context.close();
  });

  test('admin filters persist URL state', async ({ browser }) => {
    const context = await browser.newContext({ storageState: adminStorageState ?? undefined }); const page = await context.newPage();
    await page.goto(`/fr/admin/services?status=DRAFT&categoryId=${seeded.globalCategoryId}&featured=true&mobile=true&sortBy=priceMinor&sortOrder=asc&page=1`, { waitUntil: 'networkidle' });
    await expect(page.locator('select[name="status"]')).toHaveValue('DRAFT'); await expect(page.locator('select[name="categoryId"]')).toHaveValue(seeded.globalCategoryId); await expect(page.locator('input[name="featured"]')).toBeChecked(); await expect(page.locator('input[name="mobile"]')).toBeChecked(); await expect(page.locator('select[name="sortBy"]')).toHaveValue('priceMinor'); await expect(page.locator('select[name="sortOrder"]')).toHaveValue('asc'); await context.close();
  });

  test('admin taxonomy and moderation workspace are exposed', async ({ browser }) => {
    const context = await browser.newContext({ storageState: adminStorageState ?? undefined }); const page = await context.newPage(); await page.goto('/fr/admin/services', { waitUntil: 'networkidle' });
    await expect(page.getByRole('tab', { name: /catég|categor|categoría|الفئات/i }).first()).toBeVisible(); await expect(page.getByRole('tab', { name: /modér|moder|moderación|الإشراف/i }).first()).toBeVisible(); await expect(page.getByRole('tab', { name: /stat|stats|إحصاء/i }).first()).toBeVisible(); await context.close();
  });

  test('admin lifecycle preserves the explicit state machine', async ({ browser }) => {
    const context = await browser.newContext({ storageState: adminStorageState ?? undefined }); const page = await context.newPage(); await page.goto('/fr/admin/services', { waitUntil: 'networkidle' });
    const row = page.locator(`tr:has([data-id="${seeded.draftServiceId}"])`); await expect(row).toHaveCount(1);
    await row.locator(`[data-action="publish"][data-id="${seeded.draftServiceId}"]`).click(); await page.waitForLoadState('networkidle'); await expect.poll(() => serviceStatus(seeded.draftServiceId)).toBe('PUBLISHED');
    await page.locator(`tr:has([data-id="${seeded.draftServiceId}"]) [data-action="unpublish"][data-id="${seeded.draftServiceId}"]`).click(); await page.waitForLoadState('networkidle'); await expect.poll(() => serviceStatus(seeded.draftServiceId)).toBe('DRAFT');
    await page.locator(`tr:has([data-id="${seeded.draftServiceId}"]) [data-action="archive"][data-id="${seeded.draftServiceId}"]`).click(); await page.waitForLoadState('networkidle'); await expect.poll(() => serviceStatus(seeded.draftServiceId)).toBe('ARCHIVED');
    await page.locator(`tr:has([data-id="${seeded.draftServiceId}"]) [data-action="restore"][data-id="${seeded.draftServiceId}"]`).click(); await page.waitForLoadState('networkidle'); await expect.poll(() => serviceStatus(seeded.draftServiceId)).toBe('DRAFT'); await context.close();
  });
});
