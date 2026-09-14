// Itinerary days seed — faits par jour (ordre = dayNumber, TODO §8.5).
const D = (id: string, tripId: string, dayNumber: number, location: string | null, route: string | null) => ({
  id, tripId, dayNumber, location, route,
  activityLevel: 3, distanceKm: null, activityDurationMin: null,
  minAltitudeM: null, maxAltitudeM: null,
});

export default [
  // ── South Africa (9 j) ──
  D("day-sa-1", "trip-south-africa", 1, "Cape Town", null),
  D("day-sa-2", "trip-south-africa", 2, "Cape Town", "Table Mountain"),
  D("day-sa-3", "trip-south-africa", 3, "Cape Peninsula", "Chapman's Peak, Cape of Good Hope"),
  D("day-sa-4", "trip-south-africa", 4, "Stellenbosch", "Cape Winelands"),
  D("day-sa-5", "trip-south-africa", 5, "Franschhoek", "Cape Winelands"),
  D("day-sa-6", "trip-south-africa", 6, "Private reserve", "Transfer north"),
  D("day-sa-7", "trip-south-africa", 7, "Private reserve", "Morning and evening drives"),
  D("day-sa-8", "trip-south-africa", 8, "Private reserve", "Full day in the wild"),
  D("day-sa-9", "trip-south-africa", 9, "Cape Town", "Return and departure"),
  // ── Sicily + Malta (8 j) ──
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
];
