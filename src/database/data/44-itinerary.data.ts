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
  D("d6bebb5e-d91f-4da7-aeb5-ede74b3ac765", "26cf16d8-0770-48f9-870e-c68c9a9c47e0", 1, "Algiers", null),
  D("db2b3baa-b7a0-4842-a7ca-81d611036fba", "26cf16d8-0770-48f9-870e-c68c9a9c47e0", 2, "Algiers", "Casbah and Notre-Dame d'Afrique"),
  D("63250141-0198-4a17-a432-f3cf40548794", "26cf16d8-0770-48f9-870e-c68c9a9c47e0", 3, "Djanet", "Flight south"),
  D("19a33b54-59fa-487d-a7a5-638deeb93625", "26cf16d8-0770-48f9-870e-c68c9a9c47e0", 4, "Tassili", "Desert tracks"),
  D("18b19224-3b10-4446-ac01-eb13fd8441c3", "26cf16d8-0770-48f9-870e-c68c9a9c47e0", 5, "Desert bivouac", "Dunes and rock art"),
  D("185b1940-896b-46cf-a08a-0dc277523185", "26cf16d8-0770-48f9-870e-c68c9a9c47e0", 6, "Oasis", "Gardens and spring"),
  D("18dfe4bd-2f4f-4d4c-aac4-f4e96a680d9a", "26cf16d8-0770-48f9-870e-c68c9a9c47e0", 7, "Djanet", "Return and craft market"),
  D("dbd6aca8-0728-496a-abe0-4b58c727a65e", "26cf16d8-0770-48f9-870e-c68c9a9c47e0", 8, "Algiers", "Return and departure"),
  // ── Sicily + Malta (8 j, Valletta corrigée) ──
  D("a502ae85-9ef1-4717-a105-e0199423ff44", "b912b620-1d69-448f-a289-4790b4ce271c", 1, "Catania", null),
  D("31e6af29-e3e3-4c03-aa3a-0730ce3fe424", "b912b620-1d69-448f-a289-4790b4ce271c", 2, "Taormina", "Catania – Taormina"),
  D("7480a374-e210-4ec9-ac48-7d3dd8abbde6", "b912b620-1d69-448f-a289-4790b4ce271c", 3, "Syracuse, Ortigia", "Taormina – Syracuse"),
  D("7f400f39-e739-4334-a537-3e62ad458c67", "b912b620-1d69-448f-a289-4790b4ce271c", 4, "Noto", "Syracuse – Noto"),
  D("0c9ee53a-1808-4669-a394-a5c663c0413d", "b912b620-1d69-448f-a289-4790b4ce271c", 5, "Pozzallo – Valletta", "Fast ferry to Malta"),
  D("0cf3e2dc-a45a-4f15-ab35-a94446a9f569", "b912b620-1d69-448f-a289-4790b4ce271c", 6, "Valletta", null),
  D("126e1234-81bc-4a31-a2b9-0b22de9cc07f", "b912b620-1d69-448f-a289-4790b4ce271c", 7, "Gozo", "Day crossing"),
  D("8fcf7e85-fcaa-4f41-a3e4-e2fe3dc817d1", "b912b620-1d69-448f-a289-4790b4ce271c", 8, "Valletta", "Departure"),
  // ── Andalusia + Morocco (8 j) ──
  D("bfc109ae-5dd0-4c04-a9a2-b920e7330df7", "22b3db08-f245-44eb-8ee2-a858eb7e25c4", 1, "Málaga", null),
  D("99b131a7-712f-4417-a778-68d708dfb5f1", "22b3db08-f245-44eb-8ee2-a858eb7e25c4", 2, "Granada", "Málaga – Granada"),
  D("ba4adc95-a72b-4387-a5fa-b7dfad38e329", "22b3db08-f245-44eb-8ee2-a858eb7e25c4", 3, "Granada", "Alhambra"),
  D("12e71010-2c0b-460e-abe0-0d38266e5baf", "22b3db08-f245-44eb-8ee2-a858eb7e25c4", 4, "Córdoba", "Granada – Córdoba"),
  D("c5d00b7d-0ebd-4b69-abe6-61434a0bf209", "22b3db08-f245-44eb-8ee2-a858eb7e25c4", 5, "Tarifa – Tangier", "Strait ferry crossing"),
  D("67144af5-9e1f-4e41-a33e-037829c66ad1", "22b3db08-f245-44eb-8ee2-a858eb7e25c4", 6, "Chefchaouen", "Tangier – Chefchaouen"),
  D("3c29369a-6f87-4f80-a727-7c517f3f54ce", "22b3db08-f245-44eb-8ee2-a858eb7e25c4", 7, "Tangier", "Chefchaouen – Tangier"),
  D("7b27764d-74e4-49e6-af63-6cb87d6a1be0", "22b3db08-f245-44eb-8ee2-a858eb7e25c4", 8, "Tangier", "Departure"),
  // ── Bosnie (7 j) ──
  D("fc411abd-7dd8-4fe0-a9ae-33ac19ff8190", "2c45ce15-a211-4a07-9472-1539aae514c5", 1, "Sarajevo", null, 2),
  D("781e5848-cb7d-4563-a713-47a4bf289bc8", "2c45ce15-a211-4a07-9472-1539aae514c5", 2, "Sarajevo", "Baščaršija and Gazi Husrev-bey", 2),
  D("7c716bac-9e1e-4d0f-ae96-b179d9d8d9d8", "2c45ce15-a211-4a07-9472-1539aae514c5", 3, "Blagaj", "Sarajevo – Blagaj", 2),
  D("044e77a1-b294-4953-a1b8-bb9e99586960", "2c45ce15-a211-4a07-9472-1539aae514c5", 4, "Kravica", "Blagaj – Kravica falls", 2),
  D("3fdaa16e-31e3-4c31-ab34-a15613931af1", "2c45ce15-a211-4a07-9472-1539aae514c5", 5, "Mostar", "Kravica – Mostar Stari Most", 2),
  D("1a77b560-e860-4133-a360-5d541f86ad9c", "2c45ce15-a211-4a07-9472-1539aae514c5", 6, "Mostar", "Neretva valley", 2),
  D("6102715b-6a34-4eb5-a062-c3ec2e89c43f", "2c45ce15-a211-4a07-9472-1539aae514c5", 7, "Sarajevo", "Return and departure", 2),
  // ── Route de la Soie (10 j) ──
  D("67670e2f-c8bf-4da3-a621-97296b2561c3", "6675b138-4572-4283-b866-b64840f63004", 1, "Samarkand", null),
  D("b98fcb93-e7e5-413f-aa18-5d4cea467d26", "6675b138-4572-4283-b866-b64840f63004", 2, "Samarkand", "Registan and bazaars"),
  D("ca7f3f7a-6eeb-4e61-a78d-e018e537ff4d", "6675b138-4572-4283-b866-b64840f63004", 3, "Bukhara", "Samarkand – Bukhara"),
  D("4df45daf-8ee2-44a8-a9d8-ebefafd52dfa", "6675b138-4572-4283-b866-b64840f63004", 4, "Bukhara", "Poi Kalyan and old town"),
  D("44e306f4-9c7d-4f56-aeb7-af88a79645e5", "6675b138-4572-4283-b866-b64840f63004", 5, "Tashkent – Bishkek", "Flight north"),
  D("0c411a3a-a11c-4500-a986-dea0dc437234", "6675b138-4572-4283-b866-b64840f63004", 6, "Issyk-Kul", "Lake shore"),
  D("61265df7-76fb-43e9-a884-66690d086fd3", "6675b138-4572-4283-b866-b64840f63004", 7, "Song-Kul", "High pastures and yurts"),
  D("52c50b6d-b236-450b-a14b-7109e7eb14a0", "6675b138-4572-4283-b866-b64840f63004", 8, "Song-Kul", "Horse ride and lake"),
  D("f4748fe1-48c5-4044-ad27-58b3938db697", "6675b138-4572-4283-b866-b64840f63004", 9, "Bishkek", "Return and bazaar"),
  D("8bb38a11-29dd-4305-a2b9-559339387432", "6675b138-4572-4283-b866-b64840f63004", 10, "Tashkent", "Return and departure"),
];
