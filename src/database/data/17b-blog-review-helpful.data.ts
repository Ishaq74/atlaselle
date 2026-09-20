// Blog review helpful votes — cohérent avec 17 (helpfulCount).
// brevw-0001: 3 · 0002: 4 · 0003: 5 · 0004: 2 · 0005: 3 · 0006: 5 · 0007: 1
// L'auteure de l'avis ne vote jamais pour son propre avis.
const ADMIN = "11111111-1111-1111-1111-111111111111";
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
  // brevw-0001 (3) — Camille exclue (auteure)
  H("51f811b1-0a50-433c-a980-16fba005a4e0", LUCAS, new Date("2026-07-09T12:00:00.000Z")),
  H("51f811b1-0a50-433c-a980-16fba005a4e0", SARAH, new Date("2026-07-09T13:00:00.000Z")),
  H("51f811b1-0a50-433c-a980-16fba005a4e0", INES, new Date("2026-07-10T09:00:00.000Z")),
  // brevw-0002 (4) — Lucas exclu
  H("20d66656-ecba-41a5-a428-1713349d3e2d", CAMILLE, new Date("2026-08-12T16:00:00.000Z")),
  H("20d66656-ecba-41a5-a428-1713349d3e2d", SARAH, new Date("2026-08-13T09:00:00.000Z")),
  H("20d66656-ecba-41a5-a428-1713349d3e2d", AMINA, new Date("2026-08-13T10:00:00.000Z")),
  H("20d66656-ecba-41a5-a428-1713349d3e2d", INES, new Date("2026-08-14T11:00:00.000Z")),
  // brevw-0003 (5) — Amina exclue
  H("9f5fc661-c0d5-4c3f-a2c2-c67c805c8c94", CAMILLE, new Date("2026-08-19T13:00:00.000Z")),
  H("9f5fc661-c0d5-4c3f-a2c2-c67c805c8c94", LUCAS, new Date("2026-08-19T14:00:00.000Z")),
  H("9f5fc661-c0d5-4c3f-a2c2-c67c805c8c94", SARAH, new Date("2026-08-20T09:00:00.000Z")),
  H("9f5fc661-c0d5-4c3f-a2c2-c67c805c8c94", INES, new Date("2026-08-20T10:00:00.000Z")),
  H("9f5fc661-c0d5-4c3f-a2c2-c67c805c8c94", ADMIN, new Date("2026-08-20T11:00:00.000Z")),
  // brevw-0004 (2) — Inès exclue
  H("bf01286c-95e6-4243-ac1d-ff5bd2b41c99", CAMILLE, new Date("2026-08-08T10:00:00.000Z")),
  H("bf01286c-95e6-4243-ac1d-ff5bd2b41c99", SARAH, new Date("2026-08-08T11:00:00.000Z")),
  // brevw-0005 (3) — Sarah exclue
  H("c74dc189-dd4a-4f67-a6bd-bf131417911b", CAMILLE, new Date("2026-08-27T09:00:00.000Z")),
  H("c74dc189-dd4a-4f67-a6bd-bf131417911b", AMINA, new Date("2026-08-27T10:00:00.000Z")),
  H("c74dc189-dd4a-4f67-a6bd-bf131417911b", INES, new Date("2026-08-28T11:00:00.000Z")),
  // brevw-0006 (5) — Amina exclue
  H("16eea639-c066-464d-a98a-f4beaa44a23c", CAMILLE, new Date("2026-09-03T14:00:00.000Z")),
  H("16eea639-c066-464d-a98a-f4beaa44a23c", LUCAS, new Date("2026-09-03T15:00:00.000Z")),
  H("16eea639-c066-464d-a98a-f4beaa44a23c", SARAH, new Date("2026-09-04T09:00:00.000Z")),
  H("16eea639-c066-464d-a98a-f4beaa44a23c", INES, new Date("2026-09-04T10:00:00.000Z")),
  H("16eea639-c066-464d-a98a-f4beaa44a23c", ADMIN, new Date("2026-09-04T11:00:00.000Z")),
  // brevw-0007 (1) — Camille exclue
  H("b6ee1bda-6b15-4b60-a547-686d46df6cab", SARAH, new Date("2026-09-09T12:00:00.000Z")),
];
