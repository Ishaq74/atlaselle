/**
 * Convertit les visuels de marque trop lourds en JPEG.
 *
 * Trois PNG de 2,4 Mo alimentent la page /about, pour des vignettes rendues à
 * 800 px de large : le navigateur téléchargeait plusieurs mégaoctets pour
 * afficher une galerie. Lighthouse le relevait comme « Properly size images »
 * (237 KiB récupérables) — et le PNG reste 2,4 Mo SUR DISQUE, quel que soit
 * le `widths` déclaré dans le composant.
 *
 * On convertit donc la source, pas seulement le HTML. Le nom de fichier
 * change pour que le cache et les imports soient explicites.
 *
 *   pnpm assets:optimize
 */
import { existsSync } from "node:fs";
import { readdir, rename, stat } from "node:fs/promises";
import { join } from "node:path";
import sharp from "sharp";

const DIR = "src/assets/images/brand";
/** Au-delà, on ne gagne plus rien à encoder plus grand. */
const MAX_WIDTH = 1200;
const QUALITY = 82;

const files = await readdir(DIR);
// PNG comme JPEG : les deux se compressent mal, et un JPEG de 400 Ko est
// encore trop lourd pour une vignette.
const heavy = files.filter((f) => f.endsWith(".png") || f.endsWith(".jpg"));

let converted = 0;
for (const name of heavy) {
  const from = join(DIR, name);
  const before = (await stat(from)).size;
  // Les logos gardent leur transparence : le JPEG la détruit.
  if (/logo/i.test(name)) {
    console.log(`  ignore (logo, transparence) : ${name}`);
    continue;
  }
  // Au-dessous du seuil, la conversion coûte plus qu'elle ne rapporte.
  // 200 Ko : sous ce niveau, un visuel de page est déjà raisonnable.
  if (before < 200 * 1024) {
    console.log(`  ignore (deja leger)         : ${name}`);
    continue;
  }

  const target = name.replace(/\.(png|jpg)$/, ".jpg");
  const to = join(DIR, target);
  // Ré-optimiser un JPEG déjà produit est possible : le garde ne concerne que
  // le cas où la SOURCE est un PNG et la cible existe déjà.
  const sourceIsPng = name.endsWith(".png");
  if (sourceIsPng && existsSync(to)) {
    console.log(`  ignore (existe deja)        : ${name}`);
    continue;
  }

// On écrit dans un fichier distinct : Sharp refuse la même chemin en entrée
// et en sortie, et ré-optimiser un JPEG existant est justement le cas ici.
const scratch = `${to}.tmp`;
await sharp(from)
  .resize({ width: MAX_WIDTH, withoutEnlargement: true })
  .jpeg({ quality: QUALITY, mozjpeg: true })
  .toFile(scratch);

const after = (await stat(scratch)).size;
// L'ancien fichier devient inutile : on l'écarte pour ne pas garder
// plusieurs mégaoctets orphelins dans le dépôt.
await rename(from, join(DIR, `${target}.replaced`));
await rename(scratch, to);

  console.log(
    `  ${name} : ${Math.round(before / 1024)} KB -> ${Math.round(after / 1024)} KB`,
  );
  converted++;
}

console.log(`\n${converted} image(s) convertie(s) dans ${DIR}`);
