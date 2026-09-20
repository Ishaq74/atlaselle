// Blog favorites — PK (postId, userId) respectée.
const CAMILLE = "33333333-3333-3333-3333-333333333333";
const LUCAS = "44444444-4444-4444-4444-444444444444";
const SARAH = "55555555-5555-5555-5555-555555555555";
const AMINA = "66666666-6666-6666-6666-666666666666";
const INES = "77777777-7777-7777-7777-777777777777";

const F = (postId: string, userId: string, createdAt: Date) => ({ postId, userId, createdAt });

export default [
  F("9b4d8fef-badd-4787-ae7b-d91f7c7107c3", SARAH, new Date("2026-07-10T10:05:00.000Z")),
  F("9b4d8fef-badd-4787-ae7b-d91f7c7107c3", INES, new Date("2026-07-12T09:00:00.000Z")),
  F("e58bf5f3-629e-433f-a53c-804f3de36783", CAMILLE, new Date("2026-08-19T10:05:00.000Z")),
  F("e58bf5f3-629e-433f-a53c-804f3de36783", AMINA, new Date("2026-08-19T09:40:00.000Z")),
  F("e58bf5f3-629e-433f-a53c-804f3de36783", INES, new Date("2026-08-21T11:00:00.000Z")),
  F("c4092370-2aa2-4986-ac3d-9ee0c40622cc", LUCAS, new Date("2026-08-12T12:20:00.000Z")),
  F("c4092370-2aa2-4986-ac3d-9ee0c40622cc", SARAH, new Date("2026-08-15T09:00:00.000Z")),
  F("2e254fa0-937a-4575-859c-79b037ee095c", AMINA, new Date("2026-08-27T10:05:00.000Z")),
  F("e4eade2e-cb1c-4852-a326-ab1e77149b82", CAMILLE, new Date("2026-09-04T09:00:00.000Z")),
  F("2ae90d0f-fa6d-45d8-996f-45d3c1a7060f", INES, new Date("2026-09-19T10:25:00.000Z")),
];
