import { describe, expect, it, vi } from 'vitest';

vi.mock('astro:actions', () => {
  class ActionError extends Error {
    code: string;
    constructor({ code, message }: { code: string; message: string }) {
      super(message);
      this.code = code;
    }
  }
  return { ActionError, defineAction: (def: unknown) => def };
});

import { assertFresh, hasVoyagePermission, assertVoyagePermission } from '@/actions/voyage/_helpers';
import { sanitizeAnalyticsProps, isAnalyticsEvent, trackAnalytics, ANALYTICS_EVENTS } from '@/lib/analytics';
import { newRequestId, getRequestId, withRequestId } from '@/lib/request-id';
import { statement } from '@/lib/permissions';

describe('_helpers voyage — permissions et verrou', () => {
  it('hasVoyagePermission false sans user / banni', async () => {
    expect(await hasVoyagePermission({ locals: {} } as never, { trip: ['read'] } as never)).toBe(false);
    expect(await hasVoyagePermission({ locals: { user: { banned: true } } } as never, {})).toBe(false);
  });
  it('hasVoyagePermission false quand auth jette', async () => {
    const ctx = { locals: { user: { id: 'u1', banned: false } } } as never;
    // sans mock auth, import réel échoue -> catch -> false
    expect(await hasVoyagePermission(ctx, { trip: ['read'] } as never)).toBe(false);
  });
  it('assertVoyagePermission UNAUTHORIZED / FORBIDDEN', async () => {
    await expect(assertVoyagePermission({ locals: {} } as never, {})).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
    await expect(assertVoyagePermission({ locals: { user: { banned: true } } } as never, {})).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(assertVoyagePermission({ locals: { user: { id: 'u1', banned: false } } } as never, { trip: ['update'] } as never)).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
  it('assertFresh bypass null/vide, égalité seconde, conflit', () => {
    const now = new Date('2027-05-01T12:00:00.500Z');
    expect(() => assertFresh(now, null, 'X')).not.toThrow();
    expect(() => assertFresh(now, undefined, 'X')).not.toThrow();
    expect(() => assertFresh(now, '', 'X')).not.toThrow();
    // même seconde malgré ms différentes (PG micro vs JS milli)
    expect(() => assertFresh(now, '2027-05-01T12:00:00.000Z', 'X')).not.toThrow();
    expect(() => assertFresh(now, '2020-01-01T00:00:00.000Z', 'Contenu')).toThrow(/obsolète/);
    // date invalide -> jamais égale -> conflit
    expect(() => assertFresh(now, 'pas-une-date', 'X')).toThrow(/obsolète/);
  });
});

describe('analytics — sanitize et track', () => {
  it('10 événements autorisés', () => {
    expect(ANALYTICS_EVENTS).toHaveLength(10);
    expect(isAnalyticsEvent('purchase')).toBe(true);
    expect(isAnalyticsEvent('motivation')).toBe(false);
  });
  it('sanitize ne garde que tripId/locale/page string <=160', () => {
    expect(sanitizeAnalyticsProps(undefined)).toEqual({});
    expect(sanitizeAnalyticsProps({ tripId: 't1', locale: 'fr', page: '/en/trips', motivation: 'secret' } as never)).toEqual({ tripId: 't1', locale: 'fr', page: '/en/trips' });
    expect(sanitizeAnalyticsProps({ tripId: 123 } as never)).toEqual({});
    expect(sanitizeAnalyticsProps({ page: 'x'.repeat(161) })).toEqual({});
  });
  it('trackAnalytics log JSON avec timestamp', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    trackAnalytics('trip_view', { tripId: 't1' });
    expect(spy).toHaveBeenCalledOnce();
    const logged = JSON.parse(spy.mock.calls[0][0] as string);
    expect(logged.type).toBe('analytics');
    expect(logged.event).toBe('trip_view');
    expect(logged.tripId).toBe('t1');
    expect(logged.timestamp).toBeTypeOf('string');
    spy.mockClear();
    trackAnalytics('page_view');
    const bare = JSON.parse(spy.mock.calls[0][0] as string);
    expect(bare.event).toBe('page_view');
    expect(bare.timestamp).toBeTypeOf('string');
    spy.mockRestore();
  });
});

describe('request-id — bords', () => {
  it('newRequestId uuid opaque', () => {
    expect(newRequestId()).toMatch(/^[0-9a-f-]{36}$/i);
  });
  it('getRequestId non-string -> null', () => {
    expect(getRequestId(undefined)).toBeNull();
    expect(getRequestId(null)).toBeNull();
    expect(getRequestId({ requestId: 123 } as never)).toBeNull();
    expect(getRequestId({ requestId: {} } as never)).toBeNull();
    expect(getRequestId({ requestId: '' })).toBeNull();
    expect(getRequestId({ requestId: 'abc' })).toBe('abc');
  });
  it('withRequestId vide -> message seul', () => {
    expect(withRequestId('', 'hello')).toBe('hello');
    expect(withRequestId(null, 'hello')).toBe('hello');
    expect(withRequestId(undefined, 'hello')).toBe('hello');
    expect(withRequestId('abc', 'hello')).toBe('[req:abc] hello');
  });
});

describe('permissions — statement voyage exact', () => {
  it('ressources voyage déclarées', () => {
    expect(statement.trip).toEqual(['create', 'read', 'update', 'publish', 'archive', 'moderate', 'engage']);
    expect(statement.departure).toEqual(['create', 'read', 'update', 'close']);
    expect(statement.application).toEqual(['read', 'review', 'approve', 'decline']);
    expect(statement.reservation).toEqual(['read', 'cancel']);
    expect(statement.payment).toEqual(['read', 'refund']);
    expect(statement.traveler).toEqual(['read', 'export', 'anonymize']);
    expect(statement.policy).toEqual(['create', 'read', 'update', 'publish']);
    expect(statement.email).toEqual(['read', 'retry']);
  });
});
