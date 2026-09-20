// Service comments — 8 commentaires utilisatrices + réponses rédaction.
// (serviceComments n'a pas de guestName : comptes uniquement.)
const K = (
  id: string,
  serviceId: string,
  authorId: string,
  parentId: string | null,
  content: string,
  status: string,
  createdAt: Date,
) => ({
  id,
  serviceId,
  authorId,
  parentId,
  content,
  status,
  createdAt,
  updatedAt: createdAt,
});

const ADMIN = "11111111-1111-1111-1111-111111111111";
const CAMILLE = "33333333-3333-3333-3333-333333333333";
const LUCAS = "44444444-4444-4444-4444-444444444444";
const SARAH = "55555555-5555-5555-5555-555555555555";
const AMINA = "66666666-6666-6666-6666-666666666666";
const INES = "77777777-7777-7777-7777-777777777777";

export default [
  K("31ddf253-680e-4db7-a9c9-1563cd28d843", "4fe869b9-68ee-4cd9-bacd-29258d552049", INES, null,
    "Le service couvre-t-il aussi les passeports non français ? Mon mari a un passeport belge.",
    "APPROVED", new Date("2026-08-08T10:00:00.000Z")),
  K("8d572870-2d2e-4d59-a714-3ea77a22cab6", "4fe869b9-68ee-4cd9-bacd-29258d552049", ADMIN, "31ddf253-680e-4db7-a9c9-1563cd28d843",
    "Bonjour Inès — oui, nous montons les dossiers pour la plupart des nationalités européennes. Écrivez-nous pour votre cas précis.",
    "APPROVED", new Date("2026-08-08T11:30:00.000Z")),
  K("fcc7220a-f48d-455c-a509-597e0072bbc9", "9493e50e-ebcd-4268-b5ef-5cd660f0904a", AMINA, null,
    "La journée guide existe-t-elle à Alger aussi, ou seulement Fès et Sarajevo ?",
    "APPROVED", new Date("2026-08-25T16:00:00.000Z")),
  K("cad4c6b2-1839-42cd-ad70-5393a8011233", "9493e50e-ebcd-4268-b5ef-5cd660f0904a", ADMIN, "fcc7220a-f48d-455c-a509-597e0072bbc9",
    "À Alger aussi, ainsi qu'à Grenade et Palerme. Le programme se construit la veille avec la guide.",
    "APPROVED", new Date("2026-08-25T17:00:00.000Z")),
  K("bdb961af-a363-46cb-a430-0c627e395475", "347b90bb-e76b-4da5-85d4-74233f6118ef", SARAH, null,
    "Confirmé : le chauffeur attend même en cas de retard. Prendre l'option aller-retour, ça simplifie tout.",
    "APPROVED", new Date("2026-08-01T08:30:00.000Z")),
  K("fa624af6-cf64-45f7-8d75-676685dcb6ca", "76a25f24-0a19-44f0-8596-9e1430ae62e8", LUCAS, null,
    "La consultation est-elle déductible aussi pour un voyage déjà réservé ?",
    "PENDING", new Date("2026-09-18T21:00:00.000Z")),
  K("975ba106-d21a-4437-a585-dcc504e096ce", "70ffd9d1-2f73-4e94-8536-02d548a92419", CAMILLE, null,
    "Si vous hésitez sur l'extension : prenez-la. La deuxième nuit au bivouac change tout.",
    "APPROVED", new Date("2026-07-14T20:00:00.000Z")),
  K("ef56c414-126d-412b-a22d-15af74691246", "00ccc16b-5fc1-4370-9b7e-8ff31c51ffdf", INES, null,
    "L'attestation pour le visa est arrivée immédiatement après paiement, comme annoncé.",
    "APPROVED", new Date("2026-08-10T09:00:00.000Z")),
];
