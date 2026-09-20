// Blog post SEO — 10 articles × 4 locales. focusKeyword localisé,
// ogLocale cohérent, schemaMarkup JSON-LD Article minimal.
type L = "fr" | "en" | "es" | "ar";

const OG_LOCALE: Record<L, string> = { fr: "fr_FR", en: "en_US", es: "es_ES", ar: "ar_SA" };
const D = new Date("2026-09-01T09:00:00.000Z");

const S = (
  postId: string,
  locale: L,
  focusKeyword: string,
  focusKeywordScore: number,
  readabilityScore: number,
  headline: string,
) => ({
  id: `bseo-${postId.replace("a766d71b-d90e-460d-ad99-baf3002f57db", "")}-${locale}`,
  postId,
  locale,
  focusKeyword,
  focusKeywordScore,
  readabilityScore,
  metaRobots: "index,follow",
  metaOgType: "article",
  metaOgLocale: OG_LOCALE[locale],
  metaTwitterCard: "summary_large_image",
  schemaMarkup: {
    "@context": "https://schema.org",
    "@type": "Article",
    headline,
    inLanguage: locale,
    author: { "@type": "Person", name: "Oumhani Achour" },
    publisher: { "@type": "Organization", name: "Atlaselle" },
  },
  createdAt: D,
  updatedAt: D,
});

export default [
  // ── Algérie ──
  S("9b4d8fef-badd-4787-ae7b-d91f7c7107c3", "fr", "voyage algérie désert", 92, 78, "Algérie : désert, oasis et Alger"),
  S("9b4d8fef-badd-4787-ae7b-d91f7c7107c3", "en", "algeria desert travel", 90, 80, "Algeria: desert, oasis and Algiers"),
  S("9b4d8fef-badd-4787-ae7b-d91f7c7107c3", "es", "viaje argelia desierto", 88, 76, "Argelia: desierto, oasis y Argel"),
  S("9b4d8fef-badd-4787-ae7b-d91f7c7107c3", "ar", "السفر إلى الجزائر الصحراء", 85, 74, "الجزائر: الصحراء والواحات والعاصمة"),
  // ── Andalousie-Maroc ──
  S("39ee3d3f-56be-4097-915c-db53b8bf927f", "fr", "voyage andalousie maroc", 91, 79, "Andalousie-Maroc : deux rivages"),
  S("39ee3d3f-56be-4097-915c-db53b8bf927f", "en", "andalusia morocco tour", 89, 81, "Andalusia-Morocco: two shores"),
  S("39ee3d3f-56be-4097-915c-db53b8bf927f", "es", "viaje andalucía marruecos", 90, 78, "Andalucía-Marruecos: dos orillas"),
  S("39ee3d3f-56be-4097-915c-db53b8bf927f", "ar", "رحلة الأندلس المغرب", 84, 73, "الأندلس والمغرب: ضفتان"),
  // ── Bosnie ──
  S("d7d77012-392f-49ad-8b72-e5860a1eff5a", "fr", "voyage bosnie sarajevo", 90, 77, "Bosnie : ponts, rivières et vieilles villes"),
  S("d7d77012-392f-49ad-8b72-e5860a1eff5a", "en", "bosnia travel sarajevo", 88, 79, "Bosnia: bridges, rivers and old towns"),
  S("d7d77012-392f-49ad-8b72-e5860a1eff5a", "es", "viaje bosnia sarajevo", 87, 75, "Bosnia: puentes, ríos y ciudades viejas"),
  S("d7d77012-392f-49ad-8b72-e5860a1eff5a", "ar", "السفر إلى البوسنة سراييفو", 83, 72, "البوسنة: جسور وأنهار"),
  // ── Sicile-Malte ──
  S("335960c7-43bb-44eb-84fb-3bb7b2f5969b", "fr", "voyage sicile malte", 91, 78, "Sicile-Malte : la traversée insulaire"),
  S("335960c7-43bb-44eb-84fb-3bb7b2f5969b", "en", "sicily malta travel", 89, 80, "Sicily-Malta: the island crossing"),
  S("335960c7-43bb-44eb-84fb-3bb7b2f5969b", "es", "viaje sicilia malta", 88, 76, "Sicilia-Malta: la travesía insular"),
  S("335960c7-43bb-44eb-84fb-3bb7b2f5969b", "ar", "السفر صقلية مالطا", 84, 73, "صقلية ومالطا: العبور"),
  // ── Route de la Soie ──
  S("cc564fbf-0a61-4554-a5dc-a30fbfb5fb83", "fr", "voyage route de la soie", 93, 77, "Route de la Soie : Samarcande au Song-Kul"),
  S("cc564fbf-0a61-4554-a5dc-a30fbfb5fb83", "en", "silk road tour", 91, 79, "Silk Road: Samarkand to Song-Kul"),
  S("cc564fbf-0a61-4554-a5dc-a30fbfb5fb83", "es", "viaje ruta de la seda", 89, 75, "Ruta de la Seda: Samarcanda al Song-Kul"),
  S("cc564fbf-0a61-4554-a5dc-a30fbfb5fb83", "ar", "رحلة طريق الحرير", 85, 72, "طريق الحرير: سمرقند إلى سونغ كول"),
  // ── Valise ──
  S("c4092370-2aa2-4986-ac3d-9ee0c40622cc", "fr", "liste valise voyage", 95, 82, "Préparer sa valise pour un petit groupe"),
  S("c4092370-2aa2-4986-ac3d-9ee0c40622cc", "en", "packing list travel", 94, 84, "Packing for a small-group journey"),
  S("c4092370-2aa2-4986-ac3d-9ee0c40622cc", "es", "lista maleta viaje", 92, 80, "Preparar la maleta para un grupo pequeño"),
  S("c4092370-2aa2-4986-ac3d-9ee0c40622cc", "ar", "قائمة حقيبة السفر", 88, 76, "تحضير الحقيبة لرحلة في مجموعة صغيرة"),
  // ── Solo ──
  S("e58bf5f3-629e-433f-a53c-804f3de36783", "fr", "voyage solo femme", 96, 83, "Voyager seule, en toute sérénité"),
  S("e58bf5f3-629e-433f-a53c-804f3de36783", "en", "solo female travel", 95, 85, "Travelling solo, with complete serenity"),
  S("e58bf5f3-629e-433f-a53c-804f3de36783", "es", "viajar sola mujer", 93, 81, "Viajar sola, con total serenidad"),
  S("e58bf5f3-629e-433f-a53c-804f3de36783", "ar", "سفر نسائي فردي", 89, 77, "أن تسافري وحدك، بكل طمأنينة"),
  // ── Visas ──
  S("2e254fa0-937a-4575-859c-79b037ee095c", "fr", "visa algérie formalités", 89, 76, "Visas et formalités : le guide"),
  S("2e254fa0-937a-4575-859c-79b037ee095c", "en", "algeria visa requirements", 87, 78, "Visas and formalities: the guide"),
  S("2e254fa0-937a-4575-859c-79b037ee095c", "es", "visado argelia requisitos", 86, 74, "Visados y formalidades: la guía"),
  S("2e254fa0-937a-4575-859c-79b037ee095c", "ar", "تأشيرة الجزائر متطلبات", 82, 72, "التأشيرات والإجراءات: الدليل"),
  // ── Ramadan ──
  S("e4eade2e-cb1c-4852-a326-ab1e77149b82", "fr", "voyager pendant ramadan", 92, 79, "Voyager pendant le Ramadan"),
  S("e4eade2e-cb1c-4852-a326-ab1e77149b82", "en", "traveling during ramadan", 90, 81, "Travelling during Ramadan"),
  S("e4eade2e-cb1c-4852-a326-ab1e77149b82", "es", "viajar durante ramadán", 89, 77, "Viajar durante el Ramadán"),
  S("e4eade2e-cb1c-4852-a326-ab1e77149b82", "ar", "السفر خلال رمضان", 91, 78, "السفر خلال رمضان"),
  // ── Budget ──
  S("2ae90d0f-fa6d-45d8-996f-45d3c1a7060f", "fr", "budget voyage petit groupe", 88, 77, "Budget d'un voyage en petit groupe"),
  S("2ae90d0f-fa6d-45d8-996f-45d3c1a7060f", "en", "small group travel cost", 87, 79, "Small-group travel budget"),
  S("2ae90d0f-fa6d-45d8-996f-45d3c1a7060f", "es", "presupuesto viaje grupo pequeño", 86, 75, "Presupuesto de un viaje en grupo pequeño"),
  S("2ae90d0f-fa6d-45d8-996f-45d3c1a7060f", "ar", "ميزانية رحلة مجموعة صغيرة", 83, 72, "ميزانية رحلة في مجموعة صغيرة"),
];
