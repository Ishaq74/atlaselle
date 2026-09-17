import { describe, expect, it } from 'vitest';
import { VOYAGE_EMAIL_TEMPLATES } from '@database/schemas/email-voyage.schema';
import { LOCALES, type Locale } from '@i18n/config';
import { voyageTemplate } from '@smtp/templates/voyage';

const VARS = {
  name: 'Amina',
  trip: 'Afrique du Sud',
  number: 'ATL-2027-ABCDEF',
  dates: '4–13 October 2027',
  amount: '€750',
  date: '6 July 2027',
  url: 'http://localhost:4321/en/checkout/x',
};

const FOOTNOTE: Record<Locale, string> = {
  fr: "ignorez cet e-mail",
  en: 'ignore this email',
  es: 'ignore este correo',
  ar: 'تجاهل',
};

describe('voyage email templates — matrice 12×4', () => {
  it('12 templates déclarés', () => {
    expect(VOYAGE_EMAIL_TEMPLATES).toHaveLength(12);
  });

  it('vars malveillantes neutralisées (pas de HTML injecté)', () => {
    const evil = {
      ...VARS,
      name: '<script>alert(1)</script>',
      trip: '<img src=x onerror=alert(2)>',
    };
    for (const key of VOYAGE_EMAIL_TEMPLATES) {
      const out = voyageTemplate(key, 'fr', evil, VARS.url);
      expect(out.html).not.toContain('<script>alert(1)</script>');
      expect(out.html).not.toContain('<img src=x onerror=alert(2)>');
    }
  });

  for (const key of VOYAGE_EMAIL_TEMPLATES) {
    for (const locale of LOCALES) {
      it(`${key} [${locale}] rend sujet/html/texte complets et localisés`, () => {
        const out = voyageTemplate(key, locale, VARS, VARS.url);
        expect(out.subject.length).toBeGreaterThan(0);
        expect(out.html.length).toBeGreaterThan(100);
        expect(out.text.length).toBeGreaterThan(20);
        for (const part of [out.subject, out.html, out.text]) {
          expect(part).not.toMatch(/\{\w+\}/);
          expect(part).not.toContain('undefined');
        }
        // pied localisé présent → preuve que la locale a bien été prise en compte
        expect(out.html).toContain(FOOTNOTE[locale]);
      });
    }
  }
});
