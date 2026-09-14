import { describe, expect, it } from 'vitest';
import { voyageTemplate } from '@/smtp/templates/voyage';
import { VOYAGE_EMAIL_TEMPLATES, type VoyageEmailTemplate } from '@database/schemas/email-voyage.schema';
import type { Locale } from '@/i18n/config';

const LOCALES: Locale[] = ['fr', 'en', 'es', 'ar'];
const VARS = { name: 'Test', trip: 'Trip', number: 'ATL-2027-ABC123', dates: '1 – 8 June 2027', amount: '€100', date: '1 May 2027' };

describe('voyage templates (TODO §14.1 — 12 × 4 langues)', () => {
  it.each(VOYAGE_EMAIL_TEMPLATES)('renders %s in all locales without leftover vars', (key: VoyageEmailTemplate) => {
    for (const locale of LOCALES) {
      const { subject, html, text } = voyageTemplate(key, locale, VARS, 'https://example.com/x');
      expect(subject.length).toBeGreaterThan(5);
      expect(subject).not.toMatch(/\{[a-z]+\}/);
      expect(text).not.toMatch(/\{[a-z]+\}/);
      expect(html).toContain(locale === 'ar' ? 'dir="rtl"' : 'dir="ltr"');
      expect(html).toContain('ATLASELLE');
    }
  });
});
