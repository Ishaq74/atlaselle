import { describe, it, expect, beforeAll } from 'vitest';
import { getBlogValidLinkTargets } from '@database/loaders/blog.loader';
import { blogInternalLinkResolver } from '@/lib/blog/blog-internal-link';
import { detectDeadInternalLinks, markDeadInternalLinks } from '@/lib/content/editor-helpers';
import type { Locale } from '@i18n/config';

/**
 * Integration test: validates the blog internal-link resolver + dead-link
 * detection against the real (seeded) test database.
 */
describe('blog internal link resolver (integration)', () => {
  let slugs: Set<string>;

  beforeAll(async () => {
    slugs = await getBlogValidLinkTargets('fr' as Locale);
  });

  it('lists published blog post slugs (single-tenant)', () => {
    expect(slugs.size).toBeGreaterThan(0);
    // The blog seed includes a French post "voyager-pendant-le-ramadan".
    expect(slugs.has('voyager-pendant-le-ramadan')).toBe(true);
  });

  it('resolver.listValidTargets matches getBlogValidLinkTargets', async () => {
    const targets = await blogInternalLinkResolver.listValidTargets({
      locale: 'fr' as Locale,
    });
    expect(targets instanceof Set).toBe(true);
    expect(targets.has('voyager-pendant-le-ramadan')).toBe(true);
  });

  it('resolver.resolve returns a published URL', async () => {
    const res = await blogInternalLinkResolver.resolve('voyager-pendant-le-ramadan', {
      locale: 'fr' as Locale,
    });
    expect(res.exists).toBe(true);
    expect(res.href).toContain('/fr/blog/');
  });

  it('resolver.resolve reports missing targets', async () => {
    const res = await blogInternalLinkResolver.resolve('does-not-exist-slug', {
      locale: 'fr' as Locale,
    });
    expect(res.exists).toBe(false);
  });

  it('resolver.search finds posts by title', async () => {
    const results = await blogInternalLinkResolver.search('Ramadan', {
      locale: 'fr' as Locale,
    });
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].href).toContain('/fr/blog/');
  });

  it('detectDeadInternalLinks flags a slug absent from validTargets', () => {
    const html = '<a href="/fr/blog/ghost" data-internal-link="ghost">Gone</a>';
    const reports = detectDeadInternalLinks(html, slugs);
    expect(reports).toHaveLength(1);
    expect(reports[0].target).toBe('ghost');
  });

  it('markDeadInternalLinks adds the dead-link class', () => {
    const html = '<a href="/fr/blog/ghost" data-internal-link="ghost" class="x">Gone</a>';
    const out = markDeadInternalLinks(html, slugs);
    expect(out).toContain('class="x dead-link"');
    expect(out).toContain('data-dead-link="true"');
  });

  it('valid internal links are not flagged', () => {
    const html = '<a href="/fr/blog/voyager-pendant-le-ramadan" data-internal-link="voyager-pendant-le-ramadan">OK</a>';
    const reports = detectDeadInternalLinks(html, slugs);
    expect(reports).toHaveLength(0);
  });
});
