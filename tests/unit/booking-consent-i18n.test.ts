import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

// DB pilotée par les tests : 'throw' simule une DB indisponible (fallback seed),
// [] simule des pages supprimées, sinon slugs renommés par un admin.
const state = vi.hoisted(() => ({ rows: 'throw' as 'throw' | { id: string; slug: string }[] }));

vi.mock('@database/drizzle', () => ({
  getDrizzle: () => ({
    select: () => ({
      from: () => ({
        where: () => (state.rows === 'throw' ? Promise.reject(new Error('DB down')) : Promise.resolve(state.rows)),
      }),
    }),
  }),
}));

import { resolveLegalLinks } from '@/lib/legal-pages';
import type { Locale } from '@/i18n/config';

// Slugs seed (src/lib/legal-pages.ts FALLBACK_SLUGS, seeds 09-legal-pages).
const FALLBACK: Record<Locale, { terms: string; insurance: string }> = {
  fr: { terms: '/fr/conditions-reservation', insurance: '/fr/assurance-voyage' },
  en: { terms: '/en/booking-terms', insurance: '/en/travel-insurance' },
  es: { terms: '/es/condiciones-reserva', insurance: '/es/seguro-de-viaje' },
  ar: { terms: '/ar/booking-terms', insurance: '/ar/travel-insurance' },
};
const LOCALES = ['fr', 'en', 'es', 'ar'] as const;

// IDs fixes des pages légales seedées (miroir de LEGAL_PAGE_IDS).
const TERMS_ID_FR = '785db5e4-f3e3-43cd-b5ad-e26c1aa24600';

describe('resolveLegalLinks — fallback seed (DB indisponible)', () => {
  let errSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    state.rows = 'throw';
    // Le helper loggue le fallback sur console.error : on silence pour garder
    // la sortie de test lisible.
    errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => errSpy.mockRestore());

  it.each(LOCALES)('locale %s : liens non vides vers conditions + assurance (slugs seed)', async (locale) => {
    const links = await resolveLegalLinks(locale);
    expect(links).toEqual(FALLBACK[locale]);
    expect(links.terms.length).toBeGreaterThan(0);
    expect(links.insurance.length).toBeGreaterThan(0);
  });

  it('fallback partiel quand la page CMS a été supprimée (0 ligne)', async () => {
    state.rows = [];
    await expect(resolveLegalLinks('fr')).resolves.toEqual(FALLBACK.fr);
  });
});

describe('resolveLegalLinks — slugs DB (renommage admin pris en compte)', () => {
  beforeEach(() => {
    state.rows = [{ id: TERMS_ID_FR, slug: 'cgv-renommees' }];
  });

  it('utilise le slug DB courant et retombe sur le seed pour la page absente', async () => {
    const links = await resolveLegalLinks('fr');
    expect(links.terms).toBe('/fr/cgv-renommees');
    expect(links.insurance).toBe('/fr/assurance-voyage');
  });
});

// Les labels de consentement sont inline dans les .astro (ternaires par locale) :
// on vérifie statiquement que chacune des 4 branches mentionne les ancres légales
// et que la checkbox termsAccepted est bien câblée (pattern readFileSync, cf.
// tests/unit/editor-dom-safety.test.ts).
const applySrc = readFileSync(resolve(process.cwd(), 'src/pages/[lang]/apply/[trip].astro'), 'utf8');
const checkoutSrc = readFileSync(resolve(process.cwd(), 'src/pages/[lang]/checkout/[session].astro'), 'utf8');

describe('booking consent i18n — sources des pages apply/checkout', () => {
  it('apply : les 4 branches de locale du label mentionnent les 2 liens légaux', () => {
    expect(applySrc).toContain('resolveLegalLinks(locale)');
    expect(applySrc).toContain('name="termsAccepted"');
    // Une occurrence par branche de locale (fr, es, ar, en) du ternaire termsLabel.
    expect(applySrc.match(/legalLinks\.terms/g)).toHaveLength(4);
    expect(applySrc.match(/legalLinks\.insurance/g)).toHaveLength(4);
    // Le script client exige la case cochée avant l'appel d'action.
    expect(applySrc).toContain('data.get("termsAccepted") !== "on"');
    expect(applySrc).toContain('termsAccepted: true as const');
  });

  it('checkout : les 4 branches de locale mentionnent les conditions, termsAccepted envoyé', () => {
    expect(checkoutSrc).toContain('resolveLegalLinks(locale)');
    expect(checkoutSrc.match(/legalLinks\.terms/g)).toHaveLength(4);
    expect(checkoutSrc).toContain('data.get("terms") !== "on"');
    expect(checkoutSrc).toContain('termsAccepted: true as const');
  });
});
