// Service attribute definitions — 5 attributs structurants du catalogue.
const D = new Date("2026-06-15T09:00:00.000Z");

const A = (
  id: string,
  key: string,
  label: string,
  type: "STRING" | "NUMBER" | "BOOLEAN" | "SELECT",
  options: string | null,
  required: boolean,
  sortOrder: number,
) => ({ id, key, label, type, options, required, sortOrder, createdAt: D, updatedAt: D });

export default [
  A("105397b8-2d4f-4bf2-a04a-bac909a6f0db", "langues", "Langues parlées", "SELECT", "français,anglais,espagnol,arabe", true, 0),
  A("8bb085f6-07f4-46ee-a59f-bc476a0e5ebe", "format_groupe", "Format du groupe", "SELECT", "privé,petit groupe", true, 1),
  A("9f2a60ec-a7b1-4fd8-a91c-e1751d48a780", "point_rdv", "Point de rendez-vous", "STRING", null, false, 2),
  A("6778d9ac-ad2a-4fe3-af9c-56908dfcd496", "delai_reservation_heures", "Délai de réservation minimum (heures)", "NUMBER", null, true, 3),
  A("ad214dfc-eaf5-4a07-ac4b-3ebfb6129934", "confirmation_immediate", "Confirmation immédiate", "BOOLEAN", null, false, 4),
];
