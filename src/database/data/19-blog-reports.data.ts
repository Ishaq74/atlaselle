// Blog reports — 2 signalements résolus par Oumhani.
// CHECK blog_reports_single_target : exactement 1 cible parmi post/comment/review.
export default [
  {
    id: "2bb2c986-32e2-426d-9ec4-eeb6a5b0e29a",
    postId: null,
    commentId: "3ec170c3-f2ca-49a9-a225-128bdc55d907",
    reviewId: null,
    reporterId: "66666666-6666-6666-6666-666666666666",
    reason: "OTHER",
    description: "Question plutôt destinée au service client — signalé pour réponse directe.",
    status: "RESOLVED",
    resolvedBy: "11111111-1111-1111-1111-111111111111",
    resolvedAt: new Date("2026-09-19T09:00:00.000Z"),
    createdAt: new Date("2026-09-18T22:30:00.000Z"),
  },
  {
    id: "8d7b4fd5-d3ad-4431-9c12-8a210515345d",
    postId: "2ae90d0f-fa6d-45d8-996f-45d3c1a7060f",
    commentId: null,
    reviewId: null,
    reporterId: "44444444-4444-4444-4444-444444444444",
    reason: "OFF_TOPIC",
    description: "Lien externe publicitaire détecté dans une ancienne version du commentaire d'un invité (depuis supprimé).",
    status: "RESOLVED",
    resolvedBy: "11111111-1111-1111-1111-111111111111",
    resolvedAt: new Date("2026-09-10T11:00:00.000Z"),
    createdAt: new Date("2026-09-10T08:20:00.000Z"),
  },
];
