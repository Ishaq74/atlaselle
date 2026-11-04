# Parcours d'inscription, liste d'attente et calendrier de paiement

Référence métier du parcours voyage automatisé. Le code fait foi ; ce document décrit les règles et les points d'entrée.

## Responsabilités

| Notion | Rôle | Module |
| --- | --- | --- |
| Candidature (`applications`) | Demande initiale, décisions jamais écrasées | `modules/applications` |
| Liste d'attente (`waitlist_entries`) | Rang FIFO (`joinedAt`, `id`), proposition de place | `applications/domain/waitlist-service.ts` |
| Hold (`seat_holds`) | Place retenue temporairement (compte dans la capacité) | `availability/domain/availability-service.ts` |
| Réservation (`reservations`) | Suivi de la participation et du solde | `reservations/domain/reservation-service.ts` |
| Paiement (`payments`) | Cycle de vie financier, preuve = webhook vérifié | `payments/domain/payment-service.ts` |

Aucun statut n'a été ajouté : `waitlist_entries.status` = `waiting | offered | promoted | expired | removed`.

## Inscription (`submitApplication`)

1. Voyage non publié, départ fermé/annulé ou `bookingDeadline` dépassée → refus.
2. Place libre **et** aucun candidat en attente → approbation automatique, checkout, réservation `awaiting_payment`, hold, lien de paiement par email (`checkout.started`).
3. Départ complet, statut `waitlist`, ou candidats déjà en attente → candidature enregistrée + entrée de liste d'attente (`waitlist.joined`). Aucune réservation, aucun acompte.
   - Si une place est libre et la file non vide, elle est proposée immédiatement au premier de la file, sans attendre le cron.
   - **FIFO atomique** : `holdSeatsInTransaction` (sous verrou du départ) compte chaque candidat éligible en attente comme une place réservée. Un candidat déjà approuvé avec un lien checkout ouvert, une nouvelle inscription ou un paiement tardif ne peuvent donc jamais prendre une place libérée devant la file, même avant la promotion. Seule une proposition de liste d'attente (`allowWaitlist`) passe devant.
4. La validation manuelle (`reviewApplication`) reste disponible ; elle retire l'entrée de liste d'attente.

## Liste d'attente

- Ordre : `joinedAt` puis `id` (déterministe). Les candidatures non `submitted`/`approved` sont ignorées et retirées.
- Déclencheurs de `promoteWaitlist(departureId)` : annulation effective d'une réservation, offre expirée, tentative de paiement abandonnée, cron `promoteWaitingApplicants` (filet de sécurité : hold expiré, départ rouvert).
- `promoteWaitlist` verrouille le départ (`FOR UPDATE`), expire les offres échues, puis propose **autant de places que de places réellement libres** : hold + checkout + email `waitlist.offered`. Une candidature par entrée (`waitlist_application_uidx`).
- Durée de l'offre : `departures.waitlist_offer_ttl_hours` (défaut **48 h**, 1–720, modifiable dans l'admin du départ). Hold, checkout et entrée expirent ensemble.
- Offre expirée (`expireWaitlistOffers`) : entrée `expired`, hold libéré, checkout neutralisé, email `waitlist_offer_expired`, place proposée au suivant. Le candidat peut se réinscrire.
- Pas de promotion après `bookingDeadline` ni sur un départ non réservable.

## Durées (cohérence checkout / hold)

| Élément | Durée |
| --- | --- |
| Lien checkout candidature classique | 7 jours (aucune place garantie tant que le paiement n'est pas initié) |
| Tentative de paiement (session provider) | 35 min + 5 min de marge = 40 min (`PAYMENT_ATTEMPT_TTL_MINUTES`) |
| Hold d'une candidature classique | 30 min, étendu à 40 min dès l'initiation du paiement ; checkout aligné |
| Offre de liste d'attente | 48 h (réglable) ; la tentative de paiement ne raccourcit **jamais** le hold ni le lien |

## Tentative abandonnée / expirée (`expireStalePaymentAttempts`, webhook d'expiration)

Une réservation `pending`/`awaiting_payment` sans paiement après 40 min est annulée (idempotent, verrou réservation + départ) :

- paiement en attente → `failed` ;
- offre de liste d'attente encore valide : le hold est conservé, le lien est rouvert, le candidat peut réessayer ;
- offre échue : offre expirée, place libérée ;
- candidature classique : hold libéré, nouveau lien (7 j) et email `application.approved` si la candidature est toujours approuvée ;
- puis promotion de la liste d'attente.

**Paiement tardif** (webhook après annulation) : jamais confirmé, remboursé automatiquement (`late-refund`), réservation → `refunded`.

## Confirmation de l'acompte

`processProviderSuccess` : webhook vérifié, idempotent, montant/devise re-vérifiés, verrou réservation + départ. Hold converti, réservation `confirmed` (solde restant) ou `completed`, entrée de liste d'attente `promoted`, événements `payment.received` + `booking.confirmed` (outbox). Une réservation confirmée avec solde dû reste `confirmed` ; elle passe `balance_due` seulement à l'échéance (`markBalanceDue`).

## Solde et rappels (`sendBalanceReminders`, cron)

- Date limite finale = **départ − 2 mois** (`departures.balanceDueDate` si renseignée) ; ramenée à l'instant de la réservation si déjà dépassée.
- Calendrier stable depuis `confirmedAt` (jamais depuis l'exécution du worker) :
  1. **J+2** (`balance_reminder`) si le solde reste dû ;
  2. un rappel **par mois calendaire** (fin de mois ramenée au dernier jour) tant que l'échéance n'est pas atteinte ;
  3. **dernier rappel à J-7 de l'échéance** (`balance_final_reminder`) ; il absorbe un rappel mensuel qui tomberait à moins de 7 jours.
- Réservation tardive (échéance ≤ confirmation) : solde exigible immédiatement (`balance_due` au prochain cron), J+2 puis rappels mensuels jusqu'au départ, pas de dernier rappel rétroactif ; l'email affiche la date de départ.
- Un rappel manqué n'est rattrapé que pendant 7 jours (`BALANCE_REMINDER_GRACE_DAYS`) : pas de rafale rétroactive.
- Aucun rappel si le solde est nul, la réservation annulée/remboursée ou le voyage parti. Idempotence : `dedupeKey = balance:<reservation>:<date planifiée>`.
- Lien : page `booking-confirmed` (bouton « payer le solde » → `initiateBalancePayment`).

## Cron `/api/cron/voyage`

Ordre : `expireStalePaymentAttempts` → `expireHolds` → `expireCheckoutSessions` → `expireApplications` → `expireWaitlistOffers` → `promoteWaitingApplicants` → `markBalanceDue` → file email → `sendBalanceReminders` → `sendTripReminders` → rétention. Chaque job est isolé (`errors`).

Planification (le dépôt fournit l'ordonnanceur) :
- production : workflow [`.github/workflows/voyage-cron.yml`](../.github/workflows/voyage-cron.yml), toutes les 5 minutes ; secrets `APP_URL` et `CRON_SECRET` (sans eux, l'exécution est ignorée) ;
- local / docker : service `cron` de `docker-compose.yml` (boucle `curl`, 300 s, `CRON_SECRET` partagé avec `app`).

La justesse ne dépend pas de la fréquence : les holds expirés ne comptent plus dans la capacité (comparaison d'horodatage), le FIFO est garanti sous verrou à chaque réservation de place, et les déclencheurs directs (annulation, abandon de paiement, arrivée en liste d'attente) promeuvent immédiatement. Le cron ne règle que la latence des expirations et des emails.

## Migration

`0007_waitlist_offer_ttl.sql` : colonne `departures.waitlist_offer_ttl_hours` (défaut 48, CHECK 1–720) et suppression de l'index `waitlist_one_offer_per_departure_uidx` (plusieurs offres simultanées si plusieurs places). Colonne non nulle avec défaut : aucune donnée existante modifiée. Déploiement : `pnpm db:migrate`.

## Paiement du solde

La session provider d'un paiement de solde est portée par `payments.metadata.providerSessionId` : la page de retour `booking-confirmed?session_id=…` et le callback mock retrouvent la réservation par cette clé. Le formulaire « Payer le solde » inclut la case CGV exigée par l'action `payBalance`.

## Tests de bout en bout

`tests/e2e/voyage-waitlist.spec.ts` (navigateur réel, provider mock, cron appelé en HTTP) : inscription → acompte → confirmation → rappel J+2 → solde payé ; complet → liste d'attente → annulation → proposition → acompte ; proposition expirée → candidat suivant.

## Limites connues / décisions à confirmer

- Les réservations tardives affichent la date de départ comme « date limite » dans les rappels (le solde est exigible immédiatement).
- Les candidats dont l'offre a expiré ne sont pas remis en file (décision produit).

