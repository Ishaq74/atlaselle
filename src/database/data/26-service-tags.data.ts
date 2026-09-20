// Service tags — 8 étiquettes transverses.
const G = (id: string, slug: string, color: string) => ({
  id,
  slug,
  color,
  createdAt: new Date("2026-06-15T09:00:00.000Z"),
  updatedAt: new Date("2026-06-15T09:00:00.000Z"),
});

export default [
  G("ff6843ae-97d9-4e6e-bc4b-95160a1c2efa", "visa", "#4A5D8A"),
  G("390da339-de91-4e94-905b-bfb102771c6d", "guide", "#C46A4A"),
  G("85cbc9bc-ed04-495c-b1fa-65d48d4a92e8", "transfert", "#3D6B6E"),
  G("bc9f2653-e7ac-4ded-822f-bacf9f6b2473", "sur-mesure", "#8A6BA8"),
  G("020abab2-c9b4-465b-9417-97326140b29e", "desert", "#B8912F"),
  G("0932d98c-1244-4827-81ca-0d6c4ee28890", "assurance", "#5A7A4A"),
  G("365d8e38-6440-43ca-8321-53747c28da18", "francophone", "#A85B7A"),
  G("484cb698-8174-4293-af25-519425188008", "petit-groupe", "#3D5A6B"),
];
