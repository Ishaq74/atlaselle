import { describe, expect, it } from 'vitest';
import { stripHtml, generateExcerpt, slugify } from '@/core/content/text';
import { registerModule, getModule, listModules, clearModuleRegistryForTests } from '@/core/modules/module-registry';
import { assertSearchResourceDefinition } from '@/core/search/contract';
import {
  registerSearchResource,
  getSearchResource,
  listSearchResources,
  clearSearchResourcesForTests,
} from '@/core/search/registry';
import { bootstrapModules } from '@/core/modules/bootstrap';

describe('core/content/text', () => {
  it('stripHtml supprime les balises et normalise les espaces', () => {
    expect(stripHtml('<p>Hello <b>world</b></p>')).toBe('Hello world');
    expect(stripHtml('a<br>b')).toBe('a b');
  });

  it('generateExcerpt coupe au mot près avec ellipse', () => {
    expect(generateExcerpt('court', 160)).toBe('court');
    expect(generateExcerpt('a'.repeat(160), 160)).toBe('a'.repeat(160));
    expect(generateExcerpt(`mot ${'x'.repeat(200)}`, 10)).toBe('mot…');
    expect(generateExcerpt('abcdefghij klmnop', 8)).toBe('abcdefgh…');
  });

  it('slugify latinise, arabe -> vide (slugs AR = ASCII EN par politique)', () => {
    expect(slugify('Afrique du Sud : côte sauvage')).toBe('afrique-du-sud-cote-sauvage');
    expect(slugify('  Sicile + Malte  ')).toBe('sicile-malte');
    expect(slugify('جنوب أفريقيا')).toBe('');
  });
});

describe('core/modules/module-registry', () => {
  it('register/get/list + doublon refusé + clear', () => {
    clearModuleRegistryForTests();
    const mod = { id: 'test-mod' } as never;
    registerModule(mod);
    expect(getModule('test-mod')).toBe(mod);
    expect(listModules().map((m) => m.id)).toContain('test-mod');
    expect(() => registerModule(mod)).toThrow(/already registered/);
    expect(getModule('nope')).toBeUndefined();
    clearModuleRegistryForTests();
    expect(listModules()).toEqual([]);
  });

  it('bootstrapModules est idempotent', () => {
    bootstrapModules();
    expect(() => bootstrapModules()).not.toThrow();
    expect(listModules().length).toBeGreaterThanOrEqual(2);
    clearModuleRegistryForTests();
  });
});

describe('core/search/registry + contract', () => {
  it('assert refuse noms vides, doublons, tri inconnu', () => {
    expect(() => assertSearchResourceDefinition({ resourceId: 'r', fields: [{ name: '  ', kind: 'text' }] })).toThrow(/empty/);
    expect(() =>
      assertSearchResourceDefinition({
        resourceId: 'r',
        fields: [
          { name: 'title', kind: 'text' },
          { name: 'title', kind: 'keyword' },
        ],
      }),
    ).toThrow(/Duplicate/);
    expect(() =>
      assertSearchResourceDefinition({ resourceId: 'r', fields: [{ name: 'title', kind: 'text' }], defaultSort: 'nope' }),
    ).toThrow(/Unknown default sort/);
    expect(() =>
      assertSearchResourceDefinition({ resourceId: 'r', fields: [{ name: 'title', kind: 'text' }] }),
    ).not.toThrow();
  });

  it('register/get/list + doublon refusé + clear', () => {
    clearSearchResourcesForTests();
    const def = { resourceId: 'test-res', fields: [{ name: 'title', kind: 'text' as const }] };
    registerSearchResource(def);
    expect(getSearchResource('test-res')).toBe(def);
    expect(listSearchResources().map((r) => r.resourceId)).toContain('test-res');
    expect(() => registerSearchResource(def)).toThrow(/already registered/);
    expect(getSearchResource('nope')).toBeUndefined();
    clearSearchResourcesForTests();
    expect(listSearchResources()).toEqual([]);
  });
});
