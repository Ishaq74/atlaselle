// Blog post galleries — 3 galeries photos rattachées aux articles destination.
// Médias = fichiers voyages réels (00b). Légendes dans 23b.
const G = (id: string, postId: string, title: string, description: string, sortOrder: number) => ({
  id,
  postId,
  title,
  description,
  sortOrder,
  createdAt: new Date("2026-09-01T09:00:00.000Z"),
  updatedAt: new Date("2026-09-01T09:00:00.000Z"),
});

export default [
  G("46d73468-cd6c-4b4c-a425-655d8ca2ff0c", "9b4d8fef-badd-4787-ae7b-d91f7c7107c3", "Algérie en images",
    "Dunes du Tassili, oasis de Djanet et tables algériennes.", 0),
  G("050454a4-cb4e-41bf-a059-8552cb61c150", "cc564fbf-0a61-4554-a5dc-a30fbfb5fb83", "Route de la Soie en images",
    "Registan de Samarcande, bazar de Boukhara et yourtes du Song-Kul.", 0),
  G("d6e86293-48e9-4fbc-aa58-dd181a664e33", "e4eade2e-cb1c-4852-a326-ab1e77149b82", "Tables du Ramadan",
    "Tables partagées et pâtisseries des soirs de rupture du jeûne.", 0),
];
