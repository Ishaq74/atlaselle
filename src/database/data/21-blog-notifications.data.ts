// Blog notifications — file d'Oumhani (admin) : nouveaux commentaires/avis.
// CHECK : postId toujours renseigné, jamais commentId ET reviewId ensemble.
const ADMIN = "11111111-1111-1111-1111-111111111111";
const CAMILLE = "33333333-3333-3333-3333-333333333333";
const LUCAS = "44444444-4444-4444-4444-444444444444";
const SARAH = "55555555-5555-5555-5555-555555555555";
const AMINA = "66666666-6666-6666-6666-666666666666";
const INES = "77777777-7777-7777-7777-777777777777";

const N = (
  id: string,
  type: string,
  postId: string,
  commentId: string | null,
  reviewId: string | null,
  fromUserId: string | null,
  isRead: boolean,
  createdAt: Date,
) => ({
  id,
  userId: ADMIN,
  type,
  postId,
  commentId,
  reviewId,
  fromUserId,
  isRead,
  metadata: null,
  createdAt,
});

export default [
  N("c5bc9263-9917-4b98-a65d-7d42654122e4", "NEW_COMMENT", "9b4d8fef-badd-4787-ae7b-d91f7c7107c3", "ac7f9543-ac0a-489b-a400-e02a46d0cb7a", null, CAMILLE, true, new Date("2026-07-08T19:20:00.000Z")),
  N("12ac002d-ff0a-4004-a37a-849871fb4e71", "NEW_COMMENT", "9b4d8fef-badd-4787-ae7b-d91f7c7107c3", "ac3270a1-a77c-45b3-ae3a-6a67d79e60ec", null, null, true, new Date("2026-07-10T14:40:00.000Z")),
  N("3060c7dc-643d-4b8a-ac98-54ed8452c6eb", "NEW_COMMENT", "39ee3d3f-56be-4097-915c-db53b8bf927f", "f9144337-a06f-45d1-a386-44c67c111aaf", null, CAMILLE, true, new Date("2026-07-15T20:00:00.000Z")),
  N("09d06d39-89df-4ef9-ab0f-bbabf13273f1", "NEW_COMMENT", "d7d77012-392f-49ad-8b72-e5860a1eff5a", "dfd9a8bb-6d8a-4c46-a5f1-cb8c4f23d085", null, null, true, new Date("2026-07-22T11:15:00.000Z")),
  N("16dc0302-806b-41cd-ad72-1ddfe2e72da7", "NEW_COMMENT", "335960c7-43bb-44eb-84fb-3bb7b2f5969b", "023dc9dc-3d70-4102-ab8a-21689b88a8b1", null, SARAH, true, new Date("2026-07-29T18:30:00.000Z")),
  N("3159597a-896f-42fc-a944-1baba14a7c32", "NEW_COMMENT", "cc564fbf-0a61-4554-a5dc-a30fbfb5fb83", "e69e9d2c-bed6-4056-a884-42be5b73508c", null, INES, true, new Date("2026-08-06T21:00:00.000Z")),
  N("1924a468-f49d-4a0c-a0ea-cca078fb689e", "NEW_REVIEW", "c4092370-2aa2-4986-ac3d-9ee0c40622cc", null, "20d66656-ecba-41a5-a428-1713349d3e2d", LUCAS, true, new Date("2026-08-12T14:00:00.000Z")),
  N("86366bad-02ed-456e-a148-5f2db8585532", "NEW_REVIEW", "e58bf5f3-629e-433f-a53c-804f3de36783", null, "9f5fc661-c0d5-4c3f-a2c2-c67c805c8c94", AMINA, true, new Date("2026-08-19T11:00:00.000Z")),
  N("c283b340-11bc-4597-a1a0-9e2d141b35e8", "NEW_REVIEW", "2e254fa0-937a-4575-859c-79b037ee095c", null, "c74dc189-dd4a-4f67-a6bd-bf131417911b", SARAH, true, new Date("2026-08-26T16:00:00.000Z")),
  N("fc664202-7be7-4e14-a8be-06babe3dbf19", "NEW_COMMENT", "e4eade2e-cb1c-4852-a326-ab1e77149b82", "13859e72-4c5d-4ca6-abaf-d4cd7c0baeb6", null, null, true, new Date("2026-09-03T20:40:00.000Z")),
  N("34747608-cdfb-4da6-a93f-ad8d43087697", "NEW_COMMENT", "e58bf5f3-629e-433f-a53c-804f3de36783", "3ec170c3-f2ca-49a9-a225-128bdc55d907", null, null, false, new Date("2026-09-18T22:05:00.000Z")),
  N("d663872c-c4ac-4221-a322-37ecb5e19ef1", "NEW_COMMENT", "2ae90d0f-fa6d-45d8-996f-45d3c1a7060f", "6f00ea41-a4ab-4213-a7b4-d5997f9621f7", null, INES, false, new Date("2026-09-19T10:15:00.000Z")),
  N("e893c6c6-34de-46b0-a976-fe0c19dd6a23", "NEW_REVIEW", "39ee3d3f-56be-4097-915c-db53b8bf927f", null, "7431c713-8c26-4040-a84d-60a052c28344", LUCAS, false, new Date("2026-09-19T08:00:00.000Z")),
];
