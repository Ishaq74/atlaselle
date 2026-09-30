import { describe, expect, it } from 'vitest';
import { getLocaleFromPath } from '@/i18n/utils';
import { DEFAULT_LOCALE, LOCALES } from '@i18n/config';

/**
 * `getLocaleFromPath` est le socle des composants transverses qui doivent
 * traduire leurs libellés sans recevoir la locale en prop (AdminPagination,
 * AuthLayout). Une locale mal déduite revient à afficher du français sur une
 * page arabe : chaque locale et chaque forme de chemin est couverte.
 */
describe('getLocaleFromPath', () => {
  it('deduces the locale from a localized path', () => {
    for (const locale of LOCALES) {
      expect(getLocaleFromPath(`/${locale}/admin/users`)).toBe(locale);
      expect(getLocaleFromPath(`/${locale}/`)).toBe(locale);
    }
  });

  it('ignores a trailing slash and nested segments', () => {
    expect(getLocaleFromPath('/ar/blog/2026/12/un-article/')).toBe('ar');
    expect(getLocaleFromPath('/es/auth/acceso')).toBe('es');
  });

  it('falls back to the default locale on a non-localized path', () => {
    expect(getLocaleFromPath('/')).toBe(DEFAULT_LOCALE);
    expect(getLocaleFromPath('')).toBe(DEFAULT_LOCALE);
    expect(getLocaleFromPath('/admin/users')).toBe(DEFAULT_LOCALE);
    expect(getLocaleFromPath('/xx/admin')).toBe(DEFAULT_LOCALE);
    // Un segment qui ressemble à une locale mais en majuscules n'en est pas une :
    // les URL sont générées en minuscules, on ne devine pas.
    expect(getLocaleFromPath('/FR/admin')).toBe(DEFAULT_LOCALE);
  });

  it('does not mistake a path segment that merely starts like a locale', () => {
    expect(getLocaleFromPath('/france/villes')).toBe(DEFAULT_LOCALE);
    expect(getLocaleFromPath('/arabic-panel')).toBe(DEFAULT_LOCALE);
  });
});
