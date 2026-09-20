// Media folders voyage — hiérarchie Voyages + 5 destinations alignées aux
// dossiers src/assets/images/trips/* (algeria, andalusiamorocco, bosnia,
// maltasicily, silkroad) + dossier Avatars (public/uploads/images/avatars).
// Purge Demo/Annecy. Idempotente via onConflictDoNothing.
export default [
  {
    id: "3f102944-0d91-4cb6-983a-bfb41a0ebfe8",
    parentId: null,
    name: "Voyages",
    sortOrder: 0,
    createdAt: new Date("2026-09-20T08:00:00.000Z"),
  },
  {
    id: "a965f3ac-460c-4e12-9445-71b8e19426d4",
    parentId: "3f102944-0d91-4cb6-983a-bfb41a0ebfe8",
    name: "Algérie",
    sortOrder: 0,
    createdAt: new Date("2026-09-20T08:01:00.000Z"),
  },
  {
    id: "08938be1-57bc-4c49-b7cd-c695c6c94509",
    parentId: "3f102944-0d91-4cb6-983a-bfb41a0ebfe8",
    name: "Andalousie-Maroc",
    sortOrder: 1,
    createdAt: new Date("2026-09-20T08:02:00.000Z"),
  },
  {
    id: "9dee13a1-8649-4d86-9aa1-c3cddc9dc971",
    parentId: "3f102944-0d91-4cb6-983a-bfb41a0ebfe8",
    name: "Bosnie",
    sortOrder: 2,
    createdAt: new Date("2026-09-20T08:03:00.000Z"),
  },
  {
    id: "8912db89-81ae-47a4-840f-89f504d557f9",
    parentId: "3f102944-0d91-4cb6-983a-bfb41a0ebfe8",
    name: "Malte-Sicile",
    sortOrder: 3,
    createdAt: new Date("2026-09-20T08:04:00.000Z"),
  },
  {
    id: "62573bec-5c85-49d3-8c90-aa74407e3018",
    parentId: "3f102944-0d91-4cb6-983a-bfb41a0ebfe8",
    name: "Route de la Soie",
    sortOrder: 4,
    createdAt: new Date("2026-09-20T08:05:00.000Z"),
  },
  {
    id: "d8234066-ec5c-41f2-9cdd-1b128666111e",
    parentId: null,
    name: "Avatars",
    sortOrder: 1,
    createdAt: new Date("2026-09-20T08:06:00.000Z"),
  },
];
