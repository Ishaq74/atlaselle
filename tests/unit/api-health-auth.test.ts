import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ─── Isolation des dépendances de la sonde ──────────────────────────────────
// `GET /api/health` ne lit que `request`. Tout ce qui décide du statut de santé
// — la base, la configuration SMTP, l'accès au dossier d'uploads, les
// statistiques de cache — est simulé : le résultat ne doit dépendre ni d'une
// base vivante, ni du disque de la machine, ni du .env local.
const checkConnectionMock = vi.fn();
const checkSmtpConfigMock = vi.fn();
const getCacheStatsMock = vi.fn();
const accessMock = vi.fn();

vi.mock('@database/drizzle', () => ({
  checkConnection: (...args: unknown[]) => checkConnectionMock(...args),
}));

vi.mock('@database/cache', () => ({
  getCacheStats: (...args: unknown[]) => getCacheStatsMock(...args),
}));

vi.mock('@/smtp/env', () => ({
  checkSmtpConfig: (...args: unknown[]) => checkSmtpConfigMock(...args),
}));

// `access` est la seule lecture disque de la route ; `constants` est conservé
// depuis le module réel pour que `constants.W_OK` reste la vraie valeur.
vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs/promises')>();
  return { ...actual, access: (...args: unknown[]) => accessMock(...args) };
});

type HealthGet = (context: { request: Request }) => Promise<Response>;

/**
 * Jeton de la sonde. Volontairement distinct de toute autre valeur de la suite
 * pour qu'un accès accordé ne puisse pas être accidentellement satisfait.
 */
const HEALTH_TOKEN = 'pr0be-t0ken-7f3a';
const BEARER = `Bearer ${HEALTH_TOKEN}`;

/**
 * La route lit `process.env.HEALTH_TOKEN` au chargement du module, pas à chaque
 * requête. Chaque cas charge donc un module neuf : `vi.resetModules()` vide le
 * registre, `vi.stubEnv` écrit la variable, et passer `undefined` la SUPPRIME —
 * le cas « non configuré » ne peut pas être simulé avec une chaîne vide. Sans
 * cet ancrage, le résultat dépendrait d'un HEALTH_TOKEN éventuellement présent
 * sur la machine ou dans le .env, et le cas « refus » pourrait devenir un 200.
 */
async function loadHealthGet(token: string | undefined): Promise<HealthGet> {
  vi.resetModules();
  vi.stubEnv('HEALTH_TOKEN', token);
  const { GET } = await import('@/pages/api/health');
  return GET as unknown as HealthGet;
}

function healthContext(headers: Record<string, string> = {}) {
  return { request: new Request('http://localhost:4321/api/health', { headers: new Headers(headers) }) };
}

/** Corps JSON réellement produit par la route. */
async function readPayload(response: Response): Promise<Record<string, unknown>> {
  return (await response.json()) as Record<string, unknown>;
}

beforeEach(() => {
  vi.clearAllMocks();
  // Le module journalise explicitement l'absence de HEALTH_TOKEN au chargement,
  // et la route journalise ses propres erreurs : le bruit ne fait pas partie du
  // contrat observé ici.
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  // Sonde pleinement saine par défaut : `allOk` vrai, statut 200.
  checkConnectionMock.mockResolvedValue({ ok: true, latency: 1 });
  checkSmtpConfigMock.mockReturnValue({ ok: true, provider: 'NODEMAILER' });
  getCacheStatsMock.mockReturnValue({ size: 0, hits: 0, misses: 0, inflight: 0 });
  accessMock.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  vi.resetModules();
});

describe('GET /api/health — refus par défaut', () => {
  it('refuse sans en-tête Authorization', async () => {
    const getHealth = await loadHealthGet(HEALTH_TOKEN);

    const response = await getHealth(healthContext());

    expect(response.status).toBe(401);
    // Le corps ne révèle que le refus : ni version, ni état de dépendance.
    expect(await readPayload(response)).toEqual({ error: 'Unauthorized' });
    // La porte est franchie avant toute sonde : un refus ne coûte aucune requête.
    expect(checkConnectionMock).not.toHaveBeenCalled();
    expect(checkSmtpConfigMock).not.toHaveBeenCalled();
    expect(accessMock).not.toHaveBeenCalled();
  });

  it('refuse un X-Forwarded-For forgé sur l’adresse de loopback IPv4', async () => {
    const getHealth = await loadHealthGet(HEALTH_TOKEN);

    const response = await getHealth(healthContext({ 'x-forwarded-for': '127.0.0.1' }));

    // Un port exposé n'est pas un loopback : l'en-tête est décidé par l'appelant.
    expect(response.status).toBe(401);
    expect(await readPayload(response)).toEqual({ error: 'Unauthorized' });
    expect(checkConnectionMock).not.toHaveBeenCalled();
  });

  it('refuse un X-Forwarded-For forgé sur l’adresse de loopback IPv6', async () => {
    const getHealth = await loadHealthGet(HEALTH_TOKEN);

    const response = await getHealth(healthContext({ 'x-forwarded-for': '::1' }));

    expect(response.status).toBe(401);
    expect(await readPayload(response)).toEqual({ error: 'Unauthorized' });
    expect(checkConnectionMock).not.toHaveBeenCalled();
  });

  it('refuse un X-Real-IP forgé sur l’adresse de loopback', async () => {
    const getHealth = await loadHealthGet(HEALTH_TOKEN);

    const response = await getHealth(healthContext({ 'x-real-ip': '127.0.0.1' }));

    expect(response.status).toBe(401);
    expect(await readPayload(response)).toEqual({ error: 'Unauthorized' });
    expect(checkConnectionMock).not.toHaveBeenCalled();
  });

  it('marque le refus comme non cachable', async () => {
    const getHealth = await loadHealthGet(HEALTH_TOKEN);

    const response = await getHealth(healthContext());

    expect(response.status).toBe(401);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(response.headers.get('Content-Type')).toBe('application/json');
  });

  it('refuse un schéma d’autorisation autre que Bearer', async () => {
    const getHealth = await loadHealthGet(HEALTH_TOKEN);

    const response = await getHealth(healthContext({ authorization: `Basic ${HEALTH_TOKEN}` }));

    expect(response.status).toBe(401);
    expect(await readPayload(response)).toEqual({ error: 'Unauthorized' });
  });

  it('refuse un en-tête Bearer sans credential', async () => {
    const getHealth = await loadHealthGet(HEALTH_TOKEN);

    // Un schéma sans rien derrière ne porte aucun secret et ne peut pas être une
    // présentation valide. Note d'honnêteté : la normalisation des en-têtes de
    // `Headers` retire les espaces de fin, l'en-tête observé est donc `Bearer`
    // et la branche interne « credential vide » n'est pas atteignable depuis la
    // surface HTTP. Ce test verrouille le comportement observable, pas la
    // couverture de cette branche.
    const response = await getHealth(healthContext({ authorization: 'Bearer ' }));

    expect(response.status).toBe(401);
    expect(await readPayload(response)).toEqual({ error: 'Unauthorized' });
    expect(checkConnectionMock).not.toHaveBeenCalled();
  });

  it('refuse un jeton qui n’est pas celui configuré', async () => {
    const getHealth = await loadHealthGet(HEALTH_TOKEN);

    const response = await getHealth(healthContext({ authorization: 'Bearer pr0be-t0ken-0000' }));

    expect(response.status).toBe(401);
    expect(await readPayload(response)).toEqual({ error: 'Unauthorized' });
    expect(checkConnectionMock).not.toHaveBeenCalled();
  });

  it('refuse un préfixe Bearer dont la casse diffère', async () => {
    const getHealth = await loadHealthGet(HEALTH_TOKEN);

    const response = await getHealth(healthContext({ authorization: `bearer ${HEALTH_TOKEN}` }));

    // Le schéma d'autorisation est un préfixe exact : `bearer` n'est pas `Bearer`.
    expect(response.status).toBe(401);
    expect(await readPayload(response)).toEqual({ error: 'Unauthorized' });
  });
});

describe('GET /api/health — HEALTH_TOKEN non configuré', () => {
  it('refuse tout appelant, même présentant un Bearer quelconque', async () => {
    const getHealth = await loadHealthGet(undefined);

    const response = await getHealth(healthContext({ authorization: `Bearer ${HEALTH_TOKEN}` }));

    // Aucun jeton configuré, aucune présentation ne peut être valide : le
    // défaut est le refus, pas l'ouverture.
    expect(response.status).toBe(401);
    expect(await readPayload(response)).toEqual({ error: 'Unauthorized' });
    expect(checkConnectionMock).not.toHaveBeenCalled();
  });

  it('refuse un jeton configuré vide, avec et sans en-tête', async () => {
    const getHealth = await loadHealthGet('');

    const withBearer = await getHealth(healthContext({ authorization: 'Bearer x0x0x0' }));
    const withoutHeader = await getHealth(healthContext());

    // Une variable présente mais vide n'est pas un jeton. Le cas le plus
    // dangereux n'est pas le Bearer présenté : c'est l'absence totale
    // d'en-tête, qu'une implémentation traitant « pas de jeton configuré »
    // comme « pas d'authentification requise » laisserait passer en 200.
    expect(withBearer.status).toBe(401);
    expect(await readPayload(withBearer)).toEqual({ error: 'Unauthorized' });
    expect(withoutHeader.status).toBe(401);
    expect(await readPayload(withoutHeader)).toEqual({ error: 'Unauthorized' });
    expect(checkConnectionMock).not.toHaveBeenCalled();
  });
});

describe('GET /api/health — accès accordé', () => {
  it('accorde l’accès et rend la charge utile de sonde avec le bon jeton', async () => {
    const getHealth = await loadHealthGet(HEALTH_TOKEN);

    const response = await getHealth(healthContext({ authorization: BEARER }));

    expect(response.status).toBe(200);
    const payload = await readPayload(response);
    expect(payload.status).toBe('ok');
    expect(payload.db).toEqual({ ok: true });
    expect(payload.smtp).toEqual({ ok: true, provider: 'NODEMAILER' });
    expect(payload.disk).toEqual({ uploadsWritable: true });
    expect(payload.cache).toEqual({ size: 0, hits: 0, misses: 0 });
    expect(payload.version).toBeTypeOf('string');
    expect(payload.uptime).toBeTypeOf('number');
    expect(payload.timestamp).toBeTypeOf('string');
    expect(new Date(String(payload.timestamp)).toISOString()).toBe(payload.timestamp);
    // Le jeton-secret n'est jamais renvoyé, ni dérivé de lui.
    expect(JSON.stringify(payload)).not.toContain(HEALTH_TOKEN);
  });

  it('accorde l’accès quelle que soit l’adresse réseau annoncée', async () => {
    const getHealth = await loadHealthGet(HEALTH_TOKEN);

    const response = await getHealth(
      healthContext({
        authorization: BEARER,
        'x-forwarded-for': '203.0.113.99',
        'x-real-ip': '198.51.100.4',
      }),
    );

    // Un jeton valide reste valide derrière un proxy : l'en-tête d'adresse n'a
    // aucun rôle, ni pour accorder, ni pour retirer l'accès.
    expect(response.status).toBe(200);
    expect((await readPayload(response)).status).toBe('ok');
  });
});

describe('GET /api/health — les chemins 503 appliquent la même règle', () => {
  it('refuse le chemin dégradé sans jeton, sans divulguer l’état', async () => {
    checkConnectionMock.mockResolvedValue({ ok: false, latency: 0, error: 'connection refused' });
    const getHealth = await loadHealthGet(HEALTH_TOKEN);

    const response = await getHealth(healthContext());

    // Un état dégradé ne doit pas devenir une fuite d'information pour un
    // appelant non autorisé : 401 avant 503, et rien du diagnostic en corps.
    expect(response.status).toBe(401);
    const payload = await readPayload(response);
    expect(payload).toEqual({ error: 'Unauthorized' });
    expect(payload).not.toHaveProperty('db');
    expect(payload).not.toHaveProperty('smtp');
    expect(payload).not.toHaveProperty('disk');
    expect(JSON.stringify(payload)).not.toContain('connection refused');
    expect(checkConnectionMock).not.toHaveBeenCalled();
  });

  it('rend 503 dégradé avec le bon jeton', async () => {
    checkConnectionMock.mockResolvedValue({ ok: false, latency: 0 });
    accessMock.mockRejectedValue(new Error('EACCES'));
    const getHealth = await loadHealthGet(HEALTH_TOKEN);

    const response = await getHealth(healthContext({ authorization: BEARER }));

    // La règle d'accès ne change rien à la sémantique de santé : la sonde répond
    // ce qu'elle mesure, à qui elle a décidé de répondre.
    expect(response.status).toBe(503);
    const payload = await readPayload(response);
    expect(payload.status).toBe('degraded');
    expect(payload.db).toEqual({ ok: false });
    expect(payload.smtp).toEqual({ ok: true, provider: 'NODEMAILER' });
    expect(payload.disk).toEqual({ uploadsWritable: false });
  });

  it('refuse le chemin d’erreur 503 sans jeton, sans déclencher la sonde', async () => {
    checkConnectionMock.mockRejectedValue(new Error('pool saturated'));
    const getHealth = await loadHealthGet(HEALTH_TOKEN);

    const response = await getHealth(healthContext());

    expect(response.status).toBe(401);
    expect(await readPayload(response)).toEqual({ error: 'Unauthorized' });
    // Le chemin d'erreur est en aval de la porte : il n'est jamais atteint, donc
    // ni la base n'est sollicitée, ni le cache n'est lu.
    expect(checkConnectionMock).not.toHaveBeenCalled();
    expect(getCacheStatsMock).not.toHaveBeenCalled();
  });

  it('rend 503 error avec le bon jeton quand la sonde lève', async () => {
    checkConnectionMock.mockRejectedValue(new Error('pool saturated'));
    const getHealth = await loadHealthGet(HEALTH_TOKEN);

    const response = await getHealth(healthContext({ authorization: BEARER }));

    expect(response.status).toBe(503);
    const payload = await readPayload(response);
    expect(payload.status).toBe('error');
    expect(payload.db).toEqual({ ok: false });
    expect(payload.smtp).toEqual({ ok: false, provider: 'unknown' });
    expect(payload.disk).toEqual({ uploadsWritable: false });
    // Une défaillance de sonde ne s'expose pas dans le corps : elle est journalisée.
    expect(JSON.stringify(payload)).not.toContain('pool saturated');
  });
});

describe('GET /api/health — comparaison de jetons multi-octets', () => {
  it('refuse un jeton multi-octets de même nombre de caractères que le jeton configuré', async () => {
    // 8 caractères de chaque côté, mais 16 octets pour le présenté : une
    // comparaison directe de tampons de longueurs différentes lèverait, et la
    // route répondrait 500 au lieu de refuser.
    const getHealth = await loadHealthGet('aaaaaaaa');

    const response = await getHealth(healthContext({ authorization: `Bearer ${'é'.repeat(8)}` }));

    expect(response.status).toBe(401);
    expect(await readPayload(response)).toEqual({ error: 'Unauthorized' });
  });

  it('refuse un jeton ASCII quand le jeton configuré est multi-octets', async () => {
    const getHealth = await loadHealthGet('clé-secrète');

    const response = await getHealth(healthContext({ authorization: 'Bearer claaaaaaaa' }));

    expect(response.status).toBe(401);
    expect(await readPayload(response)).toEqual({ error: 'Unauthorized' });
  });

  it('refuse un jeton multi-octets de longueur entièrement différente', async () => {
    const getHealth = await loadHealthGet('clé-secrète');

    const response = await getHealth(healthContext({ authorization: 'Bearer é' }));

    expect(response.status).toBe(401);
    expect(await readPayload(response)).toEqual({ error: 'Unauthorized' });
  });

  it('accorde l’accès à un jeton multi-octets correct', async () => {
    // La longueur-indépendance ne doit pas devenir un refus de tout ce qui est
    // multi-octets : un jeton légitime non-ASCII doit fonctionner.
    const multibyteToken = 'clé-secrète';
    const getHealth = await loadHealthGet(multibyteToken);

    const response = await getHealth(healthContext({ authorization: `Bearer ${multibyteToken}` }));

    expect(response.status).toBe(200);
    expect((await readPayload(response)).status).toBe('ok');
  });
});
