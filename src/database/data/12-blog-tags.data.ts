// Blog tags — 12 étiquettes transverses du journal Atlaselle.
// Slug racine = slug FR ; slugs localisés dans 12b.
const G = (id: string, slug: string, color: string) => ({
  id,
  slug,
  color,
  createdAt: new Date("2026-07-01T09:00:00.000Z"),
  updatedAt: new Date("2026-07-01T09:00:00.000Z"),
});

export default [
  G("77d41813-1664-4cd6-9d89-e8279ef3315b", "desert", "#C46A4A"),
  G("9e1dd7d8-de2e-4de0-906c-381852fa5854", "medina", "#8A6BA8"),
  G("bb00a3d9-0175-4947-a062-124101bf7dad", "petit-groupe", "#3D6B6E"),
  G("9166a075-a8d2-468d-a32b-94150403bc89", "voyage-solo-femmes", "#A85B7A"),
  G("4a33b847-a7e7-4d07-b2af-c41b240b91e7", "budget", "#B8912F"),
  G("dc3bcf8f-bece-434a-a1ad-83c3e017303f", "visa", "#4A5D8A"),
  G("f7c5f866-4ec2-46fb-a069-90467010a93a", "ramadan", "#5A7A4A"),
  G("44b635cc-7a45-40f3-8b1f-6df8ba5429f4", "cuisine", "#B85C38"),
  G("61f272a5-ba9c-479b-b85a-8bbd24839471", "histoire", "#6B5B95"),
  G("0ba46b94-a32d-4883-9406-c6b0fc0c0a7c", "randonnee", "#4A7A5C"),
  G("cf4f4d87-13da-4e3a-a9ed-29dbeefb42f7", "bivouac", "#8A4A3D"),
  G("7c03e6e4-9585-4516-8c67-b32047b0bd4c", "famille", "#3D5A6B"),
];
