// Service favorites — PK (serviceId, userId) respectée.
const CAMILLE = "33333333-3333-3333-3333-333333333333";
const LUCAS = "44444444-4444-4444-4444-444444444444";
const SARAH = "55555555-5555-5555-5555-555555555555";
const AMINA = "66666666-6666-6666-6666-666666666666";
const INES = "77777777-7777-7777-7777-777777777777";

const F = (serviceId: string, userId: string, createdAt: Date) => ({ serviceId, userId, createdAt });

export default [
  F("4fe869b9-68ee-4cd9-bacd-29258d552049", CAMILLE, new Date("2026-07-02T10:00:00.000Z")),
  F("4fe869b9-68ee-4cd9-bacd-29258d552049", INES, new Date("2026-08-07T09:00:00.000Z")),
  F("9493e50e-ebcd-4268-b5ef-5cd660f0904a", AMINA, new Date("2026-08-20T11:00:00.000Z")),
  F("9493e50e-ebcd-4268-b5ef-5cd660f0904a", INES, new Date("2026-08-22T14:00:00.000Z")),
  F("347b90bb-e76b-4da5-85d4-74233f6118ef", SARAH, new Date("2026-07-31T08:00:00.000Z")),
  F("76a25f24-0a19-44f0-8596-9e1430ae62e8", LUCAS, new Date("2026-09-05T16:00:00.000Z")),
  F("70ffd9d1-2f73-4e94-8536-02d548a92419", AMINA, new Date("2026-09-12T10:00:00.000Z")),
];
