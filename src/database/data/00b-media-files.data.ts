// Media files voyage — 26 fichiers réels src/assets/images/trips/* (5 dossiers)
// + 3 avatars voyageuses (public/uploads/images/avatars/*).
// Dimensions Sharp vérifiées 2026-09-20. URLs /uploads/media/trips/* synchronisées
// par db:seed-media (copie src/assets → public/uploads). Purge Demo/Annecy.
const F = (
  id: string,
  folderId: string,
  filename: string,
  url: string,
  mimeType: string,
  size: number,
  width: number | null,
  height: number | null,
) => ({ id, folderId, filename, url, mimeType, size, width, height, createdAt: new Date("2026-09-20T08:10:00.000Z") });

export default [
  // ── Algérie (5) ──
  F("e6b97486-9d26-46d2-a91e-1012aaa2b11e", "a965f3ac-460c-4e12-9445-71b8e19426d4", "Algeria-Sweets.jpg", "/uploads/media/trips/algeria/Algeria-Sweets.jpg", "image/jpeg", 136226, 736, 736),
  F("70936264-34d2-4e83-a00e-2cf3ce268be6", "a965f3ac-460c-4e12-9445-71b8e19426d4", "Algerian-Cuisine.jpg", "/uploads/media/trips/algeria/Algerian-Cuisine.jpg", "image/jpeg", 255608, 857, 1200),
  F("ff4992b5-1aeb-4f82-961c-1eed42476af1", "a965f3ac-460c-4e12-9445-71b8e19426d4", "Desert Algeria.jpg", "/uploads/media/trips/algeria/Desert Algeria.jpg", "image/jpeg", 126267, 1500, 763),
  F("995f4751-37f4-43a4-ad3e-3bfac173decb", "a965f3ac-460c-4e12-9445-71b8e19426d4", "Djanet.jpg", "/uploads/media/trips/algeria/Djanet.jpg", "image/jpeg", 33080, 896, 597),
  F("1fd68249-7526-4db3-a8b6-d592e307675e", "a965f3ac-460c-4e12-9445-71b8e19426d4", "Notre-Dame-Afrique-Alger.png", "/uploads/media/trips/algeria/Notre-Dame-Afrique-Alger.png", "image/png", 2679220, 1000, 1500),
  // ── Andalousie-Maroc (5) ──
  F("10f32a99-7dc0-4515-880e-346971974385", "08938be1-57bc-4c49-b7cd-c695c6c94509", "Alhambra-Granada.jpg", "/uploads/media/trips/andalusiamorocco/Alhambra-Granada.jpg", "image/jpeg", 503435, 2092, 1395),
  F("9e5fb75e-e67d-4d2a-a4b1-1b55dab31f70", "08938be1-57bc-4c49-b7cd-c695c6c94509", "Casablanca.jpg", "/uploads/media/trips/andalusiamorocco/Casablanca.jpg", "image/jpeg", 190567, 2048, 1366),
  F("d074d152-7ca1-43ad-abe3-ce832875b160", "08938be1-57bc-4c49-b7cd-c695c6c94509", "Chefchaouen.jpg", "/uploads/media/trips/andalusiamorocco/Chefchaouen.jpg", "image/jpeg", 199578, 1200, 900),
  F("caeca25e-e144-4663-a483-49c35eedfd16", "08938be1-57bc-4c49-b7cd-c695c6c94509", "Fes Medina.jpg", "/uploads/media/trips/andalusiamorocco/Fes Medina.jpg", "image/jpeg", 117874, 683, 1024),
  F("8823b290-c90f-4092-ab46-241a628bcb30", "08938be1-57bc-4c49-b7cd-c695c6c94509", "Mezquita-Cordoba.jpg", "/uploads/media/trips/andalusiamorocco/Mezquita-Cordoba.jpg", "image/jpeg", 174758, 1024, 1024),
  // ── Bosnie (5) ──
  F("be6d6c45-6754-4954-ae0a-95c448ca1705", "9dee13a1-8649-4d86-9aa1-c3cddc9dc971", "Blagaj-Tekke-Buna-River.jpg", "/uploads/media/trips/bosnia/Blagaj-Tekke-Buna-River.jpg", "image/jpeg", 307717, 1289, 860),
  F("fb16efdc-451b-491d-a514-0ab222b2e150", "9dee13a1-8649-4d86-9aa1-c3cddc9dc971", "Gazihusrev.jpg", "/uploads/media/trips/bosnia/Gazihusrev.jpg", "image/jpeg", 55828, 540, 720),
  F("856485ed-ff8d-43bb-a5cd-5944e77bacc5", "9dee13a1-8649-4d86-9aa1-c3cddc9dc971", "Kravica Waterfalls.jpg", "/uploads/media/trips/bosnia/Kravica Waterfalls.jpg", "image/jpeg", 3337294, 4737, 3440),
  F("cecca041-aac8-4930-a6ba-555694aec0b5", "9dee13a1-8649-4d86-9aa1-c3cddc9dc971", "Rejser.jpg", "/uploads/media/trips/bosnia/Rejser.jpg", "image/jpeg", 3167558, 5154, 3440),
  F("9122ed1e-6dcd-4653-bbe8-f4b6a42877ba", "9dee13a1-8649-4d86-9aa1-c3cddc9dc971", "Sarajevo-Bascarsija.jpg", "/uploads/media/trips/bosnia/Sarajevo-Bascarsija.jpg", "image/jpeg", 313384, 1600, 840),
  // ── Malte-Sicile (5) ──
  F("e0ef38d1-7681-499e-a6c0-05c2848170b1", "8912db89-81ae-47a4-840f-89f504d557f9", "Malta.jpg", "/uploads/media/trips/maltasicily/Malta.jpg", "image/jpeg", 352188, 1920, 1080),
  F("725cb003-1b69-49b7-a2a1-a599bff53103", "8912db89-81ae-47a4-840f-89f504d557f9", "Mdina — MALTA.jpg", "/uploads/media/trips/maltasicily/Mdina — MALTA.jpg", "image/jpeg", 570494, 1365, 2048),
  F("dc74011a-8b27-4430-a096-131427f97efd", "8912db89-81ae-47a4-840f-89f504d557f9", "Ortigia-Syracuse.jpg", "/uploads/media/trips/maltasicily/Ortigia-Syracuse.jpg", "image/jpeg", 574988, 2048, 1383),
  F("33846349-91dc-44cc-ad7a-08c72e05a32f", "8912db89-81ae-47a4-840f-89f504d557f9", "Palermo Arab-Norman heritage.jpg", "/uploads/media/trips/maltasicily/Palermo Arab-Norman heritage.jpg", "image/jpeg", 134086, 900, 900),
  F("b118554b-0c93-443f-9c25-e4a3d6f5253f", "8912db89-81ae-47a4-840f-89f504d557f9", "Taormina-Isola-Bella.jpg", "/uploads/media/trips/maltasicily/Taormina-Isola-Bella.jpg", "image/jpeg", 496147, 2048, 1365),
  // ── Route de la Soie (6) ──
  // Note lignage : Mostar-Stari-Most.jpg rangé dans silkroad/ sur disque (Mostar = Bosnie).
  // Conservé tel quel pour alignement 26 fichiers ; rattaché au trip silkroad en seed,
  // anomalie documentée, déplacement disque interdit sans arbitrage produit.
  F("4a14cc18-1bc1-4ae9-a091-e2471a45f032", "62573bec-5c85-49d3-8c90-aa74407e3018", "Bukhara-Poi-Kalyan.jpg", "/uploads/media/trips/silkroad/Bukhara-Poi-Kalyan.jpg", "image/jpeg", 91502, 1000, 667),
  F("c3be1d30-f97e-4c09-aa0f-dc1ad481f8b5", "62573bec-5c85-49d3-8c90-aa74407e3018", "Kyrgyzstan-Issyk-Kul.jpg", "/uploads/media/trips/silkroad/Kyrgyzstan-Issyk-Kul.jpg", "image/jpeg", 265303, 1500, 998),
  F("21a711d5-fdca-4957-aa89-cff5ce28e8b8", "62573bec-5c85-49d3-8c90-aa74407e3018", "Mostar-Stari-Most.jpg", "/uploads/media/trips/silkroad/Mostar-Stari-Most.jpg", "image/jpeg", 184413, 1290, 860),
  F("b89b1bda-87af-49c4-80ff-5d72fff4fb5e", "62573bec-5c85-49d3-8c90-aa74407e3018", "Samarkand.jpg", "/uploads/media/trips/silkroad/Samarkand.jpg", "image/jpeg", 165678, 1290, 860),
  F("9e01ff3d-e6d6-4a22-acec-10b401deb643", "62573bec-5c85-49d3-8c90-aa74407e3018", "Song-Kul-Yurts-Horses.jpg", "/uploads/media/trips/silkroad/Song-Kul-Yurts-Horses.jpg", "image/jpeg", 47418, 600, 400),
  F("de4c07a2-50c8-4756-a187-8c1d61185469", "62573bec-5c85-49d3-8c90-aa74407e3018", "Uzbek-Bazaar-Textiles-Ceramics.jpg", "/uploads/media/trips/silkroad/Uzbek-Bazaar-Textiles-Ceramics.jpg", "image/jpeg", 117339, 700, 496),
  // ── Avatars voyageuses (3) — public/uploads/images/avatars/* ──
  F("14544e25-5700-463c-a299-84e5532e6186", "d8234066-ec5c-41f2-9cdd-1b128666111e", "camille-dupond.png", "/uploads/images/avatars/camille-dupond.png", "image/png", 2212796, 1024, 1024),
  F("bf5db896-28a8-4256-a3bf-16bca3acb493", "d8234066-ec5c-41f2-9cdd-1b128666111e", "lucas-martin.png", "/uploads/images/avatars/lucas-martin.png", "image/png", 2187048, 1024, 1024),
  F("0c789a9b-e9bb-4c1c-ac3f-a07b6df372eb", "d8234066-ec5c-41f2-9cdd-1b128666111e", "sarah-leroy.png", "/uploads/images/avatars/sarah-leroy.png", "image/png", 2296613, 1024, 1024),
];
