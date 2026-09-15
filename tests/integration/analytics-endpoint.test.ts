import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '@/pages/api/analytics';

function req(body: unknown) {
  return {
    request: new Request('http://localhost/api/analytics', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: typeof body === 'string' ? body : JSON.stringify(body),
    }),
    clientAddress: '127.0.0.1',
  } as any;
}

describe('POST /api/analytics', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('accepts allowlisted events with safe props only', async () => {
    const logs: string[] = [];
    vi.spyOn(console, 'log').mockImplementation((msg: string) => void logs.push(msg));
    const res = await POST(req({ event: 'trip_view', props: { tripId: 'abc', locale: 'fr', motivation: 'x' } }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    const logged = JSON.parse(logs.find((l) => l.includes('trip_view')) ?? '{}');
    expect(logged.tripId).toBe('abc');
    expect(logged.motivation).toBeUndefined();
  });

  it('rejects unknown events and invalid bodies', async () => {
    expect((await POST(req({ event: 'motivation' }))).status).toBe(400);
    expect((await POST(req({ nope: 1 }))).status).toBe(400);
    expect((await POST(req('not-json{'))).status).toBe(400);
  });
});
