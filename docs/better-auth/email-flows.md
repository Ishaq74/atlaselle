# Email Flows — Verification & Password Reset

Overview of the transactional email system wired into better-auth for Atomic.

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
│     ├─ i18n.ts                     # Translation dictionaries (fr/en/es/ar)
│     ├─ layout.ts                   # Shared HTML layout (renderEmailHtml / renderEmailText)
│     ├─ verify-email.ts             # Email-verification template
│     └─ reset-password.ts           # Password-reset template
```

---

## 1. Email Verification

### Flow

1. User signs up via `authClient.signUp.email()`.
2. better-auth fires the `emailVerification.sendVerificationEmail` callback with `{ user, url, token }`.
3. The callback:
   - Extracts the locale from the verification URL (`/{locale}/auth/verify-email?token=…`).
   - Calls `verifyEmailTemplate({ locale, userName, verificationUrl })` to produce subject / html / text.
   - Fires `void sendEmail(…)` (non-blocking to avoid timing attacks).
4. User clicks the link → lands on `VerifyEmailPage.astro` at `/{locale}/auth/verify-email?token=…`.
5. The page calls `authClient.verifyEmail({ query: { token } })` on the client side.

### Configuration in `auth.ts`

```ts
emailVerification: {
  sendOnSignUp: true,
  autoSignInAfterVerification: true,
  sendVerificationEmail: async ({ user, url }) => {
    const locale = extractLocale(url);
    const { subject, html, text } = verifyEmailTemplate({
      locale,
      userName: user.name,
      verificationUrl: url,
    });
    void sendEmail({ to: user.email, subject, html, text });
  },
},
```

### Resend verification email

From the client, call:

```ts
await authClient.sendVerificationEmail({
  email: 'user@example.com',
  callbackURL: `/${locale}/auth/verify-email`,
});
```

---

## 2. Password Reset (Forgot Password)

### Flow Password Reset

1. User navigates to `ForgotPasswordPage.astro` (`/{locale}/auth/forgot-password`).
2. User submits their email. The client calls:

   ```ts
   await authClient.requestPasswordReset({
     email,
     redirectTo: `/${locale}/auth/reset-password`,
   });
   ```

3. better-auth fires `emailAndPassword.sendResetPassword` with `{ user, url, token }`.
4. The callback:
   - Extracts the locale from the reset URL.
   - Calls `resetPasswordTemplate({ locale, userName, resetUrl })`.
   - Fires `void sendEmail(…)` (non-blocking).
5. User clicks the link → lands on `ResetPasswordPage.astro` at `/{locale}/auth/reset-password?token=…`.
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
    void sendEmail({ to: user.email, subject, html, text });
  },
},
```

---

## 3. Template System

### i18n (`templates/i18n.ts`)

A `translations` map keyed by locale (`fr | en | es | ar`) providing three groups of strings:

| Group           | Purpose                                             |
| --------------- | --------------------------------------------------- |
| `layout`        | Fallback link text, footer                          |
| `verifyEmail`   | Subject, heading, body, button, footer note         |
| `resetPassword` | Subject, heading, body, button, expiry, footer note |

Helper functions:

- `getEmailTranslations(locale)` — returns the full dictionary for a locale (falls back to `fr`).
- `interpolate(str, vars)` — replaces `{name}` placeholders.

### Shared layout (`templates/layout.ts`)

`renderEmailHtml(locale, layout, section)` produces a responsive HTML email with:

- **Violet/slate brand palette** — accent `#6d28d9`, slate grays.
- **Gradient accent bar** at the top of the card.
- **Logo block** — violet square "A" + "Atomic" wordmark.
- **CTA button** — Outlook VML fallback for rounded corners.
- **Fallback link box** — gray background, word-break URL.
- **Footer** — auto-sent notice.
- **RTL support** — `dir`, `text-align`, padding direction for Arabic.

`renderEmailText(section)` generates a plain-text fallback.

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
    subject: `${t.subject} — Atomic`,
    html: renderEmailHtml(locale, layout, section),
    text: renderEmailText(section),
  };
}
```

1. Wire it in `auth.ts` or wherever the email is triggered.

---

## 4. Locale extraction

The `extractLocale(url)` helper in `auth.ts` parses the pathname of the callback URL and reads the first segment. If it matches a known locale, it is used; otherwise `DEFAULT_LOCALE` (`fr`) is returned.

This works because all auth pages follow the pattern `/{locale}/auth/{page}?token=…`.

---

## 5. SMTP Providers

The provider is selected by the `SMTP_PROVIDER` environment variable:

| Value        | Provider                   | Required env vars                        |
| ------------ | -------------------------- | ---------------------------------------- |
| `brevo`      | Brevo API v3 (fetch)       | `BREVO_API_KEY`                          |
| `resend`     | Resend SDK                 | `RESEND_API_KEY`                         |
| `nodemailer` | Generic SMTP (Nodemailer)  | `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` |

All providers share the `SMTP_FROM_EMAIL` and `SMTP_FROM_NAME` env vars for the sender address (defaults to `Atomic` if `SMTP_FROM_NAME` is not set).

---

## 6. Auth Pages Summary

| Page                     | Route                              | Description                                    |
| ------------------------ | ---------------------------------- | ---------------------------------------------- |
| `SignUpPage`             | `/{locale}/auth/sign-up`           | Registration form                              |
| `SignInPage`             | `/{locale}/auth/sign-in`           | Login form (includes "Forgot password?" link)   |
| `ForgotPasswordPage`     | `/{locale}/auth/forgot-password`   | Enter email to request reset                   |
| `ResetPasswordPage`      | `/{locale}/auth/reset-password`    | Choose new password (requires `?token=`)        |
| `VerifyEmailPage`        | `/{locale}/auth/verify-email`      | Token verification + auto-sign-in              |
| `DashboardPage`          | `/{locale}/auth/dashboard`         | Authenticated user dashboard                   |
| `AdminStatsPage`         | `/{locale}/admin/stats`            | Admin panel — statistics                       |
| `AdminUsersPage`         | `/{locale}/admin/users`            | Admin panel — user management                  |
| `AdminOrgsPage`          | `/{locale}/admin/organizations`    | Admin panel — organizations                    |
| `AdminAuditPage`         | `/{locale}/admin/audit`            | Admin panel — audit log                        |
| `OrgMembersPage`         | `/{locale}/organizations/{slug}/members`  | Organization members                    |
| `OrgSettingsPage`        | `/{locale}/organizations/{slug}/settings` | Organization settings                   |
