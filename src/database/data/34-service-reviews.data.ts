// Service reviews — 9 avis : 8 APPROVED + 1 PENDING.
// UNIQUE(serviceId, authorId) respectée. Compteurs 24-services cohérents :
// visa 500/2 · guide 467/3 · transfert 500/1 · sur-mesure 500/1 · ext 500/1.
// helpfulCount cohérent avec 34b.
const RV = (
  id: string,
  serviceId: string,
  authorId: string,
  rating: number,
  title: string | null,
  content: string,
  status: string,
  helpfulCount: number,
  createdAt: Date,
) => ({
  id,
  serviceId,
  authorId,
  rating,
  title,
  content,
  status,
  isRecommended: rating >= 4,
  helpfulCount,
  createdAt,
  updatedAt: createdAt,
});

const CAMILLE = "33333333-3333-3333-3333-333333333333";
const LUCAS = "44444444-4444-4444-4444-444444444444";
const SARAH = "55555555-5555-5555-5555-555555555555";
const AMINA = "66666666-6666-6666-6666-666666666666";
const INES = "77777777-7777-7777-7777-777777777777";

export default [
  RV("29bd7915-6c27-469c-a3a3-a20ae282adb6", "4fe869b9-68ee-4cd9-bacd-29258d552049", CAMILLE, 5, "Dossier monté sans stress",
    "Liste des pièces claire, rendez-vous consulaire pris pour moi, visa obtenu du premier coup. L'attestation d'hébergement était prête en 48 h.",
    "APPROVED", 2, new Date("2026-07-05T10:00:00.000Z")),
  RV("f2646d38-80a9-4fa5-a1b4-7976e9b22330", "4fe869b9-68ee-4cd9-bacd-29258d552049", AMINA, 5, "Indispensable pour l'Algérie",
    "Le visa algérien me faisait peur depuis des mois. Dossier bouclé en neuf jours, avec un appel très rassurant avant le dépôt.",
    "APPROVED", 1, new Date("2026-08-21T15:00:00.000Z")),
  RV("dfba31af-e9c6-4428-ac0e-0712fac319e8", "9493e50e-ebcd-4268-b5ef-5cd660f0904a", SARAH, 5, "Une journée à Fès inoubliable",
    "Notre guide connaissait chaque atelier de la médina. Huit heures sont passées comme deux.",
    "APPROVED", 2, new Date("2026-07-30T19:00:00.000Z")),
  RV("58242dfb-036e-4b2b-a70e-ede42d7256e8", "9493e50e-ebcd-4268-b5ef-5cd660f0904a", LUCAS, 4, "Très bonne journée à Sarajevo",
    "Guide passionnante et programme bien construit la veille. Un point de moins car la météo a réduit la partie colline — pas la faute du service.",
    "APPROVED", 1, new Date("2026-08-16T18:00:00.000Z")),
  RV("6ecd34ed-8b4d-48cd-abe6-59e9de2fe364", "9493e50e-ebcd-4268-b5ef-5cd660f0904a", INES, 5, "Le bon format",
    "Réservé pour notre première journée à Fès : parfait pour prendre ses repères avant d'explorer seule.",
    "APPROVED", 1, new Date("2026-09-02T11:00:00.000Z")),
  RV("b2f3c86e-8d91-43b6-a5d3-6f3ec6b292d0", "347b90bb-e76b-4da5-85d4-74233f6118ef", LUCAS, 5, "Minuit à Alger, zéro friction",
    "Vol retardé de deux heures : le chauffeur attendait, pancarte en main. Accompagnement à pied jusqu'au riad dans la Casbah.",
    "APPROVED", 1, new Date("2026-07-25T09:00:00.000Z")),
  RV("2f31d41e-a6e1-4018-a492-2420eefb7f24", "76a25f24-0a19-44f0-8596-9e1430ae62e8", CAMILLE, 5, "Une heure qui change tout",
    "Repartie avec un itinéraire écrit en 48 h, honnête sur ce qui ne valait pas le coup. Déduit du voyage, comme promis.",
    "APPROVED", 1, new Date("2026-07-12T14:00:00.000Z")),
  RV("4ee95573-b5b1-4c43-ac0b-ceb1b93a6671", "76a25f24-0a19-44f0-8596-9e1430ae62e8", AMINA, 4, "Très utile, créneaux à élargir",
    "Contenu excellent. Seul bémol : les créneaux du mercredi après-midi ne conviennent pas à toutes.",
    "PENDING", 0, new Date("2026-09-19T09:00:00.000Z")),
  RV("1c0078a2-27cf-4493-a686-c02ef9fcc345", "70ffd9d1-2f73-4e94-8536-02d548a92419", SARAH, 5, "La nuit de trop qu'il fallait",
    "Deux jours de plus à Djanet : le lever de soleil sur les dunes justifie à lui seul l'extension.",
    "APPROVED", 1, new Date("2026-09-15T20:00:00.000Z")),
];
