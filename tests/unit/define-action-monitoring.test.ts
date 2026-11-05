import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('astro:actions', () => ({
  ActionError: class ActionError extends Error {},
  defineAction: (def: unknown) => def,
}));

const captureError = vi.fn();
vi.mock('@/lib/monitoring', () => ({ captureError: (...args: unknown[]) => captureError(...args) }));

import { defineAction } from '@/lib/form-fallback/define-action';
import { FORM_COMPANION } from '@/lib/form-fallback/companion';

const make = (handler: (i: unknown, c: unknown) => unknown, extra: Record<string, unknown> = {}) =>
  defineAction({ handler, ...extra } as never) as unknown as {
    handler: (i: unknown, c: unknown) => Promise<unknown>;
    [FORM_COMPANION]?: { handler: (i: unknown, c: unknown) => Promise<unknown>; accept?: string };
  };

beforeEach(() => captureError.mockReset());

describe('defineAction — signalement des exceptions inattendues', () => {
  it('relaie le résultat et ne signale rien en cas de succès', async () => {
    const action = make(async (input) => ({ echoed: input }));
    await expect(action.handler({ a: 1 }, {})).resolves.toEqual({ echoed: { a: 1 } });
    expect(captureError).not.toHaveBeenCalled();
  });

  it('signale une exception avec le contexte de requête, puis la relance INCHANGÉE', async () => {
    const boom = new Error('db exploded');
    const action = make(async () => {
      throw boom;
    });
    const context = { url: new URL('https://site.test/_actions/doThing?token=zzz'), locals: { requestId: 'req-9', user: { id: 'user_7' } } };
    await expect(action.handler({}, context)).rejects.toBe(boom);
    expect(captureError).toHaveBeenCalledTimes(1);
    expect(captureError).toHaveBeenCalledWith(boom, { requestId: 'req-9', userId: 'user_7', path: '/_actions/doThing', tags: { source: 'action' } });
  });

  it('tolère un contexte absent ou partiel', async () => {
    const action = make(async () => {
      throw new Error('x');
    });
    await expect(action.handler({}, null)).rejects.toThrow('x');
    await expect(action.handler({}, { locals: {} })).rejects.toThrow('x');
    expect(captureError.mock.calls[0][1]).toEqual({ requestId: null, userId: null, path: null, tags: { source: 'action' } });
  });

  it('passe aussi les handlers synchrones qui lèvent', async () => {
    const action = make(() => {
      throw new Error('sync');
    });
    await expect(action.handler({}, {})).rejects.toThrow('sync');
    expect(captureError).toHaveBeenCalledTimes(1);
  });

  it('applique le même signalement à la jumelle « form » et ne double pas les actions déjà « form »', async () => {
    const action = make(async () => {
      throw new Error('twin');
    });
    const twin = action[FORM_COMPANION];
    expect(twin?.accept).toBe('form');
    await expect(twin!.handler({}, {})).rejects.toThrow('twin');
    expect(captureError).toHaveBeenCalledTimes(1);

    const formOnly = make(async () => 'ok', { accept: 'form' });
    expect(formOnly[FORM_COMPANION]).toBeUndefined();
  });
});
