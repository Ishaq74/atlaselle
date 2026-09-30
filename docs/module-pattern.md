# Pattern de module Atlaselle

Trois domaines — `blog`, `services`, `trips` — sont alignés sur ce pattern.
Le document est normatif : un module qui ne le suit pas n'est pas conforme, et
le garde-fou `tests/unit/component-architecture.test.ts` le vérifie pour ces
trois domaines.

## Frontières

```
src/modules/<domaine>/     logique métier  — aucune UI, aucun .astro
src/components/<domaine>/   présentation    — aucun accès base, aucun script métier
src/core/                   cœur transverse  — partagé par tous les domaines
```

Deux règles qui portent l'essentiel :

1. **Un composant ne lit jamais la base.** Les données viennent d'un loader qui
   retourne un DTO nommé. Un `getDrizzle()` dans un `.astro` rend le composant
   dépendant du schéma et inutilisable ailleurs.
2. **Un composant n'appelle jamais `astro:actions`.** Il importe un module de
   `modules/<domaine>/client/`, seul habilité à connaître les sélecteurs et les
   actions du domaine.

## Arborescence d'un module

Obligatoire :

```
module.ts          enregistrement du module (contrat core/modules)
capabilities.ts    abilities déclarées, une par ligne
loaders/           lectures BDD → DTO nommé
client/            scripts navigateur, un fichier par feature
admin/             définition de la ressource back-office
```

Optionnel — ne créer le dossier **que s'il est utilisé** :

| Dossier | Rôle | Règle |
|---|---|---|
| `actions/` | façade sur `src/actions/<domaine>/` | toujours une simple réexport |
| `domain/` | types, règles pures, machines à état | sans I/O |
| `engagement/` | adaptateur vers les contrats partagés | seulement si le domaine a des avis/commentaires |
| `i18n/` | libellés des 4 locales | obligatoire dès qu'un texte est affiché |
| `permissions/` | guards d'accès | obligatoire si le domaine a des rôles |
| `repositories/` | accès données partagé par plusieurs consommateurs | une fonction par entité |
| `schema/` | façade sur `src/database/schemas` | une ligne |
| `search/`, `seo/`, `utils/`, `validation/` | façades une ligne | facultatif |

Créer un dossier vide pour « être complet » est une dette : il faut le remplir ou
le supprimer.

## Arborescence des composants

```
src/components/<domaine>/
  <Domaine>Card.astro          cartes de liste
  <Domaine>Detail.astro        page de détail
  <Domaine>ListingPage.astro   page de liste
  <Domaine>AdminList.astro     back-office
  <Domaine>AdminForm.astro     back-office
  admin/                       isolée du public
  detail/  listing/  layout/  ui/     selon les besoins
```

Pas de dossier vide, pas de `index.ts` : les composants s'importent par chemin
explicite. Un baril dans `components/<domaine>/` cache quel composant est le
partagé — c'est exactement le piège qui avait produit trois découpages
différents pour l'engagement.

## L'engagement, cas le plus illustratif

Le même modèle (réactions, avis, commentaires, partage) existe sur trois
domaines. Il est découpé à l'identique, un fichier par rôle, tous préfixés par
le domaine :

```
components/<domaine>/engagement/
  <Domaine>Engagement.astro        orchestrateur : charge le DTO, compose
  <Domaine>EngagementBar.astro     barre réactions + favori + partage
  <Domaine>ReviewSection.astro     onglets liste / écriture + résumé de note
  <Domaine>ReviewForm.astro        formulaire d'avis
  <Domaine>CommentSection.astro    onglets + les trois états de statut
  <Domaine>CommentForm.astro       formulaire de commentaire
```

Et le transverse :

```
components/molecules/Engagement/   atomes agnostiques, ne dépendent d'aucun domaine
core/engagement/                   contrats + client partagé (binding.ts, form.ts)
```

Chaque domaine fournit `modules/<domaine>/engagement/adapter.ts` qui traduit ses
lignes de base vers les contrats des atomes. La mécanique client est dans
`core/engagement/client/binding.ts` (réactions, favori) et `form.ts` (soumission) :
un seul endroit à corriger quand le comportement change, au lieu de trois.

### État d'une réaction : pourquoi `aria-pressed`

Le style actif des boutons est un variant Tailwind `aria-pressed:*`. Le client ne
fait donc que retourner l'attribut. Il ne manipule aucune classe, donc le rendu
ne peut pas diverger de l'état accessible — ce qui avait produit un clic sans
effet visible dans deux implémentations successives.

## Ce qui a été corrigé au passage

Ces problèmes existaient avant l'alignement. Ils documentent les pièges :

- **Badge d'avis inversé.** `recommended` et `notRecommended` pointaient sur la
  même chaîne : un avis négatif affichait « Je recommande ce service ». Les deux
  libellés doivent différer.
- **Clic sans effet.** Bascule de `variant-primary`, classe qui n'existe pas
  dans l'atome.
- **Formulaire qui perdait son titre.** L'atome rend un champ `title` et l'action
  l'accepte, mais le script ne l'envoyait pas.
- **Sélecteurs morts.** Un `querySelector` sur un `data-*` qu'aucun atome
  n'émet n'écoute jamais rien. Les sélecteurs viennent du contrat des atomes.
- **`textContent` sur un bouton.** Remplace le contenu, donc l'icône. Cibler le
  `span[data-…-label]` interne.
- **Libellés en dur.** Les libellés de la carte d'avis blog étaient en anglais
  dans le composant : seuls les voyages et les services localisaient.
- **Réaction du visiteur jamais rendue.** La barre affichait toujours un état
  inactif après rechargement, faute de lecture de la session.

## Vérifier

```bash
pnpm check                      # types
pnpm lint                       # 0 erreur attendue
pnpm build
pnpm vitest run tests/unit      # dont component-architecture
```
