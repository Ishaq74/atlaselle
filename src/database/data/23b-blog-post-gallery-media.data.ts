// Blog post gallery media — PK (galleryId, mediaId), altText obligatoire.
const M = (
  galleryId: string,
  mediaId: string,
  altText: string,
  caption: string | null,
  sortOrder: number,
) => ({ galleryId, mediaId, altText, caption, sortOrder });

export default [
  // ── Algérie ──
  M("46d73468-cd6c-4b4c-a425-655d8ca2ff0c", "ff4992b5-1aeb-4f82-961c-1eed42476af1", "Dunes du désert algérien au lever du jour", "Le désert au sud de Djanet, au matin.", 0),
  M("46d73468-cd6c-4b4c-a425-655d8ca2ff0c", "995f4751-37f4-43a4-ad3e-3bfac173decb", "Falaises et oasis de Djanet", "L'oasis de Djanet, porte du Tassili.", 1),
  M("46d73468-cd6c-4b4c-a425-655d8ca2ff0c", "70936264-34d2-4e83-a00e-2cf3ce268be6", "Cuisine algérienne partagée", "Une table algérienne, entre couscous et tajines.", 2),
  M("46d73468-cd6c-4b4c-a425-655d8ca2ff0c", "1fd68249-7526-4db3-a8b6-d592e307675e", "Basilique Notre-Dame d'Afrique à Alger", "Notre-Dame d'Afrique veille sur la baie d'Alger.", 3),
  // ── Route de la Soie ──
  M("050454a4-cb4e-41bf-a059-8552cb61c150", "b89b1bda-87af-49c4-80ff-5d72fff4fb5e", "Place du Registan à Samarcande", "Le Registan au lever du jour.", 0),
  M("050454a4-cb4e-41bf-a059-8552cb61c150", "4a14cc18-1bc1-4ae9-a091-e2471a45f032", "Minaret Poi Kalyan à Boukhara", "Le minaret Poi Kalyan domine les bazars.", 1),
  M("050454a4-cb4e-41bf-a059-8552cb61c150", "de4c07a2-50c8-4756-a187-8c1d61185469", "Bazar ouzbek et textiles artisanaux", "Textiles et céramiques d'Ouzbékistan.", 2),
  M("050454a4-cb4e-41bf-a059-8552cb61c150", "9e01ff3d-e6d6-4a22-acec-10b401deb643", "Yourtes et chevaux au lac Song-Kul", "Nuit en yourte à 3 000 mètres.", 3),
  M("050454a4-cb4e-41bf-a059-8552cb61c150", "c3be1d30-f97e-4c09-aa0f-dc1ad481f8b5", "Lac Issyk-Kul au Kirghizistan", "Les rives de l'Issyk-Kul.", 4),
  // ── Ramadan ──
  M("d6e86293-48e9-4fbc-aa58-dd181a664e33", "e6b97486-9d26-46d2-a91e-1012aaa2b11e", "Pâtisseries algériennes artisanales", "Douceurs des soirs de Ramadan.", 0),
  M("d6e86293-48e9-4fbc-aa58-dd181a664e33", "70936264-34d2-4e83-a00e-2cf3ce268be6", "Cuisine algérienne partagée", "L'iftar, un moment de table partagée.", 1),
];
