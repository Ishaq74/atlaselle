// Service availability — créneaux hebdomadaires (dayOfWeek 0=dimanche).
// Timezone Europe/Paris pour les services bureau, locale pour le terrain.
const AV = (
  id: string,
  serviceId: string,
  dayOfWeek: number,
  startTime: string,
  endTime: string,
  timezone: string,
  maxParticipants: number | null,
) => ({
  id,
  serviceId,
  dayOfWeek,
  startTime,
  endTime,
  timezone,
  maxParticipants,
  createdAt: new Date("2026-06-15T09:00:00.000Z"),
});

export default [
  // ── Assistance visa : lun-ven 09:00-17:00, 1 dossier par créneau ──
  AV("917271fa-5150-45f1-a4fe-9e5289342cce", "4fe869b9-68ee-4cd9-bacd-29258d552049", 1, "09:00", "17:00", "Europe/Paris", 4),
  AV("0b3992ea-1139-4442-a7ff-575ce4cce8f7", "4fe869b9-68ee-4cd9-bacd-29258d552049", 2, "09:00", "17:00", "Europe/Paris", 4),
  AV("b13e3208-f90e-4a47-a270-2c4cd42b1ecf", "4fe869b9-68ee-4cd9-bacd-29258d552049", 3, "09:00", "17:00", "Europe/Paris", 4),
  AV("2ae18be7-4923-44d5-affc-4348335d8331", "4fe869b9-68ee-4cd9-bacd-29258d552049", 4, "09:00", "17:00", "Europe/Paris", 4),
  AV("2ace5c21-9e1b-4968-a91f-843a3d33ee2e", "4fe869b9-68ee-4cd9-bacd-29258d552049", 5, "09:00", "17:00", "Europe/Paris", 4),
  // ── Guide privée : mardi + samedi, journée complète ──
  AV("83c770b8-13ca-44a6-a14b-45965db6fad6", "9493e50e-ebcd-4268-b5ef-5cd660f0904a", 2, "09:00", "18:00", "Africa/Casablanca", 6),
  AV("ccb24e5c-3cb2-4ac1-adf6-b7c46967f120", "9493e50e-ebcd-4268-b5ef-5cd660f0904a", 6, "09:00", "18:00", "Africa/Casablanca", 6),
  // ── Transfert : tous les jours 06:00-23:00 ──
  AV("0e3f87a8-20ac-4bf8-a354-b00dbacec001", "347b90bb-e76b-4da5-85d4-74233f6118ef", 0, "06:00", "23:00", "Europe/Paris", 4),
  AV("5868470e-7317-4476-af84-c8f42f533924", "347b90bb-e76b-4da5-85d4-74233f6118ef", 1, "06:00", "23:00", "Europe/Paris", 4),
  AV("811bf87e-15f7-4a73-a5d6-aa043d5d0ae6", "347b90bb-e76b-4da5-85d4-74233f6118ef", 2, "06:00", "23:00", "Europe/Paris", 4),
  AV("d4255757-6041-42fe-aa82-328e0c995813", "347b90bb-e76b-4da5-85d4-74233f6118ef", 3, "06:00", "23:00", "Europe/Paris", 4),
  AV("004d56cd-3a74-4d34-a440-ce9d231bd4a4", "347b90bb-e76b-4da5-85d4-74233f6118ef", 4, "06:00", "23:00", "Europe/Paris", 4),
  AV("98d92efc-9668-4dbb-a9a4-1c1628f73a54", "347b90bb-e76b-4da5-85d4-74233f6118ef", 5, "06:00", "23:00", "Europe/Paris", 4),
  AV("a72a5b11-f205-48c2-abe9-bc150b44bce5", "347b90bb-e76b-4da5-85d4-74233f6118ef", 6, "06:00", "23:00", "Europe/Paris", 4),
  // ── Consultation sur-mesure : mercredi aprem + samedi matin ──
  AV("63978c6b-aa2c-4f88-a846-b633bb387dc5", "76a25f24-0a19-44f0-8596-9e1430ae62e8", 3, "14:00", "18:00", "Europe/Paris", 2),
  AV("be126799-8d5d-4976-ab21-9c1337a77f94", "76a25f24-0a19-44f0-8596-9e1430ae62e8", 6, "10:00", "12:00", "Europe/Paris", 2),
  // ── Assurance : souscription en ligne lun-ven ──
  AV("4f69e386-8573-4fab-a6c1-41df1bf85e89", "00ccc16b-5fc1-4370-9b7e-8ff31c51ffdf", 1, "09:00", "17:00", "Europe/Paris", null),
  AV("3b09e6f2-2799-4578-ad8f-c4e642e83377", "00ccc16b-5fc1-4370-9b7e-8ff31c51ffdf", 2, "09:00", "17:00", "Europe/Paris", null),
  AV("cbd44665-69a2-43fa-a326-49f449275cb8", "00ccc16b-5fc1-4370-9b7e-8ff31c51ffdf", 3, "09:00", "17:00", "Europe/Paris", null),
  AV("e6253fef-f8ca-4bc8-aa8e-e47bed776c0f", "00ccc16b-5fc1-4370-9b7e-8ff31c51ffdf", 4, "09:00", "17:00", "Europe/Paris", null),
  AV("0b05e1a9-ff98-4f19-ab78-88a9a52bf1a4", "00ccc16b-5fc1-4370-9b7e-8ff31c51ffdf", 5, "09:00", "17:00", "Europe/Paris", null),
];
