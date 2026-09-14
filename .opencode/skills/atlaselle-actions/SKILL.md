---
name: atlaselle-actions
description: Atlaselle server actions, loaders, DTOs, error codes. Use when adding mutations, data fetching, validation, or touching actions, loaders, permissions checks, error handling. Covers action, loader, DTO, validation, erreur, contrat.
metadata:
  author: atlaselle-repo
  version: "1.0"
---

# Atlaselle Actions & Loaders — contrats typés

Patterns existants : `src/actions/{admin,blog,services}/`, `src/database/loaders/`, `src/modules/*/loaders/`, `src/modules/*/domain/`. Doc : `docs/actions.md`.

## 1. Contrats (TODO §23.3)

```ts
type LoaderResult<T> = { data: T; meta: { total?: number; page?: number; pageSize?: number } };
type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: { code: string; message: string; fieldErrors?: Record<string, string[]> } };
```

- Actions : validation Zod → auth → autorisation → portée → service → transaction → audit → `ActionResult`. Jamais de HTML, jamais de Drizzle direct dans une page (pages → actions/loaders → services).
- Loaders : schéma Zod des filtres, type déterministe, cache TTL (`src/database/cache.ts`, clés `trip:{id}`, `departure:{id}`, `trips:list`, `homepage:featured`, `faq:global`), invalidation en cascade après mutation.
- DTO explicites (`TripPageDTO`, `CheckoutDTO`, `ReservationDTO`, `AdminApplicationListDTO`…) — jamais une ligne Drizzle exposée. Notes internes (`*_internal_notes`) jamais sérialisées.

## 2. Frontière de sécurité (TODO §17.4)

Chaque action refait : authentification → autorisation → vérification de portée → validation. Guards : `src/lib/auth-guards.ts`. Un composant/une route n'est JAMAIS une frontière suffisante.

## 3. Codes d'erreur voyage (stables, i18n côté client)

`APPLICATION_CLOSED`, `APPLICATION_DEADLINE_PASSED`, `DEPARTURE_SOLD_OUT`, `CHECKOUT_EXPIRED`, `PAYMENT_FAILED`, `PAYMENT_AMOUNT_MISMATCH`, `RESERVATION_ALREADY_CONFIRMED`, `UNAUTHORIZED`, `FORBIDDEN`.
Convention repo : Astro `ActionError` n'accepte que des codes HTTP → `domainError(transport, code, message)` (`src/lib/voyage-errors.ts`) produit `[CODE] message`. Services : `codedError()` pur (`src/lib/voyage-codes.ts`, sans dépendance Astro — jamais d'import `astro:*` dans `domain/`).

## 4. Idempotence (paiement, webhook, checkout)

`createCheckout`, `processWebhook`, `confirmPayment`, `refundPayment` idempotents (clé d'idempotence, vérification montants serveur — jamais le montant client). Webhook : signature → événement → idempotence → réservation → montants → transaction → effets → réponse.

## 5. Anti-patterns

`updateTrip({ status })` générique (passer par les transitions explicites) · prix/capacité calculés côté client · montant navigateur trusté · statut écrasé sans enregistrement de décision · PII/sensible dans logs, URLs, erreurs, HTML.

## 6. Checklist

Tests unitaires (transitions, pricing, permissions) + intégration (candidature, approbation, webhook dupliqué = 1 paiement) + E2E ; `redactSensitive()` sur tout log ; audit écrit pour les mutations sensibles.
