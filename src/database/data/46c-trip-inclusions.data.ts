// Trip inclusions — 3 par voyage × 5 = 15 (traductions en 46d). Pas de prix journaliers.
const I = (id: string, tripId: string, sortOrder: number) => ({ id, tripId, sortOrder });
export default [
  I("inc-dz-1", "trip-algeria", 0),
  I("inc-dz-2", "trip-algeria", 1),
  I("inc-dz-3", "trip-algeria", 2),
  I("inc-sm-1", "trip-sicily-malta", 0),
  I("inc-sm-2", "trip-sicily-malta", 1),
  I("inc-sm-3", "trip-sicily-malta", 2),
  I("inc-am-1", "trip-andalusia-morocco", 0),
  I("inc-am-2", "trip-andalusia-morocco", 1),
  I("inc-am-3", "trip-andalusia-morocco", 2),
  I("inc-bo-1", "trip-bosnia", 0),
  I("inc-bo-2", "trip-bosnia", 1),
  I("inc-bo-3", "trip-bosnia", 2),
  I("inc-sk-1", "trip-silkroad", 0),
  I("inc-sk-2", "trip-silkroad", 1),
  I("inc-sk-3", "trip-silkroad", 2),
];
