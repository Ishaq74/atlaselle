// Blog post locks — verrous d'édition actifs (Oumhani édite 2 articles).
// postId unique (contrainte). sessionId technique, expiresAt > lockedAt.
export default [
  {
    id: "c7a1e0f2-1111-4000-a000-b10000000001",
    postId: "9b4d8fef-badd-4787-ae7b-d91f7c7107c3",
    userId: "11111111-1111-1111-1111-111111111111",
    sessionId: "sess-oumhani-20260920-algeria",
    lockedAt: new Date("2026-09-20T14:30:00.000Z"),
    expiresAt: new Date("2026-09-20T15:30:00.000Z"),
  },
  {
    id: "c7a1e0f2-1111-4000-a000-b10000000002",
    postId: "39ee3d3f-56be-4097-915c-db53b8bf927f",
    userId: "11111111-1111-1111-1111-111111111111",
    sessionId: "sess-oumhani-20260920-andalusia",
    lockedAt: new Date("2026-09-20T14:45:00.000Z"),
    expiresAt: new Date("2026-09-20T15:45:00.000Z"),
  },
];
