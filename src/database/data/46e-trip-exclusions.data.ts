// Trip exclusions — 2 par voyage × 5 = 10 (traductions en 46f).
const E = (id: string, tripId: string, sortOrder: number) => ({ id, tripId, sortOrder });
export default [
  E("exc-dz-1", "trip-algeria", 0),
  E("exc-dz-2", "trip-algeria", 1),
  E("exc-sm-1", "trip-sicily-malta", 0),
  E("exc-sm-2", "trip-sicily-malta", 1),
  E("exc-am-1", "trip-andalusia-morocco", 0),
  E("exc-am-2", "trip-andalusia-morocco", 1),
  E("exc-bo-1", "trip-bosnia", 0),
  E("exc-bo-2", "trip-bosnia", 1),
  E("exc-sk-1", "trip-silkroad", 0),
  E("exc-sk-2", "trip-silkroad", 1),
];
