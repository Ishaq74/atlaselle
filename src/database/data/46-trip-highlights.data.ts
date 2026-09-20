// Trip highlights — 2 par voyage × 5 (traductions en 46b).
// mediaId réel aligné aux dossiers images (invariant hero/highlights illustrés).
const H = (id: string, tripId: string, sortOrder: number, mediaId: string | null) => ({ id, tripId, mediaId, iconKey: null, sortOrder });
export default [
  H("e7956c33-5aa7-4ca9-a3c7-967c13d91ea3", "26cf16d8-0770-48f9-870e-c68c9a9c47e0", 0, "e6b97486-9d26-46d2-a91e-1012aaa2b11e"),
  H("f1d83fb8-3367-4d04-ae67-ca78fd4455fd", "26cf16d8-0770-48f9-870e-c68c9a9c47e0", 1, "995f4751-37f4-43a4-ad3e-3bfac173decb"),
  H("a4758a27-e1b4-43f4-a109-f0d3a0f5a864", "b912b620-1d69-448f-a289-4790b4ce271c", 0, "dc74011a-8b27-4430-a096-131427f97efd"),
  H("64b422e6-05c5-4262-aeb7-8d75dd61e0a3", "b912b620-1d69-448f-a289-4790b4ce271c", 1, "725cb003-1b69-49b7-a2a1-a599bff53103"),
  H("3f5df32c-f331-43cc-ad55-74e0a038758e", "22b3db08-f245-44eb-8ee2-a858eb7e25c4", 0, "d074d152-7ca1-43ad-abe3-ce832875b160"),
  H("363492fd-e613-4d8d-ae2b-bfac1de126d3", "22b3db08-f245-44eb-8ee2-a858eb7e25c4", 1, "caeca25e-e144-4663-a483-49c35eedfd16"),
  H("f2dbf3e8-4f34-45eb-acc3-4e5a5d3eb325", "2c45ce15-a211-4a07-9472-1539aae514c5", 0, "be6d6c45-6754-4954-ae0a-95c448ca1705"),
  H("9b1d055b-0842-4452-a1b2-e70d16b6508e", "2c45ce15-a211-4a07-9472-1539aae514c5", 1, "856485ed-ff8d-43bb-a5cd-5944e77bacc5"),
  H("54ba59a8-cd9b-40ba-af4d-cb6ece54e0b9", "6675b138-4572-4283-b866-b64840f63004", 0, "4a14cc18-1bc1-4ae9-a091-e2471a45f032"),
  H("570bbd16-b899-4ce9-a28d-ffae39023240", "6675b138-4572-4283-b866-b64840f63004", 1, "9e01ff3d-e6d6-4a22-acec-10b401deb643"),
];
