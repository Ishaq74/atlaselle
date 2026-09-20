// Service review helpful votes — cohérent avec 34 (helpfulCount).
// L'auteure de l'avis ne vote jamais pour son propre avis.
const CAMILLE = "33333333-3333-3333-3333-333333333333";
const LUCAS = "44444444-4444-4444-4444-444444444444";
const SARAH = "55555555-5555-5555-5555-555555555555";
const AMINA = "66666666-6666-6666-6666-666666666666";
const INES = "77777777-7777-7777-7777-777777777777";

const H = (reviewId: string, userId: string, createdAt: Date) => ({
  reviewId,
  userId,
  isHelpful: true,
  createdAt,
});

export default [
  // svrev-visa-1 (2) — Camille exclue
  H("29bd7915-6c27-469c-a3a3-a20ae282adb6", AMINA, new Date("2026-07-06T09:00:00.000Z")),
  H("29bd7915-6c27-469c-a3a3-a20ae282adb6", INES, new Date("2026-07-06T10:00:00.000Z")),
  // svrev-visa-2 (1) — Amina exclue
  H("f2646d38-80a9-4fa5-a1b4-7976e9b22330", CAMILLE, new Date("2026-08-22T09:00:00.000Z")),
  // svrev-guide-1 (2) — Sarah exclue
  H("dfba31af-e9c6-4428-ac0e-0712fac319e8", CAMILLE, new Date("2026-07-31T09:00:00.000Z")),
  H("dfba31af-e9c6-4428-ac0e-0712fac319e8", INES, new Date("2026-08-01T10:00:00.000Z")),
  // svrev-guide-2 (1) — Lucas exclu
  H("58242dfb-036e-4b2b-a70e-ede42d7256e8", SARAH, new Date("2026-08-17T09:00:00.000Z")),
  // svrev-guide-3 (1) — Inès exclue
  H("6ecd34ed-8b4d-48cd-abe6-59e9de2fe364", AMINA, new Date("2026-09-03T09:00:00.000Z")),
  // svrev-trans-1 (1) — Lucas exclu
  H("b2f3c86e-8d91-43b6-a5d3-6f3ec6b292d0", CAMILLE, new Date("2026-07-26T09:00:00.000Z")),
  // svrev-sm-1 (1) — Camille exclue
  H("2f31d41e-a6e1-4018-a492-2420eefb7f24", LUCAS, new Date("2026-07-13T09:00:00.000Z")),
  // svrev-ext-1 (1) — Sarah exclue
  H("1c0078a2-27cf-4493-a686-c02ef9fcc345", AMINA, new Date("2026-09-16T09:00:00.000Z")),
];
