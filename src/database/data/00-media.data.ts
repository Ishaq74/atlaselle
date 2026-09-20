// Media folders voyage — hiérarchie Voyages + 5 destinations alignées aux
// dossiers src/assets/images/trips/* (algeria, andalusiamorocco, bosnia,
// maltasicily, silkroad). Purge Demo/Annecy. Idempotente via onConflictDoNothing.
export default [
  {
    id: "folder-voyages",
    parentId: null,
    name: "Voyages",
    sortOrder: 0,
    createdAt: new Date("2026-09-20T08:00:00.000Z"),
  },
  {
    id: "folder-voyages-algeria",
    parentId: "folder-voyages",
    name: "Algérie",
    sortOrder: 0,
    createdAt: new Date("2026-09-20T08:01:00.000Z"),
  },
  {
    id: "folder-voyages-andalusiamorocco",
    parentId: "folder-voyages",
    name: "Andalousie-Maroc",
    sortOrder: 1,
    createdAt: new Date("2026-09-20T08:02:00.000Z"),
  },
  {
    id: "folder-voyages-bosnia",
    parentId: "folder-voyages",
    name: "Bosnie",
    sortOrder: 2,
    createdAt: new Date("2026-09-20T08:03:00.000Z"),
  },
  {
    id: "folder-voyages-maltasicily",
    parentId: "folder-voyages",
    name: "Malte-Sicile",
    sortOrder: 3,
    createdAt: new Date("2026-09-20T08:04:00.000Z"),
  },
  {
    id: "folder-voyages-silkroad",
    parentId: "folder-voyages",
    name: "Route de la Soie",
    sortOrder: 4,
    createdAt: new Date("2026-09-20T08:05:00.000Z"),
  },
];
