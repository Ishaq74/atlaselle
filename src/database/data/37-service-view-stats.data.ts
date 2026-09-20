// Service view stats — historique de vues réaliste sur ~60 jours (août-sept 2026).
// hour 0-23 (contrainte), date YYYY-MM-DD, country ISO-2.
const S = (
  serviceId: string,
  viewedAt: Date,
  date: string,
  hour: number,
  referrer: string | null,
  country: string,
) => ({
  id: crypto.randomUUID(),
  serviceId,
  viewedAt,
  date,
  hour,
  referrer,
  country,
});

const VISA = "4fe869b9-68ee-4cd9-bacd-29258d552049";
const GUIDE = "9493e50e-ebcd-4268-b5ef-5cd660f0904a";
const TRANSFERT = "347b90bb-e76b-4da5-85d4-74233f6118ef";
const SURMESURE = "76a25f24-0a19-44f0-8596-9e1430ae62e8";

export default [
  S(VISA, new Date("2026-08-02T10:14:00.000Z"), "2026-08-02", 10, "https://www.google.com/", "FR"),
  S(VISA, new Date("2026-08-05T15:22:00.000Z"), "2026-08-05", 15, null, "FR"),
  S(VISA, new Date("2026-08-12T09:05:00.000Z"), "2026-08-12", 9, "https://atlaselle.com/fr/services", "FR"),
  S(VISA, new Date("2026-08-20T18:40:00.000Z"), "2026-08-20", 18, "https://www.google.com/", "BE"),
  S(VISA, new Date("2026-09-01T11:30:00.000Z"), "2026-09-01", 11, null, "FR"),
  S(VISA, new Date("2026-09-10T14:12:00.000Z"), "2026-09-10", 14, "https://atlaselle.com/fr/trips", "MA"),
  S(GUIDE, new Date("2026-08-03T16:45:00.000Z"), "2026-08-03", 16, "https://www.google.com/", "FR"),
  S(GUIDE, new Date("2026-08-15T10:20:00.000Z"), "2026-08-15", 10, null, "FR"),
  S(GUIDE, new Date("2026-08-28T13:55:00.000Z"), "2026-08-28", 13, "https://atlaselle.com/fr/services", "CH"),
  S(GUIDE, new Date("2026-09-05T19:10:00.000Z"), "2026-09-05", 19, "https://www.instagram.com/", "FR"),
  S(TRANSFERT, new Date("2026-08-06T08:30:00.000Z"), "2026-08-06", 8, null, "FR"),
  S(TRANSFERT, new Date("2026-08-22T12:00:00.000Z"), "2026-08-22", 12, "https://www.google.com/", "ES"),
  S(TRANSFERT, new Date("2026-09-08T17:25:00.000Z"), "2026-09-08", 17, "https://atlaselle.com/fr/services", "FR"),
  S(SURMESURE, new Date("2026-08-10T14:50:00.000Z"), "2026-08-10", 14, null, "FR"),
  S(SURMESURE, new Date("2026-09-12T10:05:00.000Z"), "2026-09-12", 10, "https://www.google.com/", "FR"),
];
