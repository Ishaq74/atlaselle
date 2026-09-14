// Trip inclusions — 3 par voyage (traductions en 46d). Pas de prix journaliers.
const I = (id: string, tripId: string, sortOrder: number) => ({ id, tripId, sortOrder });
export default [
  I("inc-sa-1", "trip-south-africa", 0),
  I("inc-sa-2", "trip-south-africa", 1),
  I("inc-sa-3", "trip-south-africa", 2),
  I("inc-sm-1", "trip-sicily-malta", 0),
  I("inc-sm-2", "trip-sicily-malta", 1),
  I("inc-sm-3", "trip-sicily-malta", 2),
  I("inc-am-1", "trip-andalusia-morocco", 0),
  I("inc-am-2", "trip-andalusia-morocco", 1),
  I("inc-am-3", "trip-andalusia-morocco", 2),
];
