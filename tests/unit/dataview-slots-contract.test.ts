import { readFileSync } from 'node:fs';
import { globSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * Contrat de structure pour <DataView>.
 *
 * Bug corrigé sur /admin/trips : les slots nommés étaient écrits à
 * l'intérieur d'une expression conditionnelle —
 *
 *     {rows.length === 0
 *       ? <div slot="table">état vide</div>
 *       : <div slot="table">…</div>}
 *
 * Astro n'y voit qu'un slot « default » : `Astro.slots.has('table')` renvoie
 * `false`, `modes` reste vide, donc aucun sélecteur de vue n'est rendu et les
 * trois vues s'empilent à la suite. Le composant est impeccable, la page
 * d'appel est fautive — d'où un bug invisible à `astro check` et à ESLint.
 *
 * `/admin/blog` et les autres pages qui passent leurs slots directement
 * fonctionnaient : d'où l'illusion que tout ou rien était cassé.
 *
 * Règle : `slot="list|table|cards"` doit apparaître à la profondeur 0 du
 * template de <DataView>, hors de toute accolade `{…}`.
 */
const SLOTS = ['list', 'table', 'cards'] as const;

/**
 * Profondeur d'accolades de template, en ignorant balises et chaînes.
 *
 * Ce qui compte n'est pas la profondeur absolue, mais la profondeur À
 * L'OUVERTURE de la balise portant le slot. Astro enregistre un slot dès lors
 * que son élément est à la profondeur 0 ; les accolades *à l'intérieur* de
 * cet élément (`<div slot="table">{rows.length === 0 ? … : …}</div>`) sont le
 * motif correct et ne doivent pas être signalées.
 *
 * On mesure donc la profondeur au moment où l'on rencontre `<`, et l'on ne
 * retient que les slots dont la balise ouvrante était à la profondeur 0.
 */
function slotDepthViolations(block: string): Array<{ slot: string; line: number }> {
  const found: Array<{ slot: string; line: number }> = [];
  let depth = 0;
  let inTag = false;
  let tagDepth = 0;
  let tagLine = 0;
  let tagText = '';

  for (let i = 0; i < block.length; i++) {
    const ch = block[i];

    // Dans une balise, TOUT le texte compte pour retrouver `slot="…"`,
    // valeur d'attribut comprise : tronquer au premier guillemet faisait
    // manquer le motif. Aucun suivi de `quote` n'est nécessaire ici, un `>`
    // dans une valeur d'attribut n'existe pas en HTML.
    if (inTag) {
      if (ch === '>') {
        inTag = false;
        if (tagDepth > 0) {
          for (const slot of SLOTS) {
            if (tagText.includes(`slot="${slot}"`) || tagText.includes(`slot='${slot}'`)) {
              found.push({ slot, line: tagLine });
            }
          }
        }
        tagText = '';
        continue;
      }
      if (ch === '<') {
        inTag = true;
        tagDepth = depth;
        tagLine = block.slice(0, i).split('\n').length;
        tagText = '';
        continue;
      }
      tagText += ch;
      continue;
    }
    if (ch === '<') {
      inTag = true;
      tagDepth = depth;
      tagLine = block.slice(0, i).split('\n').length;
      tagText = '';
      continue;
    }
    if (ch === '{') { depth++; continue; }
    if (ch === '}') { depth--; continue; }
  }

  return found;
}

const dataViewFiles = globSync('src/**/*.astro').filter((file) =>
  readFileSync(file, 'utf8').includes('<DataView'),
);

describe('<DataView> — slots nommés', () => {
  it('trouve des pages qui utilisent le composant', () => {
    expect(dataViewFiles.length).toBeGreaterThan(0);
  });

  it.each(dataViewFiles)('%s ne place aucun slot nommé dans une expression', (file) => {
    const src = readFileSync(file, 'utf8');
    const open = src.indexOf('<DataView');
    const closeIdx = src.indexOf('</DataView>', open);
    const block = src.slice(open, closeIdx === -1 ? src.length : closeIdx);

    const violations = slotDepthViolations(block);
    expect(
      violations,
      violations.length
        ? `slot(s) named at template depth > 0 — Astro ne les enregistrera pas ` +
          `(Astro.slots.has() === false → plus de sélecteur, vues empilées). ` +
          `Déplace la condition À L'INTÉRIEUR de chaque slot.`
        : '',
    ).toEqual([]);
  });
});

describe('<DataView> — détection (auto-test du détecteur)', () => {
  it('signale un slot nommé placé dans un ternaire', () => {
    const broken = [
      '<DataView a="1">',
      '  {rows.length === 0 ? (',
      '    <div slot="table">vide</div>',
      '  ) : (',
      '    <div slot="table">données</div>',
      '  )}',
      '</DataView>',
    ].join('\n');
    const violations = slotDepthViolations(broken);
    expect(violations.map((v) => v.slot)).toContain('table');
  });

  it('accepte des slots passés directement', () => {
    const valid = [
      '<DataView a="1">',
      '  <div slot="table">table</div>',
      '  <div slot="list">liste</div>',
      '  <div slot="cards">cartes</div>',
      '</DataView>',
    ].join('\n');
    expect(slotDepthViolations(valid)).toEqual([]);
  });

  it('accepte une condition placée à l’intérieur du slot', () => {
    const valid = [
      '<DataView a="1">',
      '  <div slot="table">{rows.length === 0 ? <p>vide</p> : <Table />}</div>',
      '  <div slot="list">…</div>',
      '  <div slot="cards">…</div>',
      '</DataView>',
    ].join('\n');
    expect(slotDepthViolations(valid)).toEqual([]);
  });
});
