import { describe, expect, it } from 'vitest';
import { LOCALES } from '@i18n/config';
import { verifyEmailTemplate } from '@smtp/templates/verify-email';
import { resetPasswordTemplate } from '@smtp/templates/reset-password';
import { deleteAccountTemplate } from '@smtp/templates/delete-account';
import { contactFormTemplate } from '@smtp/templates/contact-form';
import { blogNewsletterConfirmTemplate, blogNewsletterUnsubscribeTemplate } from '@smtp/templates/blog-newsletter';

const URL = 'http://localhost:4321/x';

describe('core email templates — matrice ×4 locales', () => {
  for (const locale of LOCALES) {
    it(`verify-email [${locale}]`, () => {
      const out = verifyEmailTemplate({ locale, userName: 'Amina', verificationUrl: URL });
      expect(out.subject.length).toBeGreaterThan(0);
      expect(out.html).toContain(URL);
      expect(out.text.length).toBeGreaterThan(0);
      for (const part of [out.subject, out.html, out.text]) {
        expect(part).not.toMatch(/\{\w+\}/);
        expect(part).not.toContain('undefined');
      }
    });

    it(`reset-password [${locale}]`, () => {
      const out = resetPasswordTemplate({ locale, userName: 'Amina', resetUrl: URL });
      expect(out.subject.length).toBeGreaterThan(0);
      expect(out.html).toContain(URL);
      expect(out.text.length).toBeGreaterThan(0);
    });

    it(`delete-account [${locale}]`, () => {
      const out = deleteAccountTemplate({ locale, userName: 'Amina', deleteUrl: URL });
      expect(out.subject.length).toBeGreaterThan(0);
      expect(out.html).toContain(URL);
    });

    it(`contact-form [${locale}]`, () => {
      const out = contactFormTemplate({
        locale, firstName: 'Amina', lastName: 'B.', email: 'a@test.com',
        phone: '+336', reason: 'Voyage', message: 'Bonjour', urgent: false, ipAddress: null,
      });
      expect(out.subject.length).toBeGreaterThan(0);
      expect(out.html).toContain('Bonjour');
      expect(out.text).toContain('Amina');
    });

    it(`blog-newsletter confirm + unsubscribe [${locale}]`, () => {
      const confirm = blogNewsletterConfirmTemplate({ locale, userName: 'Amina', confirmUrl: URL, unsubscribeUrl: URL });
      expect(confirm.html).toContain(URL);
      expect(confirm.subject.length).toBeGreaterThan(0);
      const unsub = blogNewsletterUnsubscribeTemplate({ locale, userName: 'Amina' });
      expect(unsub.subject.length).toBeGreaterThan(0);
      expect(unsub.text.length).toBeGreaterThan(0);
    });
  }
});
