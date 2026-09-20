// Service SEO — 6 services × 4 locales. ogLocale cohérent, schema Service.
type L = "fr" | "en" | "es" | "ar";

const OG_LOCALE: Record<L, string> = { fr: "fr_FR", en: "en_US", es: "es_ES", ar: "ar_SA" };
const D = new Date("2026-06-15T09:00:00.000Z");

const S = (
  serviceId: string,
  locale: L,
  focusKeyword: string,
  focusKeywordScore: number,
  readabilityScore: number,
  name: string,
) => ({
  id: `sseo-${serviceId.replace("1a7c33c1-16c7-48b8-ac6b-baea03eb9bb2", "")}-${locale}`,
  serviceId,
  locale,
  focusKeyword,
  focusKeywordScore,
  readabilityScore,
  metaRobots: "index,follow",
  metaOgType: "service",
  metaOgLocale: OG_LOCALE[locale],
  schemaMarkup: JSON.stringify({
    "@context": "https://schema.org",
    "@type": "Service",
    name,
    provider: { "@type": "Organization", name: "Atlaselle" },
    areaServed: "Worldwide",
  }),
  createdAt: D,
  updatedAt: D,
});

export default [
  // ── Visa ──
  S("4fe869b9-68ee-4cd9-bacd-29258d552049", "fr", "assistance visa algérie", 93, 82, "Assistance visa et formalités"),
  S("4fe869b9-68ee-4cd9-bacd-29258d552049", "en", "algeria visa assistance", 91, 84, "Visa assistance and formalities"),
  S("4fe869b9-68ee-4cd9-bacd-29258d552049", "es", "asistencia visado argelia", 90, 80, "Asistencia de visados y formalidades"),
  S("4fe869b9-68ee-4cd9-bacd-29258d552049", "ar", "مساعدة تأشيرة الجزائر", 87, 78, "مساعدة التأشيرة والإجراءات"),
  // ── Guide ──
  S("9493e50e-ebcd-4268-b5ef-5cd660f0904a", "fr", "guide privée francophone", 92, 83, "Guide privée francophone à la journée"),
  S("9493e50e-ebcd-4268-b5ef-5cd660f0904a", "en", "private french speaking guide", 90, 85, "Private French-speaking guide for a day"),
  S("9493e50e-ebcd-4268-b5ef-5cd660f0904a", "es", "guía privada francófona", 89, 81, "Guía privada francófona por un día"),
  S("9493e50e-ebcd-4268-b5ef-5cd660f0904a", "ar", "مرشدة خاصة ناطقة بالفرنسية", 86, 77, "مرشدة خاصة ناطقة بالفرنسية"),
  // ── Transfert ──
  S("347b90bb-e76b-4da5-85d4-74233f6118ef", "fr", "transfert aéroport privé", 88, 82, "Transfert aéroport privé"),
  S("347b90bb-e76b-4da5-85d4-74233f6118ef", "en", "private airport transfer", 89, 84, "Private airport transfer"),
  S("347b90bb-e76b-4da5-85d4-74233f6118ef", "es", "traslado privado aeropuerto", 88, 80, "Traslado privado al aeropuerto"),
  S("347b90bb-e76b-4da5-85d4-74233f6118ef", "ar", "نقل خاص من المطار", 85, 78, "نقل خاص من المطار"),
  // ── Sur-mesure ──
  S("76a25f24-0a19-44f0-8596-9e1430ae62e8", "fr", "consultation voyage sur mesure", 91, 81, "Consultation voyage sur-mesure"),
  S("76a25f24-0a19-44f0-8596-9e1430ae62e8", "en", "custom travel consultation", 90, 83, "Custom travel consultation"),
  S("76a25f24-0a19-44f0-8596-9e1430ae62e8", "es", "consulta viaje a medida", 89, 79, "Consulta de viaje a medida"),
  S("76a25f24-0a19-44f0-8596-9e1430ae62e8", "ar", "استشارة سفر حسب الطلب", 86, 76, "استشارة سفر حسب الطلب"),
  // ── Extension désert ──
  S("70ffd9d1-2f73-4e94-8536-02d548a92419", "fr", "extension désert algérie", 89, 80, "Extension désert — 2 jours"),
  S("70ffd9d1-2f73-4e94-8536-02d548a92419", "en", "algeria desert extension", 88, 82, "Desert extension — 2 days"),
  S("70ffd9d1-2f73-4e94-8536-02d548a92419", "es", "extensión desierto argelia", 87, 78, "Extensión desierto — 2 días"),
  S("70ffd9d1-2f73-4e94-8536-02d548a92419", "ar", "امتداد صحراء الجزائر", 84, 75, "امتداد الصحراء — يومان"),
  // ── Assurance ──
  S("00ccc16b-5fc1-4370-9b7e-8ff31c51ffdf", "fr", "assurance voyage annulation", 87, 80, "Assurance et assistance voyage"),
  S("00ccc16b-5fc1-4370-9b7e-8ff31c51ffdf", "en", "travel insurance cancellation", 88, 82, "Travel insurance and assistance"),
  S("00ccc16b-5fc1-4370-9b7e-8ff31c51ffdf", "es", "seguro viaje cancelación", 86, 78, "Seguro y asistencia de viaje"),
  S("00ccc16b-5fc1-4370-9b7e-8ff31c51ffdf", "ar", "تأمين السفر إلغاء", 83, 75, "تأمين ومساعدة السفر"),
];
