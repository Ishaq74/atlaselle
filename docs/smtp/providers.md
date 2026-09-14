# Providers SMTP

Le module SMTP supporte 3 providers interchangeables via `SMTP_PROVIDER` dans `.env`.

## Architecture

```md
src/smtp/
├── types.ts              # Types partagés (SmtpProvider, EmailPayload, EmailFrom)
├── env.ts                # Config env — IIFE validation, getters typés
├── send.ts               # sendEmail() — point d'entrée unifié
├── providers/
│   ├── nodemailer.ts     # SMTP générique (Nodemailer)
│   ├── brevo.ts          # API Brevo v3 (fetch, pas de SDK)
│   └── resend.ts         # SDK Resend
├── templates/
│   ├── layout.ts         # Layout HTML partagé (wrapper responsive)
│   ├── i18n.ts           # Traductions des templates (4 locales)
│   ├── verify-email.ts   # Vérification email (inscription)
│   ├── reset-password.ts # Réinitialisation mot de passe
│   ├── delete-account.ts # Confirmation suppression de compte (RGPD)
│   ├── contact-form.ts   # Notification admin — formulaire de contact
│   └── blog-newsletter.ts # Newsletter blog (confirm + unsubscribe)
│   # Pas de organization-invitation.ts (supprimé avec les pages org — ne pas référencer)
└── commands/
    ├── _utils.ts         # Couleurs ANSI, logSmtpTarget()
    ├── smtp.check.ts     # Commande pnpm smtp:check
    └── logs.rotate.ts    # Rotation logs/*.jsonl (LOGS_RETENTION_DAYS, défaut 30 j)
```

## NODEMAILER (SMTP générique)

Transport SMTP standard. Compatible avec tout serveur SMTP : IONOS, OVH, Gmail, Infomaniak, etc.

### Configuration `.env` NODEMAILER

```env
SMTP_PROVIDER=NODEMAILER
SMTP_HOST=smtp.ionos.fr
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=contact@mondomaine.fr
SMTP_PASS=mon_mot_de_passe
```

### Détails techniques NODEMAILER

- **Singleton** : le transporter est créé une seule fois (lazy)
- **Auth optionnelle** : si `SMTP_USER` est absent, aucune auth n'est envoyée (mode relais)
- **STARTTLS** : port 587 + `secure=false` → upgrade TLS automatique (comportement Nodemailer natif)
- **TLS directe** : port 465 + `secure=true` → chiffrement dès la connexion
- **Timeouts** : `connectionTimeout: 10_000` + `socketTimeout: 10_000`
- **safeName** : nom expéditeur sanitisé par regex (fallback `'Atlaselle'`)
- **verify()** : appelle `transporter.verify()` — effectue le handshake SMTP sans envoyer

### Référence NODEMAILER

- <https://nodemailer.com/usage/>

## BREVO (API v3)

Appels HTTP directs à l'API Brevo — pas de SDK, uniquement `fetch`.

### Configuration `.env` BREVO

```env
SMTP_PROVIDER=BREVO
BREVO_API_KEY=xkeysib-votre-cle-api
```

### Détails techniques BREVO

- **Envoi** : `POST https://api.brevo.com/v3/smtp/email`
  - Body : `{ sender, to, subject, htmlContent, textContent }`
  - Header : `api-key: <BREVO_API_KEY>`
  - Retourne `Promise<void>` (pas de messageId — brevo.ts:6-41)
  - Timeout 10 s via `AbortController`, `safeName` sanitisé par regex
- **verify()** : `GET https://api.brevo.com/v3/account` — valide la clé API (timeout 10 s)

### Prérequis BREVO

Le sender (`SMTP_FROM_EMAIL`) doit être vérifié dans le dashboard Brevo :
<https://app.brevo.com/senders>

Sans ça, l'API accepte l'appel (200 OK) mais l'email est **silencieusement ignoré**.

### Référence BREVO

- <https://developers.brevo.com/reference/sendtransacemail>

## RESEND (SDK)

Utilise le SDK officiel `resend` (package npm).

### Configuration `.env` RESEND

```env
SMTP_PROVIDER=RESEND
RESEND_API_KEY=re_votre_cle_api
```

### Détails techniques RESEND

- **Envoi** : `resend.emails.send({ from, to, subject, html, text })`
  - Retourne `{ data, error }` — pas de `try/catch`, on vérifie `error` directement
  - `from` au format `"Nom <email@domaine.com>"`
- **verify()** : `GET https://api.resend.com/domains` via fetch
  - Les clés **send-only** (restreintes) retournent 401 avec `restricted_api_key` → c'est considéré comme valide
  - Seule une clé réellement invalide provoque une erreur

### Prérequis RESEND

Le domaine du sender doit être vérifié dans le dashboard Resend :
<https://resend.com/domains>

### Référence

- <https://resend.com/docs/send-with-nodejs>

## Utilisation dans le code

```ts
import { sendEmail } from '@smtp/send';

await sendEmail({
  to: 'dest@example.com',
  subject: 'Mon sujet',
  html: '<p>Contenu HTML</p>',
  text: 'Contenu texte',
});
```

Le provider est automatiquement sélectionné via `SMTP_PROVIDER`. L'expéditeur est lu depuis `SMTP_FROM_EMAIL` / `SMTP_FROM_NAME`.

## Templates email

Tous les templates sont dans `src/smtp/templates/` et utilisent un layout HTML responsive partagé (`layout.ts`). Chaque template est une fonction qui retourne `{ subject, html, text }` et accepte une `locale` pour l'internationalisation (traductions dans `i18n.ts`).

| Template | Usage | Déclencheur |
| :-- | :-- | :-- |
| `verify-email` | Lien de vérification email après inscription | better-auth (automatique) |
| `reset-password` | Lien de réinitialisation mot de passe | better-auth (automatique) |
| `delete-account` | Confirmation de suppression de compte (RGPD) | Action utilisateur |
| `contact-form` | Notification admin d'un message de contact | `POST /api/contact` |
| `blog-newsletter` | Confirmation + désinscription newsletter blog | Souscription newsletter |

Soit 5 fichiers de templates (avec `layout.ts` et `i18n.ts` utilitaires). Vérifié `src/smtp/templates/` 2026-09-14.
