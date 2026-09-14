import type { Locale } from './config';

/**
 * Table centralisée des segments d'URL traduits par langue.
 * Référence unique — TODO §7.2 + Annexe A. Ne jamais recopier ces
 * segments dans les pages, les composants ou les tests.
 *
 * Routage technique : segment dynamique `[lang]` unique. Les dossiers
 * statiques `src/pages/fr|en|es|ar` sont interdits (legacy supprimé,
 * suppression sèche sans 301 — site pas encore en prod).
 *
 * Convention AR : slugs ASCII translittérés en anglais (partage /
 * copier-coller / indexation), contenu de page entièrement en arabe.
 */

export type TripId = 'south-africa' | 'sicily-malta' | 'andalusia-morocco';

/** `/fr/voyages` · `/en/trips` · `/ar/trips` · `/es/viajes` */
export const TRIP_LIST_SEGMENT: Record<Locale, string> = {
  fr: 'voyages',
  en: 'trips',
  ar: 'trips',
  es: 'viajes',
};

/** `/fr/candidature` · `/en/apply` · `/ar/apply` · `/es/postulacion` */
export const APPLY_SEGMENT: Record<Locale, string> = {
  fr: 'candidature',
  en: 'apply',
  ar: 'apply',
  es: 'postulacion',
};

export const FAQ_SEGMENT: Record<Locale, string> = {
  fr: 'faq',
  en: 'faq',
  ar: 'faq',
  es: 'faq',
};

/** `/fr/conditions` · `/en/terms` · `/ar/terms` · `/es/terminos` */
export const TERMS_SEGMENT: Record<Locale, string> = {
  fr: 'conditions',
  en: 'terms',
  ar: 'terms',
  es: 'terminos',
};

/** `/fr/confidentialite` · `/en/privacy` · `/ar/privacy` · `/es/privacidad` */
export const PRIVACY_SEGMENT: Record<Locale, string> = {
  fr: 'confidentialite',
  en: 'privacy',
  ar: 'privacy',
  es: 'privacidad',
};

/** `/fr/a-propos` · `/en/about` · `/ar/about` · `/es/acerca-de` */
export const ABOUT_SEGMENT: Record<Locale, string> = {
  fr: 'a-propos',
  en: 'about',
  ar: 'about',
  es: 'acerca-de',
};

/** `/fr/contact` · `/en/contact` · `/ar/contact` · `/es/contacto` */
export const CONTACT_SEGMENT: Record<Locale, string> = {
  fr: 'contact',
  en: 'contact',
  ar: 'contact',
  es: 'contacto',
};

/**
 * Slugs des 3 voyages initiaux — TODO Annexe A.1.
 * FR/EN/ES traduits, AR = slug EN translittéré (ASCII).
 */
export const TRIP_SLUGS: Record<TripId, Record<Locale, string>> = {
  'south-africa': {
    fr: 'afrique-du-sud',
    en: 'south-africa',
    ar: 'south-africa',
    es: 'sudafrica',
  },
  'sicily-malta': {
    fr: 'sicile-malte',
    en: 'sicily-malta',
    ar: 'sicily-malta',
    es: 'sicilia-malta',
  },
  'andalusia-morocco': {
    fr: 'andalousie-maroc',
    en: 'andalusia-morocco',
    ar: 'andalusia-morocco',
    es: 'andalucia-marruecos',
  },
};

const TRIP_IDS = Object.keys(TRIP_SLUGS) as TripId[];

export function getTripSlug(tripId: TripId, locale: Locale): string {
  return TRIP_SLUGS[tripId][locale];
}

/** Résout `slug + locale` → `TripId`, ou `null` si inconnu. */
export function resolveTripSlug(locale: Locale, slug: string): TripId | null {
  const match = TRIP_IDS.find((id) => TRIP_SLUGS[id][locale] === slug);
  return match ?? null;
}

/** `/{locale}/{trips|voyages|viajes}` */
export function getTripsBasePath(locale: Locale): string {
  return `/${locale}/${TRIP_LIST_SEGMENT[locale]}`;
}

/** `/{locale}/{segment}/{slug}` — détail voyage. */
export function getTripPath(locale: Locale, slug: string): string {
  return `${getTripsBasePath(locale)}/${slug}`;
}

/** `/{locale}/{apply|candidature|postulacion}/{tripSlug}` */
export function getApplyPath(locale: Locale, tripSlug: string): string {
  return `/${locale}/${APPLY_SEGMENT[locale]}/${tripSlug}`;
}

export function getFaqPath(locale: Locale): string {
  return `/${locale}/${FAQ_SEGMENT[locale]}`;
}

export function getTermsPath(locale: Locale): string {
  return `/${locale}/${TERMS_SEGMENT[locale]}`;
}

export function getPrivacyPath(locale: Locale): string {
  return `/${locale}/${PRIVACY_SEGMENT[locale]}`;
}

export function getAboutPath(locale: Locale): string {
  return `/${locale}/${ABOUT_SEGMENT[locale]}`;
}

export function getContactPath(locale: Locale): string {
  return `/${locale}/${CONTACT_SEGMENT[locale]}`;
}

/** Vrai si le chemin correspond à une fiche voyage dans n'importe quelle langue. */
export function isTripDetailPath(pathname: string): boolean {
  return TRIP_IDS.some((id) =>
    (Object.keys(TRIP_SLUGS[id]) as Locale[]).some((loc) =>
      pathname === getTripPath(loc, TRIP_SLUGS[id][loc]),
    ),
  );
}

/**
 * Réécriture des segments localisés vers les routes physiques `[lang]/trips` et `[lang]/apply`.
 * Les fichiers de routes sont en segments fixes (`trips`, `apply`) ; les segments
 * traduits (`voyages`, `viajes`, `candidature`, `postulacion`) sont réécrits côté
 * middleware pour que les URLs canoniques localisées (Annexe A) fonctionnent.
 * Les segments nus (`/fr/voyages`) vont vers la liste (`/[lang]/trips`).
 * Pur et testé (tests/unit/i18n-routes.test.ts). Retourne le chemin réécrit ou `null`.
 */
export function resolveLocalizedRoute(pathname: string): string | null {
  const m = pathname.match(/^\/(fr|en|es|ar)\/([^/]+)(?:\/(.*))?$/);
  if (!m) return null;
  const locale = m[1] as Locale;
  const segment = m[2];
  const rest = m[3] ?? "";
  if (segment === TRIP_LIST_SEGMENT[locale] && segment !== "trips") {
    return rest ? `/${locale}/trips/${rest}` : `/${locale}/trips`;
  }
  if (segment === APPLY_SEGMENT[locale] && segment !== "apply" && rest) {
    return `/${locale}/apply/${rest}`;
  }
  return null;
}
