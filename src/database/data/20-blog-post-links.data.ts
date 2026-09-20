// Blog post links — maillage interne RELATED + NEXT entre articles.
// UNIQUE(source, target, linkType) et no_self respectés.
const L = (id: string, sourcePostId: string, targetPostId: string, linkType: string, sortOrder: number) => ({
  id,
  sourcePostId,
  targetPostId,
  linkType,
  sortOrder,
  createdAt: new Date("2026-09-01T09:00:00.000Z"),
});

export default [
  // Guides → destinations concernées
  L("3aeb4b24-8344-4735-afa8-5f19e87a8c01", "c4092370-2aa2-4986-ac3d-9ee0c40622cc", "9b4d8fef-badd-4787-ae7b-d91f7c7107c3", "RELATED", 0),
  L("e31a346a-f2c7-4d1d-ac7b-654f02535b62", "c4092370-2aa2-4986-ac3d-9ee0c40622cc", "cc564fbf-0a61-4554-a5dc-a30fbfb5fb83", "RELATED", 1),
  L("bd4e6d32-52ac-450b-acce-03d5c6c30cd8", "2e254fa0-937a-4575-859c-79b037ee095c", "9b4d8fef-badd-4787-ae7b-d91f7c7107c3", "RELATED", 0),
  L("332a02eb-8f1f-4c49-a4d1-bb83abd38b1f", "2e254fa0-937a-4575-859c-79b037ee095c", "39ee3d3f-56be-4097-915c-db53b8bf927f", "RELATED", 1),
  L("58f0b5e1-56d8-4a47-a905-7ec3bbc6dd9a", "e58bf5f3-629e-433f-a53c-804f3de36783", "c4092370-2aa2-4986-ac3d-9ee0c40622cc", "RELATED", 0),
  L("f36318ea-678b-4176-ac1d-157cebe93c6d", "e58bf5f3-629e-433f-a53c-804f3de36783", "2ae90d0f-fa6d-45d8-996f-45d3c1a7060f", "RELATED", 1),
  L("ac395180-0537-4f2b-a824-02fa33992381", "e4eade2e-cb1c-4852-a326-ab1e77149b82", "39ee3d3f-56be-4097-915c-db53b8bf927f", "RELATED", 0),
  L("9738b334-e7f6-4e72-a51d-52c0d0b60b54", "2ae90d0f-fa6d-45d8-996f-45d3c1a7060f", "d7d77012-392f-49ad-8b72-e5860a1eff5a", "RELATED", 0),
  // Chaînage chronologique des récits destination
  L("4597f2ec-1e6c-42d3-a6af-34044594a1d9", "9b4d8fef-badd-4787-ae7b-d91f7c7107c3", "39ee3d3f-56be-4097-915c-db53b8bf927f", "NEXT", 0),
  L("919a9b51-0043-4e81-aa93-a5f9ca314a38", "39ee3d3f-56be-4097-915c-db53b8bf927f", "d7d77012-392f-49ad-8b72-e5860a1eff5a", "NEXT", 0),
  L("f1ee0cc8-621c-44a8-a89c-1faaa0872e01", "d7d77012-392f-49ad-8b72-e5860a1eff5a", "335960c7-43bb-44eb-84fb-3bb7b2f5969b", "NEXT", 0),
  L("f53c034a-0899-4379-a27f-c30166615744", "335960c7-43bb-44eb-84fb-3bb7b2f5969b", "cc564fbf-0a61-4554-a5dc-a30fbfb5fb83", "NEXT", 0),
];
