---
name: atlaselle-email
description: Atlaselle SMTP, templates, dead-letter, voyage email program. Use when adding emails, templates, notifications, or touching SMTP, providers, outbox, jobs. Covers email, template, notification, SMTP, Brevo, Resend.
metadata:
  author: atlaselle-repo
  version: "1.0"
---

# Atlaselle Email — SMTP + templates + file voyage

## 1. Existant (`src/smtp/`, docs `docs/smtp/`)

- Providers interchangeables via `SMTP_PROVIDER` : Nodemailer, Brevo (fetch, pas de SDK), Resend (SDK). Entrée unique : `sendEmail()` (`src/smtp/send.ts`). Config validée (`src/smtp/env.ts`).
- Templates (`src/smtp/templates/`) : `verify-email`, `reset-password`, `delete-account` (RGPD), `contact-form`, `blog-newsletter` + `layout.ts` (wrapper responsive) + `i18n.ts` (4 locales). **Pas de `organization-invitation.ts`** (supprimé — ne pas référencer).
- Dead-letter : `logs/email-dead-letter-*.jsonl` à la **racine** (pas `src/smtp/logs/`). Rotation : `pnpm logs:rotate`. Diagnostic : `pnpm smtp:check`.
- Chaque template = fonction retournant `{ subject, html, text }`, `locale` en param, choix selon `traveler.locale` avec repli contrôlé.

## 2. Programme voyage (à créer, TODO §14)

Tables : `email_templates` / `email_deliveries` / `email_events` (états `queued, sending, sent, failed, retrying, dead_letter`). 11 templates × 4 langues, versionnés : `application_received`, `application_approved`, `application_contact_required`, `application_declined`, `checkout_started`, `payment_received`, `booking_confirmed`, `balance_due`, `balance_reminder`, `pre_trip_preparation`, `pre_trip_reminder`, `post_trip_followup`.
Jobs : `processEmailQueue`, `processEmailRetries` (+ `expireSeatHolds`, `expireCheckoutSessions`, `sendBalanceReminders`, `sendPreTripReminders` — pattern `src/pages/api/cron/publish.ts` + `pnpm db:cleanup-audit` à étendre).
Canal V1 = email uniquement (`NotificationService`, extension SMS/WhatsApp future). Outbox pattern : voir `atlaselle-voyage`.

## 3. Modes dégradés

Email indisponible → réservation confirmée quand même, email en file, admin alertée (pattern dead-letter existant). Paiement indisponible → checkout bloqué proprement, candidature conservée.

## 4. Anti-patterns

Template sans version texte · locale codée en dur · secret provider en log · envoi sans file pour le transactionnel voyage · PII sensible dans le sujet.

## 5. Checklist

`pnpm smtp:check`, tests `send-email`, E2E du déclencheur, QA des 4 locales, dead-letter vérifiée, variables `SMTP_*` documentées (jamais commitées).
