import { describe, expect, it } from 'vitest';
import { isExpectedError, redactText, scrubEvent, scrubValue, stripQuery, type ScrubbableEvent } from '@/lib/monitoring/scrub';
import { monitoringConfig } from '@/lib/monitoring';

describe('redactText', () => {
  it('masque e-mails, jetons, clés secrètes, téléphones et IP', () => {
    const input =
      'Échec pour jane.doe+x@example.co.uk avec Bearer abcdef123456789 ; clé sk_live_ABCDEFGH12345678 et whsec_ZYXWVUTS98765432 ; ' +
      'appeler +33 6 12 34 56 78 depuis 192.168.1.20 ou 2001:db8:85a3:0:0:8a2e:370:7334 ; /cb?token=abc123&x=1';
    const out = redactText(input);
    expect(out).not.toMatch(/jane|abcdef123456789|sk_live|whsec_|\+33|192\.168|2001:db8|abc123/);
    expect(out).toContain('[email]');
    expect(out).toContain('Bearer [token]');
    expect(out).toContain('[api-key]');
    expect(out).toContain('[phone]');
    expect(out).toContain('[ip]');
    expect(out).toContain('token=[redacted]&x=1');
  });

  it('laisse intacts les identifiants opaques et les messages techniques', () => {
    const text = 'Paiement introuvable pour 0b9f9a3e-3b5c-4f4e-9d0e-6d1a2b3c4d5e (HTTP 500, ECONNRESET)';
    expect(redactText(text)).toBe(text);
  });
});

describe('stripQuery', () => {
  it('retire requête et fragment', () => {
    expect(stripQuery('/fr/checkout/s1?room=double&email=a@b.co#x')).toBe('/fr/checkout/s1');
    expect(stripQuery('https://site.test/a?b=1')).toBe('https://site.test/a');
    expect(stripQuery('/plain')).toBe('/plain');
  });
});

describe('scrubValue', () => {
  it('masque les valeurs de clés sensibles, récursivement, et nettoie les chaînes', () => {
    const out = scrubValue({
      email: 'a@b.co',
      nested: { phone: '+33612345678', ok: 'contact a@b.co', list: [{ password: 'x' }, 'jane@x.fr'] },
      count: 3,
      legalName: 'Jane Doe',
    }) as Record<string, unknown>;
    expect(JSON.stringify(out)).not.toMatch(/a@b\.co|\+336|jane@x|Jane|"x"/);
    expect(out.count).toBe(3);
    expect((out.nested as { ok: string }).ok).toBe('contact [email]');
  });

  it('borne la profondeur', () => {
    const deep = { a: { b: { c: { d: { e: { f: 1 } } } } } };
    expect(JSON.stringify(scrubValue(deep))).toContain('[truncated]');
  });
});

function makeEvent(): ScrubbableEvent {
  return {
    user: { id: 'user_42', email: 'jane@example.com', ip_address: '10.0.0.8', username: 'jane' },
    request: {
      method: 'POST',
      url: 'https://site.test/fr/checkout/abc?token=secret&email=jane@example.com#frag',
      headers: { cookie: 'session=abc', authorization: 'Bearer zzzzzzzzzz', 'content-type': 'application/json', 'x-forwarded-for': '1.2.3.4' },
      cookies: { session: 'abc' },
      data: { email: 'jane@example.com', password: 'p' },
      query_string: 'token=secret',
    },
    server_name: 'prod-host-01',
    message: 'Failure for jane@example.com',
    exception: {
      values: [{ value: 'SMTP 550 <jane@example.com> unknown', stacktrace: { frames: [{ filename: 'a.ts', vars: { email: 'jane@example.com' } }] } }],
    },
    breadcrumbs: [
      { category: 'console', message: 'log with jane@example.com' },
      { category: 'http', message: 'GET /x?token=abc', data: { url: 'https://api.stripe.com/v1?key=sk_live_ABCDEFGH12345678', email: 'jane@example.com' } },
    ],
    extra: { traveler: { email: 'jane@example.com', id: 't1' } },
    contexts: { runtime: { name: 'node', version: '22.23.4' }, custom: { note: 'mail jane@example.com' } },
    tags: { request_id: 'req-1' },
  };
}

describe('scrubEvent', () => {
  it('ne laisse subsister aucune donnée personnelle, quel que soit l’endroit', () => {
    const out = scrubEvent(makeEvent());
    const dump = JSON.stringify(out);
    expect(dump).not.toMatch(/jane|@example|10\.0\.0\.8|1\.2\.3\.4|session=abc|zzzzzzzzzz|sk_live|prod-host|secret/i);
    expect(out.user).toEqual({ id: 'user_42' });
    expect(out.request).toEqual({
      method: 'POST',
      url: 'https://site.test/fr/checkout/abc',
      headers: { 'content-type': 'application/json' },
    });
    expect(out.server_name).toBeUndefined();
    expect(out.exception?.values?.[0].stacktrace?.frames?.[0]).not.toHaveProperty('vars');
    expect(out.breadcrumbs).toHaveLength(1);
    expect(out.breadcrumbs?.[0].category).toBe('http');
  });

  it('conserve ce qui sert au diagnostic', () => {
    const out = scrubEvent(makeEvent());
    expect(out.tags).toEqual({ request_id: 'req-1' });
    expect(out.exception?.values?.[0].value).toBe('SMTP 550 <[email]> unknown');
    expect((out.contexts?.runtime as { name: string }).name).toBe('node');
    expect((out.extra?.traveler as { id: string }).id).toBe('t1');
  });

  it('supprime l’utilisateur s’il n’a pas d’identifiant opaque, et tolère les événements minimaux', () => {
    expect(scrubEvent({ user: { email: 'a@b.co' } }).user).toBeNull();
    expect(scrubEvent({})).toEqual({ server_name: undefined });
  });
});

describe('isExpectedError', () => {
  it('ignore refus, validation et codes métier ; garde les exceptions réelles', () => {
    for (const code of ['UNAUTHORIZED', 'FORBIDDEN', 'NOT_FOUND', 'CONFLICT', 'TOO_MANY_REQUESTS', 'BAD_REQUEST', 'DEPARTURE_SOLD_OUT', 'APPLICATION_DUPLICATE']) {
      expect(isExpectedError(Object.assign(new Error('x'), { code }))).toBe(true);
    }
    expect(isExpectedError({ type: 'AstroActionInputError', issues: [] })).toBe(true);
    expect(isExpectedError(Object.assign(new Error('boom'), { code: 'INTERNAL_SERVER_ERROR' }))).toBe(false);
    expect(isExpectedError(Object.assign(new Error('pg'), { code: '23505' }))).toBe(false);
    expect(isExpectedError(new TypeError('Cannot read properties of undefined'))).toBe(false);
    expect(isExpectedError(null)).toBe(false);
    expect(isExpectedError('string')).toBe(false);
  });
});

describe('monitoringConfig', () => {
  const dsn = 'https://publickey@o123.ingest.de.sentry.io/456';

  it('est désactivée sans DSN, avec DSN invalide, et en test sans activation explicite', () => {
    expect(monitoringConfig({})).toBeNull();
    expect(monitoringConfig({ SENTRY_DSN: '  ' })).toBeNull();
    expect(monitoringConfig({ SENTRY_DSN: 'not a url' })).toBeNull();
    expect(monitoringConfig({ SENTRY_DSN: 'ftp://k@h/1' })).toBeNull();
    expect(monitoringConfig({ SENTRY_DSN: 'https://host/1' })).toBeNull();
    expect(monitoringConfig({ SENTRY_DSN: dsn, NODE_ENV: 'test' })).toBeNull();
  });

  it('lit l’environnement, la release et borne le taux de traces', () => {
    expect(monitoringConfig({ SENTRY_DSN: dsn, NODE_ENV: 'production' })).toEqual({ dsn, environment: 'production', release: undefined, tracesSampleRate: 0 });
    expect(monitoringConfig({ SENTRY_DSN: dsn, SENTRY_ENVIRONMENT: 'staging', SENTRY_RELEASE: 'abc123', SENTRY_TRACES_SAMPLE_RATE: '0.25' })).toMatchObject({
      environment: 'staging',
      release: 'abc123',
      tracesSampleRate: 0.25,
    });
    expect(monitoringConfig({ SENTRY_DSN: dsn, SENTRY_TRACES_SAMPLE_RATE: '7' })?.tracesSampleRate).toBe(1);
    expect(monitoringConfig({ SENTRY_DSN: dsn, SENTRY_TRACES_SAMPLE_RATE: '-3' })?.tracesSampleRate).toBe(0);
    expect(monitoringConfig({ SENTRY_DSN: dsn, SENTRY_TRACES_SAMPLE_RATE: 'abc' })?.tracesSampleRate).toBe(0);
    expect(monitoringConfig({ SENTRY_DSN: dsn, NODE_ENV: 'test', SENTRY_ENABLE_IN_TEST: 'true' })).not.toBeNull();
    expect(monitoringConfig({ SENTRY_DSN: 'http://k@127.0.0.1:9000/1', NODE_ENV: 'development' })?.environment).toBe('development');
  });
});
