import type { AboutTranslations } from '../config';
import { stone, bronze, houseCivilization, polish } from '../../assets/images/brand';
import { avatar1 } from '../../assets/images/avatars';

export default {
  meta: {
    title: 'Acerca de – Atlaselle',
    description: 'Atlaselle diseña viajes en grupo pequeño para mujeres, entre medinas, desiertos e islas. Descubre nuestra historia y nuestra fundadora.',
  },
  hero: {
    eyebrow: 'Nuestra historia',
    title: 'Viajes pensados como encuentros',
    description: 'Atlaselle nació de una observación sencilla: demasiadas mujeres renuncian a viajar por falta de un marco tranquilizador. Diseñamos viajes en grupo pequeño — de seis a catorce viajeras — entre medinas, desiertos e islas mediterráneas, con tiempo para habitar de verdad cada lugar.',
  },
  mission: {
    eyebrow: 'Nuestra razón de ser',
    title: 'Misión y Visión',
    description: 'Dos pilares guían cada uno de nuestros itinerarios.',
    cards: [
      {
        icon: 'mdi:target',
        title: 'Nuestra Misión',
        description: 'Permitir que cada mujer viaje con serenidad, sola sin estar aislada: grupos pequeños compuestos con cuidado, alojamientos elegidos sobre el terreno, guías locales y un ritmo que respeta a cada una.',
      },
      {
        icon: 'mdi:eye-outline',
        title: 'Nuestra Visión',
        description: 'Un viaje que deje una huella positiva: para las viajeras que vuelven transformadas y para las comunidades que nos acogen — artesanos, casas de huéspedes y mesas locales primero.',
      },
    ],
  },
  values: {
    eyebrow: 'Lo que nos define',
    title: 'Nuestros Valores',
    description: 'Los principios que guían Atlaselle cada día.',
    items: [
      {
        title: 'Atención',
        description: 'Cada itinerario se prueba sobre el terreno. Ritmo pausado, pausas reales, tiempos de calma cada día: el viaje debe seguir siendo un placer, no una carrera.',
        image: stone,
        value: 'care',
      },
      {
        title: 'Confianza',
        description: 'Precios transparentes línea por línea, condiciones de cancelación claras, seguro explicado sin jerga. Ningún suplemento oculto, ninguna sorpresa.',
        image: bronze,
        value: 'trust',
      },
      {
        title: 'Encuentro',
        description: 'Privilegiamos las direcciones locales: casas de huéspedes, talleres de artesanos, mesas familiares. El viaje empieza por quienes nos acogen.',
        image: houseCivilization,
        value: 'encounter',
      },
      {
        title: 'Respeto',
        description: 'Por el planeta, por las culturas y por tu ritmo interior. Espacios de oración identificados, programas adaptados durante el Ramadán, grupos pequeños para limitar nuestra huella.',
        image: polish,
        value: 'respect',
      },
    ],
  },
  team: {
    eyebrow: 'La fundadora',
    title: 'Quién está detrás de Atlaselle',
    description: 'Atlaselle es una empresa a escala humana: una sola persona diseña, prueba y acompaña cada viaje.',
    members: [
      {
        name: 'Oumhani Achour',
        role: 'Fundadora y Diseñadora de viajes',
        bio: 'Viajera de terreno, Oumhani recorrió Argelia, Marruecos, Andalucía, Bosnia y la Ruta de la Seda antes de convertirlos en itinerarios. Responde personalmente a cada candidatura.',
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
    title: '¿Lista para tu próximo viaje?',
    description: 'Explora nuestros destinos o escríbenos directamente: cada viaje empieza con una conversación.',
    primaryButton: { text: 'Ver viajes', href: '/es/viajes' },
    secondaryButton: { text: 'Contáctanos', href: '/es/contacto' },
  },
} satisfies AboutTranslations;
