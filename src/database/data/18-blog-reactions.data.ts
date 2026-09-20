// Blog reactions — PK (postId, userId) respectée, une réaction par user/article.
const ADMIN = "11111111-1111-1111-1111-111111111111";
const CAMILLE = "33333333-3333-3333-3333-333333333333";
const LUCAS = "44444444-4444-4444-4444-444444444444";
const SARAH = "55555555-5555-5555-5555-555555555555";
const AMINA = "66666666-6666-6666-6666-666666666666";
const INES = "77777777-7777-7777-7777-777777777777";

const R = (postId: string, userId: string, reactionType: string, createdAt: Date) => ({
  postId,
  userId,
  reactionType,
  createdAt,
  updatedAt: createdAt,
});

export default [
  R("9b4d8fef-badd-4787-ae7b-d91f7c7107c3", CAMILLE, "LOVE", new Date("2026-07-08T19:25:00.000Z")),
  R("9b4d8fef-badd-4787-ae7b-d91f7c7107c3", LUCAS, "LIKE", new Date("2026-07-09T08:00:00.000Z")),
  R("9b4d8fef-badd-4787-ae7b-d91f7c7107c3", SARAH, "LOVE", new Date("2026-07-10T10:00:00.000Z")),
  R("39ee3d3f-56be-4097-915c-db53b8bf927f", CAMILLE, "LOVE", new Date("2026-07-15T20:05:00.000Z")),
  R("39ee3d3f-56be-4097-915c-db53b8bf927f", AMINA, "LIKE", new Date("2026-07-16T09:00:00.000Z")),
  R("d7d77012-392f-49ad-8b72-e5860a1eff5a", INES, "LIKE", new Date("2026-07-23T11:00:00.000Z")),
  R("335960c7-43bb-44eb-84fb-3bb7b2f5969b", SARAH, "LOVE", new Date("2026-07-29T18:35:00.000Z")),
  R("335960c7-43bb-44eb-84fb-3bb7b2f5969b", AMINA, "LIKE", new Date("2026-07-30T09:00:00.000Z")),
  R("cc564fbf-0a61-4554-a5dc-a30fbfb5fb83", INES, "FIRE", new Date("2026-08-06T21:05:00.000Z")),
  R("cc564fbf-0a61-4554-a5dc-a30fbfb5fb83", LUCAS, "FIRE", new Date("2026-08-07T10:00:00.000Z")),
  R("c4092370-2aa2-4986-ac3d-9ee0c40622cc", LUCAS, "CLAP", new Date("2026-08-12T12:15:00.000Z")),
  R("c4092370-2aa2-4986-ac3d-9ee0c40622cc", CAMILLE, "CLAP", new Date("2026-08-13T08:00:00.000Z")),
  R("e58bf5f3-629e-433f-a53c-804f3de36783", AMINA, "LOVE", new Date("2026-08-19T09:35:00.000Z")),
  R("e58bf5f3-629e-433f-a53c-804f3de36783", CAMILLE, "LOVE", new Date("2026-08-19T10:00:00.000Z")),
  R("e58bf5f3-629e-433f-a53c-804f3de36783", SARAH, "LOVE", new Date("2026-08-20T09:00:00.000Z")),
  R("2e254fa0-937a-4575-859c-79b037ee095c", SARAH, "CLAP", new Date("2026-08-26T16:05:00.000Z")),
  R("e4eade2e-cb1c-4852-a326-ab1e77149b82", AMINA, "LOVE", new Date("2026-09-03T12:05:00.000Z")),
  R("e4eade2e-cb1c-4852-a326-ab1e77149b82", ADMIN, "LOVE", new Date("2026-09-03T12:30:00.000Z")),
  R("2ae90d0f-fa6d-45d8-996f-45d3c1a7060f", INES, "LIKE", new Date("2026-09-19T10:20:00.000Z")),
];
