// Services — 6 services Atlaselle PUBLISHED, provider : Oumhani Achour.
// ratingAverage100/ratingCount cohérents avec 34 (avis APPROVED uniquement) :
// visa 500/2 · guide 467/3 · transfert 500/1 · sur-mesure 500/1 ·
// extension-desert 500/1 · assurance 0/0.
const S = (
  id: string,
  slug: string,
  coverImageId: string,
  priceMinor: number | null,
  durationMinutes: number | null,
  maxParticipants: number | null,
  isMobile: boolean,
  isFeatured: boolean,
  viewCount: number,
  ratingAverage100: number,
  ratingCount: number,
  seoScore: number,
  publishedAt: Date,
) => ({
  id,
  providerId: "11111111-1111-1111-1111-111111111111",
  slug,
  status: "PUBLISHED",
  coverImageId,
  priceMinor,
  currency: "EUR",
  durationMinutes,
  maxParticipants,
  isMobile,
  isFeatured,
  viewCount,
  ratingAverage100,
  ratingCount,
  seoScore,
  publishedAt,
  createdAt: publishedAt,
  updatedAt: publishedAt,
  updatedBy: "11111111-1111-1111-1111-111111111111",
  lockedBy: null,
  lockedAt: null,
});

export default [
  S("4fe869b9-68ee-4cd9-bacd-29258d552049", "assistance-visa-formalites", "9e5fb75e-e67d-4d2a-a4b1-1b55dab31f70", 9500, 45, 1, false, true, 486, 500, 2, 93, new Date("2026-06-15T09:00:00.000Z")),
  S("9493e50e-ebcd-4268-b5ef-5cd660f0904a", "guide-privee-francophone", "caeca25e-e144-4663-a483-49c35eedfd16", 18000, 480, 6, true, true, 342, 467, 3, 91, new Date("2026-06-15T09:10:00.000Z")),
  S("347b90bb-e76b-4da5-85d4-74233f6118ef", "transfert-aeroport-prive", "e0ef38d1-7681-499e-a6c0-05c2848170b1", 4500, 60, 4, true, false, 268, 500, 1, 88, new Date("2026-06-15T09:20:00.000Z")),
  S("76a25f24-0a19-44f0-8596-9e1430ae62e8", "consultation-voyage-sur-mesure", "de4c07a2-50c8-4756-a187-8c1d61185469", 6000, 60, 2, false, false, 195, 500, 1, 90, new Date("2026-06-22T09:00:00.000Z")),
  S("70ffd9d1-2f73-4e94-8536-02d548a92419", "extension-desert-2-jours", "ff4992b5-1aeb-4f82-961c-1eed42476af1", 29000, null, 8, true, false, 154, 500, 1, 89, new Date("2026-06-29T09:00:00.000Z")),
  S("00ccc16b-5fc1-4370-9b7e-8ff31c51ffdf", "assurance-assistance-voyage", "be6d6c45-6754-4954-ae0a-95c448ca1705", 3900, null, null, false, false, 121, 0, 0, 87, new Date("2026-07-06T09:00:00.000Z")),
];
