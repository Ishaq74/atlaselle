import type { AboutTranslations } from '../config';
import { stone, bronze, houseCivilization, polish } from '../../assets/images/brand';
import { avatar1 } from '../../assets/images/avatars';

export default {
  meta: {
    title: 'About – Atlaselle',
    description: 'Atlaselle designs small-group journeys for women, across medinas, deserts and islands. Discover our story and our founder.',
  },
  hero: {
    eyebrow: 'Our story',
    title: 'Journeys designed as encounters',
    description: 'Atlaselle was born from a simple observation: too many women give up travelling for lack of a reassuring structure. We design small-group journeys — six to fourteen travellers — across medinas, deserts and Mediterranean islands, with the time to truly inhabit each place.',
  },
  mission: {
    eyebrow: 'Our purpose',
    title: 'Mission & Vision',
    description: 'Two pillars guide every one of our itineraries.',
    cards: [
      {
        icon: 'mdi:target',
        title: 'Our Mission',
        description: 'To let every woman travel with peace of mind, alone without being isolated: carefully assembled small groups, handpicked accommodation, local guides and a pace that respects everyone.',
      },
      {
        icon: 'mdi:eye-outline',
        title: 'Our Vision',
        description: 'Travel that leaves a positive trace: for the travellers who come back transformed, and for the communities that host us — artisans, guesthouses and local tables first.',
      },
    ],
  },
  values: {
    eyebrow: 'What defines us',
    title: 'Our Values',
    description: 'The principles that guide Atlaselle every day.',
    items: [
      {
        title: 'Care',
        description: 'Every itinerary is field-tested. Unhurried pace, real breaks, quiet time every day: a journey should remain a pleasure, not a race.',
        image: stone,
        value: 'care',
      },
      {
        title: 'Trust',
        description: 'Line-by-line transparent pricing, clear cancellation terms, insurance explained without jargon. No hidden extras, no surprises.',
        image: bronze,
        value: 'trust',
      },
      {
        title: 'Encounter',
        description: 'We favour local addresses: guesthouses, artisan workshops, family tables. The journey begins with those who welcome us.',
        image: houseCivilization,
        value: 'encounter',
      },
      {
        title: 'Respect',
        description: 'For the planet, for cultures, and for your inner rhythm. Identified prayer spaces, programmes adapted during Ramadan, small groups to limit our footprint.',
        image: polish,
        value: 'respect',
      },
    ],
  },
  team: {
    eyebrow: 'The founder',
    title: 'Who is behind Atlaselle',
    description: 'Atlaselle is a human-scale company: one person designs, tests and accompanies every journey.',
    members: [
      {
        name: 'Oumhani Achour',
        role: 'Founder & Journey Designer',
        bio: 'A field traveller, Oumhani explored Algeria, Morocco, Andalusia, Bosnia and the Silk Road before turning them into itineraries. She personally answers every application.',
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
    title: 'Ready for your next journey?',
    description: 'Browse our destinations or write to us directly: every journey begins with a conversation.',
    primaryButton: { text: 'View trips', href: '/en/trips' },
    secondaryButton: { text: 'Contact us', href: '/en/contact' },
  },
} satisfies AboutTranslations;
