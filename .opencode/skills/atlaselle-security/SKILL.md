---
name: atlaselle-security
description: Atlaselle security (headers, CSP, rate-limit, sanitize, secrets, RGPD). Use when adding endpoints, uploads, user content, or touching security, CSP, rate limiting, sanitization, privacy. Covers sécurité, CSP, rate-limit, sanitisation, RGPD, secret.
metadata:
  author: atlaselle-repo
  version: "1.0"
---

# Atlaselle Security — en-têtes, validation, données

Docs : `docs/security.md`, `docs/rate-limit.md`, `docs/middleware.md`, `docs/actions.md`.

## 1. En-têtes (`astro.config.mjs` + `src/middleware.ts`)

`security.checkOrigin: true` (CSRF), `security.csp` (allowlist Stripe.js à ajouter avec payments). Middleware : `X-Content-Type-Options`, `X-Frame-Options DENY`, `Referrer-Policy`, `Permissions-Policy`, HSTS, COOP/CORP/COEP, SVG en `Content-Disposition: attachment`. `requestId` manquant (à créer, TODO §18.1/§20.4).

## 2. Rate-limit + validation (`src/lib/rate-limit.ts`, in-memory)

Limiter : contact, newsletter, candidature, login admin, reset password, initiation paiement. Upload : 10 req/60 s par IP. Toute entrée publique = schéma Zod (`z.flattenError` → `fieldErrors`), tout HTML utilisateur = `sanitize()` (`src/lib/sanitize.ts`, allowlist DOMPurify — tests `sanitize`, `section-content-xss`).
À renforcer : neutralisation Unicode bidi (spoofing) dès contenu libre (TODO §18.3).

## 3. Secrets et RGPD

Aucun secret en Git (`.env.example` fait foi). `redactSensitive()` dans tous les logs structurés. Jamais de sensible (santé, régime, accessibilité, CB, tokens) dans analytics, logs, URLs, état client, erreurs, HTML public.
RGPD : minimisation, export (`src/pages/api/export-data.ts`, `audit-export.ts` — patterns à étendre aux voyageuses), suppression (distinguer compte vs historique transactions), durées configurables (jamais inventées). Préférences personnelles = privées, restreintes, auditées. Suppression douce préférée (`deletedAt`).

## 4. Anti-patterns

Endpoint public sans rate-limit · HTML non sanitisé · montant client trusté · PII en URL/log · secret commité · `any` sans justification (ESLint flat, 2 espaces).

## 5. Checklist

`pnpm lint && pnpm check`, tests XSS/rate-limit, audit des accès sensibles, `.env` hors Git, mentions légales validées par langue avant prod (checklist TODO §34).
