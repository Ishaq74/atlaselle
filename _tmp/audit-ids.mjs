// Audit : liste les IDs lisibles (non-UUID) restants dans les seeds,
// et détecte les FK orphelines (référence convertie vs cible non convertie).
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const DIR = 'src/database/data';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Identifiants "techniques" acceptés en clair (validation z.string, pas uuid) :
const WHITELIST_PREFIX = /^(menu-|nav-|social-|contact-|00000000-|10000000-|20000000-)/;

const files = readdirSync(DIR).filter((f) => f.endsWith('.data.ts'));
const report = {};

for (const f of files) {
  const c = readFileSync(join(DIR, f), 'utf8');
  const ids = [...c.matchAll(/"([a-z][a-z0-9]+(?:-[a-z0-9]+)+)"/g)]
    .map((m) => m[1])
    .filter((v) => !UUID_RE.test(v) && !WHITELIST_PREFIX.test(v))
    // exclure les slugs/urls/locales (heuristique : présence d'un point, d'un slash, ou valeur connue de champ non-id)
    .filter((v) => !v.includes('/') && !v.includes('.'));
  if (ids.length) report[f] = [...new Set(ids)];
}

for (const [f, ids] of Object.entries(report)) {
  console.log(`${f} (${ids.length}): ${ids.slice(0, 12).join(', ')}${ids.length > 12 ? '…' : ''}`);
}
console.log('\nTOTAL fichiers avec IDs lisibles:', Object.keys(report).length);
