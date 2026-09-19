export default [
  { id: "9d000000-0000-0000-0000-000000000001", key: "language", label: "Langue du service", type: "SELECT", options: JSON.stringify(["fr", "en", "es", "ar"]), required: false, sortOrder: 1, createdAt: new Date("2026-02-01T09:00:00.000Z") },
  { id: "9d000000-0000-0000-0000-000000000002", key: "difficulty", label: "Difficulté", type: "SELECT", options: JSON.stringify(["easy", "moderate", "hard"]), required: false, sortOrder: 2, createdAt: new Date("2026-02-01T09:01:00.000Z") },
  { id: "9d000000-0000-0000-0000-000000000003", key: "meeting_point", label: "Point de rendez-vous", type: "STRING", options: null, required: false, sortOrder: 1, createdAt: new Date("2026-02-01T09:02:00.000Z") },
];
