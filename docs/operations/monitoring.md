# Suivi d'erreurs et supervision (Sentry)

> TODO §20 (observabilité) et §34 (« monitoring », « error tracking »).
> Code : `src/lib/monitoring/` (`index.ts` SDK, `scrub.ts` nettoyage) · script de vérification : `pnpm monitoring:check` · tests : `tests/unit/monitoring-scrub.test.ts`, `tests/unit/define-action-monitoring.test.ts`, `tests/integration/monitoring-sentry.test.ts`.

**Statut.** Le branchement est prêt et testé avec le vrai SDK. Il est **inactif tant que `SENTRY_DSN` n'est pas renseigné** : aucun code Sentry n'est chargé, rien n'est envoyé. La création du compte Sentry et les alertes (§4, §5) restent à faire à la mise en service.

---

## 1. Ce qui est surveillé

Côté **serveur uniquement** (`@sentry/node`). Seules les erreurs **inattendues** remontent : les refus normaux (droits, validation, limites de débit, codes métier voyage comme `DEPARTURE_SOLD_OUT`) sont ignorés, sinon chaque tentative d'un visiteur ouvrirait un incident.

| Étiquette `source` | Déclencheur | Niveau | Pourquoi |
| :-- | :-- | :-- | :-- |
| `request` | exception non gérée d'une page ou d'un endpoint (middleware) | error | page ou API cassée |
| `response` | réponse HTTP ≥ 500 sans exception (message fixe `HTTP 500 response`, regroupé par statut) | error | idem, sans exception |
| `session-check` | vérification de session en échec ou expirée (5 s) | error | **base de données indisponible** |
| `action` | exception dans un handler d'action (`defineAction`, y compris le repli sans JavaScript) | error | Astro masque l'exception derrière un `INTERNAL_SERVER_ERROR` générique : on la capte à la source |
| `form-fallback` | exception pendant un envoi natif de formulaire | error | idem |
| `cron` (`job:<nom>`) | un job du cron voyage échoue (isolé des autres) | error | holds non expirés, e-mails non envoyés… |
| `stripe-webhook` | traitement d'un webhook Stripe en échec, **y compris** codes métier (`PAYMENT_FAILED`, `PAYMENT_AMOUNT_MISMATCH`) | **fatal** | paiement encaissé mais non enregistré |
| `erasure-ledger` | effacement RGPD non inscrit au registre hors base | **fatal** | une restauration ressusciterait la personne |
| `auth` (`step:revoke-sessions`) | sessions non révoquées après un blocage ou un changement de rôle | **fatal** | un compte banni ou rétrogradé reste connecté |
| `audit` | échec d'écriture du journal d'audit | error | trace de sécurité perdue |
| `db-pool` | erreur inattendue du pool PostgreSQL | error | connexions instables |
| `smtp` | e-mail déplacé en dead-letter (sans adresse ni objet) | error | message définitivement perdu |
| `upload`, `contact-form` | échec inattendu d'un envoi de fichier ou du formulaire de contact | error | |

**Moniteur de cron** (Sentry Crons, slug `voyage-cron`, `*/5 * * * *`) : chaque exécution de `POST /api/cron/voyage` envoie un début puis un `ok` ou un `error` (si au moins un job a échoué). Sentry alerte si l'exécution **échoue** ou **n'arrive pas** (cron GitHub Actions arrêté, secret `CRON_SECRET` périmé, application à l'arrêt). La planification est dans `src/pages/api/cron/voyage.ts` (`CRON_MONITOR`) : la garder identique à `.github/workflows/voyage-cron.yml`.

**Sonde de santé** : `GET /api/health` (jeton `HEALTH_TOKEN`) indique `monitoring.errorTracking: true|false`. Un suivi inactif n'est pas une panne : le statut reste `ok`.

## 2. Ce qui n'est pas fait (volontairement)

- **Pas de SDK navigateur** : pas de capture des erreurs JavaScript côté client, ni de replay de session. Ils exigent une adaptation de la CSP (`connect-src`) et exposent davantage de données personnelles. À ajouter plus tard si le besoin est avéré.
- **Pas de traces de performance** : `SENTRY_TRACES_SAMPLE_RATE` vaut 0 par défaut. Les temps de réponse restent mesurés par Lighthouse CI.
- **Pas de source maps** : les piles référencent le code compilé de `dist/` (les lignes de code environnantes sont jointes, c'est du code applicatif, pas des données). Envoyer les source maps avec `sentry-cli` dans le job `deploy` demande un jeton d'authentification et le choix de l'hébergeur.
- **Pas de breadcrumbs `console`, HTTP sortant ni `fetch`** : ils embarquent arguments de logs et URLs (identifiants Stripe).
- **Pas de supervision de disponibilité** : Sentry reçoit des erreurs, il ne sait pas que le site est injoignable. Voir §6.

## 3. Vie privée (RGPD)

Un événement d'erreur ne contient **aucune donnée de visiteuse** :

1. **Collecte coupée à la source** (`dataCollection`) : pas d'informations utilisateur, pas de cookies, pas d'en-têtes, pas de corps de requête, pas de paramètres d'URL ; `includeServerName: false`. Le SDK v11 collecte tout par défaut : cette configuration est indispensable.
2. **Nettoyage de chaque événement** (`scrubEvent`, avant envoi, **seconde barrière**) : e-mails, téléphones `+…`, IPv4/IPv6, jetons `Bearer`, clés `sk_…`/`whsec_…`, couples `…token=…`/`…password=…`, valeurs des clés sensibles (e-mail, nom, adresse, mot de passe, note, régime alimentaire…), variables locales de pile, breadcrumbs `console`. L'URL est réduite à son chemin.
3. **Ce qui est envoyé** : type et message d'erreur nettoyé, pile technique, chemin sans paramètres, méthode, statut, identifiant de requête (`X-Request-Id`, opaque), identifiant **opaque** du compte connecté, version, environnement.
4. **Ce qui doit être décidé à la mise en service** : région des données (**UE**, domaine `.de.sentry.io`), contrat de sous-traitance Sentry (DPA, à signer depuis le compte), durée de conservation dans Sentry (réglable par projet, 30 à 90 jours recommandés), mention dans la politique de confidentialité. L'identifiant de requête permet de retrouver la requête dans les journaux de l'application, pas d'identifier une personne sans accès à la base.

**Preuves** : `tests/integration/monitoring-sentry.test.ts` lance le **vrai SDK** vers un faux serveur d'ingestion local et inspecte ce qui part sur le réseau (aucune adresse, IP, téléphone ni jeton) ; le test `monitoring-scrub` couvre chaque emplacement de l'événement. Une vérification manuelle dans Astro (endpoint qui lève une exception avec e-mail et jeton dans le message) a confirmé : message `Boom for [email] token=[redacted] ?mode=throw&email=[email]`, chemin `/api/boom-tmp`, aucune donnée de requête.

> **Limite connue** : le nettoyage repose sur des motifs. Un identifiant personnel d'une forme inhabituelle (nom en clair dans un message d'erreur construit par l'application) pourrait passer. Règle de code : ne jamais mettre de donnée personnelle dans un message d'erreur ; utiliser des identifiants.

## 4. Mise en service (à faire par toi, quand tout est prêt)

1. Créer une organisation Sentry en **région UE** (à la création, choisir « Europe (Frankfurt) »). Signer le DPA.
2. Créer un projet de type **Node.js**. Copier le **DSN**.
3. Renseigner les variables d'environnement **de production** (gestionnaire de secrets de l'hébergeur) :

   | Variable | Valeur |
   | :-- | :-- |
   | `SENTRY_DSN` | DSN du projet |
   | `SENTRY_ENVIRONMENT` | `production` (et `staging` ailleurs) |
   | `SENTRY_RELEASE` | SHA du commit déployé (relie une erreur à son déploiement) |
   | `SENTRY_TRACES_SAMPLE_RATE` | laisser vide (0) |

4. Vérifier le branchement : `pnpm monitoring:check` (avec les variables du serveur). Il envoie un événement de test et un check-in ; le retrouver dans **Issues** (étiquette `source:monitoring-check`). Il avertit si le DSN n'est pas en région UE.
5. Après le premier passage du cron (`Voyage cron` dans GitHub Actions, secrets `APP_URL` et `CRON_SECRET`), le moniteur `voyage-cron` apparaît dans **Crons**. Régler les destinataires.
6. Supprimer ensuite l'issue de test.

## 5. Alertes à créer dans Sentry

| Alerte | Condition | Destinataire |
| :-- | :-- | :-- |
| Paiement / effacement / sessions | issue avec niveau **fatal** (`source` = `stripe-webhook`, `erasure-ledger`, `auth`) : **immédiat**, à chaque occurrence | personne d'astreinte |
| Base indisponible | issue `source:session-check` ou `source:db-pool`, plus de 3 occurrences en 5 min | astreinte |
| Cron voyage | moniteur `voyage-cron` : échec ou exécution manquée | astreinte |
| Pic d'erreurs | plus de 20 événements en 10 min (tous `source`) | équipe |
| Nouvelle erreur | première occurrence d'une issue `source` ∈ `request`, `action`, `cron` en production | équipe (mail quotidien) |
| E-mails perdus | issue `source:smtp` | équipe |

## 6. Supervision de disponibilité (à brancher en plus)

Sentry ne détecte pas un site injoignable. Configurer chez un service de sonde externe (au choix, y compris celui de l'hébergeur) une requête **toutes les minutes** :

- `GET https://<site>/api/health` avec l'en-tête `Authorization: Bearer <HEALTH_TOKEN>` ;
- succès attendu : HTTP **200** et `"status":"ok"` ; HTTP **503** = dégradé (`db`, `smtp` ou `disk.uploadsWritable` en échec) ; **401** = jeton absent ou faux ;
- alerter après 2 échecs consécutifs.

## 7. Lire un incident

1. Ouvrir l'événement : l'étiquette `request_id` identifie la requête (aussi renvoyée dans l'en-tête de réponse `X-Request-Id`), `path` la route, `source` l'origine (§1).
2. Retrouver les journaux de l'application avec cet identifiant.
3. Pour un `stripe-webhook`, suivre le runbook de réconciliation (`docs/operations/backup-restore-rollback.md` §4.3) : Stripe réessaie, mais vérifier qu'aucune réservation n'est confirmée sans paiement.
4. Pour `erasure-ledger`, exécuter `pnpm db:erasure-ledger -- --import-audit` (reconstitue le registre depuis l'audit) et vérifier l'espace disque du volume `erasure`.

## 8. Comportement garanti

- **Jamais bloquant** : aucune fonction de `src/lib/monitoring` ne lève, ne retarde une réponse ni ne modifie le comportement (testé : serveur d'ingestion injoignable, DSN invalide, SDK absent).
- **Une erreur n'est comptée qu'une fois**, même si elle traverse plusieurs couches (action → middleware).
- **Les erreurs sont relancées inchangées** : le suivi observe, il ne gère rien.
- **Inactif en test** (`NODE_ENV=test`) sauf `SENTRY_ENABLE_IN_TEST=true`.

## 9. Suite possible

Source maps (jeton Sentry en CI), SDK navigateur avec CSP adaptée, traces de performance échantillonnées, journalisation structurée.
