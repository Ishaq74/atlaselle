// Trip highlights — 2 par voyage (traductions en 46b).
const H = (id: string, tripId: string, sortOrder: number) => ({ id, tripId, mediaId: null, iconKey: null, sortOrder });
export default [
  H("hl-sa-1", "trip-south-africa", 0),
  H("hl-sa-2", "trip-south-africa", 1),
  H("hl-sm-1", "trip-sicily-malta", 0),
  H("hl-sm-2", "trip-sicily-malta", 1),
  H("hl-am-1", "trip-andalusia-morocco", 0),
  H("hl-am-2", "trip-andalusia-morocco", 1),
];
