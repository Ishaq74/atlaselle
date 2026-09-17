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

interface TestContext {
  request: Request;
  locals: { requestId?: string; user?: unknown; session?: unknown };
  rewrite: (path: string) => Response;
}

type OnRequest = (context: TestContext, next: () => Promise<Response>) => Promise<Response>;
const handle = onRequest as unknown as OnRequest;

function ctx(path: string, headers: Record<string, string> = {}) {
  const next = vi.fn(async () => new Response('OK', { status: 200 }));
  const rewrite = vi.fn((p: string) => new Response(`rewritten:${p}`, { status: 200 }));
  const context: TestContext = {
    request: new Request(`http://localhost:4321${path}`, { headers: new Headers(headers) }),
    locals: {},
    rewrite,
  };
  return { context, next, rewrite };
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
    expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(res.headers.get('X-Frame-Options')).toBe('DENY');
    expect(res.headers.get('X-Request-Id')).toBe(context.locals.requestId);
    expect(res.headers.get('Strict-Transport-Security')).toContain('max-age=');
  });

  it('propage un incoming x-request-id', async () => {
    const { context, next } = ctx('/en/trips', { 'x-request-id': 'abc-123' });
    await handle(context, next);
    expect(context.locals.requestId).toBe('abc-123');
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
});
