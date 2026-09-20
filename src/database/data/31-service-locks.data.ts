// Service locks — verrous d'édition actifs (Oumhani édite 2 services).
// serviceId unique. expiresAt > lockedAt (contrainte service_locks_expiry_after_lock).
export default [
  {
    id: "d8b2f103-2222-4000-a000-b20000000001",
    serviceId: "4fe869b9-68ee-4cd9-bacd-29258d552049",
    userId: "11111111-1111-1111-1111-111111111111",
    sessionId: "sess-oumhani-20260920-visa",
    lockedAt: new Date("2026-09-20T14:20:00.000Z"),
    expiresAt: new Date("2026-09-20T15:20:00.000Z"),
  },
  {
    id: "d8b2f103-2222-4000-a000-b20000000002",
    serviceId: "9493e50e-ebcd-4268-b5ef-5cd660f0904a",
    userId: "11111111-1111-1111-1111-111111111111",
    sessionId: "sess-oumhani-20260920-guide",
    lockedAt: new Date("2026-09-20T14:50:00.000Z"),
    expiresAt: new Date("2026-09-20T15:50:00.000Z"),
  },
];
