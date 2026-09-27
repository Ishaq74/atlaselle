import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('astro:middleware', () => ({
  defineMiddleware: (fn: unknown) => fn,
}));

const getSessionMock = vi.fn();

vi.mock('@/lib/auth', () => ({
  auth: {
    api: {
      getSession: (...args: unknown[]) => getSessionMock(...args),
      userHasPermission: async () => ({ success: true }),
    },
  },
}));

import { onRequest } from '@/middleware';

/**
 * Surface du contexte réellement consommée par src/middleware.ts :
 * `request`, `url`, `clientAddress`, `locals`, `rewrite`. `url` n'est pas une
 * copie : Astro le définit comme `new URL(context.request.url)` (APIContext.url),
 * le double le dérive donc de la même request que le reste du contexte.
 */
interface TestContext {
  request: Request;
  url: URL;
  clientAddress: string;
  locals: { requestId?: string; user?: unknown; session?: unknown };
  rewrite: (path: string) => Response;
}

type OnRequest = (context: TestContext, next: () => Promise<Response>) => Promise<Response>;
const handle = onRequest as unknown as OnRequest;

/** Adresse de socket observée : sans en-tête de proxy, elle n'est jamais lue. */
const SOCKET_ADDRESS = '203.0.113.1';

function ctx(path: string, headers: Record<string, string> = {}) {
  const next = vi.fn(async () => new Response('OK', { status: 200 }));
  const rewrite = vi.fn((p: string) => new Response(`rewritten:${p}`, { status: 200 }));
  const request = new Request(`http://localhost:4321${path}`, { headers: new Headers(headers) });
  const context: TestContext = {
    request,
    url: new URL(request.url),
    clientAddress: SOCKET_ADDRESS,
    locals: {},
    rewrite,
  };
  return { context, next, rewrite };
}

/**
 * Contrat SECURITY_HEADERS de src/middleware.ts, énoncé ici indépendamment de
 * l'implémentation (la constante du produit n'est pas exportée) : une régression
 * sur l'une de ces neuf valeurs, ou la disparition de l'une d'elles, casse ici.
 * Ordre conservé tel quel pour rester lisible face à la source.
 */
const SECURITY_HEADER_CONTRACT: ReadonlyArray<readonly [string, string]> = [
  ['X-Content-Type-Options', 'nosniff'],
  ['X-Frame-Options', 'DENY'],
  ['Referrer-Policy', 'strict-origin-when-cross-origin'],
  ['Permissions-Policy', 'camera=(), microphone=(), geolocation=()'],
  ['X-XSS-Protection', '0'],
  ['Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload'],
  ['Cross-Origin-Opener-Policy', 'same-origin'],
  ['Cross-Origin-Resource-Policy', 'same-origin'],
  ['Cross-Origin-Embedder-Policy', 'credentialless'],
];

/**
 * Application unique des en-têtes : doit tenir pour TOUTE réponse rendue, y
 * compris les sorties précoces. Les valeurs sont lues sur l'objet `Response`
 * réellement retourné, jamais sur une copie fabriquée par le test.
 */
function expectSecurityHeaders(response: Response, expectedRequestId: string): void {
  for (const [header, value] of SECURITY_HEADER_CONTRACT) {
    expect(response.headers.get(header)).toBe(value);
  }
  expect(response.headers.get('X-Request-Id')).toBe(expectedRequestId);
}

describe('middleware onRequest', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSessionMock.mockResolvedValue(null);
  });

  it('rejette les locales invalides en 404', async () => {
    const { context, next } = ctx('/xx/trips');
    const res = await handle(context, next);
    expect(res.status).toBe(404);
    expect(next).not.toHaveBeenCalled();
  });

  it('rejette les locales invalides majuscules en 404', async () => {
    const { context, next } = ctx('/XX/trips');
    const res = await handle(context, next);
    expect(res.status).toBe(404);
    expect(next).not.toHaveBeenCalled();
  });

  it('redirige 301 les locales majuscules vers le canonique minuscule', async () => {
    const { context, next } = ctx('/EN/trips?foo=bar');
    const res = await handle(context, next);
    expect(res.status).toBe(301);
    expect(res.headers.get('Location')).toBe('http://localhost:4321/en/trips?foo=bar');
    expect(next).not.toHaveBeenCalled();
  });

  it('réécrit les segments localisés (voyages -> trips)', async () => {
    const { context, next } = ctx('/fr/voyages/afrique-du-sud');
    const res = await handle(context, next);
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('rewritten:/fr/trips/afrique-du-sud');
    expect(next).not.toHaveBeenCalled();
  });

  it('pose requestId, user null et headers de sécurité', async () => {
    const { context, next } = ctx('/en/trips');
    const res = await handle(context, next);
    expect(res.status).toBe(200);
    expect(next).toHaveBeenCalledOnce();
    expect(typeof context.locals.requestId).toBe('string');
    expect(context.locals.user).toBeNull();
    // Les en-têtes sont lus sur la réponse réellement rendue : le corps 'OK'
    // prouve qu'il s'agit bien de l'objet renvoyé par next(), sur lequel
    // applySecurityHeaders écrit — et non d'une réponse recréée par le test.
    expect(await res.text()).toBe('OK');
    // Valeurs exactes du contrat SECURITY_HEADERS de src/middleware.ts : une
    // régression sur l'une d'elles doit casser ici, pas en production.
    expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(res.headers.get('X-Frame-Options')).toBe('DENY');
    expect(res.headers.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin');
    expect(res.headers.get('Permissions-Policy')).toBe('camera=(), microphone=(), geolocation=()');
    expect(res.headers.get('X-XSS-Protection')).toBe('0');
    expect(res.headers.get('Strict-Transport-Security')).toBe('max-age=63072000; includeSubDomains; preload');
    expect(res.headers.get('Cross-Origin-Opener-Policy')).toBe('same-origin');
    expect(res.headers.get('Cross-Origin-Resource-Policy')).toBe('same-origin');
    expect(res.headers.get('Cross-Origin-Embedder-Policy')).toBe('credentialless');
    expect(res.headers.get('X-Request-Id')).toBe(context.locals.requestId);
  });

  it('propage un incoming x-request-id au format UUID', async () => {
    const incoming = '123e4567-e89b-42d3-a456-426614174000';
    const { context, next } = ctx('/en/trips', { 'x-request-id': incoming });
    await handle(context, next);
    expect(context.locals.requestId).toBe(incoming);
  });

  it('regénère un requestId quand le x-request-id entrant n’est pas un UUID (anti log-injection)', async () => {
    const { context, next } = ctx('/en/trips', { 'x-request-id': 'abc-123' });
    await handle(context, next);
    expect(context.locals.requestId).not.toBe('abc-123');
    expect(typeof context.locals.requestId).toBe('string');
  });

  it('remplit locals.user quand la session existe', async () => {
    getSessionMock.mockResolvedValueOnce({ user: { id: 'u1' }, session: { id: 's1' } });
    const { context, next } = ctx('/en/trips');
    await handle(context, next);
    expect((context.locals.user as { id: string }).id).toBe('u1');
    expect(context.locals.session).toEqual({ id: 's1' });
  });

  it('503 quand la session dépasse 5s (et rejet orphelin absorbé)', async () => {
    getSessionMock.mockImplementationOnce(() => new Promise(() => {}));
    const { context, next } = ctx('/en/trips');
    const res = await handle(context, next);
    expect(res.status).toBe(503);
    expect(res.headers.get('Retry-After')).toBe('5');
    expect(next).not.toHaveBeenCalled();
  });

  it('erreur session -> anonyme, pas de 500', async () => {
    getSessionMock.mockRejectedValueOnce(new Error('db down'));
    const { context, next } = ctx('/en/trips');
    const res = await handle(context, next);
    expect(res.status).toBe(200);
    expect(context.locals.user).toBeNull();
  });

  it('svg sous /uploads/ -> pièce jointe', async () => {
    const { context, next } = ctx('/uploads/logo.svg');
    const res = await handle(context, next);
    expect(res.headers.get('Content-Disposition')).toBe('attachment');
  });

  /**
   * INVARIANT — « le garde-fou SVG est borné au chemin ET à l'extension ».
   *
   * `runRequestChain` (src/middleware.ts) compare `url.pathname.toLowerCase()` :
   * la casse est donc indifférente, `.svgz` est traité comme `.svg`, et un
   * `/uploads/…` qui n'est pas un SVG ne doit RIEN recevoir. Ces branches n'ont
   * jamais été couvertes par une exécution réelle du middleware (le test
   * supprimé `tests/unit/middleware-timeout.test.ts` les énonçait sur des chaînes
   * reconstruites à la main, sans jamais appeler `onRequest`) ; elles sont
   * énoncées ici sur la réponse que le produit renvoie effectivement.
   * Le cas `/uploads/logo.svg` reste couvert par le test juste au-dessus.
   */
  it.each([
    '/uploads/icons/icon.svgz',
    // La comparaison se fait en minuscules : une extension en casse haute doit
    // être traitée comme un SVG, sinon la protection est contournable par URL.
    '/uploads/Brand/Logo.SVG',
    '/uploads/Brand/Icon.SvgZ',
  ])('%s -> pièce jointe image/svg+xml', async (path) => {
    const { context, next } = ctx(path);
    const res = await handle(context, next);

    expect(next).toHaveBeenCalledOnce();
    expect(res.headers.get('Content-Disposition')).toBe('attachment');
    expect(res.headers.get('Content-Type')).toBe('image/svg+xml');
    // Le corps est celui rendu par `next()` : les en-têtes ont bien été posés
    // sur la réponse produite par le produit, pas sur une réponse recréée ici.
    expect(await res.text()).toBe('OK');
  });

  it.each(['/uploads/images/photo.webp', '/uploads/docs/report.pdf', '/uploads/logo.png'])(
    '%s -> aucun en-tête de pièce jointe forcé',
    async (path) => {
      const { context, next } = ctx(path);
      const res = await handle(context, next);

      expect(next).toHaveBeenCalledOnce();
      expect(res.headers.get('Content-Disposition')).toBeNull();
      expect(res.headers.get('Content-Type')).not.toBe('image/svg+xml');
      // La réponse reste celle de la route : le garde-fou ne l'a pas remplacée.
      expect(res.status).toBe(200);
      expect(await res.text()).toBe('OK');
    },
  );
});

/**
 * INVARIANT — « les en-têtes de sécurité sont posés sur TOUTES les réponses ».
 *
 * src/middleware.ts produit la réponse par une fonction interne (`runRequestChain`)
 * puis passe par un unique point d'application (`applySecurityHeaders`). Les trois
 * chemins ci-dessous court-circuitaient autrefois AVANT ce point : la 404 de locale
 * invalide, la 301 de canonicalisation de casse, la 503 de session indisponible.
 * Aucun d'eux n'est mesuré par le test du chemin nominal.
 */
describe('middleware — en-têtes de sécurité sur les sorties précoces', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // mockResolvedValue rétablit l'implémentation par défaut : un test 503 de ce
    // bloc laisse une promesse pendante, elle ne doit pas survivre au clearAllMocks.
    getSessionMock.mockResolvedValue(null);
  });

  it('404 de locale invalide : statut, corps et les dix en-têtes', async () => {
    const { context, next } = ctx('/xx/trips');
    const res = await handle(context, next);

    expect(res.status).toBe(404);
    // `next` non appelé : c'est bien la sortie précoce du middleware, pas un 404
    // rendu par la route. Le corps 'Not Found' prouve que les en-têtes ont été
    // posés sur l'objet réellement produit par le garde-fou de locale.
    expect(next).not.toHaveBeenCalled();
    expect(await res.text()).toBe('Not Found');
    expectSecurityHeaders(res, context.locals.requestId as string);
  });

  it('404 de locale invalide : X-Request-Id reprend l’UUID entrant', async () => {
    const incoming = '123e4567-e89b-42d3-a456-426614174000';
    const { context, next } = ctx('/xx/trips', { 'x-request-id': incoming });
    const res = await handle(context, next);

    expect(res.status).toBe(404);
    expect(context.locals.requestId).toBe(incoming);
    expect(res.headers.get('X-Request-Id')).toBe(incoming);
  });

  it('301 de canonicalisation : statut, Location exacte et les dix en-têtes', async () => {
    const { context, next } = ctx('/EN/trips?foo=bar');
    const res = await handle(context, next);

    expect(res.status).toBe(301);
    // La Location est lue sur la réponse : elle est produite par la même
    // construction que celle qui reçoit les en-têtes de sécurité.
    expect(res.headers.get('Location')).toBe('http://localhost:4321/en/trips?foo=bar');
    expect(next).not.toHaveBeenCalled();
    expectSecurityHeaders(res, context.locals.requestId as string);
  });

  it('301 de canonicalisation : la réponse expose des en-têtes MUTABLES', async () => {
    const { context, next } = ctx('/EN/trips');
    const res = await handle(context, next);

    // Verrou de la correction : `Response.redirect()` renvoie une Response dont
    // les en-têtes portent le guard "immutable" — y écrire lève TypeError et
    // ferait échouer le point unique d'application des en-têtes (donc toute la
    // suite). La 301 doit rester une Response CONSTRUITE, sans corps et mutable.
    expect(res.status).toBe(301);
    expect(res.body).toBeNull();
    expect(() => res.headers.set('X-Contract-Probe', 'mutable')).not.toThrow();
    expect(res.headers.get('X-Contract-Probe')).toBe('mutable');
  });

  it('503 de session indisponible : statut, Retry-After et les dix en-têtes', async () => {
    getSessionMock.mockImplementationOnce(() => new Promise(() => {}));
    const { context, next } = ctx('/en/trips');
    const res = await handle(context, next);

    expect(res.status).toBe(503);
    expect(res.headers.get('Retry-After')).toBe('5');
    // Le corps est celui de la 503 elle-même : les en-têtes ont bien été posés
    // sur l'objet de sortie précoce, pas sur une réponse de remplacement.
    expect(await res.json()).toEqual({ error: 'Service temporarily unavailable' });
    expect(next).not.toHaveBeenCalled();
    expectSecurityHeaders(res, context.locals.requestId as string);
  });

  it('503 de session indisponible : conserve son Content-Type d’origine', async () => {
    getSessionMock.mockImplementationOnce(() => new Promise(() => {}));
    const { context, next } = ctx('/en/trips');
    const res = await handle(context, next);

    // L'application des en-têtes ne doit ni écraser ni supprimer les en-têtes
    // propres au chemin court-circuité : ils font partie du même objet.
    expect(res.status).toBe(503);
    expect(res.headers.get('Content-Type')).toBe('application/json');
    expect(res.headers.get('Retry-After')).toBe('5');
  });
});
