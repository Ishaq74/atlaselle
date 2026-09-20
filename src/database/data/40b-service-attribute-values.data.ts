// Service attribute values — valeurs par service pour les 5 définitions (40).
// PK (serviceId, definitionId) respectée.
const U = new Date("2026-06-15T09:00:00.000Z");

const V = (
  serviceId: string,
  definitionId: string,
  v: { stringValue?: string; numberValue?: number; booleanValue?: boolean; selectedValue?: string },
) => ({
  serviceId,
  definitionId,
  stringValue: v.stringValue ?? null,
  numberValue: v.numberValue ?? null,
  booleanValue: v.booleanValue ?? null,
  selectedValue: v.selectedValue ?? null,
  updatedAt: U,
});

export default [
  // ── Assistance visa ──
  V("4fe869b9-68ee-4cd9-bacd-29258d552049", "105397b8-2d4f-4bf2-a04a-bac909a6f0db", { selectedValue: "français" }),
  V("4fe869b9-68ee-4cd9-bacd-29258d552049", "8bb085f6-07f4-46ee-a59f-bc476a0e5ebe", { selectedValue: "privé" }),
  V("4fe869b9-68ee-4cd9-bacd-29258d552049", "9f2a60ec-a7b1-4fd8-a91c-e1751d48a780", { stringValue: "Bureau Atlaselle, Lyon — ou visio" }),
  V("4fe869b9-68ee-4cd9-bacd-29258d552049", "6778d9ac-ad2a-4fe3-af9c-56908dfcd496", { numberValue: 72 }),
  V("4fe869b9-68ee-4cd9-bacd-29258d552049", "ad214dfc-eaf5-4a07-ac4b-3ebfb6129934", { booleanValue: true }),
  // ── Guide privée ──
  V("9493e50e-ebcd-4268-b5ef-5cd660f0904a", "105397b8-2d4f-4bf2-a04a-bac909a6f0db", { selectedValue: "français" }),
  V("9493e50e-ebcd-4268-b5ef-5cd660f0904a", "8bb085f6-07f4-46ee-a59f-bc476a0e5ebe", { selectedValue: "petit groupe" }),
  V("9493e50e-ebcd-4268-b5ef-5cd660f0904a", "9f2a60ec-a7b1-4fd8-a91c-e1751d48a780", { stringValue: "Hall de votre hébergement" }),
  V("9493e50e-ebcd-4268-b5ef-5cd660f0904a", "6778d9ac-ad2a-4fe3-af9c-56908dfcd496", { numberValue: 48 }),
  V("9493e50e-ebcd-4268-b5ef-5cd660f0904a", "ad214dfc-eaf5-4a07-ac4b-3ebfb6129934", { booleanValue: true }),
  // ── Transfert ──
  V("347b90bb-e76b-4da5-85d4-74233f6118ef", "105397b8-2d4f-4bf2-a04a-bac909a6f0db", { selectedValue: "français" }),
  V("347b90bb-e76b-4da5-85d4-74233f6118ef", "8bb085f6-07f4-46ee-a59f-bc476a0e5ebe", { selectedValue: "privé" }),
  V("347b90bb-e76b-4da5-85d4-74233f6118ef", "9f2a60ec-a7b1-4fd8-a91c-e1751d48a780", { stringValue: "Sortie de l'aéroport, pancarte Atlaselle" }),
  V("347b90bb-e76b-4da5-85d4-74233f6118ef", "6778d9ac-ad2a-4fe3-af9c-56908dfcd496", { numberValue: 48 }),
  V("347b90bb-e76b-4da5-85d4-74233f6118ef", "ad214dfc-eaf5-4a07-ac4b-3ebfb6129934", { booleanValue: true }),
  // ── Consultation sur-mesure ──
  V("76a25f24-0a19-44f0-8596-9e1430ae62e8", "105397b8-2d4f-4bf2-a04a-bac909a6f0db", { selectedValue: "français" }),
  V("76a25f24-0a19-44f0-8596-9e1430ae62e8", "8bb085f6-07f4-46ee-a59f-bc476a0e5ebe", { selectedValue: "privé" }),
  V("76a25f24-0a19-44f0-8596-9e1430ae62e8", "9f2a60ec-a7b1-4fd8-a91c-e1751d48a780", { stringValue: "Visioconférence — lien envoyé à la réservation" }),
  V("76a25f24-0a19-44f0-8596-9e1430ae62e8", "6778d9ac-ad2a-4fe3-af9c-56908dfcd496", { numberValue: 24 }),
  V("76a25f24-0a19-44f0-8596-9e1430ae62e8", "ad214dfc-eaf5-4a07-ac4b-3ebfb6129934", { booleanValue: false }),
  // ── Extension désert ──
  V("70ffd9d1-2f73-4e94-8536-02d548a92419", "105397b8-2d4f-4bf2-a04a-bac909a6f0db", { selectedValue: "français" }),
  V("70ffd9d1-2f73-4e94-8536-02d548a92419", "8bb085f6-07f4-46ee-a59f-bc476a0e5ebe", { selectedValue: "petit groupe" }),
  V("70ffd9d1-2f73-4e94-8536-02d548a92419", "9f2a60ec-a7b1-4fd8-a91c-e1751d48a780", { stringValue: "Djanet — hall de la maison d'hôtes" }),
  V("70ffd9d1-2f73-4e94-8536-02d548a92419", "6778d9ac-ad2a-4fe3-af9c-56908dfcd496", { numberValue: 168 }),
  V("70ffd9d1-2f73-4e94-8536-02d548a92419", "ad214dfc-eaf5-4a07-ac4b-3ebfb6129934", { booleanValue: false }),
  // ── Assurance ──
  V("00ccc16b-5fc1-4370-9b7e-8ff31c51ffdf", "105397b8-2d4f-4bf2-a04a-bac909a6f0db", { selectedValue: "français" }),
  V("00ccc16b-5fc1-4370-9b7e-8ff31c51ffdf", "8bb085f6-07f4-46ee-a59f-bc476a0e5ebe", { selectedValue: "privé" }),
  V("00ccc16b-5fc1-4370-9b7e-8ff31c51ffdf", "6778d9ac-ad2a-4fe3-af9c-56908dfcd496", { numberValue: 48 }),
  V("00ccc16b-5fc1-4370-9b7e-8ff31c51ffdf", "ad214dfc-eaf5-4a07-ac4b-3ebfb6129934", { booleanValue: true }),
];
