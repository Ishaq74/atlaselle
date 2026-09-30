/**
 * Registre des actions du domaine voyage.
 *
 * `astro:actions` n'expose que ce que réexporte `src/actions/index.ts` : sans
 * ce fichier, les mutations du domaine ne sont pas atteignables par
 * `actions.createTripReview` etc. Blog a le même barrel, d'où la parité.
 *
 * `departures`, `checkout` et `payments` sont réexportés : ils appartiennent au
 * même domaine voyage que `trips`, `contents` et `engagement`.
 */
export * from "./applications";
export * from "./checkout";
export * from "./contents";
export * from "./departures";
export * from "./email";
export * from "./engagement";
export * from "./faq";
export * from "./itinerary";
export * from "./moderation";
export * from "./notification";
export * from "./outbox";
export * from "./payments";
export * from "./policies";
export * from "./travelers";
export * from "./trips";
