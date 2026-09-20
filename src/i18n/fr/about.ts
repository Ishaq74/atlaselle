import type { AboutTranslations } from '../config';
import { stone, bronze, houseCivilization, polish } from '../../assets/images/brand';
import { avatar1 } from '../../assets/images/avatars';

export default {
  meta: {
    title: 'À Propos – Atlaselle',
    description: "Atlaselle conçoit des voyages en petit groupe pour femmes, entre médinas, déserts et îles. Découvrez l'histoire et la fondatrice.",
  },
  hero: {
    eyebrow: 'Notre histoire',
    title: 'Des voyages pensés comme des rencontres',
    description: "Atlaselle est née d'un constat simple : trop de femmes renoncent à partir faute d'un cadre rassurant. Nous concevons des voyages en petit groupe — six à quatorze voyageuses — entre médinas, déserts et îles méditerranéennes, avec le temps de vraiment habiter chaque lieu.",
  },
  mission: {
    eyebrow: 'Notre raison d\'être',
    title: 'Mission & Vision',
    description: 'Deux piliers guident chacun de nos itinéraires.',
    cards: [
      {
        icon: 'mdi:target',
        title: 'Notre Mission',
        description: "Permettre à chaque femme de voyager sereinement, seule sans être isolée : petits groupes composés avec soin, hébergements choisis sur place, guides locales et un rythme qui respecte chacune.",
      },
      {
        icon: 'mdi:eye-outline',
        title: 'Notre Vision',
        description: "Un voyage qui laisse une trace positive : pour les voyageuses qui reviennent transformées, et pour les communautés qui nous accueillent — artisans, maisons d'hôtes et tables locales d'abord.",
      },
    ],
  },
  values: {
    eyebrow: 'Ce qui nous définit',
    title: 'Nos Valeurs',
    description: 'Les principes qui guident Atlaselle au quotidien.',
    items: [
      {
        title: 'Attention',
        description: "Chaque itinéraire est testé sur le terrain. Rythme posé, pauses réelles, temps calmes chaque jour : le voyage doit rester un plaisir, pas une course.",
        image: stone,
        value: 'care',
      },
      {
        title: 'Confiance',
        description: "Prix transparents ligne par ligne, conditions d'annulation claires, assurance expliquée sans jargon. Aucun supplément caché, aucune surprise.",
        image: bronze,
        value: 'trust',
      },
      {
        title: 'Rencontre',
        description: "Nous privilégions les adresses locales : maisons d'hôtes, ateliers d'artisans, tables familiales. Le voyage commence par celles et ceux qui nous accueillent.",
        image: houseCivilization,
        value: 'encounter',
      },
      {
        title: 'Respect',
        description: "De la planète, des cultures, et de votre rythme intérieur. Espaces de prière identifiés, programmes adaptés pendant le Ramadan, petits groupes pour limiter notre empreinte.",
        image: polish,
        value: 'respect',
      },
    ],
  },
  team: {
    eyebrow: 'La fondatrice',
    title: 'Qui est derrière Atlaselle',
    description: "Atlaselle est une entreprise à taille humaine : une seule personne conçoit, teste et accompagne chaque voyage.",
    members: [
      {
        name: 'Oumhani Achour',
        role: 'Fondatrice & Conceptrice de voyages',
        bio: "Voyageuse de terrain, Oumhani a arpenté l'Algérie, le Maroc, l'Andalousie, la Bosnie et la Route de la Soie avant d'en faire des itinéraires. Elle répond personnellement à chaque candidature.",
        image: avatar1,
        socials: [
          { name: 'LinkedIn', icon: 'linkedin', href: 'https://linkedin.com/in/oumhani-achour' },
          { name: 'Instagram', icon: 'instagram', href: 'https://instagram.com/atlaselle.voyages' },
          { name: 'Email', icon: 'mail', href: 'mailto:contact@atlaselle.com' },
        ],
      },
    ],
  },
  cta: {
    title: "Prête pour votre prochain voyage ?",
    description: "Parcourez nos destinations ou écrivez-nous directement : chaque voyage commence par une conversation.",
    primaryButton: { text: 'Voir les voyages', href: '/fr/trips' },
    secondaryButton: { text: 'Nous contacter', href: '/fr/contact' },
  },
} satisfies AboutTranslations;
