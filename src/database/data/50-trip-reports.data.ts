// Trip reports — single-target constraint, gabarit blog 19 + services 36.
export default [
  {
    id: "tr000000-0000-0000-0000-000000000001",
    tripId: null,
    commentId: "t8000000-0000-0000-0000-000000000003",
    reviewId: null,
    reporterId: "11111111-1111-1111-1111-111111111111",
    reason: "SPAM",
    description: "Demo seed: pending voyage comment report sample for the moderation queue.",
    status: "PENDING",
    resolvedBy: null,
    resolvedAt: null,
    createdAt: new Date("2026-09-12T14:30:00.000Z"),
  },
  {
    id: "tr000000-0000-0000-0000-000000000002",
    tripId: null,
    commentId: null,
    reviewId: "t9000000-0000-0000-0000-000000000004",
    reporterId: "11111111-1111-1111-1111-111111111111",
    reason: "OFF_TOPIC",
    description: "Demo seed: pending voyage review report sample for the moderation queue.",
    status: "PENDING",
    resolvedBy: null,
    resolvedAt: null,
    createdAt: new Date("2026-09-13T11:30:00.000Z"),
  },
];
