import { describe, it, expect } from 'vitest';
import type { APIContext } from 'astro';
import { GET } from '@/pages/sitemap-cms.xml';

/**
 * `site` fait partie du contexte Astro, mais l'endpoint ne le publie plus :
 * l'origine est la constante de build import.meta.env.SITE. On lui fournit un
 * `site` volontairement différent de l'origine attendue pour que le test échoue
 * si l'endpoint se met à lire le contexte au lieu de la constante figée.
 */
const CONTEXT_SITE = new URL('https://runtime-context.invalid');

/** Surface de contexte réellement consommée par GET : aucune, son paramètre est ignoré. */
type SitemapContext = Pick<APIContext, 'site'>;
type SitemapGet = (context: SitemapContext) => Promise<Response>;
const getSitemap = GET as unknown as SitemapGet;

/** Locales visibles, cf. `i18n.locales` de astro.config.mjs. Liste figée, pas l'import. */
const VISIBLE_LOCALES = ['fr', 'en', 'es', 'ar'] as const;

/**
 * Origine attendue, dérivée de la source unique du build (SITE_URL -> siteUrl.origin,
 * astro.config.mjs) et non de import.meta.env.SITE que l'endpoint lit également :
 * relire la même constante des deux côtés ne prouverait rien.
 */
function buildSiteOrigin(): string {
  const raw = process.env.SITE_URL;
  if (typeof raw !== 'string' || raw.trim() === '') {
    throw new Error(
      'SITE_URL is absent from the test environment while vitest.config.ts injects import.meta.env.SITE from it: this cross-check cannot be honest.'
    );
  }
  return new URL(raw.trim()).origin;
}

function extractLocs(xml: string): string[] {
  return [...xml.matchAll(/<loc>([^<]*)<\/loc>/g)].map((match) => match[1] ?? '');
}

// Sitemap : URLs voyage publiées × locales visibles (TODO §7.8, Annexe A).
describe('Sitemap CMS — voyages', () => {
  it('lists published trips with localized detail URLs', async () => {
    const response = await getSitemap({ site: CONTEXT_SITE });
    expect(response.status).toBe(200);
    const xml = await response.text();
    expect(xml).toContain('/fr/voyages/algerie');
    expect(xml).toContain('/en/trips/algeria');
    expect(xml).toContain('/ar/trips/algeria');
    expect(xml).toContain('/es/viajes/argelia');
    expect(xml).toContain('/fr/voyages');
    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
  });

  it('lists CMS legal pages with ASCII slugs in all locales', async () => {
    const response = await getSitemap({ site: CONTEXT_SITE });
    const xml = await response.text();
    expect(xml).toContain('/fr/mentions-legales');
    expect(xml).toContain('/en/legal-notice');
    expect(xml).toContain('/ar/legal-notice');
    expect(xml).toContain('/es/aviso-legal');
  });

  it('roots every URL at the build-time SITE origin, for the four visible locales', async () => {
    const origin = buildSiteOrigin();
    const response = await getSitemap({ site: CONTEXT_SITE });
    const xml = await response.text();

    const locs = extractLocs(xml);
    expect(locs.length).toBeGreaterThan(0);
    // Une seule origine dans tout le document : aucune URL ne doit être publiée
    // ailleurs que sur l'origine que le build a figée.
    expect(locs.filter((loc) => !loc.startsWith(`${origin}/`))).toEqual([]);
    for (const locale of VISIBLE_LOCALES) {
      expect(xml).toContain(`<loc>${origin}/${locale}/</loc>`);
    }
    expect(xml).not.toContain(CONTEXT_SITE.origin);
  });
});
