import { describe, it, expect } from 'vitest';
import { searchContent } from '@database/loaders/search.loader';
import { exportCmsContent } from '@database/loaders/page.loader';

describe('CMS content loaders (real DB)', () => {
  it('searchContent retourne [] sur requête vide', async () => {
    await expect(searchContent('', 'fr', 10)).resolves.toEqual([]);
    await expect(searchContent('   ', 'en', 10)).resolves.toEqual([]);
  });

  it('searchContent répond sur un terme générique sans jeter (infra FTS requise)', async () => {
    try {
      const rows = await searchContent('voyage', 'fr', 5);
      expect(Array.isArray(rows)).toBe(true);
    } catch (err) {
      // Infra FTS (search_vector) appliquée par `pnpm db:infra` en CI.
      // En local sans infra, PostgreSQL renvoie 42703 — on documente au lieu de casser.
      const code = (err as { cause?: { code?: string } })?.cause?.code;
      if (code === '42703') {
        console.warn('[cms-content] FTS infra manquante localement (search_vector) — skip, CI avec db:infra fait foi.');
        return;
      }
      throw err;
    }
  });

  it('exportCmsContent exporte version 1', async () => {
    const data = await exportCmsContent();
    expect(data.version).toBe(1);
    expect(Array.isArray(data.pages)).toBe(true);
    expect(typeof data.exportedAt).toBe('string');
  });
});
