// Blog posts — 10 articles PUBLISHED, autrice : Oumhani Achour (11111111).
// 5 récits destination (alignés aux 5 voyages) + 5 guides pratiques.
// featuredImageId → médiathèque voyages (00b). Compteurs cohérents avec
// l'engagement seedé (17 avis blog) et les vues déclarées.
const P = (
  id: string,
  slug: string,
  featuredImageId: string,
  viewCount: number,
  isFeatured: boolean,
  isSticky: boolean,
  seoScore: number,
  publishedAt: Date,
) => ({
  id,
  authorId: "11111111-1111-1111-1111-111111111111",
  slug,
  status: "PUBLISHED",
  featuredImageId,
  viewCount,
  isFeatured,
  isSticky,
  commentStatus: "OPEN",
  allowReviews: true,
  seoScore,
  publishedAt,
  createdAt: publishedAt,
  updatedAt: publishedAt,
  updatedBy: "11111111-1111-1111-1111-111111111111",
  lockedBy: null,
  lockedAt: null,
});

export default [
  P("9b4d8fef-badd-4787-ae7b-d91f7c7107c3", "algerie-desert-oasis-alger", "ff4992b5-1aeb-4f82-961c-1eed42476af1", 412, true, false, 94, new Date("2026-07-06T08:00:00.000Z")),
  P("39ee3d3f-56be-4097-915c-db53b8bf927f", "andalousie-maroc-deux-rivages", "10f32a99-7dc0-4515-880e-346971974385", 356, false, false, 92, new Date("2026-07-13T08:00:00.000Z")),
  P("d7d77012-392f-49ad-8b72-e5860a1eff5a", "bosnie-ponts-et-rivieres", "9122ed1e-6dcd-4653-bbe8-f4b6a42877ba", 287, false, false, 90, new Date("2026-07-20T08:00:00.000Z")),
  P("335960c7-43bb-44eb-84fb-3bb7b2f5969b", "sicile-malte-traversee-insulaire", "b118554b-0c93-443f-9c25-e4a3d6f5253f", 264, false, false, 91, new Date("2026-07-27T08:00:00.000Z")),
  P("cc564fbf-0a61-4554-a5dc-a30fbfb5fb83", "route-de-la-soie-samarcande-song-kul", "b89b1bda-87af-49c4-80ff-5d72fff4fb5e", 339, false, false, 93, new Date("2026-08-03T08:00:00.000Z")),
  P("c4092370-2aa2-4986-ac3d-9ee0c40622cc", "preparer-sa-valise-petit-groupe", "c3be1d30-f97e-4c09-aa0f-dc1ad481f8b5", 521, false, false, 95, new Date("2026-08-10T08:00:00.000Z")),
  P("e58bf5f3-629e-433f-a53c-804f3de36783", "voyager-seule-en-toute-serenite", "d074d152-7ca1-43ad-abe3-ce832875b160", 608, true, true, 96, new Date("2026-08-17T08:00:00.000Z")),
  P("2e254fa0-937a-4575-859c-79b037ee095c", "visas-et-formalites-le-guide", "9e5fb75e-e67d-4d2a-a4b1-1b55dab31f70", 447, false, false, 89, new Date("2026-08-24T08:00:00.000Z")),
  P("e4eade2e-cb1c-4852-a326-ab1e77149b82", "voyager-pendant-le-ramadan", "70936264-34d2-4e83-a00e-2cf3ce268be6", 382, false, false, 92, new Date("2026-09-01T08:00:00.000Z")),
  P("2ae90d0f-fa6d-45d8-996f-45d3c1a7060f", "budget-voyage-petit-groupe", "856485ed-ff8d-43bb-a5cd-5944e77bacc5", 298, false, false, 88, new Date("2026-09-08T08:00:00.000Z")),
];
