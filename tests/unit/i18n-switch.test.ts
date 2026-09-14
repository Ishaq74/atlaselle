import { describe, expect, it } from 'vitest';
import { mapStaticSlugPath, type StaticSlugMaps } from '@/i18n/utils';
import type { Locale } from '@/i18n/config';
import frCommon from '@/i18n/fr/common';
import enCommon from '@/i18n/en/common';
import esCommon from '@/i18n/es/common';
import arCommon from '@/i18n/ar/common';
import frAuth from '@/i18n/fr/auth';
import enAuth from '@/i18n/en/auth';
import esAuth from '@/i18n/es/auth';
import arAuth from '@/i18n/ar/auth';

// Mêmes sources que LanguageSwitcher.astro — zéro dérive.
const MAPS: StaticSlugMaps = {
  pageRoutes: { fr: frCommon.pageRoutes, en: enCommon.pageRoutes, es: esCommon.pageRoutes, ar: arCommon.pageRoutes },
  authRoutes: { fr: frAuth.routes, en: enAuth.routes, es: esAuth.routes, ar: arAuth.routes },
};

const LOCALES: Locale[] = ['fr', 'en', 'es', 'ar'];

describe('mapStaticSlugPath — pages about/contact/legal (TODO §7.6)', () => {
  it.each(LOCALES)('round-trips about from %s to every locale', (from) => {
    for (const to of LOCALES) {
      expect(mapStaticSlugPath(from, to, `/${MAPS.pageRoutes[from].about}`, MAPS)).toBe(
        `/${to}/${MAPS.pageRoutes[to].about}`,
      );
    }
  });

  it('maps contact fr → es and legal fr → ar', () => {
    expect(mapStaticSlugPath('fr', 'es', '/contact', MAPS)).toBe('/es/contacto');
    expect(mapStaticSlugPath('fr', 'ar', '/mentions-legales', MAPS)).toBe('/ar/legal-notice');
    expect(mapStaticSlugPath('en', 'fr', '/about', MAPS)).toBe('/fr/a-propos');
  });
});

describe('mapStaticSlugPath — auth localisé', () => {
  it('maps connexion fr → sign-in en, dashboard es → ar', () => {
    expect(mapStaticSlugPath('fr', 'en', '/auth/connexion', MAPS)).toBe('/en/auth/sign-in');
    expect(mapStaticSlugPath('es', 'ar', '/auth/panel', MAPS)).toBe('/ar/auth/dashboard');
    expect(mapStaticSlugPath('ar', 'fr', '/auth/sign-in', MAPS)).toBe('/fr/auth/connexion');
  });
});

describe('mapStaticSlugPath — pages universelles terms/faq', () => {
  it.each(LOCALES)('keeps universal slug from %s', (from) => {
    for (const to of LOCALES) {
      expect(mapStaticSlugPath(from, to, '/terms', MAPS)).toBe(`/${to}/terms`);
      expect(mapStaticSlugPath(from, to, '/faq', MAPS)).toBe(`/${to}/faq`);
    }
  });
});

describe('mapStaticSlugPath — repli null', () => {
  it('returns null for blog, home, unknown and deep paths', () => {
    expect(mapStaticSlugPath('fr', 'en', '/blog', MAPS)).toBeNull();
    expect(mapStaticSlugPath('fr', 'en', '/', MAPS)).toBeNull();
    expect(mapStaticSlugPath('fr', 'en', '/inexistant', MAPS)).toBeNull();
    expect(mapStaticSlugPath('fr', 'en', '/auth/connexion/extra', MAPS)).toBeNull();
    expect(mapStaticSlugPath('fr', 'en', '/auth/inexistant', MAPS)).toBeNull();
  });
});
