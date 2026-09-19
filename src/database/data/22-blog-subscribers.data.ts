// Blog newsletter subscribers (single-tenant). status PENDING so the
// confirm/unsubscribe flows can be tested. token must be unique.
export default [
  {
    id: "fc000000-0000-0000-0000-000000000001",
    email: "reader.global.demo@example.com",
    locale: "fr",
    token: "demo-sub-global-0001",
    status: "PENDING",
    confirmedAt: null,
    unsubscribedAt: null,
    createdAt: new Date("2026-02-03T09:00:00.000Z"),
  },
  {
    id: "fc000000-0000-0000-0000-000000000002",
    email: "reader.org.demo@example.com",
    locale: "en",
    token: "demo-sub-org-0002",
    status: "CONFIRMED",
    confirmedAt: new Date("2026-02-04T09:00:00.000Z"),
    unsubscribedAt: null,
    createdAt: new Date("2026-02-04T08:00:00.000Z"),
  },
];
