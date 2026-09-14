---
name: atlaselle-voyage
description: Atlaselle travel domain (trips, pricing, booking, payments, outbox). Use when implementing ANY voyage feature — schemas, state machines, pricing, availability, applications, checkout, payments, emails voyage. Covers voyage, trip, départ, candidature, réservation, paiement, pricing, disponibilité.
metadata:
  author: atlaselle-repo
  version: "1.0"
---

# Atlaselle Voyage — coder le cœur métier sans erreur

Spec : `TODO.md §8–14`, `§21`, `§31`. Socle transverse : `atlaselle-actions`, `atlaselle-db`, `atlaselle-admin`, `atlaselle-email`, `atlaselle-security`, `atlaselle-testing`.

## 1. Modules (TODO §4.2 — créer sous `src/modules/<domain>/`)

`trips`, `departures`, `itinerary`, `pricing`, `availability`, `travelers`, `applications`, `reservations`, `payments`, `policies-voyage`, `outbox`, `email-voyage`. Chacun : `schema/`, `domain/`, `actions/`, `loaders/`, `validation/`, `i18n/`, `admin/`, `components/`, `permissions/`, `seo/`, `module.ts`.
Règles d'isolement : **zéro import DB croisé**, communication via interfaces + `outbox_events` uniquement. Pluggable/supprimable sans toucher à la base. `payments` générique réutilisable (ne connaît que `reservationId, amount, currency`). Ne pas toucher `src/modules/services/` (CMS vitrine isolé).

## 2. Données (TODO §8–11)

- `trips` (faits : countryCode ISO, currency ISO-4217, durées, groupe min/max, difficulté label + score 1-5, aéroports, `heroMediaId`, `status`) + `trip_translations` (slug traduit/locate, `localeVisible`, SEO — publication progressive par langue).
- `departures` : **prix 100 % administrables** (deposit/singleSupplement/tax/fee/discount en types fixed|percent|none + `pricingRules` JSON Zod), multi-devises V1 EUR/USD, `balanceDueDate`, `bookingDeadline`. Statut publication Trip ≠ statut dispo Departure.
- `itinerary_days` + traductions (`UNIQUE(tripId, dayNumber)`), `trip_highlights/inclusions/exclusions` + traductions, FAQ (`faqs`, `faq_translations`, `trip_faqs`).
- `travelers` : `userId` NULLABLE, email `CITEXT UNIQUE` normalisé, pas de fusion auto (`APPLICATION_EMAIL_CONFLICT`), `requireAccount` paramétrable (global + surcharge Trip).
- `applications` + `application_decisions` + `application_events` + `application_internal_notes` (jamais écraser un statut : chaque décision = un enregistrement).

## 3. Machines à états (transitions explicites uniquement)

- Trip : `draft → review → approved → published ⇄ unpublished → archived → restored` (`publishTrip()`, `unpublishTrip()`, `archiveTrip()`, `restoreTrip()` — jamais `updateTrip({status})`).
- Departure : `draft → open ⇄ limited/waitlist → closed → completed` (+ `cancelled`).
- Application : `draft → submitted → under_review ⇄ contact_required → approved | declined` (+ `withdrawn`, `expired` : 30 j sans décision, `bookingDeadline` sauf dérogation auditée).
- Reservation : `pending → awaiting_payment → confirmed ⇄ balance_due → completed | cancelled | refunded` (prix immuable : snapshot).
- Payment : `created → pending → authorized → paid | failed | cancelled | refunded | partially_refunded`.
- SeatHold : `active | expired | released | converted`.

## 4. Prix, dispo, tunnel (TODO §10–13)

- `PricingService` : entrée (departure, traveler, chambre, devise) → base/supplement/discount/tax/fee/total/deposit/solde, **centimes**, recalculé serveur au checkout ET au webhook.
- `AvailabilityService` : `getAvailability/holdSeats/releaseSeats/confirmSeats`, `confirmedSeats + heldSeats ≤ capacityMax`, transaction `SELECT … FOR UPDATE`.
- Tunnel : approbation → checkout (lien signé, TTL 7 j) → snapshot prix → hold → session paiement → provider → webhook → confirmation → hold converti → email. Solde = total − payé. `cancelReservation()` : politique + inventaire + notifications + audit.
- Paiement = module générique + adaptateur **Stripe** (pas `better-auth-stripe`). Idempotence partout (voir `atlaselle-actions` §4).

## 5. Ordre imposé (TODO §31)

Types domaine → Trip → Departure → Itinerary → loaders/pages → admin Trip → Application/Pricing/Availability → checkout → paiement → réservation → email → outbox/jobs → analytics. **Aucun paiement avant Trip/Departure/Pricing/Availability/Application stabilisés.** Migrations `0010 → 0015`, seeds `41 → 46` (3 voyages : Afrique du Sud déc 2026, Sicile+Malte juin 2027, Andalousie+Maroc mars 2027 — pas de prix journaliers).

## 6. Checklist par étape

Schémas + contraintes → services + tests unitaires (transitions, pricing, concurrence) → actions idempotentes → loaders + pages 4 langues → admin + permissions → intégration (webhook ×2 = 1 paiement) → E2E 4 langues + RTL → QA prod (TODO §34).
