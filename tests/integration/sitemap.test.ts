import { describe, it, expect } from 'vitest';
import { GET } from '@/pages/sitemap-cms.xml';

// Sitemap : URLs voyage publiées × locales visibles (TODO §7.8, Annexe A).
describe('Sitemap CMS — voyages', () => {
  it('lists published trips with localized detail URLs', async () => {
    const response = await GET({ site: new URL('https://atlaselle.test') } as any);
    expect(response.status).toBe(200);
    const xml = await response.text();
    expect(xml).toContain('/fr/voyages/afrique-du-sud');
    expect(xml).toContain('/en/trips/south-africa');
    expect(xml).toContain('/ar/trips/south-africa');
    expect(xml).toContain('/es/viajes/sudafrica');
    expect(xml).toContain('/fr/voyages');
    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
  });
});
