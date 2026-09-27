import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { AuditAction } from '@/lib/audit';
import type { auditLog } from '@database/schemas';

/**
 * Signatures des doubles, lues dans les modules mockés — jamais redéclarées à la
 * main.
 *
 * Ce contrat n'est pas cosmétique, il est structurel : sans signature déclarée,
 * `vi.fn(() => …)` infère une fonction à *zéro* argument. Trois erreurs en
 * découlent mécaniquement — passer un argument à un tel mock est un `ts(2554)`,
 * une factory `(...args: unknown[]) => mock(...args)` déverse un `unknown[]`
 * que le typage refuse faute de type tuple (`ts(2556)`), et `mock.calls` est
 * typé `[][]`, donc `call[0]` n'existe pas. Déclarer la signature sur la
 * constante qui porte le mock supprime les trois causes à la racine, sans `any`,
 * sans `@ts-ignore`, sans cast. Même correction que celle déjà appliquée dans
 * tests/unit/search-fts.test.ts, où le même défaut existait.
 */

/** `auth.api.getSession`, telle que typée par le module mocké. */
type GetSession = (typeof import('@/lib/auth'))['auth']['api']['getSession'];
/** Unique argument que src/middleware.ts lui passe : `{ headers }`. */
type GetSessionOptions = Parameters<GetSession>[0];

/**
 * Surface de persistance réellement consommée par `logAuditEvent` :
 * `getDrizzle().insert(auditLog).values(row)`.
 *
 * La ligne est le type d'insertion de la table — pas un `Record` libre : c'est
 * la garantie que la ligne observée est bien celle que la base aurait reçue. Le
 * récepteur de `values` est une promesse opaque parce que `logAuditEvent`
 * l'attend et jette son résultat : seule la ligne est observée ici.
 */
type AuditRow = typeof auditLog.$inferInsert;
type AuditValues = (row: AuditRow) => Promise<unknown>;
type AuditInsert = (table: typeof auditLog) => { values: AuditValues };

/** `mkdir` / `appendFile` de `node:fs/promises`, surcharges comprises. */
type FsPromises = typeof import('node:fs/promises');
type Mkdir = FsPromises['mkdir'];
type AppendFile = FsPromises['appendFile'];

/**
 * `mkdir` est bel et bien *surchargée* dans `node:fs/promises` : l'une de ses
 * trois signatures renvoie `Promise<void>` (options `recursive` absent ou
 * `false`), une autre `Promise<string | undefined>`. Aucune implémentation unique
 * ne peut satisfaire les deux récepteurs à la fois, et un wrapper qui les
 * afficherait tous ne serait pas constructible. Le recorder de la factory rejoue
 * donc l'appel, pas la fonction : ses paramètres et son récepteur sont ceux de
 * la dernière surcharge, extraits mécaniquement du type du module. Le double, lui,
 * conserve la signature complète — c'est elle qui fait foi sur l'arity.
 *
 * `logAuditEvent` appelle `mkdir(logsDir, { recursive: true, mode: 0o700 })` puis
 * enchaîne sur `appendFile` sans jamais lire le résultat : le récepteur observé
 * est donc le seul point où cette réduction de signature est observable, et il
 * est déjà couvert par « une panne du journal… repli disque ».
 */
type MkdirParams = Parameters<Mkdir>;
type MkdirRecorder = (path: MkdirParams[0], options?: MkdirParams[1]) => ReturnType<Mkdir>;

vi.mock('astro:middleware', () => ({
  defineMiddleware: (fn: unknown) => fn,
}));

const getSessionMock = vi.fn<GetSession>();

// Référence différée à getSessionMock : la factory est évaluée à l'import du
// module mocké, avant l'initialisation de la constante du fichier de test. Le
// report porte sur la *lecture* de la constante — celle-ci n'a lieu que dans le
// corps de la flèche, à l'appel — et jamais sur la forme de la constante. D'où
// des paramètres nommés plutôt qu'un spread : l'arity est alors vérifiée par le
// compilateur, et l'appel reste identique à celui du module réel.
vi.mock('@/lib/auth', () => ({
  auth: {
    api: {
      getSession: (options: GetSessionOptions) => getSessionMock(options),
      userHasPermission: async () => ({ success: true }),
    },
  },
}));

// ─── Capture à la frontière de persistance, pas au-dessus ───────────────────
// `@/lib/audit` n'est PAS mocké : `logAuditEvent` et son `safeMetadata` réels
// s'exécutent, et l'observation se fait sur la ligne que la base aurait reçue
// (`insert().values(row)`). C'est la frontière la plus externe de l'événement :
// un test qui n'observerait qu'un `logAuditEvent` mocké laisserait passer une
// régression de sérialisation des métadonnées. Harnais aligné sur
// tests/unit/audit-fallback.test.ts, qui mocke les mêmes deux modules.
//
// `insert` DOIT renvoyer `{ values }` : sinon `db.insert(…).values(…)` lève,
// `logAuditEvent` avale l'erreur et écrit dans `logs/audit-fallback-*.jsonl`,
// et l'événement observé ici n'existerait pas. Le test le détecte (voir
// `onlyRow`), mais surtout la suite n'écrit aucun fichier.
const valuesMock = vi.fn<AuditValues>(() => Promise.resolve());
const insertMock = vi.fn<AuditInsert>(() => ({ values: valuesMock }));

vi.mock('@database/drizzle', () => ({
  getDrizzle: vi.fn(() => ({ insert: (table: typeof auditLog) => insertMock(table) })),
}));

vi.mock('@database/schemas', () => ({
  auditLog: {},
}));

// `logAuditEvent` avale toute erreur d'écriture et se replie sur un fichier
// `logs/audit-fallback-*.jsonl`. Ce repli est ici neutralisé : un test ne doit
// pas laisser d'artefact sur le disque de la machine, et `mkdir`/`appendFile`
// deviennent observables — le passage par la base devient prouvable.
const mkdirMock = vi.fn<Mkdir>(async () => undefined);
const appendFileMock = vi.fn<AppendFile>(async () => undefined);

vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal<FsPromises>();
  // Les deux wrappers sont annotés : leurs paramètres viennent du type du
  // module, jamais d'une liste réécrite à la main. L'arity observée est donc
  // celle de `node:fs/promises`, et non celle — fausse — d'un `vi.fn` sans
  // signature. Les références aux mocks sont différées : la factory est évaluée
  // à l'import du module mocké, avant l'initialisation des constantes de ce
  // fichier, et la lecture n'a lieu qu'à l'appel.
  const mkdir: MkdirRecorder = (path, options) => mkdirMock(path, options);
  const appendFile: AppendFile = (path, data, options) => appendFileMock(path, data, options);
  return { ...actual, mkdir, appendFile };
});

import { onRequest } from '@/middleware';

/**
 * Surface du contexte réellement consommée par src/middleware.ts. `url` n'est
 * pas une copie indépendante : Astro le définit comme `new URL(request.url)`, le
 * double le dérive donc de la même request — c'est cette request que
 * `detectRejectedForwardedHeader` compare à l'URL résolue.
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

/**
 * L'action est liée à l'union `AuditAction` de src/lib/audit.ts : si l'union
 * perd ce membre, ce fichier ne compile plus. Le même mécanisme que
 * `FORWARDED_PROXY_HEADER_REJECTED` dans src/middleware.ts.
 */
const PROXY_REJECTED: AuditAction = 'INFRA_PROXY_HEADER_REJECTED';

/** Adresse de socket observée par le serveur derrière le proxy. */
const SOCKET_ADDRESS = '203.0.113.1';

/** Hôte et protocole réellement résolus : ceux de l'URL de la requête. */
const RESOLVED_HOST = 'localhost:4321';
const RESOLVED_PROTOCOL = 'http:';

/**
 * Requête entrante : l'URL porte le site configuré, donc un en-tête de proxy
 * « déjà appliqué » a une valeur à laquelle le produit peut legitimately
 * ressembler. `security.allowedDomains` dérive de `SITE_URL` : la même variable
 * est donc ancrée, sinon `configuredSiteHost` dépendrait de la machine.
 */
const SITE_ORIGIN = 'http://localhost:4321';

const FIXED_REQUEST_ID = '123e4567-e89b-42d3-a456-426614174000';

/** En-têtes de requête qu'aucun code ne doit lire : secrets de l'appelant. */
const NEVER_READ_HEADERS: ReadonlyArray<readonly [string, string]> = [
  ['authorization', 'Bearer secret-presentation-AAA'],
  ['cookie', 'atlaselle_session=secret-cookie-BBB'],
  ['x-api-key', 'secret-api-key-CCC'],
];

function ctx(path: string, headers: Record<string, string> = {}) {
  const next = vi.fn(async () => new Response('OK', { status: 200 }));
  const rewrite = vi.fn((p: string) => new Response(`rewritten:${p}`, { status: 200 }));
  const request = new Request(`${SITE_ORIGIN}${path}`, { headers: new Headers(headers) });
  const context: TestContext = {
    request,
    url: new URL(request.url),
    clientAddress: SOCKET_ADDRESS,
    locals: {},
    rewrite,
  };
  return { context, next, rewrite };
}

/** Lignes d'audit réellement persistées : l'objet observé, pas une réimplémentation. */
function auditRows(): Record<string, unknown>[] {
  return valuesMock.mock.calls.map(([row]) => row);
}

function onlyRow(): Record<string, unknown> {
  const rows = auditRows();
  expect(rows).toHaveLength(1);
  // Une ligne observée sans erreur de journalisation ET sans repli disque : le
  // passage par la base a réussi. Si le harnais de test lui-même avait cassé,
  // `logAuditEvent` aurait avalé l'exception et écrit un fichier au lieu de
  // produire une ligne — l'événement observé n'existerait pas.
  expect(consoleErrorSpy).not.toHaveBeenCalled();
  expect(appendFileMock).not.toHaveBeenCalled();
  return rows[0];
}

function onlyMetadata(): Record<string, unknown> {
  const metadata = onlyRow().metadata;
  expect(metadata).toBeTypeOf('object');
  expect(metadata).not.toBeNull();
  return metadata as Record<string, unknown>;
}

let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.clearAllMocks();
  valuesMock.mockImplementation(() => Promise.resolve());
  mkdirMock.mockImplementation(async () => undefined);
  appendFileMock.mockImplementation(async () => undefined);
  getSessionMock.mockResolvedValue(null);
  // Détecte un harnais cassé : `logAuditEvent` journalise sur console.error avant
  // d'écrire son fichier de repli, et l'audit deviendrait alors invisible.
  consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  // extractIp ne lit x-forwarded-for / x-real-ip que si TRUST_PROXY vaut "true" :
  // sans ancrage, l'ipAddress de l'événement dépendrait de l'environnement
  // ambiant. Aucune requête de ce fichier ne porte ces en-têtes, l'adresse de
  // socket observée est donc la seule source, et elle est déterministe.
  vi.stubEnv('TRUST_PROXY', 'true');
  vi.stubEnv('SITE_URL', SITE_ORIGIN);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe('INFRA_PROXY_HEADER_REJECTED — un en-tête transféré rejeté est journalisé', () => {
  it('émet exactement un événement quand x-forwarded-host est présent et non appliqué', async () => {
    const { context, next } = ctx('/en/trips', {
      'x-forwarded-host': 'evil.example.com',
      'x-request-id': FIXED_REQUEST_ID,
    });

    const res = await handle(context, next);

    // La requête est servie normalement : le journal est un effet de bord, pas
    // une condition d'accès.
    expect(res.status).toBe(200);
    expect(insertMock).toHaveBeenCalledTimes(1);
    expect(valuesMock).toHaveBeenCalledTimes(1);

    const row = onlyRow();
    expect(row.action).toBe(PROXY_REJECTED);
    expect(row.resource).toBe('infra');
    expect(row.resourceId).toBe('forwarded-headers');
    // Aucun utilisateur n'est authentifié à ce stade du middleware.
    expect(row.userId).toBeNull();

    const metadata = onlyMetadata();
    expect(metadata.header).toBe('x-forwarded-host');
    expect(metadata.reason).toBe('not_applied');
    expect(metadata.forwardedValue).toBe('evil.example.com');
    // L'URL effectivement résolue : c'est elle qui sert de référence au rejet.
    expect(metadata.resolvedHost).toBe(RESOLVED_HOST);
    expect(metadata.resolvedProtocol).toBe(RESOLVED_PROTOCOL);
    expect(metadata.configuredSiteHost).toBe('localhost');
    expect(metadata.requestId).toBe(FIXED_REQUEST_ID);

    // L'identité réseau de l'appelant est résolue, pas celle du proxy.
    expect(row.ipAddress).toBe(SOCKET_ADDRESS);
  });

  it('n’émet rien sur le chemin heureux (aucun en-tête transféré)', async () => {
    const { context, next } = ctx('/en/trips');

    const res = await handle(context, next);

    expect(res.status).toBe(200);
    expect(valuesMock).not.toHaveBeenCalled();
  });

  it('n’émet rien quand x-forwarded-host est déjà appliqué', async () => {
    const { context, next } = ctx('/en/trips', { 'x-forwarded-host': RESOLVED_HOST });

    await handle(context, next);

    expect(valuesMock).not.toHaveBeenCalled();
  });

  it('n’émet rien quand x-forwarded-proto est déjà appliqué', async () => {
    const { context, next } = ctx('/en/trips', { 'x-forwarded-proto': 'http' });

    await handle(context, next);

    expect(valuesMock).not.toHaveBeenCalled();
  });

  it('n’émet rien quand les deux en-têtes sont présents ET déjà appliqués', async () => {
    const { context, next } = ctx('/en/trips', {
      'x-forwarded-host': RESOLVED_HOST,
      'x-forwarded-proto': 'http',
    });

    await handle(context, next);

    expect(valuesMock).not.toHaveBeenCalled();
  });

  it('n’émet rien sur une liste d’en-têtes transférés à plusieurs valeurs déjà appliqués', async () => {
    const { context, next } = ctx('/en/trips', {
      'x-forwarded-host': `${RESOLVED_HOST}, ${RESOLVED_HOST}`,
      'x-forwarded-proto': 'http, http',
    });

    await handle(context, next);

    // Seule la première valeur est significative pour une chaîne de proxy : les
    // suivantes ne doivent pas produire un rejet ni un second événement.
    expect(valuesMock).not.toHaveBeenCalled();
  });

  it('émet un seul événement quand les deux en-têtes sont rejetés', async () => {
    const { context, next } = ctx('/en/trips', {
      'x-forwarded-host': 'evil.example.com',
      'x-forwarded-proto': 'https',
      'x-request-id': FIXED_REQUEST_ID,
    });

    await handle(context, next);

    // Un rejet par requête, pas un rejet par en-tête : la sortie est tronquée au
    // premier en-tête refusé.
    expect(insertMock).toHaveBeenCalledTimes(1);
    expect(valuesMock).toHaveBeenCalledTimes(1);
    const metadata = onlyMetadata();
    expect(metadata.header).toBe('x-forwarded-host');
    expect(metadata.reason).toBe('not_applied');
  });

  it('émet un seul événement quand seul x-forwarded-proto est rejeté', async () => {
    const { context, next } = ctx('/en/trips', {
      'x-forwarded-host': RESOLVED_HOST,
      'x-forwarded-proto': 'https',
    });

    await handle(context, next);

    expect(valuesMock).toHaveBeenCalledTimes(1);
    const metadata = onlyMetadata();
    expect(metadata.header).toBe('x-forwarded-proto');
    expect(metadata.reason).toBe('not_applied');
    // Le protocole refusé est journalisé sous sa forme normalisée, incluse le
    // séparateur, et l'hôte appliqué n'est pas réémis comme valeur refusée.
    expect(metadata.forwardedValue).toBe('https:');
  });

  it('émet un seul événement sur une sortie précoce (404 de locale invalide)', async () => {
    const { context, next } = ctx('/xx/trips', { 'x-forwarded-host': 'evil.example.com' });

    const res = await handle(context, next);

    // Le signalement précède la chaîne de requête : un rejet d'en-tête ne peut
    // pas disparaître parce que la requête n'a pas été rendue.
    expect(res.status).toBe(404);
    expect(next).not.toHaveBeenCalled();
    expect(valuesMock).toHaveBeenCalledTimes(1);
    expect(onlyRow().action).toBe(PROXY_REJECTED);
  });

  it('n’émet qu’un seul événement par requête, même sur plusieurs requêtes distinctes', async () => {
    const first = ctx('/en/trips', { 'x-forwarded-host': 'evil.example.com' });
    const second = ctx('/fr/trips', { 'x-forwarded-host': 'also-evil.example.com' });

    await handle(first.context, first.next);
    await handle(second.context, second.next);

    expect(valuesMock).toHaveBeenCalledTimes(2);
    const serialized = JSON.stringify(auditRows());
    expect(serialized).toContain('evil.example.com');
    expect(serialized).toContain('also-evil.example.com');
  });

  it('une panne du journal ne transforme pas la réponse en erreur', async () => {
    valuesMock.mockImplementation(() => Promise.reject(new Error('audit table unavailable')));
    const { context, next } = ctx('/en/trips', { 'x-forwarded-host': 'evil.example.com' });

    const res = await handle(context, next);

    // Le rejet du journal est absorbé : une indisponibilité d'audit ne doit pas
    // rendre le site indisponible. La tentative reste observable, et le repli
    // disque de `logAuditEvent` est bien emprunté — c'est lui qui empêche la
    // perte de l'événement, pas son absence.
    expect(res.status).toBe(200);
    expect(valuesMock).toHaveBeenCalledTimes(1);
    expect(consoleErrorSpy).toHaveBeenCalled();
    await vi.waitFor(() => expect(appendFileMock).toHaveBeenCalledTimes(1));
  });
});

describe('INFRA_PROXY_HEADER_REJECTED — la valeur brute n’est jamais journalisée', () => {
  it('purge les caractères non hôtes d’une valeur d’hôte légitime', async () => {
    // Un hôte IPv6 est un hôte valide : la normalisation le conserve, crochets
    // compris. La purge les retire — la valeur rapportée diffère donc de la
    // valeur brute transmise par le proxy.
    const raw = '[2001:db8::1]';
    const { context, next } = ctx('/en/trips', { 'x-forwarded-host': raw });

    await handle(context, next);

    const metadata = onlyMetadata();
    expect(metadata.forwardedValue).toBe('2001:db8::1');
    // Ensemble des caractères autorisés par la purge : ni crochet ni aucun autre.
    expect(metadata.forwardedValue).toMatch(/^[a-z0-9.:_-]*$/);
    // La valeur brute, crochets comprise, n'apparaît nulle part dans le rapport.
    expect(JSON.stringify(metadata)).not.toContain(raw);
  });

  it('borne la valeur d’hôte refusée à 128 caractères', async () => {
    const raw = `${'a'.repeat(200)}.example.com`;
    const { context, next } = ctx('/en/trips', { 'x-forwarded-host': raw });

    await handle(context, next);

    const metadata = onlyMetadata();
    expect(metadata.forwardedValue).toBeTypeOf('string');
    expect(String(metadata.forwardedValue)).toHaveLength(128);
    expect(JSON.stringify(metadata)).not.toContain(raw);
  });

  it('borne la valeur de protocole refusée à 128 caractères', async () => {
    const raw = 'a'.repeat(300);
    const { context, next } = ctx('/en/trips', { 'x-forwarded-proto': raw });

    await handle(context, next);

    const metadata = onlyMetadata();
    expect(metadata.header).toBe('x-forwarded-proto');
    expect(String(metadata.forwardedValue)).toHaveLength(128);
    expect(JSON.stringify(metadata)).not.toContain(raw);
  });

  it('journalise un hôte malformé sans aucune valeur brute', async () => {
    const raw = 'evil.example.com/../admin';
    const { context, next } = ctx('/en/trips', { 'x-forwarded-host': raw });

    await handle(context, next);

    const metadata = onlyMetadata();
    expect(metadata.header).toBe('x-forwarded-host');
    expect(metadata.reason).toBe('malformed');
    // Une valeur qui ne peut pas être normalisée n'est jamais rapportée, même
    // purgée : elle ne se distingue pas d'une entrée hostile.
    expect(metadata.forwardedValue).toBeNull();
    expect(JSON.stringify(metadata)).not.toContain(raw);
  });

  it('journalise un protocole malformé sans aucune valeur brute', async () => {
    const raw = 'ht tp';
    const { context, next } = ctx('/en/trips', { 'x-forwarded-proto': raw });

    await handle(context, next);

    const metadata = onlyMetadata();
    expect(metadata.header).toBe('x-forwarded-proto');
    expect(metadata.reason).toBe('malformed');
    expect(metadata.forwardedValue).toBeNull();
    expect(JSON.stringify(metadata)).not.toContain(raw);
  });

  it('purge la casse de la valeur d’hôte refusée', async () => {
    const raw = 'EVIL.Example.com';
    const { context, next } = ctx('/en/trips', { 'x-forwarded-host': raw });

    await handle(context, next);

    const metadata = onlyMetadata();
    expect(metadata.forwardedValue).toBe('evil.example.com');
    expect(JSON.stringify(metadata)).not.toContain(raw);
  });
});

describe('INFRA_PROXY_HEADER_REJECTED — aucun secret d’en-tête n’est lu ni rapporté', () => {
  it('n’émet rien quand seuls des en-têtes de secrets sont présents', async () => {
    const headers = Object.fromEntries(NEVER_READ_HEADERS);
    const { context, next } = ctx('/en/trips', headers);

    const res = await handle(context, next);

    // authorization, cookie et x-api-key ne sont pas des entrées de détection :
    // leur présence seule ne produit aucun signalement.
    expect(res.status).toBe(200);
    expect(valuesMock).not.toHaveBeenCalled();
  });

  it('ne fuit aucun des trois secrets dans la ligne d’audit', async () => {
    const { context, next } = ctx('/en/trips', {
      'x-forwarded-host': 'evil.example.com',
      ...Object.fromEntries(NEVER_READ_HEADERS),
    });

    await handle(context, next);

    expect(valuesMock).toHaveBeenCalledTimes(1);
    const serialized = JSON.stringify(onlyRow());
    for (const [, value] of NEVER_READ_HEADERS) {
      expect(serialized).not.toContain(value);
    }
  });

  it('n’ajoute aucun champ aux métadonnées du fait de ces trois en-têtes', async () => {
    const reference = ctx('/en/trips', {
      'x-forwarded-host': 'evil.example.com',
      'x-request-id': FIXED_REQUEST_ID,
    });
    await handle(reference.context, reference.next);
    const referenceRow = onlyRow();

    valuesMock.mockClear();
    insertMock.mockClear();

    const withSecrets = ctx('/en/trips', {
      'x-forwarded-host': 'evil.example.com',
      'x-request-id': FIXED_REQUEST_ID,
      ...Object.fromEntries(NEVER_READ_HEADERS),
    });
    await handle(withSecrets.context, withSecrets.next);
    const withSecretsRow = onlyRow();

    // Les deux requêtes ne diffèrent que par ces trois en-têtes : l'événement
    // produit doit être identique, au bit près. Le requestId est ancré par un
    // UUID entrant valide, donc il ne varie pas non plus.
    expect(withSecretsRow).toEqual(referenceRow);
  });

  it('n’écrit que les faits de l’infrastructure : ensemble de clés fermé', async () => {
    const { context, next } = ctx('/en/trips', {
      'x-forwarded-host': 'evil.example.com',
      ...Object.fromEntries(NEVER_READ_HEADERS),
    });

    await handle(context, next);

    // Clés de la ligne produites par logAuditEvent : ni utilisateur, ni
    // User-Agent, ni en-tête de requête. Un champ supplémentaire ne peut pas
    // apparaître sans casser cette assertion.
    expect(Object.keys(onlyRow()).sort()).toEqual([
      'action',
      'ipAddress',
      'metadata',
      'resource',
      'resourceId',
      'userAgent',
      'userId',
    ]);

    // Clés des métadonnées : les six faits du rejet plus la corrélation. C'est
    // la garantie structurelle derrière « authorization/cookie/x-api-key ne
    // sont jamais lus » : il n'existe aucun emplacement où les loguer.
    expect(Object.keys(onlyMetadata()).sort()).toEqual([
      'configuredSiteHost',
      'forwardedValue',
      'header',
      'reason',
      'requestId',
      'resolvedHost',
      'resolvedProtocol',
    ]);
  });
});
