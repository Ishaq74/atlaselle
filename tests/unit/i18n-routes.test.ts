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
  getTripsBasePath,
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
    expect(resolveLocalizedRoute('/fr/voyages')).toBeNull();
    expect(resolveLocalizedRoute('/fr/a-propos')).toBeNull();
    expect(resolveLocalizedRoute('/fr')).toBeNull();
    expect(resolveLocalizedRoute('/')).toBeNull();
    expect(resolveLocalizedRoute('/de/voyages/x')).toBeNull();
  });
});
