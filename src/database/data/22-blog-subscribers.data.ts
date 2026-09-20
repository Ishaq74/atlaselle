// Blog subscribers — 8 abonnées newsletter : 6 CONFIRMED, 1 PENDING,
// 1 UNSUBSCRIBED. Emails uniques, tokens hachés absents (déjà consommés).
const S = (
  id: string,
  email: string,
  locale: "fr" | "en" | "es" | "ar",
  status: string,
  createdAt: Date,
  confirmedAt: Date | null,
  unsubscribedAt: Date | null = null,
) => ({
  id,
  email,
  locale,
  token: null,
  tokenUsedAt: null,
  confirmationTokenHash: null,
  confirmationTokenExpiresAt: null,
  confirmationTokenUsedAt: confirmedAt,
  unsubscribeTokenHash: null,
  unsubscribeTokenUsedAt: unsubscribedAt,
  status,
  confirmedAt,
  unsubscribedAt,
  createdAt,
  updatedAt: unsubscribedAt ?? confirmedAt ?? createdAt,
});

export default [
  S("bdcec3f6-a413-45b7-a9b7-a7171965d174", "camille.dupond@example.fr", "fr", "CONFIRMED", new Date("2026-07-08T20:00:00.000Z"), new Date("2026-07-08T20:12:00.000Z")),
  S("f0ff65ba-655a-48c5-a46e-0869f29389a5", "sarah.leroy@example.fr", "fr", "CONFIRMED", new Date("2026-07-30T09:00:00.000Z"), new Date("2026-07-30T09:20:00.000Z")),
  S("414ceb48-a5a0-45a5-a0cb-2ca75972bf9f", "amina.benali@example.fr", "fr", "CONFIRMED", new Date("2026-08-19T12:00:00.000Z"), new Date("2026-08-19T12:05:00.000Z")),
  S("99ca1402-6223-4571-a34f-daa499562c52", "ines.kaci@example.fr", "fr", "CONFIRMED", new Date("2026-08-06T21:30:00.000Z"), new Date("2026-08-06T21:40:00.000Z")),
  S("32174c26-3145-4121-a53a-f9d6a71cf8b2", "helena.marsh@example.co.uk", "en", "CONFIRMED", new Date("2026-08-14T15:00:00.000Z"), new Date("2026-08-14T15:30:00.000Z")),
  S("8b2dc47d-2588-470d-a231-8f8315caff08", "lucia.fernandez@example.es", "es", "CONFIRMED", new Date("2026-08-28T17:00:00.000Z"), new Date("2026-08-28T17:15:00.000Z")),
  S("fa49d43c-725c-45cb-aefc-bb8247cd3f25", "salma.idrissi@example.ma", "ar", "PENDING", new Date("2026-09-19T18:00:00.000Z"), null),
  S("0afe5a99-0b06-443c-a3ed-84192d62e250", "marthe.olsen@example.no", "en", "UNSUBSCRIBED", new Date("2026-07-05T10:00:00.000Z"), new Date("2026-07-05T10:10:00.000Z"), new Date("2026-09-02T08:00:00.000Z")),
];
