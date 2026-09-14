---
name: atlaselle-observability
description: Atlaselle audit, analytics, logs, jobs, outbox. Use when adding audit trails, analytics events, background jobs, outbox events, or touching logs, monitoring, dead-letter. Covers audit, analytics, log, job, outbox, monitoring.
metadata:
  author: atlaselle-repo
  version: "1.0"
---

# Atlaselle Observability — audit, events, jobs (ne jamais confondre)

TODO §20. Quatre concepts distincts : **Audit** (trace immuable admin) ≠ **Analytics** (agrégé, jamais de PII sensible) ≠ **Événement de domaine** (`trip.published`, `payment.paid` — signal interne idempotent) ≠ **Notification** (alerte équipe, ex. `blog_notifications` comme pattern).

## 1. Audit (`src/lib/audit.ts`, table `audit_log`)

Toute action admin sensible écrit un audit (qui, quoi, quand, portée). Export : `src/pages/api/audit-export.ts`. Nettoyage : `pnpm db:cleanup-audit`. Erreurs typées, logs JSON structurés, `redactSensitive()` systématique (jamais CB, tokens, mots de passe, PII inutile).

## 2. Analytics (autorisés uniquement)

`page_view, trip_view, trip_filter, apply_start, apply_submit, checkout_start, payment_start, purchase, contact_submit, newsletter_signup`. Interdits : motivation, régime, médical/accessibilité, notes internes.

## 3. Outbox + jobs (voyage, à créer — TODO §14)

`outbox_events` (`eventType, aggregateType, aggregateId, payload, status, attempts, availableAt, processedAt`) + worker (verrouille, traite, réessaie, dead-letter après seuil).
Jobs : `expireSeatHolds`, `expireCheckoutSessions`, `sendBalanceReminders`, `sendPreTripReminders`, `processEmailQueue`, `processEmailRetries`, `processMedia`, `cleanupExpiredSessions`, `cleanupOldAuditEntries`, `refreshAggregates` (pattern `src/pages/api/cron/publish.ts`).

## 4. Manquants à créer

`requestId` (middleware → `Astro.locals` → logs/actions/services/emails/paiements, TODO §20.4). Monitoring/alerting/error-tracking + RPO/RTO + test de restauration réel avant prod (TODO §27/§34).

## 5. Anti-patterns

Événement métier sans idempotence · PII dans analytics · job sans dead-letter · log avec secret · audit contournable depuis l'UI.

## 6. Checklist

Audit écrit + exporté, events testés (webhook ×2 = 1 effet), jobs planifiés et supervisés, `logs/` rotatés (`pnpm logs:rotate`).
