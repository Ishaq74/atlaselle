// Service notifications — file d'Oumhani.
// CHECK : NEW_COMMENT/REPLY → commentId seul ; NEW_REVIEW → reviewId seul ;
// SERVICE_PUBLISHED → aucun. title/message obligatoires.
const ADMIN = "11111111-1111-1111-1111-111111111111";
const CAMILLE = "33333333-3333-3333-3333-333333333333";
const LUCAS = "44444444-4444-4444-4444-444444444444";
const SARAH = "55555555-5555-5555-5555-555555555555";
const AMINA = "66666666-6666-6666-6666-666666666666";
const INES = "77777777-7777-7777-7777-777777777777";

const N = (
  id: string,
  type: string,
  serviceId: string,
  commentId: string | null,
  reviewId: string | null,
  actorId: string | null,
  title: string,
  message: string,
  readAt: Date | null,
  createdAt: Date,
) => ({
  id,
  recipientId: ADMIN,
  actorId,
  serviceId,
  commentId,
  reviewId,
  type,
  title,
  message,
  readAt,
  createdAt,
});

export default [
  N("2b4b26db-593a-4b80-ae89-90abfa70121f", "NEW_REVIEW", "4fe869b9-68ee-4cd9-bacd-29258d552049", null, "29bd7915-6c27-469c-a3a3-a20ae282adb6", CAMILLE,
    "Nouvel avis — Assistance visa", "Camille Dupond a laissé un avis 5/5 sur Assistance visa et formalités.",
    new Date("2026-07-05T11:00:00.000Z"), new Date("2026-07-05T10:00:00.000Z")),
  N("85af25bb-0640-497e-ad5d-809fa6baec8a", "NEW_REVIEW", "9493e50e-ebcd-4268-b5ef-5cd660f0904a", null, "dfba31af-e9c6-4428-ac0e-0712fac319e8", SARAH,
    "Nouvel avis — Guide privée", "Sarah Leroy a laissé un avis 5/5 sur Guide privée francophone.",
    new Date("2026-07-30T20:00:00.000Z"), new Date("2026-07-30T19:00:00.000Z")),
  N("331cda8e-8bb2-45a7-a948-c0ba556a5fb6", "NEW_REVIEW", "347b90bb-e76b-4da5-85d4-74233f6118ef", null, "b2f3c86e-8d91-43b6-a5d3-6f3ec6b292d0", LUCAS,
    "Nouvel avis — Transfert aéroport", "Lucas Martin a laissé un avis 5/5 sur Transfert aéroport privé.",
    new Date("2026-07-25T10:00:00.000Z"), new Date("2026-07-25T09:00:00.000Z")),
  N("d8616222-3460-4432-ad18-e98432afb070", "NEW_COMMENT", "4fe869b9-68ee-4cd9-bacd-29258d552049", "31ddf253-680e-4db7-a9c9-1563cd28d843", null, INES,
    "Nouveau commentaire — Assistance visa", "Inès Kaci a commenté Assistance visa et formalités.",
    new Date("2026-08-08T12:00:00.000Z"), new Date("2026-08-08T10:00:00.000Z")),
  N("9a724ac2-748d-4030-a296-219233c59fe8", "NEW_COMMENT", "9493e50e-ebcd-4268-b5ef-5cd660f0904a", "fcc7220a-f48d-455c-a509-597e0072bbc9", null, AMINA,
    "Nouveau commentaire — Guide privée", "Amina Benali a commenté Guide privée francophone.",
    new Date("2026-08-25T17:30:00.000Z"), new Date("2026-08-25T16:00:00.000Z")),
  N("c5290224-16c0-4808-aef6-2f689a8a0c40", "NEW_REVIEW", "70ffd9d1-2f73-4e94-8536-02d548a92419", null, "1c0078a2-27cf-4493-a686-c02ef9fcc345", SARAH,
    "Nouvel avis — Extension désert", "Sarah Leroy a laissé un avis 5/5 sur Extension désert — 2 jours.",
    null, new Date("2026-09-15T20:00:00.000Z")),
  N("48501b86-432d-42b4-aef2-78cf216fc92e", "NEW_REVIEW", "76a25f24-0a19-44f0-8596-9e1430ae62e8", null, "4ee95573-b5b1-4c43-ac0b-ceb1b93a6671", AMINA,
    "Avis en attente — Consultation sur-mesure", "Un avis 4/5 sur Consultation voyage sur-mesure attend votre modération.",
    null, new Date("2026-09-19T09:00:00.000Z")),
  N("c18c67f7-da3d-4078-a0bc-5bb5d606757b", "NEW_COMMENT", "76a25f24-0a19-44f0-8596-9e1430ae62e8", "fa624af6-cf64-45f7-8d75-676685dcb6ca", null, LUCAS,
    "Nouveau commentaire — Consultation sur-mesure", "Lucas Martin a commenté Consultation voyage sur-mesure (en attente).",
    null, new Date("2026-09-18T21:00:00.000Z")),
];
