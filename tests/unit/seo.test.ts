import { describe, it, expect } from 'vitest';
import { validatePageSeo, computeSeoScore, type SeoIssue } from '@/lib/seo';

describe('validatePageSeo', () => {
  // ── Title ─────────────────────────────────────────────────────────
  it('returns error when title is missing', () => {
    const issues = validatePageSeo({});
    expect(issues.some(i => i.field === 'title' && i.severity === 'error')).toBe(true);
  });

  it('warns when title is too short (< 10)', () => {
    const issues = validatePageSeo({ title: 'Hi' });
    expect(issues.some(i => i.field === 'title' && i.severity === 'warning' && i.message.includes('court'))).toBe(true);
  });

  it('warns when title is too long (> 60)', () => {
    const issues = validatePageSeo({ title: 'x'.repeat(61) });
    expect(issues.some(i => i.field === 'title' && i.severity === 'warning' && i.message.includes('long'))).toBe(true);
  });

  it('uses metaTitle over title for length checks', () => {
    const issues = validatePageSeo({ title: 'Short', metaTitle: 'x'.repeat(65) });
    expect(issues.some(i => i.field === 'title' && i.message.includes('long'))).toBe(true);
  });

  it('accepts a good title (10-60 chars)', () => {
    const issues = validatePageSeo({
      title: 'A Perfectly Good Page Title',
      metaDescription: 'A good meta description that is long enough to satisfy the fifty character minimum requirement.',
      ogImage: 'https://example.com/og.jpg',
    });
    const titleIssues = issues.filter(i => i.field === 'title');
    expect(titleIssues).toEqual([]);
  });

  // ── Meta Description ──────────────────────────────────────────────
  it('returns error when metaDescription is missing', () => {
    const issues = validatePageSeo({ title: 'Some Valid Title' });
    expect(issues.some(i => i.field === 'metaDescription' && i.severity === 'error')).toBe(true);
  });

  it('warns when metaDescription is too short (< 50)', () => {
    const issues = validatePageSeo({ title: 'A Valid Title', metaDescription: 'Short' });
    expect(issues.some(i => i.field === 'metaDescription' && i.message.includes('courte'))).toBe(true);
  });

  it('warns when metaDescription is too long (> 160)', () => {
    const issues = validatePageSeo({ title: 'A Valid Title', metaDescription: 'x'.repeat(161) });
    expect(issues.some(i => i.field === 'metaDescription' && i.message.includes('longue'))).toBe(true);
  });

  // ── OG Image ──────────────────────────────────────────────────────
  it('returns info when ogImage is missing', () => {
    const issues = validatePageSeo({ title: 'A Valid Title', metaDescription: 'x'.repeat(60) });
    expect(issues.some(i => i.field === 'ogImage' && i.severity === 'info')).toBe(true);
  });

  // ── Canonical ─────────────────────────────────────────────────────
  it('returns error for non-absolute canonical URL', () => {
    const issues = validatePageSeo({ title: 'A Valid Title', canonical: '/relative-path' });
    expect(issues.some(i => i.field === 'canonical' && i.severity === 'error')).toBe(true);
  });

  it('accepts absolute canonical URL', () => {
    const issues = validatePageSeo({ title: 'A Valid Title', canonical: 'https://example.com/page' });
    expect(issues.filter(i => i.field === 'canonical')).toEqual([]);
  });

  // ── Robots — directive validation ─────────────────────────────────
  it('warns on unknown robots directive', () => {
    const issues = validatePageSeo({ title: 'A Valid Title', robots: 'noindex, banana' });
    expect(issues.some(i => i.field === 'robots' && i.message.includes('banana'))).toBe(true);
  });

  it('returns noindex info when noindex is set', () => {
    const issues = validatePageSeo({ title: 'A Valid Title', robots: 'noindex' });
    expect(issues.some(i => i.field === 'robots' && i.severity === 'info' && i.message.includes('noindex'))).toBe(true);
  });

  it('accepts valid robots directives', () => {
    const issues = validatePageSeo({ title: 'A Valid Title', robots: 'index, follow' });
    const robotsWarnings = issues.filter(i => i.field === 'robots' && i.severity === 'warning');
    expect(robotsWarnings).toEqual([]);
  });

  // ── Robots — parameter validation (max-snippet, max-image-preview, max-video-preview)
  it('validates max-snippet requires numeric parameter', () => {
    const issues = validatePageSeo({ title: 'A Valid Title', robots: 'max-snippet' });
    expect(issues.some(i => i.field === 'robots' && i.message.includes('numérique'))).toBe(true);
  });

  it('accepts max-snippet with numeric parameter', () => {
    const issues = validatePageSeo({ title: 'A Valid Title', robots: 'max-snippet:150' });
    const snippetWarnings = issues.filter(i => i.field === 'robots' && i.message.includes('max-snippet'));
    expect(snippetWarnings).toEqual([]);
  });

  it('validates max-image-preview accepts only none|standard|large', () => {
    const issues = validatePageSeo({ title: 'A Valid Title', robots: 'max-image-preview:invalid' });
    expect(issues.some(i => i.field === 'robots' && i.message.includes('max-image-preview'))).toBe(true);
  });

  it('accepts max-image-preview with valid values', () => {
    for (const value of ['none', 'standard', 'large']) {
      const issues = validatePageSeo({ title: 'A Valid Title', robots: `max-image-preview:${value}` });
      const imgWarnings = issues.filter(i => i.field === 'robots' && i.message.includes('max-image-preview'));
      expect(imgWarnings).toEqual([]);
    }
  });

  it('validates max-video-preview requires numeric parameter', () => {
    const issues = validatePageSeo({ title: 'A Valid Title', robots: 'max-video-preview:abc' });
    expect(issues.some(i => i.field === 'robots' && i.message.includes('numérique'))).toBe(true);
  });

  it('accepts max-video-preview with numeric parameter', () => {
    const issues = validatePageSeo({ title: 'A Valid Title', robots: 'max-video-preview:30' });
    const vidWarnings = issues.filter(i => i.field === 'robots' && i.message.includes('max-video-preview'));
    expect(vidWarnings).toEqual([]);
  });

  // ── Slug ──────────────────────────────────────────────────────────
  it('warns on long slug (> 50 chars)', () => {
    const issues = validatePageSeo({ title: 'A Valid Title', slug: 'x'.repeat(51) });
    expect(issues.some(i => i.field === 'slug' && i.message.includes('long'))).toBe(true);
  });

  it('notes double hyphens in slug', () => {
    const issues = validatePageSeo({ title: 'A Valid Title', slug: 'my--page' });
    expect(issues.some(i => i.field === 'slug' && i.message.includes('tirets doubles'))).toBe(true);
  });

  // ── Meta Title vs Title ───────────────────────────────────────────
  it('notes when metaTitle equals title', () => {
    const issues = validatePageSeo({ title: 'Same Title', metaTitle: 'Same Title' });
    expect(issues.some(i => i.field === 'metaTitle' && i.message.includes('identique'))).toBe(true);
  });

  // ── The sections parameter is gone, and must stay gone ────────────
  // The duplicate <h1> warning used to be raised from a `sections` argument by
  // counting hero sections. No section type renders a level 1 heading any more —
  // SectionRenderer.astro emits `h2` for the hero title, and the editorial body
  // of a `text` or `custom` section is demoted at render time by
  // renderEditorialHtml — so the number of hero sections cannot produce a
  // duplicate heading and the argument is dead. The contract checked here is
  // therefore a negative one, and it has to hold at runtime as well as in the
  // types: legacy data still carrying several hero sections must not resurrect
  // the warning, and no issue may be reported against a `sections` field.
  it('reports nothing about sections for legacy data still carrying several hero sections', () => {
    const validateWithLegacySections = validatePageSeo as unknown as (
      page: { title?: string },
      sections: { type: string }[],
    ) => SeoIssue[];

    const issues = validateWithLegacySections(
      { title: 'A Valid Title' },
      [{ type: 'hero' }, { type: 'text' }, { type: 'hero' }],
    );

    expect(issues.filter(i => i.field === 'sections')).toEqual([]);
    expect(issues.some(i => i.message.includes('hero'))).toBe(false);
  });

  // ── Sorting ───────────────────────────────────────────────────────
  it('sorts issues by severity (error > warning > info)', () => {
    const issues = validatePageSeo({}); // triggers error + info
    const severities = issues.map(i => i.severity);
    const order = { error: 0, warning: 1, info: 2 };
    for (let j = 1; j < severities.length; j++) {
      expect(order[severities[j]]).toBeGreaterThanOrEqual(order[severities[j - 1]]);
    }
  });
});

describe('computeSeoScore', () => {
  it('returns 100 for no issues', () => {
    expect(computeSeoScore([])).toBe(100);
  });

  it('deducts 25 per error', () => {
    expect(computeSeoScore([
      { field: 'title', severity: 'error', message: 'x' },
    ])).toBe(75);
  });

  it('deducts 10 per warning', () => {
    expect(computeSeoScore([
      { field: 'slug', severity: 'warning', message: 'x' },
    ])).toBe(90);
  });

  it('deducts 3 per info', () => {
    expect(computeSeoScore([
      { field: 'ogImage', severity: 'info', message: 'x' },
    ])).toBe(97);
  });

  it('clamps score to 0 minimum', () => {
    const issues = Array.from({ length: 10 }, (_, i) => ({
      field: `f${i}`, severity: 'error' as const, message: 'x',
    }));
    expect(computeSeoScore(issues)).toBe(0);
  });

  it('handles mixed severities', () => {
    expect(computeSeoScore([
      { field: 'a', severity: 'error', message: 'x' },   // -25
      { field: 'b', severity: 'warning', message: 'x' },  // -10
      { field: 'c', severity: 'info', message: 'x' },     // -3
    ])).toBe(62);
  });
});
