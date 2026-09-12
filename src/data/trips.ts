import type { Locale } from "@i18n/config";

export type TripId = "south-africa" | "sicily-malta" | "andalusia-morocco";

type LocalizedTrip = {
  slug: string;
  title: string;
  summary: string;
  difficulty: string;
  highlights: string[];
  itinerary: { title: string; text: string }[];
};

export type Trip = {
  id: TripId;
  dates: string;
  price: number;
  currency: "EUR";
  capacity: number;
  remainingPlaces: number;
  status: "open" | "interest-list";
  deposit: number;
  finalPaymentDue: string;
  roomRule: string;
  translations: Record<Exclude<Locale, "es">, LocalizedTrip>;
};

export const TRIPS: Trip[] = [
  {
    id: "south-africa", dates: "4–13 October 2027", price: 3890, currency: "EUR", capacity: 14, remainingPlaces: 8, status: "open", deposit: 750, finalPaymentDue: "6 July 2027", roomRule: "Shared twin room included; limited single rooms available on request.",
    translations: {
      en: { slug: "south-africa", title: "South Africa: Wild Coast & Winelands", summary: "A considered journey through Cape landscapes, winelands and the living wild.", difficulty: "Moderate — comfortable walking and varied terrain.", highlights: ["Cape Town and the Winelands", "Guided wildlife encounters", "Small, locally rooted stays"], itinerary: [{ title: "Cape Town", text: "Arrive in Cape Town, settle in and gather for a welcome dinner." }, { title: "Winelands", text: "Travel through the Cape Winelands for tastings, walks and unhurried table time." }, { title: "The wild", text: "Continue to a private reserve for respectful wildlife viewing and a final fireside evening." }] },
      fr: { slug: "afrique-du-sud", title: "Afrique du Sud : côte sauvage & vignobles", summary: "Un voyage attentif entre les paysages du Cap, les vignobles et la nature vivante.", difficulty: "Modéré — marche confortable et terrains variés.", highlights: ["Le Cap et les vignobles", "Rencontres animalières guidées", "Adresses locales à taille humaine"], itinerary: [{ title: "Le Cap", text: "Arrivée au Cap, installation et dîner de bienvenue." }, { title: "Les vignobles", text: "Route à travers les vignobles du Cap, dégustations, balades et temps à table." }, { title: "La nature", text: "Séjour dans une réserve privée pour observer la faune avec respect et conclure autour du feu." }] },
      ar: { slug: "south-africa", title: "جنوب أفريقيا: الساحل البري وبلاد النبيذ", summary: "رحلة متأنية بين مناظر الكاب وبلاد النبيذ والطبيعة الحية.", difficulty: "متوسط — مشي مريح وتضاريس متنوعة.", highlights: ["كيب تاون وبلاد النبيذ", "لقاءات موجهة مع الحياة البرية", "إقامات محلية صغيرة"], itinerary: [{ title: "كيب تاون", text: "الوصول إلى كيب تاون والاستقرار وعشاء ترحيبي." }, { title: "بلاد النبيذ", text: "الانتقال عبر كروم الكاب للتذوق والمشي ووقت هادئ حول المائدة." }, { title: "البرية", text: "المتابعة إلى محمية خاصة لمشاهدة الحياة البرية باحترام وأمسية أخيرة قرب النار." }] },
    },
  },
  {
    id: "sicily-malta", dates: "12–20 May 2027", price: 3290, currency: "EUR", capacity: 12, remainingPlaces: 5, status: "open", deposit: 650, finalPaymentDue: "12 February 2027", roomRule: "Shared twin room included; limited single rooms available on request.",
    translations: {
      en: { slug: "sicily-malta", title: "Sicily + Malta: Two Islands, One Crossing", summary: "Stone, sea and layered cultures across southeastern Sicily and Malta.", difficulty: "Easy to moderate — city walks and coastal paths.", highlights: ["Baroque towns of Sicily", "Ferry from Pozzallo to Malta", "Maltese harbours and limestone villages"], itinerary: [{ title: "Southeastern Sicily", text: "Begin among markets, baroque streets and the coastal rhythm of Sicily." }, { title: "Pozzallo → Malta", text: "Board the scheduled fast ferry from Pozzallo to Malta; the crossing is included and coordinated by ATLASELLE." }, { title: "Malta", text: "Explore harbour cities, village tables and the island's luminous coast." }] },
      fr: { slug: "sicile-malte", title: "Sicile + Malte : deux îles, une traversée", summary: "Pierre, mer et cultures superposées entre le sud-est sicilien et Malte.", difficulty: "Facile à modéré — balades urbaines et sentiers côtiers.", highlights: ["Villes baroques de Sicile", "Ferry de Pozzallo à Malte", "Ports maltais et villages de calcaire"], itinerary: [{ title: "Sud-est de la Sicile", text: "Débutez entre marchés, rues baroques et rythme côtier sicilien." }, { title: "Pozzallo → Malte", text: "Embarquement sur le ferry rapide régulier de Pozzallo à Malte ; la traversée est incluse et coordonnée par ATLASELLE." }, { title: "Malte", text: "Découvrez les villes portuaires, les tables de village et le littoral lumineux de l'île." }] },
      ar: { slug: "sicily-malta", title: "صقلية + مالطا: جزيرتان وعبور واحد", summary: "حجر وبحر وثقافات متراكبة عبر جنوب شرق صقلية ومالطا.", difficulty: "سهل إلى متوسط — مشي في المدن والمسارات الساحلية.", highlights: ["مدن صقلية الباروكية", "عبّارة بوزالو إلى مالطا", "موانئ مالطا وقرى الحجر الجيري"], itinerary: [{ title: "جنوب شرق صقلية", text: "نبدأ بين الأسواق والشوارع الباروكية وإيقاع الساحل الصقلي." }, { title: "بوزالو ← مالطا", text: "الصعود إلى العبّارة السريعة المجدولة من Pozzallo إلى Malta؛ العبور مشمول ومنسق من ATLASELLE." }, { title: "مالطا", text: "استكشف مدن الموانئ وموائد القرى وساحل الجزيرة المضيء." }] },
    },
  },
  {
    id: "andalusia-morocco", dates: "7–16 September 2027", price: 3590, currency: "EUR", capacity: 14, remainingPlaces: 10, status: "interest-list", deposit: 700, finalPaymentDue: "7 June 2027", roomRule: "Shared twin room included; limited single rooms available on request.",
    translations: {
      en: { slug: "andalusia-morocco", title: "Andalusia + Morocco: Across the Strait", summary: "An intimate passage between Andalusian cities and northern Morocco.", difficulty: "Moderate — historic centres, hills and warm weather.", highlights: ["Seville and Cádiz", "Ferry crossing the Strait of Gibraltar", "Tangier and Chefchaouen"], itinerary: [{ title: "Andalusia", text: "Meet in Seville before following the Atlantic edge toward Cádiz and Tarifa." }, { title: "Choose your crossing", text: "Departure is from Tarifa or Algeciras depending on the confirmed ferry timetable; ATLASELLE confirms the selected port before final payment." }, { title: "Northern Morocco", text: "Land in Tangier and travel through northern Morocco with local hosts." }] },
      fr: { slug: "andalousie-maroc", title: "Andalousie + Maroc : traverser le détroit", summary: "Un passage intimiste entre les villes andalouses et le nord du Maroc.", difficulty: "Modéré — centres historiques, collines et météo chaude.", highlights: ["Séville et Cadix", "Traversée du détroit de Gibraltar", "Tanger et Chefchaouen"], itinerary: [{ title: "Andalousie", text: "Rendez-vous à Séville avant de suivre l'Atlantique vers Cadix et Tarifa." }, { title: "Choisir la traversée", text: "Départ de Tarifa ou d'Algésiras selon les horaires de ferry confirmés ; ATLASELLE confirme le port retenu avant le solde." }, { title: "Nord du Maroc", text: "Arrivée à Tanger puis route dans le nord du Maroc avec des hôtes locaux." }] },
      ar: { slug: "andalusia-morocco", title: "الأندلس + المغرب: عبر المضيق", summary: "عبور حميم بين مدن الأندلس وشمال المغرب.", difficulty: "متوسط — مراكز تاريخية وتلال وطقس دافئ.", highlights: ["إشبيلية وقادس", "عبور مضيق جبل طارق", "طنجة وشفشاون"], itinerary: [{ title: "الأندلس", text: "نلتقي في إشبيلية ثم نتبع حافة الأطلسي نحو قادس وطريفة." }, { title: "اختيار العبور", text: "المغادرة من طريفة أو الجزيرة الخضراء بحسب جدول العبّارة المؤكد؛ تؤكد ATLASELLE الميناء المختار قبل الدفعة النهائية." }, { title: "شمال المغرب", text: "الوصول إلى طنجة والسفر عبر شمال المغرب مع مضيفين محليين." }] },
    },
  },
];

export function getTripBySlug(locale: Locale, slug: string) {
  return TRIPS.find((trip) => trip.translations[locale as Exclude<Locale, "es">]?.slug === slug || (locale === "es" && trip.id === slug));
}

export function tripUrl(locale: Locale, trip: Trip) {
  const slug = locale === "es" ? trip.id : trip.translations[locale as Exclude<Locale, "es">].slug;
  return locale === "fr" ? `/fr/voyages/${slug}` : `/${locale}/trips/${slug}`;
}

/** The sole server-side calculation used by application and payment flows. */
export function calculateTripTotal(trip: Trip, travelers = 1) {
  const quantity = Number.isInteger(travelers) && travelers > 0 ? travelers : 1;
  return { currency: trip.currency, travelers: quantity, total: trip.price * quantity, depositDue: trip.deposit * quantity, balanceDue: (trip.price - trip.deposit) * quantity };
}
