/**
 * PROBE TEMPORAIRE — non-vacuité des tests réécrits. Supprimé après exécution.
 *
 * Chaque test conduit le PRODUIT RÉEL dans l'état observable qu'il produirait si
 * il revenait à son état précédent, puis exige que l'assertion NEUVE refuse cet
 * état. Si une assertion devenait vacuous, ce probe échoue.
 */
import { randomUUID } from 'node:crypto';
import { test, expect } from '@playwright/test';
import { adminRequest, callAction } from '../helpers/actions';

/**
 * Exige qu'une assertion (poll + matcher terminal) ÉCHOUE, et renvoie son
 * message. Les timeouts courts sont portés par les assertions elles-mêmes : le
 * locator visé est déjà résolu, attendre 5 s un échec ATTENDU n'ajouterait rien.
 */
async function mustReject(label: string, assertion: () => Promise<unknown>): Promise<string> {
  try {
    await assertion();
  } catch (err) {
    return err instanceof Error ? err.message : String(err);
  }
  throw new Error(`PROBE VACUOUS: « ${label} » a accepte l'etat precedent du produit.`);
}

test.describe('PROBE — actions-admin : bascule de publication', () => {
  test('les assertions neuves refusent la page non publiee', async ({ browser }) => {
    const { getDrizzle } = await import('../../src/database/drizzle');
    const { pages } = await import('../../src/database/schemas/page.schema');
    const { eq } = await import('drizzle-orm');
    const db = getDrizzle();
    const req = await adminRequest(browser);
    const slug = `e2e-probe-${randomUUID().slice(0, 8)}`;

    const created = await callAction(req, 'createPage', { locale: 'fr', slug, title: 'Probe' });
    expect(created.ok).toBe(true);
    const [row] = await db.select({ id: pages.id }).from(pages).where(eq(pages.slug, slug)).limit(1);
    const pageId = row!.id;

    const readPublication = async () => {
      const [r] = await db
        .select({ isPublished: pages.isPublished, publishedAt: pages.publishedAt })
        .from(pages)
        .where(eq(pages.id, pageId))
        .limit(1);
      return {
        isPublished: r?.isPublished ?? null,
        publishedAt: r?.publishedAt ? r.publishedAt.toISOString() : null,
      };
    };
    const PUBLISHED = { isPublished: true, publishedAt: expect.any(String) };
    const UNPUBLISHED = { isPublished: false, publishedAt: null };

    try {
      // Observable « produit précédent » : un publishPage qui n'applique pas la
      // bascule laisse la page non publiée. Reproduit ici a l'identique.
      const ignored = await callAction(req, 'publishPage', { id: pageId });
      expect(ignored.status).toBe(400);
      expect(await readPublication()).toEqual(UNPUBLISHED);

      // 1. L'assertion « la page EST publiée » doit REFUSER cet état.
      const publishedMsg = await mustReject('page publiee', () =>
        expect.poll(readPublication, { message: 'probe', timeout: 1_500 }).toEqual(PUBLISHED),
      );
      expect(publishedMsg).toContain('isPublished');

      // 2. L'assertion « la page est dépubliée » ACCEPTE cet état : la paire
      //    n'est pas degeneree, elle discrimine reellement les deux etats.
      await expect
        .poll(readPublication, { message: 'probe', timeout: 1_500 })
        .toEqual(UNPUBLISHED);

      // 3. Une fois la bascule reellement appliquee, l'assertion « publiee » passe.
      const applied = await callAction(req, 'publishPage', { id: pageId, isPublished: true });
      expect(applied.ok).toBe(true);
      await expect
        .poll(readPublication, { message: 'probe', timeout: 5_000 })
        .toEqual(PUBLISHED);

      // 4. Et elle refuse l'etat inverse : la discrimination est dans les deux sens.
      const reverted = await callAction(req, 'publishPage', { id: pageId, isPublished: false });
      expect(reverted.ok).toBe(true);
      const revertedMsg = await mustReject('page publiee apres depublication', () =>
        expect.poll(readPublication, { message: 'probe', timeout: 1_500 }).toEqual(PUBLISHED),
      );
      expect(revertedMsg).toContain('isPublished');
    } finally {
      await callAction(req, 'deletePage', { id: pageId }).catch(() => {});
      await callAction(req, 'permanentlyDeletePage', { id: pageId }).catch(() => {});
      await db.delete(pages).where(eq(pages.id, pageId)).catch(() => {});
    }
  });
});

test.describe('PROBE — actions-voyage : sequence d etats', () => {
  test('la sequence reelle est distincte du vocabulaire perime, etape par etape', async ({ browser }) => {
    const { getDrizzle } = await import('../../src/database/drizzle');
    const { trips, TRIP_STATUSES } = await import('../../src/database/schemas/trips.schema');
    const { insertTestTrip } = await import('../helpers/trip-factory');
    const { eq } = await import('drizzle-orm');
    const db = getDrizzle();
    const tripId = `e2e-probe-seq-${randomUUID().slice(0, 8)}`;
    await insertTestTrip(db, {
      id: tripId, status: 'draft', countryCode: 'FR', defaultCurrency: 'EUR',
      durationDays: 3, durationNights: 2, groupMin: 2, groupMax: 8,
      difficulty: 'easy', difficultyLevel: 1,
    });

    const readStatus = async () => {
      const [r] = await db.select({ status: trips.status }).from(trips).where(eq(trips.id, tripId)).limit(1);
      return r?.status;
    };

    // Sequence attendue par le test PERIME (3 valeurs du mauvais vocabulaire).
    const STALE_CHAIN = ['draft', 'under_review', 'approved', 'published', 'draft', 'archived', 'draft'];
    const REAL_TARGETS = ['review', 'approved', 'published', 'unpublished', 'archived', 'unpublished'];
    const ACTIONS = ['submitTripForReview', 'approveTrip', 'publishTrip', 'unpublishTrip', 'archiveTrip', 'restoreTrip'];

    try {
      const req = await adminRequest(browser);
      const observed: string[] = [(await readStatus()) as string];

      for (const [i, action] of ACTIONS.entries()) {
        const result = await callAction(req, action, { id: tripId });
        expect(result.ok, `${action} failed: ${result.status} ${result.errorMessage ?? ''}`).toBe(true);
        await expect.poll(readStatus, { message: `status after ${action}` }).toBe(REAL_TARGETS[i]);
        observed.push((await readStatus()) as string);
      }

      // 1. L'assertion de bout en bout distingue la sequence reelle de la perimee.
      expect(observed).not.toEqual(STALE_CHAIN);
      // 2. Elle accepte la sequence reelle.
      expect(observed).toEqual(['draft', ...REAL_TARGETS]);
      // 3. Chaque valeur perimee est refusee par l'assertion d'etape, une par une.
      for (const foreign of ['under_review', 'draft']) {
        const msg = await mustReject(`etape attendue ${foreign}`, () =>
          expect.poll(readStatus, { message: 'probe', timeout: 1_500 }).toBe(foreign),
        );
        expect(msg).toContain(foreign);
      }
      // 4. Aucune valeur observee n'appartient au vocabulaire etranger.
      for (const status of observed) {
        expect(TRIP_STATUSES).toContain(status);
        expect(status).not.toBe('under_review');
      }
    } finally {
      await db.delete(trips).where(eq(trips.id, tripId)).catch(() => {});
    }
  });
});

test.describe('PROBE — services : etat reel de l espace de travail', () => {
  test('les trois assertions neuves sont falsifiables sur le balisage rendu', async ({ browser }) => {
    const api = await adminRequest(browser);
    const state = await api.storageState();
    const context = await browser.newContext({ storageState: state });
    const page = await context.newPage();

    try {
      const response = await page.goto('/fr/admin/services', { waitUntil: 'networkidle' });
      expect(response?.status()).toBe(200);
      const workspace = page.locator('[data-services-admin-workspace]');
      await expect(workspace).toBeVisible();

      // 1. La valeur de locale est reellement lue et comparee.
      await expect(workspace).toHaveAttribute('data-locale', 'fr');
      await mustReject('data-locale vaut en', () =>
        expect(workspace).toHaveAttribute('data-locale', 'en', { timeout: 1_500 }),
      );
      await mustReject('data-locale absente', () =>
        expect(workspace).toHaveAttribute('data-locale', 'xx', { timeout: 1_500 }),
      );

      // 2. La grammaire localisee est reellement lue et comparee.
      await expect(workspace).toHaveAttribute('data-confirm-taxonomy-delete', 'Supprimer ce service ?');
      await mustReject('data-confirm-taxonomy-delete vide', () =>
        expect(workspace).toHaveAttribute('data-confirm-taxonomy-delete', '', { timeout: 1_500 }),
      );
      await mustReject('data-confirm-taxonomy-delete en anglais', () =>
        expect(workspace).toHaveAttribute('data-confirm-taxonomy-delete', 'Delete this service?', { timeout: 1_500 }),
      );

      // 3. Le garde de l'organisation unique est vivant : reinjecter l'attribut
      //    supprimee par la migration doit faire echouer l'assertion.
      await expect(workspace).not.toHaveAttribute('data-organization-id');
      await workspace.evaluate((el) => el.setAttribute('data-organization-id', ''));
      const guard = await mustReject('data-organization-id reinjectee', () =>
        expect(workspace).not.toHaveAttribute('data-organization-id', { timeout: 1_500 }),
      );
      expect(guard).toContain('data-organization-id');
      await workspace.evaluate((el) => el.removeAttribute('data-organization-id'));
      await expect(workspace).not.toHaveAttribute('data-organization-id');
    } finally {
      await context.close();
    }
  });
});
