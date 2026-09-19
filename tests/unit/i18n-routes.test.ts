import { describe, expect, it } from 'vitest';
import {
  ABOUT_SEGMENT,
  APPLY_SEGMENT,
  CONTACT_SEGMENT,
  FAQ_SEGMENT,
  PRIVACY_SEGMENT,
  TERMS_SEGMENT,
  TRIP_LIST_SEGMENT,
  TRIP_SLUGS,
  getApplyPath,
  getTripPath,
  getTripSlug,
  getTripsBasePath,
  getFaqPath,
  getTermsPath,
  getPrivacyPath,
  getAboutPath,
  getContactPath,
  isTripDetailPath,
  resolveLocalizedRoute,
  resolveTripSlug,
  type TripId,
} from '@/i18n/routes';
import type { Locale } from '@/i18n/config';

const LOCALES: Locale[] = ['fr', 'en', 'es', 'ar'];
const TRIP_IDS: TripId[] = ['south-africa', 'sicily-malta', 'andalusia-morocco'];

describe('ROUTE_SEGMENTS (TODO Annexe A)', () => {
  it('exposes the translated trip-list segment per locale', () => {
    expect(TRIP_LIST_SEGMENT).toEqual({ fr: 'voyages', en: 'trips', ar: 'trips', es: 'viajes' });
  });

  it('exposes the translated apply segment per locale', () => {
    expect(APPLY_SEGMENT).toEqual({ fr: 'candidature', en: 'apply', ar: 'apply', es: 'postulacion' });
  });

  it('exposes faq / terms / privacy / about / contact segments per locale', () => {
    expect(FAQ_SEGMENT).toEqual({ fr: 'faq', en: 'faq', ar: 'faq', es: 'faq' });
    expect(TERMS_SEGMENT).toEqual({ fr: 'conditions', en: 'terms', ar: 'terms', es: 'terminos' });
    expect(PRIVACY_SEGMENT).toEqual({ fr: 'confidentialite', en: 'privacy', ar: 'privacy', es: 'privacidad' });
    expect(ABOUT_SEGMENT).toEqual({ fr: 'a-propos', en: 'about', ar: 'about', es: 'acerca-de' });
    expect(CONTACT_SEGMENT).toEqual({ fr: 'contact', en: 'contact', ar: 'contact', es: 'contacto' });
  });
});

describe('TRIP_SLUGS (TODO Annexe A.1)', () => {
  it('matches the reference table for the 3 initial trips', () => {
    expect(TRIP_SLUGS['south-africa']).toEqual({ fr: 'afrique-du-sud', en: 'south-africa', ar: 'south-africa', es: 'sudafrica' });
    expect(TRIP_SLUGS['sicily-malta']).toEqual({ fr: 'sicile-malte', en: 'sicily-malta', ar: 'sicily-malta', es: 'sicilia-malta' });
    expect(TRIP_SLUGS['andalusia-morocco']).toEqual({
      fr: 'andalousie-maroc',
      en: 'andalusia-morocco',
      ar: 'andalusia-morocco',
      es: 'andalucia-marruecos',
    });
  });

  it('keeps Arabic slugs ASCII (transliterated English)', () => {
    for (const id of TRIP_IDS) {
      expect(TRIP_SLUGS[id].ar).toMatch(/^[a-z0-9-]+$/);
    }
  });
});

describe('path helpers', () => {
  it('builds the trip-list base per locale', () => {
    expect(getTripsBasePath('fr')).toBe('/fr/voyages');
    expect(getTripsBasePath('en')).toBe('/en/trips');
    expect(getTripsBasePath('ar')).toBe('/ar/trips');
    expect(getTripsBasePath('es')).toBe('/es/viajes');
  });

  it('builds trip detail + apply paths from the single source', () => {
    expect(getTripPath('fr', 'afrique-du-sud')).toBe('/fr/voyages/afrique-du-sud');
    expect(getTripPath('es', 'sudafrica')).toBe('/es/viajes/sudafrica');
    expect(getApplyPath('fr', 'sicile-malte')).toBe('/fr/candidature/sicile-malte');
    expect(getApplyPath('en', 'sicily-malta')).toBe('/en/apply/sicily-malta');
    expect(getApplyPath('ar', 'sicily-malta')).toBe('/ar/apply/sicily-malta');
    expect(getApplyPath('es', 'sicilia-malta')).toBe('/es/postulacion/sicilia-malta');
  });
});

describe('resolveTripSlug', () => {
  it.each(LOCALES)('round-trips every slug for locale %s', (locale) => {
    for (const id of TRIP_IDS) {
      expect(resolveTripSlug(locale, TRIP_SLUGS[id][locale])).toBe(id);
    }
  });

  it('returns null for unknown slugs', () => {
    expect(resolveTripSlug('fr', 'inexistant')).toBeNull();
    expect(resolveTripSlug('es', '')).toBeNull();
  });
});

describe('resolveLocalizedRoute (middleware rewrite → routes physiques)', () => {
  it('rewrites localized trip-list segments to /trips', () => {
    expect(resolveLocalizedRoute('/fr/voyages/afrique-du-sud')).toBe('/fr/trips/afrique-du-sud');
    expect(resolveLocalizedRoute('/es/viajes/sudafrica')).toBe('/es/trips/sudafrica');
  });

  it('rewrites localized apply segments to /apply', () => {
    expect(resolveLocalizedRoute('/fr/candidature/sicile-malte')).toBe('/fr/apply/sicile-malte');
    expect(resolveLocalizedRoute('/es/postulacion/sicilia-malta')).toBe('/es/apply/sicilia-malta');
  });

  it('returns null when nothing to rewrite', () => {
    expect(resolveLocalizedRoute('/en/trips/south-africa')).toBeNull();
    expect(resolveLocalizedRoute('/ar/apply/sicily-malta')).toBeNull();
    expect(resolveLocalizedRoute('/fr/a-propos')).toBeNull();
    expect(resolveLocalizedRoute('/fr/candidature')).toBeNull();
    expect(resolveLocalizedRoute('/fr')).toBeNull();
    expect(resolveLocalizedRoute('/')).toBeNull();
    expect(resolveLocalizedRoute('/de/voyages/x')).toBeNull();
  });

  it('rewrites bare localized list segments to the list page', () => {
    expect(resolveLocalizedRoute('/fr/voyages')).toBe('/fr/trips');
    expect(resolveLocalizedRoute('/es/viajes')).toBe('/es/trips');
    expect(resolveLocalizedRoute('/en/trips')).toBeNull();
  });
});

describe('structural path getters', () => {
  it('faq/terms/privacy/about/contact paths per locale', () => {
    expect(getFaqPath('fr')).toBe('/fr/faq');
    expect(getTermsPath('fr')).toBe('/fr/conditions');
    expect(getTermsPath('es')).toBe('/es/terminos');
    expect(getPrivacyPath('fr')).toBe('/fr/confidentialite');
    expect(getPrivacyPath('es')).toBe('/es/privacidad');
    expect(getAboutPath('fr')).toBe('/fr/a-propos');
    expect(getAboutPath('es')).toBe('/es/acerca-de');
    expect(getContactPath('es')).toBe('/es/contacto');
    expect(getContactPath('ar')).toBe('/ar/contact');
  });

  it('blog URL builders', async () => {
    const { getBlogUrl, getBlogCategoryUrl, getBlogTagUrl, getBlogPostUrl } = await import('@/i18n/utils');
    const blogT = { routes: { blog: 'blog', categories: 'cat', tags: 'tags' } } as never;
    expect(getBlogUrl('fr', blogT)).toBe('/fr/blog');
    expect(getBlogCategoryUrl('fr', blogT, 'news')).toBe('/fr/blog/news');
    expect(getBlogTagUrl('fr', blogT, 'tech')).toBe('/fr/blog/tags/tech');
    expect(getBlogPostUrl('fr', blogT, 'hello')).toBe('/fr/blog/hello');
    expect(getBlogPostUrl('fr', blogT, 'hello', 'news')).toBe('/fr/blog/news/hello');
  });
});

describe('trip path helpers (source unique routes.ts, DB en prod)', () => {
  it('getTripSlug couvre les 3 voyages × 4 locales', () => {
    for (const id of ['south-africa', 'sicily-malta', 'andalusia-morocco'] as TripId[]) {
      for (const locale of LOCALES) {
        expect(getTripSlug(id, locale)).toBe(TRIP_SLUGS[id][locale]);
      }
    }
  });

  it('isTripDetailPath reconnaît les fiches', () => {
    expect(isTripDetailPath('/fr/voyages/afrique-du-sud')).toBe(true);
    expect(isTripDetailPath('/en/trips/south-africa')).toBe(true);
    expect(isTripDetailPath('/fr/voyages')).toBe(false);
    expect(isTripDetailPath('/en/trips/unknown')).toBe(false);
  });
});
