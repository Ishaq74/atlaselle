import { describe, expect, it } from 'vitest';
import { LOCALES, type Locale } from '@i18n/config';
import { BLOG_AUTHOR_SEGMENTS, BLOG_ROUTE_SEGMENTS } from '@/lib/blog/constants';
import { getBlogTranslations } from '@/i18n/utils';

/**
 * BLOG_ROUTE_SEGMENTS / BLOG_AUTHOR_SEGMENTS (src/lib/blog/constants.ts)
 * dupliquent volontairement `routes.blog` et `routes.author` des dictionnaires,
 * afin d'éviter un import statique des 4 dictionnaires blog dans
 * `src/lib/blog/utils.ts` (sinon le code-splitting de `src/i18n/utils.ts` est
 * annulé — avertissement Vite INEFFECTIVE_DYNAMIC_IMPORT).
 *
 * Toute divergence casserait les URLs du blog : ces tests verrouillent l'invariant.
 */
describe('segments de routes blog', () => {
  const expectedLocales = [...LOCALES].sort();

  it('BLOG_ROUTE_SEGMENTS expose une entrée pour chaque locale', () => {
    expect(Object.keys(BLOG_ROUTE_SEGMENTS).sort()).toEqual(expectedLocales);
  });

  it('BLOG_AUTHOR_SEGMENTS expose une entrée pour chaque locale', () => {
    expect(Object.keys(BLOG_AUTHOR_SEGMENTS).sort()).toEqual(expectedLocales);
  });

  it.each(LOCALES)('BLOG_ROUTE_SEGMENTS correspond à routes.blog pour la locale %s', async (locale: Locale) => {
    const translations = await getBlogTranslations(locale);
    expect(BLOG_ROUTE_SEGMENTS[locale]).toBe(translations.routes.blog);
  });

  it.each(LOCALES)('BLOG_AUTHOR_SEGMENTS correspond à routes.author pour la locale %s', async (locale: Locale) => {
    const translations = await getBlogTranslations(locale);
    expect(BLOG_AUTHOR_SEGMENTS[locale]).toBe(translations.routes.author);
  });
});
