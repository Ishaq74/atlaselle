// Atlaselle credentials — alignés aux users (Oumhani + 5 voyageuses).
// Mot de passe démo : Atlaselle2026! (hash scrypt conservé pour déterminisme).
const HASH =
  "s:d87bfb32cbb18998fe59a65e9d4c999c237718c00319e2d9f0835dce30b8b8e70b64e1c5614bb2de4d5ee69927e76e6c174a94860d8f666d6b07490a6f961c8d:7184dd31723e5d0611323cf2244c307e";

const A = (id: string, accountId: string, userId: string, createdAt: Date) => ({
  id,
  accountId,
  providerId: "0a848c8c-67a0-4e13-a1c0-50dff34d1e42",
  userId,
  password: HASH,
  createdAt,
  updatedAt: createdAt,
});

export default [
  A("a1111111-1111-1111-1111-111111111111", "contact@atlaselle.com", "11111111-1111-1111-1111-111111111111", new Date("2026-09-20T09:00:00.000Z")),
  A("a3333333-3333-3333-3333-333333333333", "camille.dupond@example.fr", "33333333-3333-3333-3333-333333333333", new Date("2026-06-14T10:00:00.000Z")),
  A("a4444444-4444-4444-4444-444444444444", "lucas.martin@example.fr", "44444444-4444-4444-4444-444444444444", new Date("2026-06-20T10:00:00.000Z")),
  A("a5555555-5555-5555-5555-555555555555", "sarah.leroy@example.fr", "55555555-5555-5555-5555-555555555555", new Date("2026-07-02T10:00:00.000Z")),
  A("a6666666-6666-6666-6666-666666666666", "amina.benali@example.fr", "66666666-6666-6666-6666-666666666666", new Date("2026-07-18T10:00:00.000Z")),
  A("a7777777-7777-7777-7777-777777777777", "ines.kaci@example.fr", "77777777-7777-7777-7777-777777777777", new Date("2026-08-05T10:00:00.000Z")),
];
