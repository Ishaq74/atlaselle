import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import { PgDialect } from 'drizzle-orm/pg-core';
import type { APIContext } from 'astro';
import type { RateLimitOptions, RateLimitResult } from '@/lib/rate-limit';

/**
 * Signature réelle de `checkRateLimit`, reprise du module mocké.
 *
 * Ce contrat n'est pas cosmétique, il est structurel : sans signature déclarée,
 * `vi.fn(() => …)` infère une fonction à *zéro* argument. Deux erreurs en
 * découlent mécaniquement — `mock.calls` est typé `[][]`, donc `call[0]` n'existe
 * pas ; et une factory `(...args: unknown[]) => mock(...args)` tente de déverser
 * un `unknown[]`, que le typage refuse faute de type tuple. Typer la constante
 * supprime les deux causes, sans `any`, sans `@ts-ignore`, sans cast.
 */
type CheckRateLimit = (key: string, opts: RateLimitOptions) => RateLimitResult;

const mockExecute = vi.fn();
const mockSelect = vi.fn();
const mockCheckRateLimit = vi.fn<CheckRateLimit>(() => ({
  allowed: true,
  remaining: 59,
  resetAt: Date.now() + 60_000,
}));

vi.mock('@database/drizzle', () => ({
  getDrizzle: vi.fn(() => ({
    execute: mockExecute,
    select: mockSelect,
  })),
}));

// Référence différée à mockCheckRateLimit : la factory est évaluée à l'import
// du module mocké, avant l'initialisation de la constante du fichier de test.
// Le report porte sur la *lecture* de la constante — celle-ci n'a lieu que dans
// le corps de la flèche, à l'appel — et jamais sur la forme de la constante.
// D'où des paramètres nommés plutôt qu'un spread : l'arity est alors vérifiée
// par le compilateur, et l'appel reste identique à celui du module réel.
vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: (key: string, opts: RateLimitOptions) => mockCheckRateLimit(key, opts),
}));

import { GET, buildTsQuery, getRegconfig } from '@/pages/api/search';

/** Surface de contexte réellement consommée par GET : url, request, clientAddress. */
type SearchContext = Pick<APIContext, 'url' | 'request' | 'clientAddress'>;
type SearchGet = (context: SearchContext) => Promise<Response>;
const getSearch = GET as unknown as SearchGet;

beforeEach(() => {
  mockExecute.mockReset().mockResolvedValue({ rows: [] });
  mockSelect.mockReset();
  mockCheckRateLimit.mockClear();
  // extractIp ne lit x-forwarded-for / x-real-ip que si TRUST_PROXY=true. L'ancrer
  // rend le test indépendant de l'environnement ambiant : sans ça, le résultat
  // dépendrait d'une variable exportée par la machine ou par la CI.
  vi.stubEnv('TRUST_PROXY', 'true');
});

afterEach(() => {
  vi.unstubAllEnvs();
});

/** Adresse du reverse proxy : celle que voit Astro pour toutes les requêtes. */
const PROXY_ADDRESS = '198.51.100.7';

/**
 * Contexte réel : la Request porte l'en-tête de proxy et l'URL de la requête, et
 * `url` en est dérivé — Astro construit context.url depuis context.request.url.
 * `request` n'est plus décoratif : c'est lui que extractIp interroge.
 */
function searchContext(path: string, forwardedClientIp: string): SearchContext {
  const url = new URL(`https://atlaselle.test${path}`);
  return {
    url,
    request: new Request(url, { headers: { 'x-forwarded-for': forwardedClientIp } }),
    clientAddress: PROXY_ADDRESS,
  };
}

/**
 * Contexte sans en-tête de proxy : la seule identité réseau restante est
 * l'adresse de socket. `clientAddress` valant '' est la forme que reçoit
 * l'application quand aucune adresse n'est déterminable (extractIp la rejette
 * comme falsy) — la variable reste typée `string`, comme dans APIContext.
 * `searchContext` reste inchangé pour les tests qui ont besoin de l'en-tête.
 */
function proxylessSearchContext(path: string, clientAddress: string): SearchContext {
  const url = new URL(`https://atlaselle.test${path}`);
  return { url, request: new Request(url), clientAddress };
}

/** Clés de compartiment effectivement demandées, dans l'ordre des appels. */
function rateLimitKeys(): string[] {
  // Le `as string` qui était nécessaire ici n'était qu'un symptôme de la
  // signature absente : `call[0]` est désormais un `string` garanti, et la
  // preuve est portée par le compilateur plutôt que par une affirmation.
  return mockCheckRateLimit.mock.calls.map(([key]) => key);
}

// ─── Tests ──────────────────────────────────────────────────────────

describe('getRegconfig', () => {
  it('returns french for fr', () => {
    expect(getRegconfig('fr')).toBe('french');
  });

  it('returns english for en', () => {
    expect(getRegconfig('en')).toBe('english');
  });

  it('returns spanish for es', () => {
    expect(getRegconfig('es')).toBe('spanish');
  });

  it('returns simple for ar (no PG stemmer)', () => {
    expect(getRegconfig('ar')).toBe('simple');
  });

  it('returns simple for unknown locale', () => {
    expect(getRegconfig('ja')).toBe('simple');
  });
});

describe('buildTsQuery', () => {
  it('builds a simple single-word query with prefix match', () => {
    expect(buildTsQuery('hello')).toBe('hello:*');
  });

  it('builds a multi-word query with AND + prefix on last word', () => {
    expect(buildTsQuery('hello world')).toBe('hello & world:*');
  });

  it('handles three words', () => {
    expect(buildTsQuery('astro cms search')).toBe('astro & cms & search:*');
  });

  it('strips tsquery operators from input', () => {
    expect(buildTsQuery("hello & | ! ( ) ' : < > world")).toBe('hello & world:*');
  });

  it('strips backslashes', () => {
    expect(buildTsQuery('test\\injection')).toBe('testinjection:*');
  });

  it('returns null for empty string', () => {
    expect(buildTsQuery('')).toBeNull();
  });

  it('returns null for whitespace only', () => {
    expect(buildTsQuery('   ')).toBeNull();
  });

  it('returns null for string of only operators', () => {
    expect(buildTsQuery('& | ! ()')).toBeNull();
  });

  it('handles extra whitespace between words', () => {
    expect(buildTsQuery('  hello   world  ')).toBe('hello & world:*');
  });

  it('handles single character tokens after cleanup', () => {
    expect(buildTsQuery('a b c')).toBe('a & b & c:*');
  });

  it('handles mixed valid and invalid tokens', () => {
    expect(buildTsQuery('| hello & world !')).toBe('hello & world:*');
  });

  it('handles unicode characters', () => {
    expect(buildTsQuery('café résumé')).toBe('café & résumé:*');
  });

  it('handles Arabic text', () => {
    expect(buildTsQuery('مرحبا العالم')).toBe('مرحبا & العالم:*');
  });
});

describe('GET blog publication scope (single-tenant, no org filter)', () => {
  it('scopes to published posts without any organization predicate', async () => {
    const response = await getSearch(searchContext('/api/search?q=atlaselle&locale=fr', '203.0.113.1'));

    expect(response.status).toBe(200);
    // Derrière un proxy, clientAddress est celle du proxy : sans extractIp, tous
    // les clients tomberaient dans le même compartiment de rate limit.
    expect(mockCheckRateLimit).toHaveBeenCalledWith('search:203.0.113.1', { window: 60, max: 60 });
    const query = new PgDialect().sqlToQuery(mockExecute.mock.calls[0][0]);
    expect(query.sql).not.toContain('organization_id');
    expect(query.sql).toContain('bp.status = $');
    expect(query.params).toContain('PUBLISHED');
    expect(query.sql).toContain('bp.published_at <= now()');
  });

  it('ignores the legacy org param', async () => {
    const response = await getSearch(searchContext('/api/search?q=atlaselle&locale=en&org=acme', '203.0.113.2'));

    expect(response.status).toBe(200);
    // Le client légitime est bien le second : le param `org` ne doit pas non plus
    // déplacer le compartiment de rate limit.
    expect(mockCheckRateLimit).toHaveBeenCalledWith('search:203.0.113.2', { window: 60, max: 60 });
    const query = new PgDialect().sqlToQuery(mockExecute.mock.calls[0][0]);
    expect(query.sql).not.toContain('organization_id');
    expect(query.params).toContain('PUBLISHED');
    expect(query.sql).toContain('bp.published_at <= now()');
  });
});

/**
 * INVARIANT — « l'identité réseau de la recherche est résolue, pas l'adresse du
 * proxy ». `clientAddress` est l'adresse du reverse proxy pour toutes les
 * requêtes qui le traversent : l'utiliser comme clé confond tous les visiteurs
 * dans un seul compartiment. `extractIp(request.headers, clientAddress)`
 * remonte la chaîne transférée. Les cas d'isolation de compartiment déjà
 * couverts ci-dessus (« scopes to published posts », « ignores the legacy org
 * param ») ne sont pas répétés ici.
 */
describe('GET rate limit — identité réseau résolue (tests/unit/search-fts)', () => {
  it('donne deux clés distinctes à deux X-Forwarded-For distincts', async () => {
    const first = await getSearch(searchContext('/api/search?q=atlaselle&locale=fr', '203.0.113.10'));
    const second = await getSearch(searchContext('/api/search?q=atlaselle&locale=fr', '203.0.113.11'));

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);

    // Un appel par requête, et deux compartiments : sans cela, les deux
    // utilisateurs partageraient le quota de l'autre.
    expect(mockCheckRateLimit).toHaveBeenCalledTimes(2);
    expect(rateLimitKeys()).toEqual(['search:203.0.113.10', 'search:203.0.113.11']);
    expect(new Set(rateLimitKeys()).size).toBe(2);
  });

  it('résout le client en tête de chaîne, pas l’adresse du proxy', async () => {
    // Le proxy ajoute son propre saut en fin de chaîne : le premier jeton est le
    // client, le dernier est le proxy — et c'est aussi `clientAddress`.
    const response = await getSearch(
      searchContext('/api/search?q=atlaselle&locale=fr', `203.0.113.30, ${PROXY_ADDRESS}`),
    );

    expect(response.status).toBe(200);
    expect(mockCheckRateLimit).toHaveBeenCalledWith('search:203.0.113.30', { window: 60, max: 60 });
    // Le compartiment du proxy ne doit pas être celui du client.
    expect(rateLimitKeys()).not.toContain(`search:${PROXY_ADDRESS}`);
  });

  it('retombe sur le compartiment global sans en-tête ni adresse de socket', async () => {
    const response = await getSearch(proxylessSearchContext('/api/search?q=atlaselle&locale=fr', ''));

    expect(response.status).toBe(200);
    // Repli conservé tel quel : une identité indéterminable ne doit pas être
    // confondue avec une adresse, ni se déguiser en identité connue.
    expect(mockCheckRateLimit).toHaveBeenCalledWith('search:unknown', { window: 60, max: 60 });
  });

  it('reprend l’adresse de socket quand aucun en-tête de proxy n’est transmis', async () => {
    const response = await getSearch(
      proxylessSearchContext('/api/search?q=atlaselle&locale=fr', '203.0.113.40'),
    );

    expect(response.status).toBe(200);
    expect(mockCheckRateLimit).toHaveBeenCalledWith('search:203.0.113.40', { window: 60, max: 60 });
    expect(rateLimitKeys()).not.toContain('search:unknown');
  });

  it('conserve un X-Forwarded-For invalide en réponse au compartiment global', async () => {
    const url = new URL('https://atlaselle.test/api/search?q=atlaselle&locale=fr');
    const response = await getSearch({
      url,
      // extractIp valide l'adresse avant de la retenir : une valeur non-IP ne
      // doit pas devenir une clé de compartiment.
      request: new Request(url, { headers: { 'x-forwarded-for': '<script>alert(1)</script>' } }),
      clientAddress: '',
    });

    expect(response.status).toBe(200);
    expect(mockCheckRateLimit).toHaveBeenCalledWith('search:unknown', { window: 60, max: 60 });
  });
});
