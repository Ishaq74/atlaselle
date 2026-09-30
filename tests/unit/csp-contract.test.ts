import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Contrat de la Content Security Policy (`astro.config.mjs`).
 *
 * L'arbitrage est explicite et il ne doit pas dériver :
 *
 * - `script-src` reste STRICT (`'self'` + Stripe). C'est la directive qui
 *   protège réellement : aucun script inline ni tiers non listé ne s'exécute.
 * - `style-src` est la seule directive relâchée, avec `'unsafe-inline'`.
 *   La variante « stricte » n'est pas exploitable ici : `unsafe-hashes` n'déclare
 *   PAS les attributs `style=""` (il y faudrait le hachage de chaque valeur), et
 *   le design system en produit partout — durées d'animation des dialogues,
 *   variables des carrousels, aperçu live de l'éditeur de thème. Sans cela, la
 *   console se remplit de violations et l'aperçu de thème s'affiche inerte.
 *
 * Les valeurs *dynamiques* (barre de lecture, atome `Progress`) ne dépendent
 * pas de ce arbitrage : elles passent par le CSSOM (`el.style.…`), que la CSP ne
 * bloque pas. Ces deux tests le vérifient, pour que personne ne « corrige » un
 * jour l'aperçu de thème en ré-écrivant la valeur en attribut `style`.
 */

const configSource = readFileSync(resolve(process.cwd(), 'astro.config.mjs'), 'utf8');
const progressSource = readFileSync(resolve(process.cwd(), 'src/components/atoms/progress/Progress.astro'), 'utf8');
const progressBarSource = readFileSync(resolve(process.cwd(), 'src/components/molecules/Reading/ArticleProgressBar.astro'), 'utf8');

describe('Content Security Policy', () => {
  it('keeps script-src strict: no unsafe-inline, no unsafe-eval', () => {
    expect(configSource).toMatch(/"default-src 'self'"/);
    expect(configSource).toMatch(/"object-src 'none'"/);
    expect(configSource).toMatch(/"frame-ancestors 'none'"/);
    expect(configSource).toMatch(/"form-action 'self'"/);
    expect(configSource).toMatch(/"base-uri 'self'"/);

    // `scriptDirective` ne doit jamais s'inaugurer d'unsafe-inline/unsafe-eval.
    const scriptDirective = configSource.slice(
      configSource.indexOf('scriptDirective'),
      configSource.indexOf('scriptDirective') + 400,
    );
    expect(scriptDirective).not.toContain('unsafe-inline');
    expect(scriptDirective).not.toContain('unsafe-eval');

    // Aucune autre directive ne doit non plus les introduire.
    const directives = configSource.slice(configSource.indexOf('directives:'), configSource.indexOf('scriptDirective'));
    expect(directives).not.toContain('unsafe-eval');
  });

  it('relaxes only style-src, and says why in a comment', () => {
    // Astro refuse `style-src` dans `directives` : la relaxation se déclare par
    // `styleDirective`, scopée par kind. `'self'` doit être présent pour le
    // kind "element" : `style-src-elem` REMPLACE le `style-src` générique, donc
    // sans `'self'` là-bas les feuilles de style compilées par Astro sont
    // bloquées et toute la mise en page disparaît. C'est un piège déjà payé une
    // fois : le bandeau cookies, masqué par une classe `hidden`, restait
    // visible parce que le CSS n'était plus appliqué.
    const styleDirective = configSource.slice(configSource.indexOf('styleDirective'));
    expect(styleDirective).toMatch(/\{ resource: "'self'", kind: "element" \}/);
    expect(styleDirective).toMatch(/\{ resource: "'unsafe-inline'", kind: "element" \}/);
    expect(styleDirective).toMatch(/\{ resource: "'unsafe-inline'", kind: "attribute" \}/);

    // Astro avertit si `style-src` (entrée NON scopée) est déclaré alors que
    // `style-src-elem` / `style-src-attr` existent : ces deux-là REMPLACENT
    // `style-src` pour leur périmètre (aucun repli navigateur), donc l'entrée
    // générique serait silencieusement morte — et l'avertissement signale une
    // configuration qui dérape. On verrouille donc l'absence d'entrée nue.
    const styleResources = configSource
      .slice(configSource.indexOf('styleDirective'))
      .split('scriptDirective')[0]
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => /resources:|resource:/.test(line) && !line.startsWith('//'));
    expect(styleResources).not.toContain("resources: ['self'],");
    expect(styleResources).not.toContain('"\'self\'",');

    // `directives` ne doit déclarer ni script-src ni style-src (on regarde les
    // vraies directives, entre guillemets — le commentaire explique le
    // pourquoi et cite les noms des directives).
    const directives = configSource.slice(configSource.indexOf('directives:'), configSource.indexOf('styleDirective'));
    expect(directives).not.toMatch(/"style-src/i);
    expect(directives).not.toMatch(/"script-src/i);

    // `unsafe-inline` ne doit apparaître que deux fois dans la configuration :
    // les deux entrées scopées de `styleDirective` (le commentaire qui
    // explique l'arbitrage n'est pas une directive et n'est pas analysé).
    const configuredUnsafeInline = configSource
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.startsWith('{ resource:') && line.includes('unsafe-inline'));
    expect(configuredUnsafeInline).toHaveLength(2);
    expect(configuredUnsafeInline.join('\n')).toMatch(/kind: "element"/);
    expect(configuredUnsafeInline.join('\n')).toMatch(/kind: "attribute"/);
  });

  it('drives dynamic values through CSSOM, which the policy does not block', () => {
    // L'atome `Progress` écrit la translation de son indicateur en CSSOM…
    expect(progressSource).toMatch(/indicator\.style\.transform/);
    // …et la barre de lecture fait de même pour sa largeur.
    expect(progressBarSource).toMatch(/bar\.style\.width/);
  });
});
