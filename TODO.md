> STATUT DOCUMENT (2026-09-15, branche feat/voyage-core) — TRAJECTOIRE DATÉE, PAS ÉTAT TEMPS RÉEL.
> Source de vérité temps réel : `docs/ETAT-REEL.md` + `package.json` + `src/`.
> LIVRÉ depuis la rédaction : schémas voyage complets + migrations 0010/0011 + seeds 41→47,
> `src/i18n/routes.ts`, CSP, suppression legacy `fr/`+`ar/`+`booking-quote`, pages org/sitemaps org,
> loaders + pages publiques DB, admin Trips/Departures, travelers/applications, pricing/availability
> (holds 30 min, concurrence prouvée), checkout + payments (mock/Stripe) + réservations,
> emails 12×4 + outbox + jobs + analytics + policies provisoires.
> Build VERT, 140 fichiers / 1462 tests verts. Reste : E2E navigateurs en CI, pa11y/lhci,
> allowlist CSP Stripe, relectures natifs ES/AR, validation juridique, checklist §34, merge.
> README*.md non édités ici (générés par `pnpm readme:generate` — voir `readme-builder/`).

Ce que définit ce document
Ce document définit :

ce qui doit exister et ce qui ne doit pas exister ;

les responsabilités de chaque couche ;

les modèles de données, les états, les transitions ;

les permissions, les opérations, les interfaces ;

les validations, les effets de bord ;

les tests et les conditions d'acceptation ;

l'état réel du repo au moment de la rédaction, et la trajectoire pour atteindre la cible.

Ordre de priorité des arbitrages non explicitement tranchés : 1. simplicité ; 2. typage strict ; 3. sécurité côté serveur ; 4. faible coût JS client ; 5. réutilisation ; 6. séparation données/présentation ; 7. observabilité ; 8. testabilité ; 9. accessibilité ; 10. absence de duplication.

Aucune donnée commerciale critique ne doit être définie à plusieurs endroits.

0.3 Décisions actées (ne plus rouvrir sans arbitrage explicite)
- Astro 7.3.1 (package.json fait foi, README à corriger) ; routage unique src/pages/[lang]/..., jamais de dossiers fr/en/es/ar en dur.
- Locale par défaut = en ; x-default = en ; slugs voyage traduits (trip_translations.slug, UNIQUE(locale, slug), AR en ASCII EN) ; pas de 301 legacy (site pas encore en prod).
- 11 modules voyage indépendants, pluggables/supprimables sans toucher à la base (zéro import DB croisé, interfaces + outbox uniquement) ; ne pas confondre src/modules/services/ (CMS vitrine inachevé) avec les nouveaux modules.
- Paiement = module payments générique + adaptateur Stripe (pas le plugin better-auth-stripe).
- Pricing 100 % administrable (deposit/singleSupplement/tax/fee/discount + pricingRules JSON Zod), montants en centimes, multi-devises EUR/USD V1 scalable ISO-4217.
- Traveler découplé de user (userId nullable, UNIQUE(email CITEXT), pas de fusion auto) ; ~~mode anonyme vs compte obligatoire paramétrable admin~~ → **amendement 2026-09-21 (décision client : « le booking c'est censé être connecté ») : compte à email vérifié exigé inconditionnellement pour candidater ; `requireAccount` reste en schéma comme feature flag (ex. futur mode invité), sans effet sur le gating.**

0.4 Sommaire
Objet du document et règle de lecture

Vision du produit

Principe multilingue global (4 langues)

Architecture technique générale

Structure réelle du repository

Design system & tokens

Cartographie des domaines métier

Système i18n complet

Contenu éditorial voyage

Médias

Disponibilité, capacité, réservation temporaire, concurrence

Voyageuses & candidatures

Réservations & moteur de prix

Paiement, webhook, tunnel de réservation

Emails, notifications, jobs, outbox

Pages publiques

Back-office

Permissions & rôles

Sécurité applicative

RGPD & gouvernance des données

Observabilité

Base de données

Cache & invalidation

Routes, loaders, DTO, contrats d'action

Intégrations externes

Performance & accessibilité (y compris RTL)

Tests

Infrastructure & exploitation

Contenu initial & migration du classeur

Gouvernance d'architecture

Périmètre V1 / hors périmètre

Ordre d'implémentation imposé

Scénarios métier bout-en-bout

Compléments et corrections de cette version

Checklist de mise en production

Principes ultimes & définition finale

Annexes : A. Matrice des URLs par langue — B. Matrice des sources — C. Données partagées — D. Checklist d'acceptation — E. État d'avancement réel

1. VISION DU PRODUIT
ATLASELLE est une plateforme de voyages en petits groupes. Cycle complet :

text
Visite → Découverte d'un voyage → Consultation du détail → Candidature
  → Analyse → Acceptation / contact / refus → Réservation → Paiement
  → Confirmation → Préparation → Voyage → Suivi post-voyage
Ce n'est pas un site vitrine : c'est un site éditorial avec un sous-système transactionnel métier.

Partie éditoriale : rapide, fortement cacheable, majoritairement statique.

Partie transactionnelle : server-side, transactionnelle, vérifiée.

1.1 État actuel du repo
Le repo implémente aujourd'hui :

✅ un CMS éditorial générique (pages, sections, navigation, blog, services, médias, consentement, audit) ;

✅ une brique ATLASELLE partielle : src/components/pages/AtlaselleHome.astro, src/components/pages/TripPage.astro, src/pages/[lang]/trips/[slug].astro, src/pages/[lang]/apply/[trip].astro ;

✅ FAIT (2026-09-14) : `src/pages/api/booking-quote.ts` supprimé (était mock statique sur src/data/trips). Reste `src/data/trips.ts` comme données statiques temporaires en attendant PricingService + AvailabilityService ;

✅ FAIT (2026-09-14) : routes legacy `src/pages/fr/...` et `src/pages/ar/...` supprimées. Routage unique : src/pages/[lang]/... (Astro dynamique, jamais de dossiers fr/en/es/ar en dur). Pas de redirection 301 : le site n'existe pas encore en production ;

❌ aucun schéma DB voyage (Trip, Departure, Itinerary, Traveler, Application, Reservation, Payment, SeatHold) ;

❌ aucun service de domaine ATLASELLE (Pricing, Availability, Booking).

Conséquence : le socle technique est là (auth, i18n, médias, audit, SMTP, CMS), le cœur voyage est à construire.

2. PRINCIPE MULTILINGUE GLOBAL (4 LANGUES)
Le site est construit simultanément en anglais, français, arabe et espagnol.

Les informations communes — dates, prix, capacité, statut, disponibilité — reposent sur une seule source de données. Seul le contenu rédactionnel (titres, descriptions, FAQ, texte alternatif, SEO) varie selon la langue.

Conséquence : toute entité portant à la fois des faits commerciaux et du texte est scindée en deux tables — une table faits unique, une table traduction répétée une fois par langue.

Le site n'est jamais un site anglais avec trois traductions annexes : c'est un système de données unique servant quatre rendus linguistiques.

2.1 État actuel
✅ 4 locales fr, en, es, ar déclarées dans src/i18n/config.ts

✅ Dossiers de traduction par locale : src/i18n/{fr,en,es,ar}/ (about, auth, common, contact, home)

✅ src/i18n/blog/{fr,en,es,ar}.ts

✅ RTL_LOCALES (arabe) — détection RTL en place

✅ Locale par défaut = en (src/i18n/config.ts DEFAULT_LOCALE = en — décision actée). README mentionne fr : obsolète, à corriger. Le chapitre 7.1 est aligné sur en.

❌ Tables de traduction métier (trip_translations, itinerary_day_translations, etc.) : à créer

3. ARCHITECTURE TECHNIQUE GÉNÉRALE
3.1 Astro comme couche d'orchestration
Astro est responsable de : rendu des pages, routing, layouts, composants de présentation, récupération de données, appels aux services, actions serveur, endpoints, middleware, métadonnées, rendu des erreurs.

Astro n'est pas responsable de : règles de prix complexes, règles de capacité, workflow de candidature, traitement métier du paiement, persistance directe dispersée dans les pages.

Une page Astro appelle un service. Elle ne devient jamais elle-même le service métier.

3.2 Architecture en couches
text
┌───────────────────────────────────────────────┐
│                    UI                          │
│  Astro pages / layouts / components            │
└───────────────────────┬───────────────────────┘
                         │
┌───────────────────────▼───────────────────────┐
│              Actions / loaders                 │
│  validation / auth / request mapping           │
└───────────────────────┬───────────────────────┘
                         │
┌───────────────────────▼───────────────────────┐
│                Domain services                 │
│  trips / booking / pricing / payments / etc.   │
└───────────────────────┬───────────────────────┘
                         │
┌───────────────────────▼───────────────────────┐
│              Repositories / DB                 │
│               Drizzle / PostgreSQL             │
└───────────────────────────────────────────────┘
Règles strictes :

Les composants UI ne connaissent pas les détails de PostgreSQL.

Les pages n'appellent jamais Drizzle directement.

Les actions ne contiennent pas de HTML.

Les services métier ne dépendent pas d'Astro.

3.3 Correspondance avec l'architecture réelle du repo
Couche conceptuelle	Emplacement réel	État
UI	src/pages/, src/components/, src/layouts/	✅
Actions / loaders	src/actions/, src/database/loaders/, src/modules/*/loaders/	🟡
Domain services	src/modules/*/domain/ + src/modules/*/actions/	🟡 (blog/services), ❌ (ATLASELLE)
Repositories / DB	src/database/schemas/, src/database/commands/, src/database/loaders/	✅
Core partagé	src/core/ (admin, cache, revision, search, seo, i18n, …)	✅
Décision : les 11 modules voyage vivent dans src/modules/<domain>/ (trips, departures, itinerary, pricing, availability, travelers, applications, reservations, payments, policies-voyage, outbox, email-voyage). Chaque module aura : schema/, domain/, actions/, loaders/, validation/, i18n/, admin/, components/, permissions/, seo/, module.ts.
Attention : ne pas confondre avec src/modules/services/ existant = module CMS générique vitrine (services commerciaux, inachevé), sans rapport avec les domain services voyage. On ne touche pas à services/ sauf pour le garder isolé. Les nouveaux modules doivent être pluggables et supprimables sans toucher à la base : aucune importation DB croisée, communication via interfaces + outbox_events uniquement. Le module payments doit être réutilisable tel quel dans d'autres projets.

3.4 Stack technique réelle
text
Core         : Astro 7.3.1 (package.json), TypeScript strict, pnpm, Node.js ≥ 22.12.0
Adapter      : @astrojs/node (SSR)
Data         : PostgreSQL 16, Drizzle ORM, Drizzle Kit
Validation   : Zod
Auth         : better-auth (email/password, organisations, rôles, impersonation)
UI           : Tailwind CSS 4 + Starwind (48 atoms vérifiés, voir docs/ETAT-REEL.md)
Tests        : Vitest (81 unit + 15 intégration, voir docs/ETAT-REEL.md) + Playwright (6 specs E2E × 3 navigateurs)
Qualité      : ESLint, Prettier, TypeScript strict, GitHub Actions, CodeQL
Emails       : SMTP (Brevo / Resend / Nodemailer) + dead-letter queue JSONL
Sanitisation : src/lib/sanitize.ts
Rate limit   : src/lib/rate-limit.ts (in-memory)
Audit        : src/lib/audit.ts + table audit_log
Recherche    : PostgreSQL FTS (search_vector)
Médias       : Sharp, upload dans public/uploads/
Version réelle : Astro 7.3.1 + @astrojs/node 11.1.5 (vérifié package.json). README mentionne Astro 6 : obsolète, à corriger.

4. STRUCTURE RÉELLE DU REPOSITORY
4.1 Structure actuelle
text
src/
├── actions/                    ✅ (admin/, blog/, services/, index.ts)
├── assets/                     ✅ (images/, brand/, avatars/)
├── components/
│   ├── atoms/                  ✅ (48 composants Starwind)
│   ├── molecules/              ✅ (3 composants)
│   ├── organisms/              ✅ (11 composants : Header, Footer, AdminFormShell, …)
│   ├── pages/                  ✅ (AtlaselleHome, TripPage, HomePage, AboutPage, ContactPage, CmsPage, LegalPage, …)
│   ├── blog/                   ✅
│   ├── services/               ✅
│   ├── content/                ✅
│   └── wow/                    ✅ (9 composants d'animation)
├── core/                       ✅
│   ├── admin/                  (confirmation, filter-contract, resource-contract)
│   ├── attributes/             cache/, capabilities/, content/, engagement/
│   ├── localization/           (module-labels)
│   ├── locks/, media/, moderation/, notifications/, presentation/, revision/
│   ├── search/                 (postgres, registry, contract)
│   ├── seo/, taxonomy/, workflow/
│   └── modules/                (bootstrap, module-contract, module-registry)
├── database/                   ✅
│   ├── schemas/                (voir §21)
│   ├── data/                   (seeds 00 à 40)
│   ├── commands/               (db.check, db.migrate, db.seed, …)
│   ├── loaders/
│   ├── infra/                  (functions.sql, triggers.sql, indexes.sql, constraints.sql)
│   ├── migrations/             (0000 → 0009)
│   └── cache.ts, drizzle.ts, env.ts
├── i18n/                       ✅
│   ├── config.ts               (LOCALES, DEFAULT_LOCALE = en, RTL_LOCALES = [ar])
│   ├── utils.ts
│   ├── {fr,en,es,ar}/          (about, auth, common, contact, home)
│   └── blog/                   (fr, en, es, ar)
├── layouts/BaseLayout.astro    ✅
├── lib/                        ✅
│   ├── audit.ts, auth.ts, auth-client.ts, auth-data.ts, auth-guards.ts
│   ├── permissions.ts, rate-limit.ts, sanitize.ts
│   └── starwind/               (composants Starwind)
├── media/                      ✅ (upload, delete, list)
├── modules/                    ✅
│   ├── blog/                   (actions, admin, capabilities, components, domain, i18n, loaders, permissions, schema, search, seo, validation, workflow)
│   └── services/               (idem)
├── pages/                      ✅
│   ├── index.astro             (racine)
│   ├── 404.astro, 500.astro
│   ├── robots.txt.ts, rss.xml.ts
│   ├── sitemap-*.xml.ts
│   ├── api/                    (audit-export, auth/[...all], blog/newsletter, contact, content-export, content-import, cron/publish, export-data, health, media, preview, search, upload — booking-quote supprimé 2026-09-14)
│   ├── fr/, ar/                ✅ SUPPRIMÉS 2026-09-14 (plus de dossiers statiques de langue)
│   └── [lang]/                 ✅
│       ├── a-propos.astro
│       ├── admin/              (audit, blog, index, media, navigation, pages, roles, services, site, stats, theme, users)
│       ├── apply/[trip].astro  ✅ (candidature ATLASELLE)
│       ├── auth/[slug].astro
│       ├── blog/               (index, [...slug])
│       ├── contact.astro
│       ├── faq.astro
│       ├── index.astro
│       ├── services/           (index, [slug], tags, [categorySlug])
│       ├── terms.astro
│       ├── trips/[slug].astro  ✅ (détail voyage ATLASELLE)
│       └── [slug].astro        (pages CMS dynamiques)
├── smtp/                       ✅ (providers: brevo, resend, nodemailer ; templates ; dead-letter dans logs/ racine, pas src/smtp/logs/)
├── styles/global.css           ✅ (voir docs/ETAT-REEL.md pour le compte réel des tokens)
└── middleware.ts               ✅
4.2 Structure cible — modules à créer
text
src/modules/
├── trips/                      ❌ à créer
│   ├── schema/                 (trips, trip_translations, trip_highlights, trip_inclusions, trip_exclusions)
│   ├── domain/                 (TripService, statuts, transitions)
│   ├── actions/                (publishTrip, unpublishTrip, archiveTrip, restoreTrip, updateTrip)
│   ├── loaders/                (loadTripPage, loadAdminTrips, loadAdminTrip)
│   ├── validation/
│   ├── i18n/
│   ├── admin/                  (resource.ts, liste, formulaires)
│   ├── components/             (TripCard, TripHero, TripItinerary, …)
│   ├── permissions/
│   ├── seo/
│   └── module.ts
├── departures/                 ❌ (departures, seat_holds)
├── itinerary/                  ❌ (itinerary_days, itinerary_day_translations)
├── pricing/                    ❌ (PricingService)
├── availability/               ❌ (AvailabilityService)
├── travelers/                  ❌ (travelers)
├── applications/               ❌ (applications, application_decisions, application_events, application_internal_notes)
├── reservations/               ❌ (reservations, reservation_price_snapshots, reservation_agreements)
├── payments/                   ❌ (payments, checkout_sessions)
├── policies-voyage/            ❌ (policy_documents, policy_versions)
├── outbox/                     ❌ (outbox_events)
└── email-voyage/               ❌ (email_templates, email_deliveries, email_events)
4.3 Décisions structurelles
blog : présent, hors périmètre ATLASELLE. Conservé comme module optionnel non interférant.

services : présent. Deux options : soit renommé/remplacé par trips, soit conservé séparément. Décision retenue : créer un module trips distinct, ne pas polluer services. Si l'équipe préfère remplacer, migration progressive.

Routage : conserver [lang] dynamique. Supprimer les dossiers legacy src/pages/fr/ et src/pages/ar/ — ils court-circuitent le segment [lang] et dupliquent la logique.

i18n/routes.ts : ✅ FAIT 2026-09-14 (`src/i18n/routes.ts`, 152 lignes) — table centralisée des slugs traduits par langue.

5. DESIGN SYSTEM & TOKENS
5.1 Composants minimum — ✅ déjà présents
Le repo contient 48 composants atoms/ couvrant : accordion, alert, alert-dialog, aspect-ratio, avatar, badge, breadcrumb, button, button-group, card, carousel, checkbox, collapsible, container, dialog, dropdown, dropzone, icon-picker, image, input, input-group, input-otp, item, kbd, label, media-picker, native-select, pagination, popover, progress, prose, radio-group, select, separator, sheet, sidebar, skeleton, slider, spinner, switch, table, tabs, textarea, theme-toggle, toast, toggle, tooltip, video.

Le design system est accessible par défaut. Aucun module admin ne recrée son propre Button.

5.2 Tokens — ✅ déjà présents
src/styles/global.css (compte réel : voir docs/ETAT-REEL.md, l'ancien chiffre 86 est obsolète) :

css
--animate-accordion-down, --animate-accordion-up
--color-background, --color-foreground
--color-card, --color-card-foreground
/* ... 80 autres */
Exigence RTL : les tokens spacing / radii / shadows doivent être exprimés en propriétés logiques CSS (margin-inline-start, padding-inline-end, etc.) plutôt qu'en propriétés physiques (margin-left). État : à auditer dans les composants atoms/, organisms/, modules/*/components/.

6. CARTOGRAPHIE DES DOMAINES MÉTIER
text
Site, Navigation, Localization, Media, Trips, Departures, Itinerary, Pricing,
Availability, Travelers, Applications, Reservations, Payments, Notifications,
Policies, Admin, Audit, Analytics
Chaque domaine possède : types, schemas, queries, commands, services, actions, loaders, tests.

6.1 État d'implémentation
Domaine	État
Site	✅ site_settings, social_links, contact_info, opening_hours, theme_settings
Navigation	✅ navigation_menus, navigation_items
Localization	✅ src/i18n/
Media	✅ media_folders, media_files, media_file_alts
Content / Pages	✅ pages, page_sections, page_versions
Consent	✅ consent_settings
Audit	✅ audit_log + src/lib/audit.ts
Auth / Admin	✅ user, session, account, organization, member, invitation, organization_role
Blog	✅ module complet (post, translation, catégorie, tag, commentaire, review, réaction, abonné, notification, …)
Services	✅ module complet (service, traduction, catégorie, tag, média, disponibilité, révision, SEO, engagement)
Trips	❌
Departures	❌
Itinerary	❌
Pricing	❌
Availability	❌
Travelers	❌
Applications	❌
Reservations	❌
Payments	❌
Notifications (voyage)	❌
Policies (voyage)	❌
7. SYSTÈME I18N COMPLET
7.1 Locales officielles
text
Locales            : fr, en, es, ar
Locale par défaut  : en
Sens d'écriture    : fr → LTR, en → LTR, es → LTR, ar → RTL
Aligné sur src/i18n/config.ts (décision actée EN). README mentionne fr : obsolète.

Toutes les surfaces sont localisées : public, formulaires, erreurs, emails, métadonnées, données structurées, messages système. Le back-office administrateur est une surface distincte (§7.7).

7.2 Politique d'URL par zone
Règle :

Segments d'URL des langues latines (FR, ES) : traduits.

Segments d'URL arabes : anglais translittéré ASCII (fiabilité partage / copier-coller / indexation). Contenu de la page : entièrement en arabe.

Routage technique : segment dynamique [lang] unique OBLIGATOIRE. Interdit : dossiers statiques src/pages/fr/, src/pages/en/, src/pages/es/, src/pages/ar/. Toute page publique et admin vit sous src/pages/[lang]/.... Table centralisée dans src/i18n/routes.ts (✅ FAIT 2026-09-14). Décision : slugs voyage traduits par langue (trip_translations.slug, UNIQUE(locale, slug)) ; slugs AR voyage en ASCII anglais.
> ✅ TRANCHÉ 2026-09-14 (SEO + usage réel : Google accepte les deux, translittéré explicitement OK ; arabe natif → %D9… illisible au partage, 404 alef/hamza, fonctionnel mondial en latin) : AR structurel = EN ASCII partout (`about`, `contact`, `legal-notice`, auth, `trips`, `apply`). Contenu arabe intégral. Voir docs/ETAT-REEL.md §5.

Zone	FR	EN	AR	ES
Accueil	/fr/	/en/	/ar/	/es/
Liste voyages	/fr/voyages	/en/trips	/ar/trips	/es/viajes
Détail voyage	/fr/voyages/[slug]	/en/trips/[slug]	/ar/trips/[slug]	/es/viajes/[slug]
Candidature	/fr/candidature/[voyage]	/en/apply/[trip]	/ar/apply/[trip]	/es/postulacion/[viaje]
FAQ	/fr/faq	/en/faq	/ar/faq	/es/faq
Conditions	/fr/conditions	/en/terms	/ar/terms	/es/terminos
Confidentialité	/fr/confidentialite	/en/privacy	/ar/privacy	/es/privacidad
À propos	/fr/a-propos	/en/about	/ar/about	/es/acerca-de
⚠️ État actuel du repo :

[lang]/apply/[trip].astro existe → sert toutes les langues

[lang]/trips/[slug].astro existe → sert toutes les langues

[lang]/faq.astro, [lang]/terms.astro, [lang]/a-propos.astro existent

Legacy à supprimer : src/pages/fr/candidature/[voyage].astro, src/pages/fr/voyages/[slug].astro, src/pages/fr/conditions.astro, src/pages/ar/conditions.astro

Cette table est la référence unique. Elle doit être encodée dans src/i18n/routes.ts et non recopiée dans chaque page.

7.3 RTL — exigences spécifiques à l'arabe
Exigence de premier ordre :

<html lang="ar" dir="rtl"> posé par le layout (BaseLayout.astro:105 dir={direction} via getDirection — ✅ déjà en place) pour toute route /ar/... ; middleware ne pose pas dir (vérifié) ;

mise en page miroir : navigation, icônes directionnelles, ordre des colonnes ;

CSS en propriétés logiques uniquement ;

isolation bidi : <bdi> ou unicode-bidi: isolate pour les contenus LTR (prix, dates ISO, numéros, emails) dans une page RTL ;

numérotation : chiffres arabes occidentaux (0-9) standardisés ;

ordre de tabulation logique en RTL ;

tests visuels de non-régression RTL.

État : ✅ RTL_LOCALES + dir={direction} déjà en place dans BaseLayout.astro:105. Reste : audit propriétés logiques CSS, isolation bidi, ordre tabulation, tests visuels RTL.

7.4 Polices
La police doit couvrir : latin étendu (é, à, ç, ñ, ¿, ¡) et écriture arabe. Si nécessaire, pile de secours par script, font-display: swap, subsetting par langue.

7.5 Traduction manquante et complétude
Jamais undefined, jamais un texte anglais présenté comme du français. Le CMS affiche « Traduction manquante » ; l'admin peut filtrer les contenus incomplets.

Avant publication dans une langue : validation des champs obligatoires, métadonnées, alt hero, itinéraire, FAQ, inclusions, exclusions — pour chaque langue indépendamment.

Publication par langue : le statut global du Trip reste unique, mais chaque TripTranslation porte localeVisible: boolean. Publication progressive possible (EN + FR d'abord, AR + ES plus tard), sans page à moitié traduite.

Une locale non localeVisible n'apparaît pas dans les alternates hreflang, et n'est pas indexée.

7.6 Sélecteur de langue et repli (fallback)
Le sélecteur persistant FR/EN/AR/ES garde la visiteuse sur la page équivalente logique.

Si la page équivalente n'existe pas (localeVisible = false ou traduction absente), redirection vers la ressource parente la plus proche dans la langue cible (liste des voyages plutôt que fiche voyage), avec message non bloquant.

Interdit : afficher silencieusement le contenu FR sous une étiquette AR.

7.7 Langue du back-office
Langues publiques : 4 (FR/EN/AR/ES).

Langue de travail du back-office : décision distincte. Hypothèse retenue : interface admin en français et anglais dans un premier temps.

Les permissions peuvent être portées par langue de contenu (rôle « éditrice contenu AR »), sans complexifier la V1 : un rôle editor gère les 4 langues de contenu.

7.8 SEO multilingue
createSeoMetadata() produit les alternates hreflang uniquement pour les locales localeVisible, plus x-default = en (décision actée ; BaseLayout.astro:117 pointe encore fr : à corriger).

Le sitemap n'inclut que les combinaisons page × locale publiées et indexables.

Emails transactionnels sélectionnés selon traveler.locale, avec repli contrôlé.

État : 🟡 src/core/seo/ existe ; sitemaps multi-domaines présents (sitemap-blog-org.xml.ts, sitemap-cms.xml.ts, sitemap-services-org.xml.ts). À étendre pour les trips.

8. CONTENU ÉDITORIAL VOYAGE
8.1 Trip — ❌ à créer
Un Trip n'est ni une réservation, ni une date, ni un prix.

text
Trip (faits, jamais de texte traduit ici)
  id, status
  countryCode (ISO-3166-1 alpha-2), defaultCurrency (ISO-4217), heroMediaId
  durationDays, durationNights
  groupMin, groupMax (cadrage catalogue ; seuils opérationnels sur Departure)
  difficulty, difficultyLevel (score 1-5 + label)
  arrivalAirport, departureAirport
  accommodationStyle
  publishedAt, createdAt, updatedAt
Table : trips — Drizzle : src/modules/trips/schema/trips.schema.ts.
Pas de colonne slug ici (décision slugs traduits) : voir TripTranslation.slug.

8.2 TripTranslation — ❌ à créer
text
TripTranslation
  tripId, locale (∈ { fr, en, es, ar })
  slug (traduit par langue, ASCII ; AR = slug EN translittéré ; décision actée)
  title, shortTitle, summary, overview
  highlights, experience, fitness, preparation, lodging, food, faithConsiderations
  metaTitle, metaDescription
  localeVisible (cf. 7.5)
  createdAt, updatedAt

Contraintes : UNIQUE(tripId, locale), UNIQUE(locale, slug)
Table : trip_translations.
Résolution route : [lang] + segment traduit (routes.ts) + slug de la locale. Pas de 301 legacy : site non encore en production.

La disponibilité, la capacité, le prix et les dates ne sont jamais dupliqués par langue.

8.3 Statuts et transitions du Trip
text
draft → review
review → approved | draft
approved → published
published → unpublished | archived
unpublished → published | archived
archived → restored
Toute transition passe par une action explicite (publishTrip(), unpublishTrip(), archiveTrip(), restoreTrip()) — jamais une mutation générique updateTrip({ status }).

8.4 Departure — ❌ à créer
text
Departure (prix 100 % administrables, multi-devises EUR/USD à la V1, scalable via ISO-4217)
  id, tripId
  startDate, endDate, status
  capacityMin, capacityMax
  priceAmount, currency, depositType (fixed|percent|none), depositAmount, depositPercent,
  singleSupplementAmount, singleSupplementType (fixed|percent|none),
  taxAmount, taxType, feeAmount, feeType, discountAmount, discountType,
  pricingRules (JSON validé Zod : seuils, suppléments, réductions — éditable admin)
  balanceDueDate, bookingDeadline
  arrivalAirport, departureAirport
  createdAt, updatedAt
Règle : aucun montant en dur côté client ; tout est lu depuis Departure + PricingService. Admin édite tous les champs ci-dessus.
Statuts :

text
draft → open
open → limited | waitlist | closed | cancelled
limited → open | waitlist | closed
waitlist → open | closed
closed → completed
Ne jamais confondre statut de publication du Trip et statut de disponibilité du Departure.

Table : departures.

8.5 Itinerary — ❌ à créer
text
ItineraryDay
  id, tripId, dayNumber, relativeDate
  location, route
  activityLevel, distance, activityDuration
  minAltitude, maxAltitude
  meals, accommodation, transferSummary

ItineraryDayTranslation
  locale, title, morning, afternoon, evening, meals, accommodation, transfer, notes

Contrainte : UNIQUE(tripId, dayNumber)
Tables : itinerary_days, itinerary_day_translations.

Ordre piloté explicitement par dayNumber.

8.6 Highlights, inclusions, exclusions, FAQ — ❌ à créer
text
trip_highlights    : tripId, mediaId, sortOrder, iconKey + traduction (title, description)
trip_inclusions    : tripId, sortOrder + traduction
trip_exclusions    : tripId, sortOrder + traduction
faqs / faq_translations / trip_faqs : FAQ globale ou rattachée à un trip
8.7 Difficulté
Représentée à la fois de façon lisible (« moderate ») et exploitable (score: 3/5).

9. MÉDIAS
9.1 Modèle centralisé — ✅ déjà présent
Tables : media_folders, media_files, media_file_alts.

text
media_folders    : id, organizationId, name, parentId, sortOrder, createdAt, updatedAt
media_files      : id, organizationId, folderId, filename, url, mimeType, size, width, height, createdAt, updatedAt
media_file_alts  : id, fileId, locale, alt, title
✅ Alts déjà localisés (media_file_alts.locale).

9.2 Cycle de vie
Pipeline : upload → validation (MIME, taille) → traitement Sharp → stockage public/uploads/ → ready. Le module src/media/ expose upload, delete, list.

9.3 Import de médias
Chaque média importé associé à : usage, alt (dans les langues concernées), droits.

10. DISPONIBILITÉ, CAPACITÉ, RÉSERVATION TEMPORAIRE, CONCURRENCE
10.1 Capacité disponible
Source de vérité : Departure.capacityMax. confirmedSeats + heldSeats ≤ capacityMax. Capacité jamais calculée uniquement côté navigateur.

10.2 AvailabilityService — ❌ à créer
text
getAvailability() / holdSeats() / releaseSeats() / confirmSeats()
Distingue explicitement available, held, confirmed.

10.3 SeatHold — ❌ à créer
text
seat_holds : id, departureId, applicationId, quantity, expiresAt, status, createdAt, releasedAt
Statuts    : active | expired | released | converted
10.4 Transaction de capacité
Transaction PostgreSQL obligatoire : SELECT ... FOR UPDATE sur la ligne departures, ou contrainte CHECK + index partiel, pour empêcher la surréservation.

11. VOYAGEUSES & CANDIDATURES
11.1 Traveler — ❌ à créer (module indépendant, découplé de user, supprimable sans toucher à la base auth)
text
travelers : id, userId NULLABLE (lien optionnel vers auth.user, jamais FK dure bloquant la suppression du module),
  email CITEXT UNIQUE, phone, legalName, preferredName, dateOfBirth, locale, timezone,
  emailVerifiedAt, createdAt, updatedAt
Décisions actées : traveler ≠ user (table propre au module travelers). Déduplication : UNIQUE(email) insensible à la casse + normalisation (trim/lowercase) à l'écriture, sans fusion automatique ; en cas de conflit : réutiliser le traveler existant si email vérifié, sinon erreur contrôlée APPLICATION_EMAIL_CONFLICT. ~~Mode anonyme vs compte obligatoire = paramétrable depuis l'admin (global + surcharge par Trip : requireAccount true|false, par défaut false en V1).~~ **Amendement 2026-09-21 : candidature = compte connecté à email vérifié better-auth, inconditionnel (`/apply` redirige 302 vers sign-in + `?next=`, `submitApplication` exige sessionUser.emailVerified + email match) ; `requireAccount` reste un feature flag admin sans effet sur le gating.**

11.2 Données sensibles
Jamais dans : analytics, logs, URLs, état client, messages d'erreur, HTML public. redactSensitive() masque les champs sensibles.

11.3 Application — ❌ à créer
text
applications :
  id, travelerId, tripId, departureId, status
  roomPreference, dietaryRequirements, accessibilityNeeds
  activityAcknowledgement, motivation, expectations, consent
  submittedAt, createdAt, updatedAt

Statuts : draft, submitted, under_review, contact_required, approved, declined, withdrawn, expired
text
draft → submitted → under_review ─┬─→ approved
                                   ├─→ contact_required ─→ under_review | approved | declined
                                   └─→ declined
11.4 Décisions et journal d'activité
text
application_decisions : id, applicationId, decision, adminUserId, internalNote, createdAt
application_events    : created, submitted, viewed, review_started, contact_requested,
                         approved, declined, withdrawn, expired
Jamais d'écrasement de statut : chaque décision crée un enregistrement.

11.5 Délai et approbation
Pas de soumission après bookingDeadline (sauf dérogation par rôle + audit). Approbation → statut approved, email d'approbation avec lien checkout horodaté, événement d'audit — aucune réservation créée automatiquement. Accès checkout : via lien signé + contrôle traveler (email) ; si Trip.requireAccount=true, login + email vérifié exigés. Paramètres admin : checkoutLinkTTL (défaut 7 j), applicationExpiry (défaut 30 j sans décision → expired).

12. RÉSERVATIONS & MOTEUR DE PRIX
12.1 Reservation — ❌ à créer
text
reservations :
  id, reservationNumber, travelerId, tripId, departureId, applicationId, status, currency
  baseAmount, singleSupplementAmount, discountAmount, taxAmount, feeAmount, totalAmount
  amountPaid, amountDue, balanceDueDate
  confirmedAt, cancelledAt, completedAt, createdAt, updatedAt

Statuts : pending, awaiting_payment, confirmed, balance_due, completed, cancelled, refunded
12.2 PricingService — ❌ à créer (100 % piloté admin, multi-devises)
text
Entrée : departure, traveler, roomPreference, pricingContext { currency demandée }
Sortie : baseAmount, supplementAmount, discountAmount, taxAmount, feeAmount,
         totalAmount, depositAmount, balanceAmount, currency
Règles administrables par Departure : depositType/Amount/Percent, singleSupplementType/Amount, taxType/Amount, feeType/Amount, discountType/Amount, pricingRules JSON (Zod). Devises V1 : EUR + USD (ISO-4217, scalable : ajouter une devise = config, pas de migration). Prix toujours recalculé serveur au checkout + au webhook (jamais de montant client). Tous les montants en centimes (integer) + currency.
12.3 Immutabilité du prix
Une réservation confirmée conserve le prix appliqué. Toute modification future du prix du départ ne modifie jamais rétroactivement. Technique : reservation_price_snapshots ou valeurs financières incorporées à la réservation.

13. PAIEMENT, WEBHOOK, TUNNEL DE RÉSERVATION (provider = Stripe, module payments générique réutilisable)
13.1 Payment — ❌ à créer (module indépendant, aucune dépendance voyage : ne connaît que reservationId, amount, currency)
text
payments :
  id, reservationId, provider, providerPaymentId, type, status
  amount, currency, idempotencyKey, metadata
  createdAt, paidAt, failedAt

Types  : deposit, balance, full_payment, refund
Statuts: created, pending, authorized, paid, failed, cancelled, refunded, partially_refunded
13.2 Idempotence
createCheckout, processWebhook, confirmPayment, refundPayment : idempotentes.

13.3 Traitement du webhook
authentifier signature ; 2. vérifier événement ; 3. vérifier idempotency key ; 4. charger réservation ; 5. vérifier montants ; 6. exécuter transaction ; 7. enregistrer résultat ; 8. effets secondaires ; 9. répondre au fournisseur.

Jamais confiance au montant côté navigateur.

13.4 Tunnel de réservation
text
Candidature approuvée → Checkout initialisé → Instantané de prix → Hold de place
  → Session de paiement → Fournisseur → Webhook → Réservation confirmée
  → Hold converti → Email de confirmation
13.5 Expiration du checkout
text
checkout_sessions : id, applicationId, departureId, reservationId?, providerSessionId,
                    status, expiresAt, createdAt, updatedAt
13.6 Solde, annulation, remboursement
Solde = totalAmount - amountPaid. cancelReservation() applique politique, date, paiements, éligibilité remboursement, inventaire, notifications — et crée un événement d'audit. Aucune logique de remboursement uniquement dans l'UI. Couche BookingPolicyService / CancellationPolicyService / PaymentPolicyService.

13.7 Documents légaux et consentement
text
policy_documents / policy_versions — types : privacy, terms, booking_terms, cancellation,
                                              accessibility, photo_consent
Réservation conserve agreementVersionId, acceptedAt, travelerId, reservationId.

Révision juridique qualifiée étendue aux 4 langues (traduction juridique, pas traduction générale).

14. EMAILS, NOTIFICATIONS, JOBS, OUTBOX
14.1 Emails transactionnels
État actuel : ✅ src/smtp/ avec providers Brevo / Resend / Nodemailer, templates i18n (verify-email, reset-password, contact-form, delete-account, blog-newsletter + layout, i18n), dead-letter queue (logs/ racine, JSONL par jour). organization-invitation.ts N'EXISTE PAS (supprimé avec les pages org — ne pas le référencer).

À ajouter :

text
email_templates / email_deliveries / email_events

Templates :
  application_received, application_approved, application_contact_required,
  application_declined, checkout_started, payment_received, booking_confirmed,
  balance_due, balance_reminder, pre_trip_preparation, pre_trip_reminder,
  post_trip_followup

États de livraison : queued, sending, sent, failed, retrying, dead_letter
Chaque template localisé dans les 4 langues, versionné. Choix selon traveler.locale, repli contrôlé.

14.2 Jobs planifiés — ❌ à créer
text
expireSeatHolds, expireCheckoutSessions, sendBalanceReminders, sendPreTripReminders,
processEmailQueue, processEmailRetries, processMedia, cleanupExpiredSessions,
cleanupOldAuditEntries, refreshAggregates
Le repo a déjà src/pages/api/cron/publish.ts et pnpm db:cleanup-audit — pattern à étendre.

14.3 NotificationService
Canal V1 : email. Extension future : SMS, WhatsApp, push.

14.4 Outbox pattern — ❌ à créer
text
outbox_events : id, eventType, aggregateType, aggregateId, payload, status, attempts,
                availableAt, processedAt, createdAt
Worker : récupère, verrouille, traite, marque, réessaie, dead-letter après seuil.

15. PAGES PUBLIQUES
15.1 Page d'accueil — ✅ partiellement présente
src/components/pages/AtlaselleHome.astro existe déjà.

Structure cible : Hero, Featured Trips, Why ATLASELLE, Founder/Story, How It Works, Travel Philosophy, Destinations, Testimonials, FAQ preview, Newsletter, Final CTA.

15.2 Liste des voyages — ❌ à créer
/fr/voyages, /en/trips, /ar/trips, /es/viajes. Filtres URL : ?destination=, ?month=, ?duration=, ?difficulty=, ?availability=.

15.3 Carte voyage (TripCard) — ❌ à créer
Image hero, titre, destination, dates, durée, difficulté, prix de départ, statut dispo, CTA — source unique Trip/Departure.

15.4 Détail voyage — ✅ squelette présent
src/components/pages/TripPage.astro + src/pages/[lang]/trips/[slug].astro existent.

Structure cible : Hero, Quick facts, Overview, Highlights, Trip map, Itinerary, Experience, Difficulty, Accommodation, Food, Cultural considerations, Inclusions, Exclusions, Dates & pricing, Leader, Testimonials, FAQ, Booking CTA.

15.5 Transparence tarifaire
Toujours distinguer prix de départ, acompte, solde, supplément chambre individuelle.

15.6 Page de candidature — ✅ squelette présent
src/pages/[lang]/apply/[trip].astro existe.

Étapes : résumé voyage, coordonnées, expérience, préférences, régime, chambre, reconnaissance activités, accords, relecture, envoi. Aucune donnée sensible dans localStorage.

15.7 Checkout — ❌ à créer
Étapes : relecture, chambre, détail prix, conditions, paiement, résultat. Prix toujours récupéré côté serveur.

15.8 Contact / Sur-mesure / Candidature
Trois concepts distincts :

Contact = message général ✅ (src/pages/api/contact.ts + src/components/pages/ContactPage/) ;

CustomTravelInquiry = demande structurée personnalisée (lead commercial) — ❌ ;

Application = candidature à un voyage existant — ❌.

15.9 404, cookies
✅ 404.astro + 500.astro existent.

✅ Consent : consent_settings + CookieConsent composant.

16. BACK-OFFICE
16.1 Contrat de ressource — ✅ présent
src/core/admin/resource-contract.ts et src/core/admin/filter-contract.ts existent. À réutiliser tel quel pour trips, departures, applications, reservations, payments.

16.2 Ressources admin minimales
État actuel : ✅ src/pages/[lang]/admin/ contient déjà : audit, blog, index, media, navigation, pages, roles, services, site, stats, theme, users.

À ajouter : trips, departures, applications, reservations, payments, policies, email-templates, travelers.

16.3 Listes, filtres, état d'URL
Filtres dans l'URL pour rendu serveur déterministe. Actions groupées opt-in.

16.4 Formulaires admin
AdminFormShell, AdminFormSection, AdminFormTabs, AdminFormFooter, AdminFormActions, AdminFormDirtyGuard — ✅ squelettes présents (src/components/organisms/AdminFormShell.astro).

Flux : UI → payload typé → Action → permission → validation → service → transaction → révision → audit → invalidation cache.

16.5 Révisions, publication, prévisualisation
page_versions existe déjà comme pattern. À dupliquer pour : trip_revisions, trip_translation_revisions, policy_revisions, faq_revisions, email_template_revisions.

Prévisualisation : /fr/preview/trips/[id] — autorisée, non indexable, ne contamine pas le cache public.

16.6 Tableau de bord et priorités
Candidatures en attente, départs à venir, places disponibles, réservations récentes, paiements en attente, soldes dus, contenu à traduire, activité récente.

Santé du contenu : « 1 voyage sans image hero — 0 départ ouvert — 3 candidatures en attente — 1 paiement échoué — 2 soldes dus ce mois ».

16.7 Reporting
Périmètres : jour, semaine, mois, voyage, départ.
Indicateurs : candidatures/voyage, taux approbation, réservations, revenu (brut/encaissé/en attente/remboursé), taux occupation.

16.8 Concurrence admin
Verrouillage optimiste (version, updatedAt, revision). Message « votre version est obsolète, recharger ou comparer » — jamais d'écrasement silencieux. Pattern content-locking déjà présent dans src/core/locks/.

17. PERMISSIONS & RÔLES
17.1 Permissions par domaine
text
trips.read/create/update/publish/archive
departures.read/update/close
applications.read/review/approve/decline
reservations.read/cancel
payments.read/refund
media.read/create/delete
policies.read/publish
admins.manage
audit.read
État : 🟡 src/lib/permissions.ts + src/core/modules/module-contract.ts fournissent le squelette. À étendre.

17.2 Rôles
Rôles better-auth actuels : user, admin (impersonation). Organisations avec rôles custom (organization_role).

À ajouter : super_admin, trip_manager, reviewer, finance, support, editor — via le système organization_role.

17.3 Matrice de permissions
Ressource	super_admin	admin	trip_manager	reviewer	finance	support
Trips	CRUD+publish	CRUD+publish	CRUD	R	R	R
Departures	CRUD	CRUD	CRUD	R	R	R
Applications	CRUD	CRUD	R	CRUD	R	R
Reservations	CRUD	CRUD	R	R	CRUD	R
Payments	CRUD	CRUD	R	R	CRUD	R
Policies	CRUD+publish	CRUD+publish	R	R	R	R
Admins	CRUD	R	–	–	–	–
Audit	R	R	R	R	R	R
Contrôle côté serveur uniquement.

17.4 Frontière de sécurité
Un composant ou une route n'est jamais une frontière suffisante. Chaque action refait : authentification, autorisation, vérification de portée, validation.

Guards existants : src/lib/auth-guards.ts — à réutiliser.

18. SÉCURITÉ APPLICATIVE
18.1 En-têtes de sécurité — 🟡 partiels (vérifié src/middleware.ts)
Posés : X-Content-Type-Options, X-Frame-Options DENY, Referrer-Policy, Permissions-Policy, HSTS, COOP/CORP/COEP.
Manquants : requestId (à créer). CSP ✅ FAIT (astro.config.mjs:75-88, `security.csp` + `checkOrigin:true` ; allowlist Stripe.js à ajouter quand le module payments arrivera). Middleware ne pose pas dir (géré par layout).

18.2 Rate limiting et anti-bot — ✅ présent
src/lib/rate-limit.ts (in-memory). Limitation sur : contact, newsletter, candidature, login admin, reset password, initiation paiement. Protection additionnelle possible : honeypot, timing, captcha — selon spam observé.

18.3 Sanitisation — ✅ présente, à renforcer
src/lib/sanitize.ts (allowlist). Tests : tests/unit/sanitize.test.ts, section-content-xss.test.ts.

À ajouter : neutralisation des caractères Unicode de contrôle bidirectionnel (bidi override) — spoofing possible dès qu'un contenu utilisateur libre existe.

18.4 Authentification et session admin — ✅ better-auth
Hachage mot de passe, vérification email, expiration session, cookies sécurisés, CSRF, autorisation par rôle, impersonation admin. Ré-authentification requise pour : remboursement, suppression, changement rôle, publication politique, dérogation capacité — chacune auditée.

18.5 Suppression et secrets
Suppression douce préférée (deletedAt, lockedAt sur pages). Aucun secret dans Git (.env.example fourni). redactSensitive() masque les champs sensibles dans les logs structurés.

19. RGPD & GOUVERNANCE DES DONNÉES
Support : minimisation, rétention, droit d'accès, export, suppression, consentement, limitation finalité. Ne jamais inventer une durée de rétention — configurable.

✅ src/pages/api/export-data.ts et audit-export.ts existent — pattern à étendre pour les voyageuses.

✅ delete-account template email existe.

Distinguer suppression compte/profil et conservation transactions historiques.

Contenu culturel/religieux du Trip = public multilingue. Préférences personnelles (régime, accessibilité) = privées, restreintes, auditées.

Notes internes (application_internal_notes, reservation_internal_notes, traveler_internal_notes) jamais sérialisées dans les pages publiques.

20. OBSERVABILITÉ
20.1 Quatre concepts à ne jamais confondre
Audit : trace immuable des actions admin sensibles. ✅ table audit_log + src/lib/audit.ts.

Analytics : mesure agrégée du comportement. Jamais de PII sensible.

Événement de domaine (trip.published, payment.paid, reservation.confirmed) : signal interne idempotent. ❌ à créer.

Notification : alerte interne à l'équipe pour action humaine rapide. ❌ à étendre (le repo a blog_notifications, service_notifications — pattern à réutiliser).

20.2 Logs et erreurs
Événements structurés JSON. Jamais : CB, jetons, mots de passe, PII inutiles. Erreurs typées : ValidationError, UnauthorizedError, ForbiddenError, NotFoundError, ConflictError, CapacityError, PaymentError, ExternalServiceError.

20.3 Événements analytics autorisés
text
page_view, trip_view, trip_filter, apply_start, apply_submit, checkout_start,
payment_start, purchase, contact_submit, newsletter_signup
Jamais : motivation, régime, médical/accessibilité, notes internes.

20.4 Request ID — ❌ à créer
Corrélation via requestId (middleware → Astro.locals → log, action, service, job email, paiement) — sans données sensibles. Absent aujourd'hui (vérifié middleware).

21. BASE DE DONNÉES
21.1 Organisation réelle des schémas
text
src/database/schemas/
  audit-log.schema.ts           ✅ audit_log
  auth.schema.ts                ✅ user, session, account, verification, organization, member, invitation, organization_role
  site.schema.ts                ✅ site_settings, social_links, contact_info, opening_hours, theme_settings
  navigation.schema.ts          ✅ navigation_menus, navigation_items
  page.schema.ts                ✅ pages, page_sections
  page-version.schema.ts        ✅ page_versions
  media.schema.ts               ✅ media_folders, media_files, media_file_alts
  consent.schema.ts             ✅ consent_settings
  blog.schema.ts                ✅ blog_* (posts, translations, categories, tags, comments, reviews, reactions, …)
  services.schema.ts            ✅ services, service_translations, categories, tags, media, availability, …
  services-engagement.schema.ts ✅ service_reactions, notifications, attributes
À créer :

text
  trips.schema.ts               ❌
  departures.schema.ts          ❌
  itinerary.schema.ts           ❌
  travelers.schema.ts           ❌
  applications.schema.ts        ❌
  reservations.schema.ts        ❌
  payments.schema.ts            ❌
  policies-voyage.schema.ts     ❌
  outbox.schema.ts              ❌
  email-voyage.schema.ts        ❌
21.2 Migrations
✅ Drizzle Kit : src/database/migrations/0000 → 0009.

Ajouts à créer : 0010_trips_module.sql, 0011_departures.sql, 0012_itinerary.sql, 0013_travelers_applications.sql, 0014_reservations_payments.sql, 0015_policies_outbox.sql.

Infra PostgreSQL custom : src/database/infra/{functions,triggers,indexes,constraints}.sql.

21.3 Contraintes et transactions
Contraintes DB (unique, not null, FK, check) pour les invariants structurels ; logique métier dans les services. Transactions obligatoires pour : confirmation réservation, application paiement, conversion hold, remboursement, publication avec révision, mutations admin critiques.

21.4 Seeds
Pattern existant : src/database/data/00-media.data.ts à 40-… + manifest.ts.

Ajouts ATLASELLE : 41-trips.data.ts, 42-trip-translations.data.ts, 43-departures.data.ts, 44-itinerary.data.ts, 45-faq.data.ts, 46-demo-admin.data.ts.

Aucune fausse donnée en production (DB_ENV !== PROD). CI exécute migrations + seed + tests.

22. CACHE & INVALIDATION
Trois régimes : cache public (accueil, voyages, fiche voyage, FAQ, à propos), cache admin privé, zone transactionnelle sans cache (checkout, réservation). Après publishTrip, updateDeparture, updateTripTranslation : invalidation en cascade.

État : ✅ src/database/cache.ts + src/core/cache/.

Clés recommandées : trip:{id}, departure:{id}, trips:list, homepage:featured, faq:global.

23. ROUTES, LOADERS, DTO, CONTRATS D'ACTION
23.1 Architecture des routes
Toutes les pages publiques et le back-office vivent sous /[lang]/..., y compris /[lang]/admin. La locale fait partie du contexte de route, jamais du modèle métier. Interdit : tout dossier statique src/pages/fr|en|es|ar.

Legacy src/pages/fr/ et src/pages/ar/ à supprimer sans redirection 301 (site pas encore en production — décision actée).

23.2 Page factory et data loader
text
TripPage → TripHero, TripFacts, TripOverview, TripHighlights, TripItinerary,
           TripPricing, TripFAQ, TripCTA
✅ src/components/pages/TripPage.astro existe. loadTripPage() à créer dans src/modules/trips/loaders/.

Pattern admin : loadAdminTrips(), loadAdminTrip(), loadAdminApplications(), loadAdminReservations() — vérifient contexte, filtres, schéma Zod, type déterministe.

Pattern existant : src/database/loaders/*.loader.ts + src/modules/*/loaders/index.ts.

23.3 Contrats typés
ts
type LoaderResult<T> = { data: T; meta: { total?: number; page?: number; pageSize?: number } };

type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: { code: string; message: string; fieldErrors?: Record<string, string[]> } };
Codes : APPLICATION_CLOSED, APPLICATION_DEADLINE_PASSED, DEPARTURE_SOLD_OUT, CHECKOUT_EXPIRED, PAYMENT_FAILED, PAYMENT_AMOUNT_MISMATCH, RESERVATION_ALREADY_CONFIRMED, UNAUTHORIZED, FORBIDDEN.

DTO explicites (TripSummaryDTO, TripPageDTO, ApplicationDTO, CheckoutDTO, ReservationDTO, AdminApplicationListDTO). Jamais une ligne Drizzle exposée directement.

Pattern existant : src/actions/{admin,blog,services}/index.ts — à étendre.

24. INTÉGRATIONS EXTERNES
Isolation derrière une interface : PaymentProvider, EmailProvider, StorageProvider, AnalyticsProvider.

État :

✅ EmailProvider : src/smtp/providers/{brevo,resend,nodemailer}.ts

✅ StorageProvider : src/media/

❌ PaymentProvider (à créer)

❌ AnalyticsProvider (à créer)

Avant ajout d'un script tiers : pourquoi ? supprimable ? différé ? consentement requis ? Compatibilité RTL du widget paiement à valider avant intégration.

Médias stockés hors dépôt (actuellement public/uploads/ — à migrer vers bucket S3/R2 en production).

25. PERFORMANCE & ACCESSIBILITÉ (Y COMPRIS RTL)
25.1 Principe
text
HTML d'abord → CSS ensuite → JavaScript seulement si nécessaire
25.2 Images et polices
Tailles responsives, dimensions correctes, format moderne, alt, stratégie de chargement (priority hero, lazy reste). font-display: swap, subsetting par script.

25.3 Mouvement et mobile
prefers-reduced-motion: reduce → animations minimisées. Mobile ≠ desktop compressé : layouts mobile/tablette/desktop distincts.

25.4 Accessibilité — cible WCAG 2.2 AA (Pa11y configuré en AAA : plus strict, à garder ; corrige l'incohérence AA vs AAA)
État : ✅ CI exécute Pa11y + Lighthouse CI.

Navigation clavier, focus visible, ordre logique, labels, erreurs associées, contraste, sémantique, alternatives, réduction mouvement, zoom, taille cible, mobile.

RTL : ordre tabulation cohérent avec sens lecture arabe, focus suivant direction, dir correct sur chaque sous-arbre.

26. TESTS
26.1 Pyramide
Unit → Integration → E2E.

26.2 Tests unitaires obligatoires
Existants : 81 fichiers unit Vitest (voir docs/ETAT-REEL.md) couvrant sanitize, XSS, schema, SEO, theme, auth, rate-limit, permissions, i18n, admin, blog, services, cache, search, loaders.

À ajouter : pricing, availability, transitions d'état ATLASELLE, permissions voyage, mapping routes i18n (4 langues — partiellement fait : tests/unit/i18n-routes.test.ts), sanitisation bidi, calculs politique.

26.3 Tests d'intégration
Existants : auth-flow, auth-org, audit, middleware, blog-actions, cms-admin, consent-cms, contact-api, legal-cms, navigation-cycle, db-health.

À ajouter : action candidature, action approbation, service réservation, webhook paiement, pipeline email voyage, permissions admin voyage, transactions DB capacité.

26.4 Tests E2E
Existants : app, auth, blog, cms-admin, services, services-lifecycle × 3 navigateurs (Chromium, Firefox, WebKit).

À ajouter : scénario complet voyage (EN, FR, AR, ES), avec validation RTL bout-en-bout pour AR. Admin : connexion, création voyage, traduction 4 langues, publication, mise à jour départ, revue candidature, recherche réservation/paiement, audit.

26.5 Concurrence et robustesse
Dernière place, deux acheteuses simultanées, expiration hold, retry paiement, webhook dupliqué, annulation + remboursement. Webhook envoyé 2× = 1 paiement, 1 confirmation.

26.6 QA automatisée
Traduction : complétude par langue (FR/EN/AR/ES)

SEO : canonical, hreflang, lang, titles/descriptions, noindex, sitemap

Accessibilité : axe, clavier, labels, titres, contraste + RTL visuel

Performance : LCP, CLS, INP, TTFB, poids JS/images, requêtes

27. INFRASTRUCTURE & EXPLOITATION
27.1 Environnements
État : ✅ DB_ENV ∈ {LOCAL, PROD, TEST} avec DATABASE_URL_LOCAL, DATABASE_URL_PROD, DATABASE_URL_TEST.

27.2 Variables d'environnement
État : ✅ .env.example complet :

text
DB_ENV, DATABASE_URL_LOCAL, DATABASE_URL_PROD, DATABASE_URL_TEST
BETTER_AUTH_SECRET, BETTER_AUTH_URL, SITE_URL
SMTP_PROVIDER, SMTP_FROM_EMAIL, SMTP_FROM_NAME
SMTP_HOST, SMTP_PORT, SMTP_SECURE (Nodemailer)
À ajouter : PAYMENT_SECRET_KEY, PAYMENT_WEBHOOK_SECRET, STORAGE_BUCKET, STORAGE_ENDPOINT, ANALYTICS_KEY.

Validation Zod au démarrage : ✅ src/database/env.ts, src/smtp/env.ts.

27.3 CI/CD — ✅ en place
GitHub Actions sur push/PR main :

Lint & Type Check (ESLint + astro check + pnpm audit)

Unit & Integration (Vitest + coverage, PostgreSQL 16)

E2E (Playwright Chromium + Firefox + WebKit)

Accessibility & Performance (Pa11y + Lighthouse CI)

Build (artefact production sur main)

Plus : CodeQL (.github/workflows/codeql.yml), Dependabot.

27.4 Sauvegardes et reprise
À documenter : RPO, RTO, procédure restauration, panne fournisseur, panne paiement/email/stockage. Tests de restauration réels.

27.5 Modes dégradés
Email indisponible → réservation confirmée, email en file, admin alertée (✅ pattern dead-letter existant)

Analytics indisponible → site continue

Paiement indisponible → checkout bloqué proprement, message dédié, candidature jamais supprimée

CDN média indisponible → contenu textuel utilisable

28. CONTENU INITIAL & MIGRATION DU CLASSEUR
28.1 Trois voyages initiaux
South Africa — 20–28 décembre 2026, 9 j / 8 n, difficulté 3/5. Cape Town, Cape Peninsula, Cape Winelands, safari lodge.

Sicily + Malta — juin 2027, 8 j / 7 n, difficulté 3/5. Catania, Taormina, Syracuse/Ortigia, Noto, Pozzallo, Valletta, Gozo. Liaison Pozzallo–Malte claire, pas de prix journalier.

Andalusia + Morocco — 13–20 mars 2027, 8 j / 7 n, difficulté 3/5. Málaga, Grenade, Cordoue, Tanger, Chefchaouen. Ferry/départ clairs, pas de prix journalier.

Trois Trip + traductions 4 langues, publication progressive (localeVisible).

28.2 Classeur = source d'import, PostgreSQL = source de vérité
Pipeline : classeur → parseur → validation Zod → objets normalisés → transaction DB → rapport (créé/mis à jour/ignoré/échoué/avertissements).

Colonne ES à ajouter au classeur avant import.

28.3 Contrôle qualité avant publication
text
titre 4 langues ✅  résumé 4 langues ✅  hero + alt 4 langues ✅
itinéraire 4 langues ✅  prix ✅  départ ✅  FAQ ✅  SEO 4 langues ✅
Score interne admin (jamais public).

29. GOUVERNANCE D'ARCHITECTURE
Pas de React par réflexe, pas de SPA, pas de CMS externe, pas de microservices, pas de bus d'événements distribué. Monolithe modulaire Astro/PostgreSQL : un dépôt, une app déployable, une base, domaines séparés logiquement.

Avant ajout de dépendance : utilitaire interne possible ? maintenue activement ? augmente JS client ? dépendance forte fournisseur ?

Extensibilité future : davantage de départs, langues, liste d'attente, compte voyageuse, documents, transferts aéroport, assurance, appariement chambres, SMS, WhatsApp.

30. PÉRIMÈTRE V1 / HORS PÉRIMÈTRE
30.1 Obligatoire
text
catalogue voyages, détail voyage, modèle données voyage, départs,
candidatures, revue admin, tarification, disponibilité, checkout, paiement,
réservation, confirmation, email, back-office, médias, FAQ, SEO, analytics,
mentions légales, audit, tests
30.2 Préparé mais pas nécessairement lancé
text
compte voyageuse, workflow avancé sur-mesure, appariement chambres, SMS, WhatsApp
30.3 Hors périmètre (non-goals)
Pas une marketplace, pas un SaaS multi-organisation, pas un CRM complet, pas un moteur de vols, pas un moteur d'hôtels, pas un logiciel de comptabilité.

31. ORDRE D'IMPLÉMENTATION IMPOSÉ
text
01. fondations du dépôt              ✅ (existant)
02. env/config                        ✅
03. tokens de design                  ✅
04. primitives UI                     ✅
05. i18n (4 langues)                  ✅ (routes.ts + ASCII AR + switcher + canonique/hreflang, tests 4 locales)
06. fondations base de données        ✅ (+ migrations 0010/0011, seeds 41→47)
07. types de domaine voyage           ✅ (transitions, pricing pur, dispo pure, tests)
08. Trip                              ✅ (schéma + traductions + contenus + FAQ + admin + actions lifecycle)
09. Departure                         ✅ (prix 100 % admin + holds 30 min + statuts + admin)
10. Itinerary                         ✅ (jours + traductions, seeds 25 j)
11. Media                             ✅ (à étendre pour ATLASELLE)
12. loaders publics                   ✅ (loadTripPage, loadTripsList, departures, booking)
13. pages publiques                   ✅ (liste, fiche, candidature, checkout, confirmation — DB)
14. fondations admin                  ✅ (core/admin/resource-contract)
15. contrat de ressource              ✅ (trips + departures + asserts)
16. admin Trip                        ✅ (liste, fiche, transitions, départs, sidebar)
17. domaine Application/Pricing/Availability ✅ (submit/review/withdraw, holds concurrence prouvée)
18. checkout                          ✅ (session TTL 7 j, tunnel mock prouvé)
19. paiement                          ✅ (provider mock + Stripe fetch, webhook idempotent, refund)
20. réservation                       ✅ (snapshot immuable, confirm/cancel)
21. email (voyage)                    ✅ (12 templates × 4 + worker + rappels dédupliqués)
22. outbox/jobs                       ✅ (worker SKIP LOCKED + cron voyage)
23. audit                             ✅ (+ actions voyage auditées)
24. analytics                         ✅ (allowlist 10 events + endpoint)
25. légal/versioning                  🟡 (page_versions + policies provisoires non publiées — validation juridique requise)
26. tests                             ✅ (140 fichiers / 1462 verts ; E2E voyage écrit, CI navigateurs à valider)
27. performance                       🟡 (Lighthouse CI en place, run à relancer)
28. accessibilité (incl. RTL)         🟡 (Pa11y en place, run à relancer)
29. sécurité                          ✅ (+ CSP Stripe allowlist restante)
30. durcissement production           🟡 (checklist §34 : sauvegarde, monitoring, rollback — ops hors code)
31. lancement                         — (branche feat/voyage-core à merger après CI verte)
Aucune implémentation de paiement ne démarre avant que Trip, Departure, Pricing, Availability et Application soient stabilisés.

31.1 Checklists par étape
Fondations ✅ : Astro démarre, TS strict, alias, lint, format, CI, PostgreSQL, Drizzle, migrations, seed, i18n 4 langues, layout base, tokens, primitives UI, gestion erreurs, request ID, validation env.

Domaine ATLASELLE ❌ : schémas Trip/TripTranslation/Departure/Itinerary/Traveler/Application/Reservation/Payment, machines à états, services domaine, tests unitaires.

Public 🟡 : Accueil, Voyages, Fiche voyage, À propos, Comment ça marche, FAQ, Contact, Mentions légales — 4 langues, SEO, sitemap, robots, données structurées.

Transactionnel ❌ : Candidature, Approbation, Tarification, Disponibilité, Hold, Checkout, Paiement, Webhook, Réservation, Confirmation, Email, anti-doublon.

Admin 🟡 : Auth ✅, rôles ✅, dashboard partiel ; ressources Trips/Departures/Applications/Reservations/Payments/Media/FAQs/Policies/audit.

Production 🟡 : sauvegarde, test restauration, monitoring, logs, alerting, error tracking, en-têtes sécurité ✅, rate limiting ✅, CSP ✅, performance, accessibilité, SEO, E2E 4 langues, E2E paiement, DR.

32. SCÉNARIOS MÉTIER BOUT-EN-BOUT
32.1 Scénario nominal
Visiteuse ouvre /fr/voyages (ou EN/AR/ES)

Sélectionne South Africa

Lit l'itinéraire complet

Voit un départ disponible

Clique « Candidater »

Complète le formulaire

Candidature validée

Persistée

Email mis en file

Admin voit la candidature

Relectrice ouvre

Approuve

Événement d'approbation créé

Email d'approbation mis en file

Voyageuse ouvre le checkout

Serveur recalcule le prix

Serveur vérifie disponibilité

Hold créé

Session paiement créée

Voyageuse paie

Fournisseur envoie webhook

Webhook vérifié

Transaction confirme paiement

Réservation créée/confirmée

Hold converti

Email confirmation mis en file

Événement audit créé

Événement analytics purchase généré

Voyageuse voit la confirmation

Admin voit la réservation confirmée

32.2 Échec et robustesse
Paiement échoué : réservation non confirmée, hold conservé, retry possible

Webhook dupliqué : reconnu doublon → 1 paiement, 1 réservation, 1 confirmation

Dernière place, deux acheteuses : l'une réussit, l'autre DEPARTURE_SOLD_OUT

Concurrence admin : verrouillage optimiste

33. COMPLÉMENTS ET CORRECTIONS DE CETTE VERSION
Astro 7.3.1 — vérifié package.json (README généré, non édité ici — corriger `readme-builder/` si besoin).

better-auth (pas custom) — email/password, email verification, org, rôles, impersonation. Ne pas confondre avec Stripe : le plugin better-auth-stripe ne sert pas au tunnel voyage ; module payments générique + adaptateur Stripe dédié.

Locale par défaut = en — aligné sur src/i18n/config.ts:5 et astro.config.mjs:38, décision actée (README généré non édité ici).

Routage [lang] dynamique uniquement — ✅ FAIT 2026-09-14 : dossiers statiques fr/ et ar/ supprimés, sans 301 (site pas encore en prod). Ne jamais recréer de dossiers fr/en/es/ar en dur.

Ne pas confondre src/modules/services/ (CMS vitrine générique, inachevé) avec les domain services voyage (pricing, availability, booking) ni avec les 11 nouveaux modules.

Architecture core/modules/lib/database documentée telle qu'elle existe, avec correspondance vers les couches conceptuelles (UI/Actions/Domain/Repositories).

Schémas DB existants documentés intégralement : auth (user, session, account, organization, member, invitation, organization_role), audit_log, site_settings/social_links/contact_info/opening_hours/theme_settings, navigation_menus/navigation_items, pages/page_sections/page_versions, media_folders/media_files/media_file_alts, consent_settings, blog_* (25+ tables), services_* (20+ tables).

Migrations 0000 → 0009 documentées. Nouvelles migrations 0010 → 0015 prévues.

SMTP Brevo/Resend/Nodemailer + dead-letter queue JSONL documentés.

Starwind 48 atoms vérifiés comme base UI (voir docs/ETAT-REEL.md).

Tests existants : voir docs/ETAT-REEL.md (comptes réels unit/intégration/E2E) — infrastructure à étendre.

Pa11y (WCAG AAA) + Lighthouse CI — déjà en place, à étendre aux pages voyage.

Rôles better-auth (user, admin, organization_role) → extension vers super_admin, trip_manager, reviewer, finance, support, editor.

Composants ATLASELLE partiels identifiés : AtlaselleHome.astro, TripPage.astro, apply/[trip].astro, trips/[slug].astro. ✅ booking-quote.ts supprimé 2026-09-14 (était mock hors architecture).

✅ FAIT 2026-09-14 — Legacy supprimé : src/pages/fr/candidature/[voyage].astro, src/pages/fr/voyages/[slug].astro, src/pages/fr/conditions.astro, src/pages/ar/conditions.astro.

✅ FAIT 2026-09-14 — i18n/routes.ts créé (src/i18n/routes.ts + tests/unit/i18n-routes.test.ts).

Publication progressive par langue (localeVisible sur trip_translations).

Support RTL arabe avec isolation bidi + propriétés logiques CSS.

Révision juridique qualifiée étendue aux 4 langues.

Sanitisation renforcée bidi (spoofing).

Compatibilité RTL du fournisseur de paiement à valider avant intégration.

Rôles d'édition par langue envisagés (futur).

Contrôle qualité et E2E étendus aux 4 langues.

Colonne ES à ajouter au classeur avant import.

Pattern page_versions réutilisable pour trip_revisions, policy_revisions, faq_revisions, email_template_revisions.

Pattern blog_notifications / service_notifications réutilisable pour application_notifications, payment_notifications, reservation_notifications.

Pattern content-locking (src/core/locks/) réutilisable pour verrouillage optimiste Trip/Departure admin.

34. CHECKLIST DE MISE EN PRODUCTION
Pas de mise en production tant que : tests échouent ; traduction manquante dans une langue prévue ; paiement non vérifié en bac à sable ; concurrence capacité non résolue ; audit indisponible ; sauvegarde indisponible ; mentions légales provisoires ; défaillances accessibilité critiques.

text
[ ] build
[ ] typecheck (astro check)
[ ] lint (ESLint)
[ ] tests unitaires (Vitest)
[ ] tests d'intégration
[ ] tests e2e (Playwright 3 navigateurs)
[ ] QA FR
[ ] QA EN
[ ] QA AR (incl. RTL visuel)
[ ] QA ES
[ ] QA SEO
[ ] QA accessibilité (Pa11y WCAG AAA + Lighthouse CI)
[ ] QA mobile
[ ] QA paiement en bac à sable
[ ] QA webhook
[ ] QA capacité/concurrence
[ ] QA email
[ ] sauvegarde base de données
[ ] test de restauration (réel)
[ ] validation des migrations
[ ] monitoring
[ ] error tracking
[ ] plan de retour arrière (rollback)
35. PRINCIPES ULTIMES & DÉFINITION FINALE
35.1 Architecture finale
text
                             ATLASELLE
                                 │
                  ┌──────────────┴──────────────┐
                  │                              │
               PUBLIC                          ADMIN
                  │                              │
          FR / EN / AR / ES                 FR / EN (V1)
                  │                              │
           Astro pages                    Ressources admin
             [lang]/*                     (core/admin/resource-contract)
                  │                              │
           Loaders publics                 Loaders admin
                  │                              │
                  └──────────────┬───────────────┘
                                 │
                       Domain services
                    (src/modules/*/domain)
                                 │
        ┌────────────┬──────────┼──────────┬────────────┐
        │            │          │          │            │
      Trips       Booking    Payment    Content       Media
        │            │          │          │            │
        └────────────┴──────────┼──────────┴────────────┘
                                 │
                       PostgreSQL / Drizzle
                                 │
             ┌───────────────────┼───────────────────┐
             │                   │                   │
           Audit               Outbox               Jobs
             │                   │                   │
             └───────────────────┼───────────────────┘
                                 │
                       Fournisseurs externes
                    ┌─────────────┼─────────────┐
                    │             │             │
                Paiement        Email        Stockage
                                (Brevo/       (local →
                                Resend/        S3/R2)
                                Nodemailer)
35.2 Règles d'architecture
text
LE CONTENU EST UNE DONNÉE
LES RÈGLES MÉTIER APPARTIENNENT AU DOMAINE
LES ACTIONS SONT DES CONTRATS
LES PAGES SONT DE LA COMPOSITION
LA BASE DE DONNÉES EST LA SOURCE DE VÉRITÉ
LE PAIEMENT EST VÉRIFIÉ CÔTÉ SERVEUR
L'INVENTAIRE EST TRANSACTIONNEL
LE CONTENU PUBLIÉ EST VERSIONNÉ
LES ACTIONS ADMIN SONT AUTORISÉES ET AUDITÉES
LE CONTENU PUBLIC EST CACHEABLE
LES OPÉRATIONS PRIVÉES NE LE SONT PAS
text
NE JAMAIS DUPLIQUER LA VÉRITÉ MÉTIER.
NE JAMAIS FAIRE CONFIANCE AU CLIENT.
NE JAMAIS CACHER LES RÈGLES MÉTIER DANS L'UI.
NE JAMAIS CONTOURNER LES ACTIONS.
NE JAMAIS PUBLIER DE CONTENU NON VALIDÉ.
NE JAMAIS MÉLANGER CONTEXTE DE SÉCURITÉ ADMIN ET PUBLIC.
NE JAMAIS RENDRE L'ÉTAT TRANSACTIONNEL OPTIMISTE.
35.3 Définition finale
ATLASELLE = un site Astro 7 éditorial performant en 4 langues + un modèle de données voyage structuré + un CMS métier spécialisé + un workflow candidature + un moteur de réservation + un moteur de prix administrable multi-devises + un inventaire transactionnel + une intégration Stripe via module payments générique réutilisable + un système de communication + un back-office administrable + une couche d'audit + une architecture i18n complète (RTL inclus, [lang] unique) + une infrastructure de tests et d'observabilité.

Le socle technique existe (better-auth, Drizzle, Starwind, SMTP, i18n, audit, CMS, tests, CI/CD). Le cœur voyage est à construire.

L'objectif : qu'une personne découvre un voyage, le comprenne, candidate, soit évaluée, paie, réserve, reçoive ses informations — dans sa langue — pendant que l'équipe publie, traduit, vend, contrôle, rembourse et audite, sans jamais casser le site, les traductions, l'inventaire ou les finances.

ANNEXE A — MATRICE DES URLS PAR ZONE (4 LANGUES, routage [lang] unique, défaut EN)
Zone	FR	EN (défaut)	AR	ES
Accueil	/fr/	/en/	/ar/	/es/
Liste voyages	/fr/voyages	/en/trips	/ar/trips	/es/viajes
Détail voyage	/fr/voyages/[slug]	/en/trips/[slug]	/ar/trips/[slug]	/es/viajes/[slug]
Candidature	/fr/candidature/[trip]	/en/apply/[trip]	/ar/apply/[trip]	/es/postulacion/[trip]
FAQ	/fr/faq	/en/faq	/ar/faq	/es/faq
Conditions	/fr/conditions	/en/terms	/ar/terms	/es/terminos
Confidentialité	/fr/confidentialite	/en/privacy	/ar/privacy	/es/privacidad
À propos	/fr/a-propos	/en/about	/ar/about	/es/acerca-de
Contact	/fr/contact	/en/contact	/ar/contact	/es/contacto
Admin	/fr/admin/...	/en/admin/...	/ar/admin/...	/es/admin/...
A.1 Slugs des 3 voyages initiaux
Voyage	FR	EN	AR	ES
South Africa	afrique-du-sud	south-africa	south-africa	sudafrica
Sicily + Malta	sicile-malte	sicily-malta	sicily-malta	sicilia-malta
Andalusia + Morocco	andalousie-maroc	andalusia-morocco	andalusia-morocco	andalucia-marruecos
A.2 Dossiers legacy à supprimer
text
src/pages/fr/candidature/[voyage].astro   ⚠️ SUPPRIMER
src/pages/fr/voyages/[slug].astro         ⚠️ SUPPRIMER
src/pages/fr/conditions.astro             ⚠️ SUPPRIMER
src/pages/ar/conditions.astro             ⚠️ SUPPRIMER
Ces routes sont couvertes par src/pages/[lang]/.... Suppression sèche sans 301 (site pas encore en prod — décision actée). Interdit de recréer des dossiers statiques de langue.

ANNEXE B — MATRICE DES SOURCES (classeur + repo)
#	Zone	Source classeur	Table(s) DB cible	État
1	Marque globale	BRAND & GLOBAL	site_settings	✅
2	Système de langues	LANGUAGE & TRANSLATION (colonne ES à ajouter)	src/i18n/	✅
3	Navigation	SITE MAP	navigation_menus, navigation_items	✅
4	Page d'accueil	BRAND & GLOBAL ; SOUTH AFRICA TRIP ; …	pages, page_sections + trips	🟡
5	Modèle page voyage	TRIP PAGE TEMPLATE	trips, trip_translations	❌
6	South Africa	SOUTH AFRICA TRIP ; ITINERARY	trips, trip_translations, itinerary_days	❌
7	Sicily + Malta	SICILY MALTA TRIP ; SICILY MALTA ITIN	idem	❌
8	Andalusia + Morocco	ANDALUSIA MOROCCO ; ANDALUSIA MOROCCO ITIN	idem	❌
9	Tarification & réservation	PRICING & BOOKING ; BOOKING FLOW	departures, applications, reservations, payments	❌
10	FAQ & politiques	FAQ ; POLICIES & SAFETY	faqs, policy_documents	❌
11	Médias	MEDIA ASSETS	media_files, media_file_alts	✅
12	SEO & analytics	SEO & ANALYTICS	pages SEO + blog_post_seo (pattern)	🟡
13	QA finale	ENGINEER HANDOFF ; CONTENT TRACKER	—	🟡
ANNEXE C — MATRICE DES DONNÉES PARTAGÉES
#	Zone	Partagée ?
1	Marque globale	Oui
2	Système de langues	Oui
3	Navigation	Oui
4	Page d'accueil	Partiellement
5	Modèle page voyage	Oui
6	South Africa	Oui
7	Sicily + Malta	Oui
8	Andalusia + Morocco	Oui
9	Tarification & réservation	Oui
10	FAQ & politiques	Non
11	Médias	Oui
12	SEO & analytics	Partiellement
13	QA finale	Oui
ANNEXE D — CHECKLIST D'ACCEPTATION CONSOLIDÉE
Marque — aucun ancien nom ; aucun mélange de langues header/footer.

Langues — sélecteur garde la page équivalente ou applique le repli (§7.6).

Navigation — chaque page publique a un équivalent dans les 4 langues, ou n'apparaît dans le sélecteur que si localeVisible.

Accueil — tout le contenu visible correspond à la langue sélectionnée.

Modèle voyage — dates, prix, capacité, statut identiques dans les 4 langues.

South Africa — pas de prix jour par jour ; une seule évaluation difficulté.

Sicily + Malta — liaison Pozzallo–Malte claire ; pas de prix journalier.

Andalusia + Morocco — choix ferry/départ clairs ; pas de prix journalier.

Tarification — totaux serveur correspondent dans les 4 langues.

FAQ / politiques — contenu juridique validé par personne qualifiée par langue.

Médias — images licenciées ; alt dans les 4 langues.

SEO / analytics — hreflang valides pour locales publiées ; analytics FR/EN/AR/ES corrects.

QA finale — aucune source externe, aucun placeholder, aucun lien cassé, aucun écran multi-langues, RTL validé visuellement.

ANNEXE E — ÉTAT D'AVANCEMENT RÉEL
✅ Déjà en place (socle)
Fondations Astro 7.3.1 + TypeScript strict + alias + ESLint + Prettier + CI/CD

PostgreSQL 16 + Drizzle ORM + migrations 0000 → 0009

better-auth (email/password, email verification, organisations, rôles, impersonation)

i18n 4 langues (en par défaut — décision actée, fr/en/es/ar, ar RTL, routage [lang] unique)

Médias (folders, files, alts localisés, Sharp, upload/delete/list)

SMTP (Brevo/Resend/Nodemailer) + dead-letter queue

Audit (audit_log + src/lib/audit.ts)

Rate limiting, sanitisation, permissions, guards

Starwind (48 atoms vérifiés, voir docs/ETAT-REEL.md) + tokens CSS (voir docs/ETAT-REEL.md)

CMS (pages, sections, navigation, consentement, thème)

Blog (module complet : post, translation, catégorie, tag, commentaire, review, réaction, abonné, notification)

Services (module CMS vitrine générique, inachevé : service, traduction, catégorie, tag, média, disponibilité, SEO — à ne pas confondre avec les domain services voyage ni les 11 nouveaux modules ; isolé, ne pas polluer)

Back-office admin (audit, blog, media, navigation, pages, roles, services, site, stats, theme, users)

Tests : voir docs/ETAT-REEL.md (comptes réels)

Pa11y (WCAG AAA) + Lighthouse CI

Recherche FTS PostgreSQL

Patterns : resource-contract, content-locking, page_versions, dead-letter queue

🟡 Partiellement en place (ATLASELLE)
src/components/pages/AtlaselleHome.astro

src/components/pages/TripPage.astro

src/pages/[lang]/trips/[slug].astro

src/pages/[lang]/apply/[trip].astro

src/pages/api/booking-quote.ts (mock statique à supprimer)

src/pages/[lang]/faq.astro

src/pages/[lang]/terms.astro

src/pages/[lang]/a-propos.astro

❌ À créer
Module trips (schéma, service, actions, loaders, admin, tests)

Module departures (schéma, statuts, capacités)

Module itinerary (jours + traductions)

Module pricing (PricingService)

Module availability (AvailabilityService, SeatHold, transactions capacité)

Module travelers

Module applications (workflow candidature, décisions, événements)

Module reservations (immutabilité prix, statuts)

Module payments (checkout, webhook, idempotence, remboursement)

Module policies-voyage (documents légaux versionnés)

Module outbox (événements domaine)

Module email-voyage (templates 4 langues, deliveries, events)

✅ FAIT 2026-09-14 — src/i18n/routes.ts (table slugs traduits) + tests/unit/i18n-routes.test.ts

Pages publiques : /voyages (liste), /checkout, booking-confirmed

Pages admin : trips, departures, applications, reservations, payments, policies, email-templates, travelers

✅ FAIT 2026-09-14 — Suppression legacy src/pages/fr/ et src/pages/ar/

✅ FAIT 2026-09-14 — src/pages/api/booking-quote.ts supprimé (était listé ici comme mock à supprimer)

loadTripPage(), loadAdminTrips(), loadAdminTrip(), loadAdminApplications(), loadAdminReservations()

Extension : CSP ✅ FAIT (astro.config.mjs) + requestId restant (dir RTL déjà géré par BaseLayout, ne pas dupliquer ; allowlist Stripe à ajouter avec payments)

Renforcement sanitize.ts : neutralisation Unicode bidi

Templates email ATLASELLE (12 × 4 langues)

Migrations 0010 → 0015

Seeds 41 → 46

Tests ATLASELLE (unit, intégration, E2E 4 langues, concurrence)
