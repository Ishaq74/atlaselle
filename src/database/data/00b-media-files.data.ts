// Media files voyage — 26 fichiers réels src/assets/images/trips/* (5 dossiers).
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
  F("med-algeria-01", "folder-voyages-algeria", "Algeria-Sweets.jpg", "/uploads/media/trips/algeria/Algeria-Sweets.jpg", "image/jpeg", 136226, 736, 736),
  F("med-algeria-02", "folder-voyages-algeria", "Algerian-Cuisine.jpg", "/uploads/media/trips/algeria/Algerian-Cuisine.jpg", "image/jpeg", 255608, 857, 1200),
  F("med-algeria-03", "folder-voyages-algeria", "Desert Algeria.jpg", "/uploads/media/trips/algeria/Desert Algeria.jpg", "image/jpeg", 126267, 1500, 763),
  F("med-algeria-04", "folder-voyages-algeria", "Djanet.jpg", "/uploads/media/trips/algeria/Djanet.jpg", "image/jpeg", 33080, 896, 597),
  F("med-algeria-05", "folder-voyages-algeria", "Notre-Dame-Afrique-Alger.png", "/uploads/media/trips/algeria/Notre-Dame-Afrique-Alger.png", "image/png", 2679220, 1000, 1500),
  // ── Andalousie-Maroc (5) ──
  F("med-andmor-01", "folder-voyages-andalusiamorocco", "Alhambra-Granada.jpg", "/uploads/media/trips/andalusiamorocco/Alhambra-Granada.jpg", "image/jpeg", 503435, 2092, 1395),
  F("med-andmor-02", "folder-voyages-andalusiamorocco", "Casablanca.jpg", "/uploads/media/trips/andalusiamorocco/Casablanca.jpg", "image/jpeg", 190567, 2048, 1366),
  F("med-andmor-03", "folder-voyages-andalusiamorocco", "Chefchaouen.jpg", "/uploads/media/trips/andalusiamorocco/Chefchaouen.jpg", "image/jpeg", 199578, 1200, 900),
  F("med-andmor-04", "folder-voyages-andalusiamorocco", "Fes Medina.jpg", "/uploads/media/trips/andalusiamorocco/Fes Medina.jpg", "image/jpeg", 117874, 683, 1024),
  F("med-andmor-05", "folder-voyages-andalusiamorocco", "Mezquita-Cordoba.jpg", "/uploads/media/trips/andalusiamorocco/Mezquita-Cordoba.jpg", "image/jpeg", 174758, 1024, 1024),
  // ── Bosnie (5) ──
  F("med-bosnia-01", "folder-voyages-bosnia", "Blagaj-Tekke-Buna-River.jpg", "/uploads/media/trips/bosnia/Blagaj-Tekke-Buna-River.jpg", "image/jpeg", 307717, 1289, 860),
  F("med-bosnia-02", "folder-voyages-bosnia", "Gazihusrev.jpg", "/uploads/media/trips/bosnia/Gazihusrev.jpg", "image/jpeg", 55828, 540, 720),
  F("med-bosnia-03", "folder-voyages-bosnia", "Kravica Waterfalls.jpg", "/uploads/media/trips/bosnia/Kravica Waterfalls.jpg", "image/jpeg", 3337294, 4737, 3440),
  F("med-bosnia-04", "folder-voyages-bosnia", "Rejser.jpg", "/uploads/media/trips/bosnia/Rejser.jpg", "image/jpeg", 3167558, 5154, 3440),
  F("med-bosnia-05", "folder-voyages-bosnia", "Sarajevo-Bascarsija.jpg", "/uploads/media/trips/bosnia/Sarajevo-Bascarsija.jpg", "image/jpeg", 313384, 1600, 840),
  // ── Malte-Sicile (5) ──
  F("med-maltsic-01", "folder-voyages-maltasicily", "Malta.jpg", "/uploads/media/trips/maltasicily/Malta.jpg", "image/jpeg", 352188, 1920, 1080),
  F("med-maltsic-02", "folder-voyages-maltasicily", "Mdina — MALTA.jpg", "/uploads/media/trips/maltasicily/Mdina — MALTA.jpg", "image/jpeg", 570494, 1365, 2048),
  F("med-maltsic-03", "folder-voyages-maltasicily", "Ortigia-Syracuse.jpg", "/uploads/media/trips/maltasicily/Ortigia-Syracuse.jpg", "image/jpeg", 574988, 2048, 1383),
  F("med-maltsic-04", "folder-voyages-maltasicily", "Palermo Arab-Norman heritage.jpg", "/uploads/media/trips/maltasicily/Palermo Arab-Norman heritage.jpg", "image/jpeg", 134086, 900, 900),
  F("med-maltsic-05", "folder-voyages-maltasicily", "Taormina-Isola-Bella.jpg", "/uploads/media/trips/maltasicily/Taormina-Isola-Bella.jpg", "image/jpeg", 496147, 2048, 1365),
  // ── Route de la Soie (6) ──
  // Note lignage : Mostar-Stari-Most.jpg rangé dans silkroad/ sur disque (Mostar = Bosnie).
  // Conservé tel quel pour alignement 26 fichiers ; rattaché au trip silkroad en seed,
  // anomalie documentée, déplacement disque interdit sans arbitrage produit.
  F("med-silk-01", "folder-voyages-silkroad", "Bukhara-Poi-Kalyan.jpg", "/uploads/media/trips/silkroad/Bukhara-Poi-Kalyan.jpg", "image/jpeg", 91502, 1000, 667),
  F("med-silk-02", "folder-voyages-silkroad", "Kyrgyzstan-Issyk-Kul.jpg", "/uploads/media/trips/silkroad/Kyrgyzstan-Issyk-Kul.jpg", "image/jpeg", 265303, 1500, 998),
  F("med-silk-03", "folder-voyages-silkroad", "Mostar-Stari-Most.jpg", "/uploads/media/trips/silkroad/Mostar-Stari-Most.jpg", "image/jpeg", 184413, 1290, 860),
  F("med-silk-04", "folder-voyages-silkroad", "Samarkand.jpg", "/uploads/media/trips/silkroad/Samarkand.jpg", "image/jpeg", 165678, 1290, 860),
  F("med-silk-05", "folder-voyages-silkroad", "Song-Kul-Yurts-Horses.jpg", "/uploads/media/trips/silkroad/Song-Kul-Yurts-Horses.jpg", "image/jpeg", 47418, 600, 400),
  F("med-silk-06", "folder-voyages-silkroad", "Uzbek-Bazaar-Textiles-Ceramics.jpg", "/uploads/media/trips/silkroad/Uzbek-Bazaar-Textiles-Ceramics.jpg", "image/jpeg", 117339, 700, 496),
];
