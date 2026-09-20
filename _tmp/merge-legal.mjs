// Fusionne 09c→09 et 09d→09b (append), supprime 09c/09d, nettoie le manifest.
import { readFileSync, writeFileSync, unlinkSync } from 'node:fs';

const DIR = 'src/database/data';

/** Append the array items of `srcFile` before the closing `];` of `dstFile`. */
function merge(dstFile, srcFile) {
  const dst = readFileSync(`${DIR}/${dstFile}`, 'utf8');
  const src = readFileSync(`${DIR}/${srcFile}`, 'utf8');
  // Extract source items: everything between "export default [" and the final "];"
  const m = src.match(/export default \[([\s\S]*)\];\s*$/);
  if (!m) throw new Error(`Cannot parse ${srcFile}`);
  const items = m[1].trim();
  if (!items) throw new Error(`${srcFile} is empty`);
  // Insert before final "];"
  const closing = dst.lastIndexOf('];');
  if (closing === -1) throw new Error(`${dstFile} has no closing ];`);
  const out = dst.slice(0, closing).replace(/\s*$/, '') + '\n' + items + '\n];\n';
  writeFileSync(`${DIR}/${dstFile}`, out);
  console.log(`merged ${srcFile} -> ${dstFile}`);
}

merge('09-legal-pages.data.ts', '09c-travel-legal-pages.data.ts');
merge('09b-legal-sections.data.ts', '09d-travel-legal-sections.data.ts');

unlinkSync(`${DIR}/09c-travel-legal-pages.data.ts`);
unlinkSync(`${DIR}/09d-travel-legal-sections.data.ts`);
console.log('deleted 09c + 09d');

// Manifest : retirer les entrées 09c/09d
const mf = `${DIR}/manifest.ts`;
let man = readFileSync(mf, 'utf8');
man = man.replace(/\n\s*\{ dataFile: '09c-travel-legal-pages[^}]+\},/, '');
man = man.replace(/\n\s*\{ dataFile: '09d-travel-legal-sections[^}]+\},/, '');
writeFileSync(mf, man);
console.log('manifest cleaned');
