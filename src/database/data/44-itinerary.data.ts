// Itinerary days seed — faits par jour (ordre = dayNumber, TODO §8.5).
// 5 voyages : Algérie 8 j, Andalousie-Maroc 8 j, Bosnie 7 j, Sicile-Malte 8 j, Soie 10 j.
// Purge Afrique du Sud (sans images). activityLevel 1-5, distances ≥ 0.
const D = (id: string, tripId: string, dayNumber: number, location: string | null, route: string | null, activityLevel = 3) => ({
  id, tripId, dayNumber, location, route,
  activityLevel, distanceKm: null, activityDurationMin: null,
  minAltitudeM: null, maxAltitudeM: null,
});

export default [
  // ── Algérie (8 j) ──
  D("day-dz-1", "trip-algeria", 1, "Algiers", null),
  D("day-dz-2", "trip-algeria", 2, "Algiers", "Casbah and Notre-Dame d'Afrique"),
  D("day-dz-3", "trip-algeria", 3, "Djanet", "Flight south"),
  D("day-dz-4", "trip-algeria", 4, "Tassili", "Desert tracks"),
  D("day-dz-5", "trip-algeria", 5, "Desert bivouac", "Dunes and rock art"),
  D("day-dz-6", "trip-algeria", 6, "Oasis", "Gardens and spring"),
  D("day-dz-7", "trip-algeria", 7, "Djanet", "Return and craft market"),
  D("day-dz-8", "trip-algeria", 8, "Algiers", "Return and departure"),
  // ── Sicily + Malta (8 j, Valletta corrigée) ──
  D("day-sm-1", "trip-sicily-malta", 1, "Catania", null),
  D("day-sm-2", "trip-sicily-malta", 2, "Taormina", "Catania – Taormina"),
  D("day-sm-3", "trip-sicily-malta", 3, "Syracuse, Ortigia", "Taormina – Syracuse"),
  D("day-sm-4", "trip-sicily-malta", 4, "Noto", "Syracuse – Noto"),
  D("day-sm-5", "trip-sicily-malta", 5, "Pozzallo – Valletta", "Fast ferry to Malta"),
  D("day-sm-6", "trip-sicily-malta", 6, "Valletta", null),
  D("day-sm-7", "trip-sicily-malta", 7, "Gozo", "Day crossing"),
  D("day-sm-8", "trip-sicily-malta", 8, "Valletta", "Departure"),
  // ── Andalusia + Morocco (8 j) ──
  D("day-am-1", "trip-andalusia-morocco", 1, "Málaga", null),
  D("day-am-2", "trip-andalusia-morocco", 2, "Granada", "Málaga – Granada"),
  D("day-am-3", "trip-andalusia-morocco", 3, "Granada", "Alhambra"),
  D("day-am-4", "trip-andalusia-morocco", 4, "Córdoba", "Granada – Córdoba"),
  D("day-am-5", "trip-andalusia-morocco", 5, "Tarifa – Tangier", "Strait ferry crossing"),
  D("day-am-6", "trip-andalusia-morocco", 6, "Chefchaouen", "Tangier – Chefchaouen"),
  D("day-am-7", "trip-andalusia-morocco", 7, "Tangier", "Chefchaouen – Tangier"),
  D("day-am-8", "trip-andalusia-morocco", 8, "Tangier", "Departure"),
  // ── Bosnie (7 j) ──
  D("day-bo-1", "trip-bosnia", 1, "Sarajevo", null, 2),
  D("day-bo-2", "trip-bosnia", 2, "Sarajevo", "Baščaršija and Gazi Husrev-bey", 2),
  D("day-bo-3", "trip-bosnia", 3, "Blagaj", "Sarajevo – Blagaj", 2),
  D("day-bo-4", "trip-bosnia", 4, "Kravica", "Blagaj – Kravica falls", 2),
  D("day-bo-5", "trip-bosnia", 5, "Mostar", "Kravica – Mostar Stari Most", 2),
  D("day-bo-6", "trip-bosnia", 6, "Mostar", "Neretva valley", 2),
  D("day-bo-7", "trip-bosnia", 7, "Sarajevo", "Return and departure", 2),
  // ── Route de la Soie (10 j) ──
  D("day-sk-1", "trip-silkroad", 1, "Samarkand", null),
  D("day-sk-2", "trip-silkroad", 2, "Samarkand", "Registan and bazaars"),
  D("day-sk-3", "trip-silkroad", 3, "Bukhara", "Samarkand – Bukhara"),
  D("day-sk-4", "trip-silkroad", 4, "Bukhara", "Poi Kalyan and old town"),
  D("day-sk-5", "trip-silkroad", 5, "Tashkent – Bishkek", "Flight north"),
  D("day-sk-6", "trip-silkroad", 6, "Issyk-Kul", "Lake shore"),
  D("day-sk-7", "trip-silkroad", 7, "Song-Kul", "High pastures and yurts"),
  D("day-sk-8", "trip-silkroad", 8, "Song-Kul", "Horse ride and lake"),
  D("day-sk-9", "trip-silkroad", 9, "Bishkek", "Return and bazaar"),
  D("day-sk-10", "trip-silkroad", 10, "Tashkent", "Return and departure"),
];
