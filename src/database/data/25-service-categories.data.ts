// Service categories — 4 familles de services Atlaselle.
const C = (id: string, slug: string, icon: string, color: string, sortOrder: number) => ({
  id,
  parentId: null,
  slug,
  icon,
  color,
  sortOrder,
  createdAt: new Date("2026-06-15T09:00:00.000Z"),
  updatedAt: new Date("2026-06-15T09:00:00.000Z"),
});

export default [
  C("549cb747-865d-477f-9232-5553e183df8f", "formalites", "mdi:file-check-outline", "#4A5D8A", 0),
  C("2ce43abb-c02f-4491-8aab-b15734f35d8b", "accompagnement", "mdi:account-check-outline", "#C46A4A", 1),
  C("2fc8e104-a18c-49f6-9394-b65c344af3c0", "transport", "mdi:car-outline", "#3D6B6E", 2),
  C("d498d7ac-f583-4d33-8ff1-d2ac02466c90", "bien-etre-securite", "mdi:shield-check-outline", "#5A7A4A", 3),
];
