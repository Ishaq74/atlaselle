// Blog categories — 6 rubriques du journal Atlaselle.
// Slug racine = slug FR ; slugs localisés dans 11b.
const C = (id: string, slug: string, icon: string, color: string, sortOrder: number) => ({
  id,
  parentId: null,
  slug,
  icon,
  color,
  sortOrder,
  createdAt: new Date("2026-07-01T09:00:00.000Z"),
  updatedAt: new Date("2026-07-01T09:00:00.000Z"),
});

export default [
  C("b8592fd9-4948-4e33-9f0f-9aa922a7d265", "destinations", "mdi:map-outline", "#C46A4A", 0),
  C("737311a4-61a3-4f99-b513-01f08644216c", "conseils-pratiques", "mdi:compass-outline", "#3D6B6E", 1),
  C("b63a893a-0f67-4511-abfe-538264d0299e", "culture-et-histoire", "mdi:bank-outline", "#8A6BA8", 2),
  C("4531e6a8-0557-427a-89a3-9a5c4838fe30", "cuisine-et-tables", "mdi:silverware-fork-knife", "#B8912F", 3),
  C("b4e2fa13-d55c-49bd-b6c1-adeb9e8d5567", "preparation-et-spiritualite", "mdi:moon-waning-crescent", "#4A5D8A", 4),
  C("36626645-f12b-41fc-95b5-a7a9a601ff65", "temoignages", "mdi:heart-outline", "#A85B7A", 5),
];
