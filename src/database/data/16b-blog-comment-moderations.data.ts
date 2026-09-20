// Blog comment moderations — actions APPROVE signées Oumhani (admin).
// Couvre les commentaires publiés non-rédaction (invités + voyageuses).
const M = (id: string, commentId: string, action: string, createdAt: Date) => ({
  id,
  commentId,
  moderatorId: "11111111-1111-1111-1111-111111111111",
  action,
  reason: null,
  previousValues: null,
  createdAt,
});

export default [
  M("5622826f-c702-4f5c-aae3-8de9414f35ae", "ac7f9543-ac0a-489b-a400-e02a46d0cb7a", "APPROVE", new Date("2026-07-08T20:00:00.000Z")),
  M("99688143-1a4f-4077-ae46-c65e7b36e01b", "ac3270a1-a77c-45b3-ae3a-6a67d79e60ec", "APPROVE", new Date("2026-07-10T15:00:00.000Z")),
  M("35fb5263-84ff-4537-a02f-cf298f0d42d1", "f9144337-a06f-45d1-a386-44c67c111aaf", "APPROVE", new Date("2026-07-15T21:00:00.000Z")),
  M("8191bd44-3f8d-4f7c-ad4d-384652315865", "dfd9a8bb-6d8a-4c46-a5f1-cb8c4f23d085", "APPROVE", new Date("2026-07-22T12:00:00.000Z")),
  M("0ece7727-1aa3-4ccd-a0dc-9cc0c80619ed", "023dc9dc-3d70-4102-ab8a-21689b88a8b1", "APPROVE", new Date("2026-07-29T19:00:00.000Z")),
  M("4ca2943a-6c49-4539-af57-4e93f12fab6f", "e69e9d2c-bed6-4056-a884-42be5b73508c", "APPROVE", new Date("2026-08-07T08:00:00.000Z")),
  M("655165f7-8051-4c03-ae49-5e3a980299dc", "7e221d96-819e-4b99-acf6-bbc052f662ee", "APPROVE", new Date("2026-08-12T13:00:00.000Z")),
  M("92391570-2b77-42c4-addd-b6749a350162", "fabad835-2f2a-4d4c-a0fa-340366d9f701", "APPROVE", new Date("2026-08-19T10:00:00.000Z")),
  M("016bc5fe-d69d-4a9f-a5c7-7b2ad6ce5a80", "13859e72-4c5d-4ca6-abaf-d4cd7c0baeb6", "APPROVE", new Date("2026-09-03T21:00:00.000Z")),
];
