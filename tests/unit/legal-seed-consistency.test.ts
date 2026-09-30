import { describe, it, expect } from 'vitest';
import pages from '@/database/data/09-legal-pages.data.ts';
import noticeSections from '@/database/data/09b-legal-sections.data.ts';
import termsSections from '@/database/data/09c-legal-terms-sections.data.ts';
import insuranceSections from '@/database/data/09d-legal-insurance-sections.data.ts';

const LOCALES = ['fr', 'en', 'es', 'ar'] as const;

/**
 * Cohérence du seed des pages légales.
 *
 * Le bug que ce test verrouille : les pages « conditions de réservation » et
 * « assurance voyage » ont été créées sans leurs sections, donc leurs onglets
 * s'affichaient VIDES sur le site — un contenu légal absent, en production,
 * sans qu'aucun test ne le remarque. Chaque section référence un `pageId` :
 * une référence fausse produit exactement le même symptôme.
 */
const GROUPS = [
  { label: 'mentions légales', sections: noticeSections },
  { label: 'conditions de réservation', sections: termsSections },
  { label: 'assurance voyage', sections: insuranceSections },
] as const;

describe('seed des pages légales', () => {
  it('déclare les 3 pages dans les 4 locales', () => {
    for (const locale of LOCALES) {
      const forLocale = pages.filter((p) => p.locale === locale);
      expect(forLocale, `pages manquantes pour ${locale}`).toHaveLength(3);
    }
  });

  it('utilise le template "legal" partout', () => {
    for (const page of pages) {
      expect(page.template, `${page.locale}/${page.slug}`).toBe('legal');
    }
  });

  it.each(GROUPS)('$label : chaque pageId existe', ({ sections }) => {
    const known = new Set(pages.map((p) => p.id));
    for (const section of sections) {
      expect(known.has(section.pageId), `pageId inconnu : ${section.pageId}`).toBe(true);
    }
  });

  it.each(GROUPS)('$label : une section au minimum par locale', ({ sections }) => {
    for (const locale of LOCALES) {
      const pageIdsOfLocale = new Set(
        pages.filter((p) => p.locale === locale).map((p) => p.id),
      );
      const count = sections.filter((s) => pageIdsOfLocale.has(s.pageId)).length;
      expect(count, `aucune section en ${locale}`).toBeGreaterThan(0);
    }
  });

  it.each(GROUPS)('$label : chaque section a un titre et des questions', ({ sections }) => {
    for (const section of sections) {
      const content = section.content as { title?: string; items?: unknown[] };
      expect(content.title, `titre manquant (${section.id})`).toBeTruthy();
      expect(Array.isArray(content.items), `items manquants (${section.id})`).toBe(true);
      expect(content.items!.length, `section vide (${section.id})`).toBeGreaterThan(0);
    }
  });

  it('ne laisse aucun identifiant de page dupliqué', () => {
    const ids = pages.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
