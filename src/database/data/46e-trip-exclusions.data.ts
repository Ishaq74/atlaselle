// Trip exclusions — 2 par voyage (traductions en 46f).
const E = (id: string, tripId: string, sortOrder: number) => ({ id, tripId, sortOrder });
export default [
  E("exc-sa-1", "trip-south-africa", 0),
  E("exc-sa-2", "trip-south-africa", 1),
  E("exc-sm-1", "trip-sicily-malta", 0),
  E("exc-sm-2", "trip-sicily-malta", 1),
  E("exc-am-1", "trip-andalusia-morocco", 0),
  E("exc-am-2", "trip-andalusia-morocco", 1),
];
