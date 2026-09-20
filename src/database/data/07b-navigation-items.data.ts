// Navigation Atlaselle — URLs réelles du site (routes [lang] + pages CMS légales).
// Header : Voyages, Blog, Services, À propos, Contact (×4 locales). La FAQ est
// intégrée en section de la page d'accueil (plus de page /faq dédiée).
// Footer legal : Mentions / Conditions de réservation / Assurance voyage / CGV.
// Slugs AR = ASCII (convention i18n/routes.ts). sortOrder unique par menu+locale.
// showIcon=true sur header (icônes visibles), false sur footer (texte seul).
export default [
  // ═══════════ HEADER (fr) ═══════════
  { id: "d3c0fadc-8361-4fcd-960b-722c2372a9a0", menuId: "menu-header", locale: "fr", label: "Voyages", url: "/fr/trips", icon: "mdi:airplane", showIcon: true, sortOrder: 0, parentId: null, isActive: true, openInNewTab: false },
  { id: "ca686f26-4699-46b3-b5e9-b69ad692e6d6", menuId: "menu-header", locale: "fr", label: "Blog", url: "/fr/blog", icon: "mdi:post-outline", showIcon: true, sortOrder: 1, parentId: null, isActive: true, openInNewTab: false },
  { id: "bfe8fdee-5f54-4e49-94bf-51c28cee3b6e", menuId: "menu-header", locale: "fr", label: "Services", url: "/fr/services", icon: "mdi:hand-heart-outline", showIcon: true, sortOrder: 2, parentId: null, isActive: true, openInNewTab: false },
  { id: "a23aafbd-3d57-489a-8666-d54decc7ec01", menuId: "menu-header", locale: "fr", label: "À propos", url: "/fr/a-propos", icon: "mdi:information-outline", showIcon: true, sortOrder: 3, parentId: null, isActive: true, openInNewTab: false },
  { id: "94bf7130-b1a6-4c29-8351-22b0aa4e03fc", menuId: "menu-header", locale: "fr", label: "Contact", url: "/fr/contact", icon: "mdi:email-outline", showIcon: true, sortOrder: 4, parentId: null, isActive: true, openInNewTab: false },
  // ═══════════ HEADER (en) ═══════════
  { id: "4d74d0a3-1a0d-4fef-8f14-ddbb2d3dd9d7", menuId: "menu-header", locale: "en", label: "Trips", url: "/en/trips", icon: "mdi:airplane", showIcon: true, sortOrder: 0, parentId: null, isActive: true, openInNewTab: false },
  { id: "61908589-93e1-4f22-8426-d1d1e9ab89cd", menuId: "menu-header", locale: "en", label: "Blog", url: "/en/blog", icon: "mdi:post-outline", showIcon: true, sortOrder: 1, parentId: null, isActive: true, openInNewTab: false },
  { id: "ce8cd301-2525-4e75-9c7b-03f95ac70b25", menuId: "menu-header", locale: "en", label: "Services", url: "/en/services", icon: "mdi:hand-heart-outline", showIcon: true, sortOrder: 2, parentId: null, isActive: true, openInNewTab: false },
  { id: "af5891e2-ac61-4ff1-92f5-59721758ce3e", menuId: "menu-header", locale: "en", label: "About", url: "/en/about", icon: "mdi:information-outline", showIcon: true, sortOrder: 3, parentId: null, isActive: true, openInNewTab: false },
  { id: "65d9f14f-1a9e-4ed0-9192-00771b35e71b", menuId: "menu-header", locale: "en", label: "Contact", url: "/en/contact", icon: "mdi:email-outline", showIcon: true, sortOrder: 4, parentId: null, isActive: true, openInNewTab: false },
  // ═══════════ HEADER (es) ═══════════
  { id: "e2a0e90e-2cb2-4de3-ac9c-6bda023a7926", menuId: "menu-header", locale: "es", label: "Viajes", url: "/es/viajes", icon: "mdi:airplane", showIcon: true, sortOrder: 0, parentId: null, isActive: true, openInNewTab: false },
  { id: "4d616a74-f23f-4c18-ab78-fb5cb95a5a80", menuId: "menu-header", locale: "es", label: "Blog", url: "/es/blog", icon: "mdi:post-outline", showIcon: true, sortOrder: 1, parentId: null, isActive: true, openInNewTab: false },
  { id: "756417fc-7896-4c27-b6f0-2924dca6eef8", menuId: "menu-header", locale: "es", label: "Servicios", url: "/es/services", icon: "mdi:hand-heart-outline", showIcon: true, sortOrder: 2, parentId: null, isActive: true, openInNewTab: false },
  { id: "9e2bf0af-8df7-425d-9675-13ab224f2817", menuId: "menu-header", locale: "es", label: "Acerca de", url: "/es/acerca-de", icon: "mdi:information-outline", showIcon: true, sortOrder: 3, parentId: null, isActive: true, openInNewTab: false },
  { id: "a10637e2-fceb-4f3a-abd6-56b6dbc6abaa", menuId: "menu-header", locale: "es", label: "Contacto", url: "/es/contacto", icon: "mdi:email-outline", showIcon: true, sortOrder: 4, parentId: null, isActive: true, openInNewTab: false },
  // ═══════════ HEADER (ar) ═══════════
  { id: "8a4bd83b-58de-4016-87dd-552326a59a8f", menuId: "menu-header", locale: "ar", label: "الرحلات", url: "/ar/trips", icon: "mdi:airplane", showIcon: true, sortOrder: 0, parentId: null, isActive: true, openInNewTab: false },
  { id: "29db0a91-cf6f-4721-aae4-1d6923731f55", menuId: "menu-header", locale: "ar", label: "المدونة", url: "/ar/blog", icon: "mdi:post-outline", showIcon: true, sortOrder: 1, parentId: null, isActive: true, openInNewTab: false },
  { id: "68a572d9-8f41-45fc-b632-8081ffdf597d", menuId: "menu-header", locale: "ar", label: "الخدمات", url: "/ar/services", icon: "mdi:hand-heart-outline", showIcon: true, sortOrder: 2, parentId: null, isActive: true, openInNewTab: false },
  { id: "622fe37a-7f1f-45cd-9ce1-78da28e06af6", menuId: "menu-header", locale: "ar", label: "من نحن", url: "/ar/about", icon: "mdi:information-outline", showIcon: true, sortOrder: 3, parentId: null, isActive: true, openInNewTab: false },
  { id: "d601a017-4d42-4b89-98d9-3daf97ede643", menuId: "menu-header", locale: "ar", label: "اتصلي بنا", url: "/ar/contact", icon: "mdi:email-outline", showIcon: true, sortOrder: 4, parentId: null, isActive: true, openInNewTab: false },

  // ═══════════ FOOTER PRIMARY (fr) ═══════════
  { id: "d26ad974-74af-4274-8365-bf08016859a4", menuId: "menu-footer-primary", locale: "fr", label: "Accueil", url: "/fr", icon: "mdi:home-outline", showIcon: false, sortOrder: 0, parentId: null, isActive: true, openInNewTab: false },
  { id: "fc63ca87-1aca-4b29-b74a-9357ea41009b", menuId: "menu-footer-primary", locale: "fr", label: "Voyages", url: "/fr/trips", icon: "mdi:airplane", showIcon: false, sortOrder: 1, parentId: null, isActive: true, openInNewTab: false },
  { id: "5044e86d-9467-451d-bc21-3a9df5d7a901", menuId: "menu-footer-primary", locale: "fr", label: "Blog", url: "/fr/blog", icon: "mdi:post-outline", showIcon: false, sortOrder: 2, parentId: null, isActive: true, openInNewTab: false },
  { id: "2371cbab-14a1-42b8-99be-5c5b9a91ce17", menuId: "menu-footer-primary", locale: "fr", label: "Contact", url: "/fr/contact", icon: "mdi:email-outline", showIcon: false, sortOrder: 3, parentId: null, isActive: true, openInNewTab: false },
  // ═══════════ FOOTER PRIMARY (en) ═══════════
  { id: "2a400edb-c397-43c6-897e-728ba33d0037", menuId: "menu-footer-primary", locale: "en", label: "Home", url: "/en", icon: "mdi:home-outline", showIcon: false, sortOrder: 0, parentId: null, isActive: true, openInNewTab: false },
  { id: "3ee45298-bed0-4fa9-b331-edf8404e6514", menuId: "menu-footer-primary", locale: "en", label: "Trips", url: "/en/trips", icon: "mdi:airplane", showIcon: false, sortOrder: 1, parentId: null, isActive: true, openInNewTab: false },
  { id: "c5fe01a2-727b-4630-8610-cd26ab26b9ea", menuId: "menu-footer-primary", locale: "en", label: "Blog", url: "/en/blog", icon: "mdi:post-outline", showIcon: false, sortOrder: 2, parentId: null, isActive: true, openInNewTab: false },
  { id: "6395a774-770a-4012-9616-4034d3e29cf8", menuId: "menu-footer-primary", locale: "en", label: "Contact", url: "/en/contact", icon: "mdi:email-outline", showIcon: false, sortOrder: 3, parentId: null, isActive: true, openInNewTab: false },
  // ═══════════ FOOTER PRIMARY (es) ═══════════
  { id: "53ddce66-bb1c-4a52-b68a-ad664b109d5a", menuId: "menu-footer-primary", locale: "es", label: "Inicio", url: "/es", icon: "mdi:home-outline", showIcon: false, sortOrder: 0, parentId: null, isActive: true, openInNewTab: false },
  { id: "390a8115-30ae-4b43-bcb3-f6a98a7970d5", menuId: "menu-footer-primary", locale: "es", label: "Viajes", url: "/es/viajes", icon: "mdi:airplane", showIcon: false, sortOrder: 1, parentId: null, isActive: true, openInNewTab: false },
  { id: "74a71c9f-3ed7-418a-bbab-380b3e8fb8e7", menuId: "menu-footer-primary", locale: "es", label: "Blog", url: "/es/blog", icon: "mdi:post-outline", showIcon: false, sortOrder: 2, parentId: null, isActive: true, openInNewTab: false },
  { id: "9503c6b9-3a35-4cd7-a210-6ce551d97d59", menuId: "menu-footer-primary", locale: "es", label: "Contacto", url: "/es/contacto", icon: "mdi:email-outline", showIcon: false, sortOrder: 3, parentId: null, isActive: true, openInNewTab: false },
  // ═══════════ FOOTER PRIMARY (ar) ═══════════
  { id: "43838ee3-e9cf-46cb-937a-582b0e35aa97", menuId: "menu-footer-primary", locale: "ar", label: "الرئيسية", url: "/ar", icon: "mdi:home-outline", showIcon: false, sortOrder: 0, parentId: null, isActive: true, openInNewTab: false },
  { id: "54558fe0-ee78-4987-ac81-cad88a369534", menuId: "menu-footer-primary", locale: "ar", label: "الرحلات", url: "/ar/trips", icon: "mdi:airplane", showIcon: false, sortOrder: 1, parentId: null, isActive: true, openInNewTab: false },
  { id: "3969d5fa-98b3-48e5-b264-b2c6d64e9e4a", menuId: "menu-footer-primary", locale: "ar", label: "المدونة", url: "/ar/blog", icon: "mdi:post-outline", showIcon: false, sortOrder: 2, parentId: null, isActive: true, openInNewTab: false },
  { id: "3e789d8c-ecf9-465b-b5cc-a61435fa1618", menuId: "menu-footer-primary", locale: "ar", label: "اتصلي بنا", url: "/ar/contact", icon: "mdi:email-outline", showIcon: false, sortOrder: 3, parentId: null, isActive: true, openInNewTab: false },

  // ═══════════ FOOTER SECONDARY (fr) ═══════════
  { id: "40993343-5e9d-41b2-95bb-635fb2bf3dd3", menuId: "menu-footer-secondary", locale: "fr", label: "Services", url: "/fr/services", icon: null, showIcon: false, sortOrder: 0, parentId: null, isActive: true, openInNewTab: false },
  { id: "a401ab40-26a6-4b2a-a849-da4c43c0a7f0", menuId: "menu-footer-secondary", locale: "fr", label: "À propos", url: "/fr/a-propos", icon: null, showIcon: false, sortOrder: 1, parentId: null, isActive: true, openInNewTab: false },
  // ═══════════ FOOTER SECONDARY (en) ═══════════
  { id: "59455c8c-f4dc-495e-a2fa-ebb4e3266f08", menuId: "menu-footer-secondary", locale: "en", label: "Services", url: "/en/services", icon: null, showIcon: false, sortOrder: 0, parentId: null, isActive: true, openInNewTab: false },
  { id: "d21fac7f-feb3-49fa-ad0d-f5fb37cf7ae7", menuId: "menu-footer-secondary", locale: "en", label: "About", url: "/en/about", icon: null, showIcon: false, sortOrder: 1, parentId: null, isActive: true, openInNewTab: false },
  // ═══════════ FOOTER SECONDARY (es) ═══════════
  { id: "ce33eef1-335e-4bac-80fe-dee961474a15", menuId: "menu-footer-secondary", locale: "es", label: "Servicios", url: "/es/services", icon: null, showIcon: false, sortOrder: 0, parentId: null, isActive: true, openInNewTab: false },
  { id: "ae9eedd2-e5fb-478e-aad0-c5622cd8ae6e", menuId: "menu-footer-secondary", locale: "es", label: "Acerca de", url: "/es/acerca-de", icon: null, showIcon: false, sortOrder: 1, parentId: null, isActive: true, openInNewTab: false },
  // ═══════════ FOOTER SECONDARY (ar) ═══════════
  { id: "90982614-2159-4257-b275-68c455ce0c18", menuId: "menu-footer-secondary", locale: "ar", label: "الخدمات", url: "/ar/services", icon: null, showIcon: false, sortOrder: 0, parentId: null, isActive: true, openInNewTab: false },
  { id: "9e6e2907-f058-4419-be29-648bd1a7a277", menuId: "menu-footer-secondary", locale: "ar", label: "من نحن", url: "/ar/about", icon: null, showIcon: false, sortOrder: 1, parentId: null, isActive: true, openInNewTab: false },

  // ═══════════ FOOTER LEGAL (fr) ═══════════
  { id: "6955e32d-8152-4e4e-abec-d56509ebb1b9", menuId: "menu-footer-legal", locale: "fr", label: "Mentions légales", url: "/fr/mentions-legales", icon: null, showIcon: false, sortOrder: 0, parentId: null, isActive: true, openInNewTab: false },
  { id: "6feb5a0d-b7e3-4c71-8f35-f6cd9c335361", menuId: "menu-footer-legal", locale: "fr", label: "Conditions de réservation", url: "/fr/conditions-reservation", icon: null, showIcon: false, sortOrder: 1, parentId: null, isActive: true, openInNewTab: false },
  { id: "922334fe-1af0-44a7-89c0-8c3eda4466f2", menuId: "menu-footer-legal", locale: "fr", label: "Assurance voyage", url: "/fr/assurance-voyage", icon: null, showIcon: false, sortOrder: 2, parentId: null, isActive: true, openInNewTab: false },
  { id: "1a50ecb9-5a2d-4311-b2e6-5a71d85382bd", menuId: "menu-footer-legal", locale: "fr", label: "Conditions générales", url: "/fr/terms", icon: null, showIcon: false, sortOrder: 3, parentId: null, isActive: true, openInNewTab: false },
  // ═══════════ FOOTER LEGAL (en) ═══════════
  { id: "ac06e7b1-0b71-4774-892d-50e57fc92529", menuId: "menu-footer-legal", locale: "en", label: "Legal Notice", url: "/en/legal-notice", icon: null, showIcon: false, sortOrder: 0, parentId: null, isActive: true, openInNewTab: false },
  { id: "f3460cd2-0342-46d4-920d-ae8a73dcd366", menuId: "menu-footer-legal", locale: "en", label: "Booking Terms", url: "/en/booking-terms", icon: null, showIcon: false, sortOrder: 1, parentId: null, isActive: true, openInNewTab: false },
  { id: "33b53fc1-51d9-4dee-baa7-1191ed7bd99d", menuId: "menu-footer-legal", locale: "en", label: "Travel Insurance", url: "/en/travel-insurance", icon: null, showIcon: false, sortOrder: 2, parentId: null, isActive: true, openInNewTab: false },
  { id: "466146e6-02db-47d6-8505-c7762968955a", menuId: "menu-footer-legal", locale: "en", label: "Terms & Conditions", url: "/en/terms", icon: null, showIcon: false, sortOrder: 3, parentId: null, isActive: true, openInNewTab: false },
  // ═══════════ FOOTER LEGAL (es) ═══════════
  { id: "178e0614-04e0-40eb-99bc-68d04510abec", menuId: "menu-footer-legal", locale: "es", label: "Aviso Legal", url: "/es/aviso-legal", icon: null, showIcon: false, sortOrder: 0, parentId: null, isActive: true, openInNewTab: false },
  { id: "45e042bf-141c-4291-b402-d53381ff6d6f", menuId: "menu-footer-legal", locale: "es", label: "Condiciones de Reserva", url: "/es/condiciones-reserva", icon: null, showIcon: false, sortOrder: 1, parentId: null, isActive: true, openInNewTab: false },
  { id: "f4bb12cc-c081-4c81-aba2-8210c4203a6c", menuId: "menu-footer-legal", locale: "es", label: "Seguro de Viaje", url: "/es/seguro-de-viaje", icon: null, showIcon: false, sortOrder: 2, parentId: null, isActive: true, openInNewTab: false },
  { id: "12a2644b-53d2-4e7b-86aa-eb3f3b474d83", menuId: "menu-footer-legal", locale: "es", label: "Términos y Condiciones", url: "/es/terms", icon: null, showIcon: false, sortOrder: 3, parentId: null, isActive: true, openInNewTab: false },
  // ═══════════ FOOTER LEGAL (ar) ═══════════
  { id: "e35cfe29-c033-4053-ad98-317df8a95291", menuId: "menu-footer-legal", locale: "ar", label: "إشعار قانوني", url: "/ar/legal-notice", icon: null, showIcon: false, sortOrder: 0, parentId: null, isActive: true, openInNewTab: false },
  { id: "0f806baa-57bc-4ae0-890c-e862bfbc8fce", menuId: "menu-footer-legal", locale: "ar", label: "شروط الحجز", url: "/ar/booking-terms", icon: null, showIcon: false, sortOrder: 1, parentId: null, isActive: true, openInNewTab: false },
  { id: "f36f7139-fa6d-4f74-8dbe-8ac9fb5b9de5", menuId: "menu-footer-legal", locale: "ar", label: "تأمين السفر", url: "/ar/travel-insurance", icon: null, showIcon: false, sortOrder: 2, parentId: null, isActive: true, openInNewTab: false },
  { id: "29068f1e-5003-4ea8-bd91-800ef548fc42", menuId: "menu-footer-legal", locale: "ar", label: "الشروط والأحكام", url: "/ar/terms", icon: null, showIcon: false, sortOrder: 3, parentId: null, isActive: true, openInNewTab: false },
];
