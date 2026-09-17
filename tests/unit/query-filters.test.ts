import { describe, expect, it } from 'vitest';
import { z } from 'astro/zod';
import { parseListFilters } from '@/lib/query-filters';

const schema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  status: z.enum(['open', 'closed']).optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

describe('parseListFilters', () => {
  it('laisse passer le valide tel quel', () => {
    expect(parseListFilters(schema, { page: '2', status: 'open', sortOrder: 'asc' })).toEqual({
      page: 2,
      status: 'open',
      sortOrder: 'asc',
    });
  });

  it('retombe sur les défauts quand une valeur est invalide', () => {
    expect(parseListFilters(schema, { page: 'abc', status: 'bogus', sortOrder: 'sideways' })).toEqual({
      page: 1,
      status: undefined,
      sortOrder: 'desc',
    });
  });

  it('accepte le vide', () => {
    expect(parseListFilters(schema, {})).toEqual({ page: 1, status: undefined, sortOrder: 'desc' });
  });

  it('conserve le repli imposé (ex. locale)', () => {
    const withLocale = z.object({ locale: z.string().min(1), status: z.enum(['open']).optional() });
    expect(parseListFilters(withLocale, { locale: 'fr', status: 'bogus' }, { locale: 'fr' })).toEqual({
      locale: 'fr',
      status: undefined,
    });
  });

  it('jette quand même le repli est invalide (schéma strict)', () => {
    const strict = z.object({ id: z.string().uuid() });
    expect(() => parseListFilters(strict, { id: 'nope' }, { id: 'toujours-pas' })).toThrow();
  });
});
