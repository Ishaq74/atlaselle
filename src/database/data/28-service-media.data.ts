// Service media — galeries (2 visuels par service, médias voyages réels).
// PK (serviceId, mediaId) respectée.
const M = (
  serviceId: string,
  mediaId: string,
  altText: string,
  caption: string | null,
  sortOrder: number,
) => ({ serviceId, mediaId, kind: "GALLERY", altText, caption, sortOrder });

export default [
  // ── Assistance visa ──
  M("4fe869b9-68ee-4cd9-bacd-29258d552049", "9e5fb75e-e67d-4d2a-a4b1-1b55dab31f70", "Front de mer de Casablanca", "Le Maroc, sans visa pour les passeports français.", 0),
  M("4fe869b9-68ee-4cd9-bacd-29258d552049", "1fd68249-7526-4db3-a8b6-d592e307675e", "Basilique Notre-Dame d'Afrique à Alger", "L'Algérie, accessible avec notre dossier visa complet.", 1),
  // ── Guide privée ──
  M("9493e50e-ebcd-4268-b5ef-5cd660f0904a", "caeca25e-e144-4663-a483-49c35eedfd16", "Médina de Fès et ses artisans", "La médina de Fès avec une guide locale.", 0),
  M("9493e50e-ebcd-4268-b5ef-5cd660f0904a", "9122ed1e-6dcd-4653-bbe8-f4b6a42877ba", "Vieux bazar Baščaršija à Sarajevo", "Baščaršija, à pied avec votre guide.", 1),
  // ── Transfert ──
  M("347b90bb-e76b-4da5-85d4-74233f6118ef", "e0ef38d1-7681-499e-a6c0-05c2848170b1", "Port de Malte au soleil", "Arrivée à La Valette, chauffeur à la sortie.", 0),
  M("347b90bb-e76b-4da5-85d4-74233f6118ef", "cecca041-aac8-4930-a6ba-555694aec0b5", "Voyageuses sur la route en Bosnie", "Sur la route, sans friction.", 1),
  // ── Sur-mesure ──
  M("76a25f24-0a19-44f0-8596-9e1430ae62e8", "de4c07a2-50c8-4756-a187-8c1d61185469", "Bazar ouzbek et textiles artisanaux", "Construire votre itinéraire, étape par étape.", 0),
  M("76a25f24-0a19-44f0-8596-9e1430ae62e8", "c3be1d30-f97e-4c09-aa0f-dc1ad481f8b5", "Lac Issyk-Kul au Kirghizistan", "Des destinations hors calendrier, sur-mesure.", 1),
  // ── Extension désert ──
  M("70ffd9d1-2f73-4e94-8536-02d548a92419", "ff4992b5-1aeb-4f82-961c-1eed42476af1", "Dunes du désert algérien au lever du jour", "Lever de soleil sur les dunes, jour 2 de l'extension.", 0),
  M("70ffd9d1-2f73-4e94-8536-02d548a92419", "995f4751-37f4-43a4-ad3e-3bfac173decb", "Falaises et oasis de Djanet", "L'oasis de Djanet, base de départ.", 1),
  // ── Assurance ──
  M("00ccc16b-5fc1-4370-9b7e-8ff31c51ffdf", "be6d6c45-6754-4954-ae0a-95c448ca1705", "Monastère de Blagaj au bord de la Buna", "Partir l'esprit tranquille.", 0),
  M("00ccc16b-5fc1-4370-9b7e-8ff31c51ffdf", "dc74011a-8b27-4430-a096-131427f97efd", "Île d'Ortigia à Syracuse", "Couverture médicale et rapatriement incluses.", 1),
];
