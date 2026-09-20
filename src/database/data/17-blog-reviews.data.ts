// Blog reviews — 8 avis lectrices sur les articles, 7 APPROVED + 1 PENDING.
// helpfulCount cohérent avec 17b (votes réels, auteure de l'avis exclue).
const RV = (
  id: string,
  postId: string,
  authorId: string | null,
  rating: number,
  title: string | null,
  content: string,
  status: string,
  helpfulCount: number,
  createdAt: Date,
) => ({
  id,
  postId,
  authorId,
  rating,
  title,
  content,
  status,
  isRecommended: rating >= 4,
  helpfulCount,
  ipAddress: "127.0.0.1",
  createdAt,
  updatedAt: createdAt,
});

const CAMILLE = "33333333-3333-3333-3333-333333333333";
const LUCAS = "44444444-4444-4444-4444-444444444444";
const SARAH = "55555555-5555-5555-5555-555555555555";
const AMINA = "66666666-6666-6666-6666-666666666666";
const INES = "77777777-7777-7777-7777-777777777777";

export default [
  RV("51f811b1-0a50-433c-a980-16fba005a4e0", "9b4d8fef-badd-4787-ae7b-d91f7c7107c3", CAMILLE, 5, "Fidèle au voyage",
    "J'ai fait ce voyage en juin et l'article le raconte exactement tel quel. La partie bivouac m'a donné envie d'y retourner.",
    "APPROVED", 3, new Date("2026-07-09T10:00:00.000Z")),
  RV("20d66656-ecba-41a5-a428-1713349d3e2d", "c4092370-2aa2-4986-ac3d-9ee0c40622cc", LUCAS, 5, "La liste qui marche",
    "Huit kilos cabine pour huit jours dans le désert : fait. La partie sur ce qu'on emporte en trop devrait être lue par tout le monde.",
    "APPROVED", 4, new Date("2026-08-12T14:00:00.000Z")),
  RV("9f5fc661-c0d5-4c3f-a2c2-c67c805c8c94", "e58bf5f3-629e-433f-a53c-804f3de36783", AMINA, 5, "L'article qui rassure",
    "Toutes mes questions y étaient, y compris celles que je n'osais pas poser. La partie « temps pour soi » est très juste.",
    "APPROVED", 5, new Date("2026-08-19T11:00:00.000Z")),
  RV("bf01286c-95e6-4243-ac1d-ff5bd2b41c99", "cc564fbf-0a61-4554-a5dc-a30fbfb5fb83", INES, 4, "Donne très envie",
    "Récit prenant. J'aurais aimé un peu plus de détails sur les longueurs de route entre l'Ouzbékistan et le Kirghizistan.",
    "APPROVED", 2, new Date("2026-08-07T09:00:00.000Z")),
  RV("c74dc189-dd4a-4f67-a6bd-bf131417911b", "2e254fa0-937a-4575-859c-79b037ee095c", SARAH, 5, "Clair et à jour",
    "Le tableau des formalités par pays est exactement ce qu'il me fallait. La partie visa Algérie m'a fait gagner un temps précieux.",
    "APPROVED", 3, new Date("2026-08-26T16:00:00.000Z")),
  RV("16eea639-c066-464d-a98a-f4beaa44a23c", "e4eade2e-cb1c-4852-a326-ab1e77149b82", AMINA, 5, "Respectueux et concret",
    "Enfin un article qui traite le sujet sans caricature. L'organisation des temps calmes est bien expliquée.",
    "APPROVED", 5, new Date("2026-09-03T12:00:00.000Z")),
  RV("b6ee1bda-6b15-4b60-a547-686d46df6cab", "2ae90d0f-fa6d-45d8-996f-45d3c1a7060f", CAMILLE, 4, "Transparence appréciable",
    "Le détail ligne par ligne est rare dans le secteur. Un exemple chiffré complet pour la Bosnie serait un plus.",
    "APPROVED", 1, new Date("2026-09-09T10:30:00.000Z")),
  RV("7431c713-8c26-4040-a84d-60a052c28344", "39ee3d3f-56be-4097-915c-db53b8bf927f", LUCAS, 4, "Beau récit",
    "La traversée du détroit très bien rendue. J'attends la suite sur la partie marocaine.",
    "PENDING", 0, new Date("2026-09-19T08:00:00.000Z")),
];
