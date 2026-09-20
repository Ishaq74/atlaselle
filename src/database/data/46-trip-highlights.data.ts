// Trip highlights — 2 par voyage × 5 (traductions en 46b).
// mediaId réel aligné aux dossiers images (invariant hero/highlights illustrés).
const H = (id: string, tripId: string, sortOrder: number, mediaId: string | null) => ({ id, tripId, mediaId, iconKey: null, sortOrder });
export default [
  H("hl-dz-1", "trip-algeria", 0, "med-algeria-01"),
  H("hl-dz-2", "trip-algeria", 1, "med-algeria-04"),
  H("hl-sm-1", "trip-sicily-malta", 0, "med-maltsic-03"),
  H("hl-sm-2", "trip-sicily-malta", 1, "med-maltsic-02"),
  H("hl-am-1", "trip-andalusia-morocco", 0, "med-andmor-03"),
  H("hl-am-2", "trip-andalusia-morocco", 1, "med-andmor-04"),
  H("hl-bo-1", "trip-bosnia", 0, "med-bosnia-01"),
  H("hl-bo-2", "trip-bosnia", 1, "med-bosnia-03"),
  H("hl-sk-1", "trip-silkroad", 0, "med-silk-01"),
  H("hl-sk-2", "trip-silkroad", 1, "med-silk-05"),
];
