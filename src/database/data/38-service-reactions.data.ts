// Service reactions — PK (serviceId, userId), enum LIKE/LOVE/FIRE/CLAP.
const CAMILLE = "33333333-3333-3333-3333-333333333333";
const LUCAS = "44444444-4444-4444-4444-444444444444";
const SARAH = "55555555-5555-5555-5555-555555555555";
const AMINA = "66666666-6666-6666-6666-666666666666";
const INES = "77777777-7777-7777-7777-777777777777";

const R = (serviceId: string, userId: string, reactionType: string, createdAt: Date) => ({
  serviceId,
  userId,
  reactionType,
  createdAt,
  updatedAt: createdAt,
});

export default [
  R("4fe869b9-68ee-4cd9-bacd-29258d552049", CAMILLE, "CLAP", new Date("2026-07-05T10:05:00.000Z")),
  R("4fe869b9-68ee-4cd9-bacd-29258d552049", AMINA, "LOVE", new Date("2026-08-21T15:05:00.000Z")),
  R("4fe869b9-68ee-4cd9-bacd-29258d552049", INES, "LIKE", new Date("2026-08-07T09:05:00.000Z")),
  R("9493e50e-ebcd-4268-b5ef-5cd660f0904a", SARAH, "LOVE", new Date("2026-07-30T19:05:00.000Z")),
  R("9493e50e-ebcd-4268-b5ef-5cd660f0904a", INES, "LOVE", new Date("2026-09-02T11:05:00.000Z")),
  R("347b90bb-e76b-4da5-85d4-74233f6118ef", LUCAS, "CLAP", new Date("2026-07-25T09:05:00.000Z")),
  R("76a25f24-0a19-44f0-8596-9e1430ae62e8", CAMILLE, "LIKE", new Date("2026-07-12T14:05:00.000Z")),
  R("70ffd9d1-2f73-4e94-8536-02d548a92419", SARAH, "FIRE", new Date("2026-09-15T20:05:00.000Z")),
  R("70ffd9d1-2f73-4e94-8536-02d548a92419", AMINA, "FIRE", new Date("2026-09-12T10:05:00.000Z")),
];
