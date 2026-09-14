# Email Flows — Verification & Password Reset

Overview of the transactional email system wired into better-auth for Atlaselle.

---

## Architecture

```md
src/
├─ lib/auth.ts                       # better-auth instance — callbacks here
├─ smtp/
│  ├─ env.ts                         # SMTP_PROVIDER, SMTP_FROM_EMAIL, SMTP_FROM_NAME, credentials
│  ├─ types.ts                       # EmailPayload interface
│  ├─ send.ts                        # sendEmail() — unified entry point
│  ├─ providers/
│  │  ├─ brevo.ts                    # Brevo (Sendinblue) API v3
│  │  ├─ resend.ts                   # Resend SDK
│  │  └─ nodemailer.ts              # Generic SMTP via Nodemailer
│  └─ templates/
│     ├─ i18n.ts                     # Translation dictionaries (fr/en/es/ar, 6 groups)
│     ├─ layout.ts                   # Shared HTML layout (renderEmailHtml / renderEmailText)
│     ├─ verify-email.ts             # Email-verification template
│     ├─ reset-password.ts           # Password-reset template
│     ├─ delete-account.ts           # Account-deletion template
│     ├─ organization-invitation.ts  # Organization-invitation template
│     ├─ contact-form.ts             # Contact-form template (own strings, used by POST /api/contact)
│     └─ blog-newsletter.ts          # Newsletter template (confirm + unsubscribe)
```

---

## 1. Email Verification

### Flow

1. User signs up via `authClient.signUp.email()`.
2. better-auth fires the `emailVerification.sendVerificationEmail` callback with `{ user, url, token }`.
3. The callback:
   - Extracts the locale from the verification URL (`/{locale}/auth/{verify-email-slug}?token=…`, slug localized per locale).
   - Calls `verifyEmailTemplate({ locale, userName, verificationUrl })` to produce subject / html / text.
   - Sends via conditional dynamic `import("@smtp/send")` skipped when `NODE_ENV === 'test'` (`isTest`); failures are logged to console and audited as `EMAIL_SEND_FAILED`.
4. User clicks the link → lands on `VerifyEmailPage.astro` at `/{locale}/auth/{verify-email-slug}?token=…` (en: `verify-email`, fr: `verifier-email`, es: `verificar-correo`).
5. The page calls `authClient.verifyEmail({ query: { token } })` on the client side. No auto-sign-in (`autoSignInAfterVerification: false`).

### Configuration in `auth.ts`

```ts
emailVerification: {
  sendOnSignUp: true,
  autoSignInAfterVerification: false,
  sendVerificationEmail: async ({ user, url }) => {
    const locale = extractLocale(url);
    const { subject, html, text } = verifyEmailTemplate({
      locale,
      userName: user.name,
      verificationUrl: url,
    });
    if (!isTest) import("@smtp/send").then(m => m.sendEmail({ to: user.email, subject, html, text })).catch(err => {
      console.error('[SMTP] Verification email failed:', err);
      void logAuditEvent({ action: 'EMAIL_SEND_FAILED', resource: 'email', metadata: { template: 'verify-email', to: user.email, error: String(err) } });
    });
  },
},
```

### Resend verification email

From the client, call:

```ts
await authClient.sendVerificationEmail({
  email: 'user@example.com',
  callbackURL: `/${locale}/auth/${verifyEmailSlug}`,
});
```

---

## 2. Password Reset (Forgot Password)

### Flow Password Reset

1. User navigates to `ForgotPasswordPage.astro` (`/{locale}/auth/{forgot-password-slug}`, en: `forgot-password`, fr: `mot-de-passe-oublie`).
2. User submits their email. The client calls:

   ```ts
   await authClient.requestPasswordReset({
     email,
     redirectTo: `/${locale}/auth/${resetPasswordSlug}`,
   });
   ```

3. better-auth fires `emailAndPassword.sendResetPassword` with `{ user, url, token }`.
4. The callback:
   - Extracts the locale from the reset URL.
   - Calls `resetPasswordTemplate({ locale, userName, resetUrl })`.
   - Sends via conditional dynamic `import("@smtp/send")` skipped when `NODE_ENV === 'test'` (`isTest`); failures are logged to console and audited as `EMAIL_SEND_FAILED`.
5. User clicks the link → lands on `ResetPasswordPage.astro` at `/{locale}/auth/{reset-password-slug}?token=…` (en: `reset-password`, fr: `reinitialiser-mot-de-passe`).
6. The page reads the `token` from the query string and calls:

   ```ts
   await authClient.resetPassword({ newPassword, token });
   ```

### Configuration in `auth.ts` Password Reset

```ts
emailAndPassword: {
  enabled: true,
  requireEmailVerification: true,
  sendResetPassword: async ({ user, url }) => {
    const locale = extractLocale(url);
    const { subject, html, text } = resetPasswordTemplate({
      locale,
      userName: user.name,
      resetUrl: url,
    });
    if (!isTest) import("@smtp/send").then(m => m.sendEmail({ to: user.email, subject, html, text })).catch(err => {
      console.error('[SMTP] Reset password email failed:', err);
      void logAuditEvent({ action: 'EMAIL_SEND_FAILED', resource: 'email', metadata: { template: 'reset-password', to: user.email, error: String(err) } });
    });
  },
},
```

---

## 3. Template System

### i18n (`templates/i18n.ts`)

A `translations` map keyed by locale (`fr | en | es | ar`) providing six groups of strings:

| Group                  | Purpose                                             |
| ---------------------- | --------------------------------------------------- |
| `layout`               | Fallback link text, footer                          |
| `verifyEmail`          | Subject, heading, body, button, footer note         |
| `resetPassword`        | Subject, heading, body, button, expiry, footer note |
| `deleteAccount`        | Subject, heading, body, button, warning, ignore     |
| `organizationInvitation` | Subject, heading, body (inviter/org/role), button, ignore |
| `blogNewsletter`       | Subject, heading, greeting, body, button, extra, unsubscribe strings |

Helper functions:

- `getEmailTranslations(locale)` — returns the full dictionary for a locale (falls back to `fr`).
- `interpolate(str, vars)` — replaces `{name}` placeholders.

### Shared layout (`templates/layout.ts`)

`renderEmailHtml(locale, layout, section)` produces a responsive HTML email with:

- **Violet/slate brand palette** — accent `#6d28d9`, slate grays.
- **Gradient accent bar** at the top of the card.
- **Logo block** — violet square "A" + "Atlaselle" wordmark.
- **CTA button** — Outlook VML fallback for rounded corners.
- **Fallback link box** — gray background, word-break URL.
- **Footer** — auto-sent notice.
- **RTL support** — `dir`, `text-align`, padding direction for Arabic.

`renderEmailText(section)` generates a plain-text fallback.

### Other templates

| Template | Trigger | Function |
| -------- | ------- | -------- |
| `delete-account.ts` | `user.deleteUser.sendDeleteAccountVerification` in `auth.ts` (skipped when `isTest`, failures audited as `EMAIL_SEND_FAILED`) | `deleteAccountTemplate({ locale, userName, deleteUrl })` |
| `organization-invitation.ts` | `organization.sendInvitationEmail` in `auth.ts` (skipped when `isTest`, failures audited as `EMAIL_SEND_FAILED`) | `organizationInvitationTemplate({ locale, inviterName, orgName, role, inviteUrl })` |
| `contact-form.ts` | `POST /api/contact` (own per-locale strings, urgent variant) | `contactFormTemplate({ locale, firstName, lastName, email, phone, reason, message, urgent, ipAddress })` |
| `blog-newsletter.ts` | Newsletter subscribe/unsubscribe flow | `blogNewsletterConfirmTemplate({ locale, userName, confirmUrl, unsubscribeUrl })` |

### Adding a new email template

1. Add strings to `EmailTranslations` in `i18n.ts` (interface + all 4 locales).
2. Create `templates/my-template.ts`:

```ts
import type { Locale } from '@i18n/config';
import { getEmailTranslations, interpolate } from './i18n';
import { renderEmailHtml, renderEmailText } from './layout';

export function myTemplate({ locale, ... }: Options) {
  const { layout, myTemplate: t } = getEmailTranslations(locale);
  const section = {
    heading: t.heading,
    greeting: interpolate(t.greeting, { name }),
    body: t.body,
    buttonText: t.button,
    buttonUrl: url,
    footnote: t.ignore,
  };
  return {
    subject: `${t.subject} — Atlaselle`,
    html: renderEmailHtml(locale, layout, section),
    text: renderEmailText(section),
  };
}
```

1. Wire it in `auth.ts` or wherever the email is triggered.

---

## 4. Locale extraction

The `extractLocale(url)` helper in `auth.ts` parses the pathname of the callback URL and reads the first segment. If it matches a known locale, it is used; otherwise `DEFAULT_LOCALE` (`en`, see `src/i18n/config.ts`) is returned.

This works because all auth pages follow the pattern `/{locale}/auth/{localized-slug}?token=…` (slugs translated per locale, see `src/i18n/{fr,en,es,ar}/auth.ts` → `routes`).

### Organization invitation URL

Built in `organization.sendInvitationEmail` (`auth.ts`):

```ts
const inviteUrl = `${baseUrl}/${inviterLocale}/auth/${inviterLocale === 'fr' ? 'organisations' : 'organizations'}?org=${encodeURIComponent(data.organization.slug)}&invitation=${encodeURIComponent(data.id)}`;
```

Pattern: `/{locale}/auth/{organisations|organizations}?org={slug}&invitation={id}` (`organisations` for `fr`, `organizations` otherwise). `BETTER_AUTH_URL` is required here — a missing or non-http(s) value throws.

---

## 5. SMTP Providers

The provider is selected by the `SMTP_PROVIDER` environment variable (normalized via `toUpperCase()`, default `NODEMAILER`):

| Value        | Provider                   | Required env vars                        |
| ------------ | -------------------------- | ---------------------------------------- |
| `BREVO`      | Brevo API v3 (fetch)       | `BREVO_API_KEY`                          |
| `RESEND`     | Resend SDK                 | `RESEND_API_KEY`                         |
| `NODEMAILER` | Generic SMTP (Nodemailer)  | `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` |

All providers share the `SMTP_FROM_EMAIL` and `SMTP_FROM_NAME` env vars for the sender address (defaults to `Atlaselle` if `SMTP_FROM_NAME` is not set).

---

## 6. Auth Pages Summary

Auth pages live under `/{locale}/auth/{localized-slug}` (single `[slug].astro` route, slugs translated per locale via `src/i18n/*/auth.ts` → `routes`). `defaultLocale` is `en` (`astro.config.mjs`, `prefixDefaultLocale: true`). Organization management has no dedicated `/{locale}/organizations/…` routes — it lives in the dashboard (the `organizations` slug redirects to the dashboard).

| Page                     | Route pattern                                    | Description                                    |
| ------------------------ | ------------------------------------------------ | ---------------------------------------------- |
| `SignUpPage`             | `/{locale}/auth/{sign-up-slug}` (en `sign-up`, fr `inscription`) | Registration form                |
| `SignInPage`             | `/{locale}/auth/{sign-in-slug}` (en `sign-in`, fr `connexion`) | Login form (includes "Forgot password?" link) |
| `ForgotPasswordPage`     | `/{locale}/auth/{forgot-password-slug}`          | Enter email to request reset                   |
| `ResetPasswordPage`      | `/{locale}/auth/{reset-password-slug}`           | Choose new password (requires `?token=`)        |
| `VerifyEmailPage`        | `/{locale}/auth/{verify-email-slug}`             | Token verification (no auto-sign-in)           |
| `DashboardPage`          | `/{locale}/auth/{dashboard-slug}`                | Authenticated user dashboard (incl. organizations) |
| `ProfilePage`            | `/{locale}/auth/{profile-slug}`                  | User profile                                   |
| `AdminPage` (tabs)       | `/{locale}/admin/{stats,users,organizations,audit,roles,site,navigation,pages,media,theme,blog/…,services/…}` | Admin panel |
