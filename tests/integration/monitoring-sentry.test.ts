import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createServer, type Server } from 'node:http';
import { gunzipSync } from 'node:zlib';
import type { AddressInfo } from 'node:net';

/**
 * Test avec le VRAI SDK Sentry envoyant vers un faux serveur d'ingestion local :
 * on lit ce qui part réellement sur le réseau (enveloppes), pas ce que le code croit envoyer.
 */
interface Envelope { headers: Record<string, unknown>; items: Array<{ type: string; payload: Record<string, unknown> }> }

let server: Server;
let port = 0;
const received: Envelope[] = [];

function parseEnvelope(raw: Buffer, encoding: string | undefined): Envelope {
  const text = (encoding === 'gzip' ? gunzipSync(raw) : raw).toString('utf8');
  const lines = text.split('\n').filter(Boolean);
  const headers = JSON.parse(lines[0]) as Record<string, unknown>;
  const items: Envelope['items'] = [];
  for (let i = 1; i + 1 < lines.length; i += 2) {
    const meta = JSON.parse(lines[i]) as { type: string };
    items.push({ type: meta.type, payload: JSON.parse(lines[i + 1]) as Record<string, unknown> });
  }
  return { headers, items };
}

beforeAll(async () => {
  server = createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', () => {
      try {
        received.push(parseEnvelope(Buffer.concat(chunks), req.headers['content-encoding'] as string | undefined));
      } catch {
        /* enveloppe illisible : ignorée */
      }
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end('{}');
    });
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  port = (server.address() as AddressInfo).port;
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

beforeEach(async () => {
  received.length = 0;
  vi.stubEnv('SENTRY_DSN', `http://publickey@127.0.0.1:${port}/1`);
  vi.stubEnv('SENTRY_ENABLE_IN_TEST', 'true');
  vi.stubEnv('SENTRY_ENVIRONMENT', 'vitest');
  vi.resetModules();
});

afterEach(async () => {
  const monitoring = await import('@/lib/monitoring');
  await monitoring.flushMonitoring(3000);
  vi.unstubAllEnvs();
});

async function waitFor(predicate: () => boolean, timeoutMs = 8000): Promise<void> {
  const start = Date.now();
  while (!predicate()) {
    if (Date.now() - start > timeoutMs) throw new Error('Délai dépassé en attendant l’enveloppe Sentry');
    await new Promise((r) => setTimeout(r, 50));
  }
}

const eventsOf = (type: string) => received.flatMap((e) => e.items.filter((i) => i.type === type).map((i) => i.payload));

describe('Sentry réel → serveur d’ingestion local', () => {
  it('transmet une erreur inattendue, sans aucune donnée personnelle', async () => {
    const monitoring = await import('@/lib/monitoring');
    expect(monitoring.isMonitoringEnabled()).toBe(true);

    const error = new Error('SMTP 550 <jane.doe@example.com> unknown, token=abc123 from 203.0.113.9 +33612345678');
    expect(
      monitoring.captureError(error, { requestId: 'req-123', userId: 'user_42', path: '/fr/checkout/s1?email=jane@example.com&token=zzz', tags: { source: 'test' } }),
    ).toBe(true);
    await monitoring.flushMonitoring(5000);
    await waitFor(() => eventsOf('event').length > 0);

    const event = eventsOf('event')[0] as {
      user?: unknown; tags?: Record<string, string>; environment?: string; server_name?: string; request?: unknown;
      exception?: { values?: Array<{ value?: string; type?: string }> };
    };
    // Le code source de l'application (lignes de pile) n'est pas une donnée personnelle : on ne contrôle que le reste.
    const withoutSource = JSON.parse(JSON.stringify(received), (key, value: unknown) => (['context_line', 'pre_context', 'post_context'].includes(key) ? undefined : value));
    const dump = JSON.stringify(withoutSource);
    const leaks = [...dump.matchAll(/.{0,60}(jane|@example|203\.0\.113\.9|\+336|abc123|zzz).{0,60}/gi)].map((m) => m[0]);
    expect(leaks).toEqual([]);
    expect(event.user).toEqual({ id: 'user_42' });
    expect(event.tags).toMatchObject({ request_id: 'req-123', path: '/fr/checkout/s1', source: 'test', app: 'atlaselle' });
    expect(event.environment).toBe('vitest');
    expect(event.server_name).toBeUndefined();
    expect(event.exception?.values?.[0].value).toBe('SMTP 550 <[email]> unknown, token=[redacted] from [ip] [phone]');
  }, 30_000);

  it('ne remonte pas les refus attendus, et ne compte une erreur qu’une fois', async () => {
    const monitoring = await import('@/lib/monitoring');
    expect(monitoring.captureError(Object.assign(new Error('Interdit'), { code: 'FORBIDDEN' }))).toBe(false);
    expect(monitoring.captureError({ type: 'AstroActionInputError', issues: [] })).toBe(false);
    expect(monitoring.captureError(Object.assign(new Error('Paiement introuvable'), { code: 'PAYMENT_FAILED' }), { alwaysReport: true })).toBe(true);
    const once = new Error('boom once');
    expect(monitoring.captureError(once)).toBe(true);
    expect(monitoring.captureError(once)).toBe(false);
    await monitoring.flushMonitoring(5000);
    await waitFor(() => eventsOf('event').length >= 2);
    const messages = eventsOf('event').flatMap((e) => ((e as { exception?: { values?: Array<{ value?: string }> } }).exception?.values ?? []).map((v) => v.value));
    expect(messages.sort()).toEqual(['Paiement introuvable', 'boom once']);
  }, 30_000);

  it('transmet un événement sans exception avec son niveau', async () => {
    const monitoring = await import('@/lib/monitoring');
    expect(monitoring.captureEvent('Email moved to dead-letter', { level: 'warning', tags: { provider: 'brevo' } })).toBe(true);
    await monitoring.flushMonitoring(5000);
    await waitFor(() => eventsOf('event').length > 0);
    expect(eventsOf('event')[0]).toMatchObject({ message: 'Email moved to dead-letter', level: 'warning', tags: expect.objectContaining({ provider: 'brevo' }) });
  }, 30_000);

  it('envoie les check-ins du moniteur de cron (démarrage puis fin)', async () => {
    const monitoring = await import('@/lib/monitoring');
    const checkIn = monitoring.startCronCheckIn('voyage-cron', '*/5 * * * *');
    await new Promise((r) => setTimeout(r, 300));
    checkIn.done(false);
    checkIn.done(true);
    await monitoring.flushMonitoring(5000);
    await waitFor(() => eventsOf('check_in').length >= 2);
    const checkIns = eventsOf('check_in') as Array<{ monitor_slug: string; status: string; monitor_config?: { schedule?: { value?: string } } }>;
    expect(checkIns.map((c) => c.status)).toEqual(['in_progress', 'error']);
    expect(checkIns.every((c) => c.monitor_slug === 'voyage-cron')).toBe(true);
    expect(checkIns[0].monitor_config?.schedule?.value).toBe('*/5 * * * *');
  }, 30_000);

  it('ne fait jamais échouer l’appelant quand le serveur est injoignable', async () => {
    vi.stubEnv('SENTRY_DSN', 'http://publickey@127.0.0.1:1/1');
    vi.resetModules();
    const monitoring = await import('@/lib/monitoring');
    expect(() => monitoring.captureError(new Error('nobody listens'))).not.toThrow();
    await expect(monitoring.flushMonitoring(1500)).resolves.toBeUndefined();
  }, 30_000);
});

describe('suivi désactivé', () => {
  it('ne charge pas le SDK et ne transmet rien sans DSN', async () => {
    vi.stubEnv('SENTRY_DSN', '');
    vi.resetModules();
    const monitoring = await import('@/lib/monitoring');
    expect(monitoring.isMonitoringEnabled()).toBe(false);
    expect(monitoring.captureError(new Error('x'))).toBe(false);
    expect(monitoring.captureEvent('x')).toBe(false);
    monitoring.startCronCheckIn('s', '* * * * *').done(true);
    await monitoring.flushMonitoring();
    await new Promise((r) => setTimeout(r, 200));
    expect(received).toHaveLength(0);
  });
});
