/**
 * Partie PURE du suivi d'erreurs : nettoyage des données personnelles et tri des erreurs attendues.
 * Aucun import du SDK : testable sans réseau, utilisée par `beforeSend` (voir ./index.ts).
 *
 * Principe (RGPD) : un événement d'erreur ne doit transporter ni adresse e-mail, ni téléphone, ni IP,
 * ni cookie, ni en-tête d'autorisation, ni corps de requête, ni jeton. Il garde ce qui sert à diagnostiquer :
 * type d'erreur, pile, chemin sans paramètres, identifiant de requête, identifiant opaque de compte.
 */

const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+/g;
const BEARER_RE = /\b(Bearer|Basic)\s+[A-Za-z0-9._~+/=-]{8,}/gi;
const SECRET_KEY_RE = /\b(?:sk|rk|pk)_(?:live|test)_[A-Za-z0-9]{8,}|\bwhsec_[A-Za-z0-9]{8,}/g;
// "clé=valeur" où la clé évoque un secret : en requête (?a=b&c=d) comme en texte libre (« token=abc »).
const QUERY_SECRET_RE = /\b([\w-]*(?:token|secret|password|passwd|signature|apikey|api_key|session|authorization)[\w-]*=)[^&\s#"']+/gi;
const PHONE_RE = /\+\d[\d .-]{7,}\d/g;
const IPV4_RE = /\b(?:\d{1,3}\.){3}\d{1,3}\b/g;
const IPV6_RE = /\b(?:[A-Fa-f0-9]{1,4}:){4,7}[A-Fa-f0-9]{1,4}\b/g;
const SENSITIVE_KEY_RE = /e-?mail|phone|tel\b|password|passwd|token|secret|authorization|cookie|session|name|address|ip\b|birth|iban|card|dietary|accessib|motivation|expectation|note/i;

export const REDACTED = '[redacted]';

export function redactText(value: string): string {
  return value
    .replace(BEARER_RE, '$1 [token]')
    .replace(SECRET_KEY_RE, '[api-key]')
    .replace(EMAIL_RE, '[email]')
    .replace(QUERY_SECRET_RE, `$1${REDACTED}`)
    .replace(PHONE_RE, '[phone]')
    .replace(IPV6_RE, '[ip]')
    .replace(IPV4_RE, '[ip]');
}

/** Retire la requête et le fragment d'une URL ou d'un chemin (les paramètres peuvent porter des jetons ou des identités). */
export function stripQuery(url: string): string {
  const cut = url.search(/[?#]/);
  return cut === -1 ? url : url.slice(0, cut);
}

const MAX_DEPTH = 4;

/** Parcourt une structure arbitraire : chaînes nettoyées et, si `maskKeys`, valeurs de clés sensibles masquées. */
export function scrubValue(value: unknown, depth = 0, maskKeys = true): unknown {
  if (typeof value === 'string') return redactText(value);
  if (value === null || typeof value !== 'object') return value;
  if (depth >= MAX_DEPTH) return '[truncated]';
  if (Array.isArray(value)) return value.slice(0, 50).map((item) => scrubValue(item, depth + 1, maskKeys));
  const out: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    out[key] = maskKeys && SENSITIVE_KEY_RE.test(key) ? REDACTED : scrubValue(item, depth + 1, maskKeys);
  }
  return out;
}

interface Frame { vars?: unknown; [key: string]: unknown }
interface ExceptionValue { value?: string; stacktrace?: { frames?: Frame[] }; [key: string]: unknown }
interface Crumb { category?: string; message?: string; data?: Record<string, unknown>; [key: string]: unknown }

export interface ScrubbableEvent {
  user?: { id?: unknown; [key: string]: unknown } | null;
  request?: { url?: string; method?: string; headers?: Record<string, unknown>; [key: string]: unknown } | null;
  server_name?: string;
  message?: string;
  logentry?: { message?: string; [key: string]: unknown };
  exception?: { values?: ExceptionValue[] };
  breadcrumbs?: Crumb[];
  extra?: Record<string, unknown>;
  contexts?: Record<string, unknown>;
  tags?: Record<string, unknown>;
  [key: string]: unknown;
}

const KEPT_REQUEST_HEADERS = new Set(['content-type', 'accept-language']);

/**
 * Nettoie un événement avant envoi. Modifie et renvoie l'événement reçu.
 * Utilisée pour `beforeSend` ET `beforeSendTransaction` : ne jamais l'appeler sur autre chose que l'événement du SDK.
 */
export function scrubEvent<T extends ScrubbableEvent>(event: T): T {
  if (event.user) {
    const id = typeof event.user.id === 'string' ? event.user.id : undefined;
    event.user = id ? { id } : null;
  }

  if (event.request) {
    const { method, url, headers } = event.request;
    const kept: Record<string, unknown> = {};
    for (const [name, value] of Object.entries(headers ?? {})) {
      if (KEPT_REQUEST_HEADERS.has(name.toLowerCase())) kept[name] = value;
    }
    event.request = { ...(method ? { method } : {}), ...(typeof url === 'string' ? { url: redactText(stripQuery(url)) } : {}), headers: kept };
  }

  event.server_name = undefined;
  if (typeof event.message === 'string') event.message = redactText(event.message);
  if (event.logentry && typeof event.logentry.message === 'string') event.logentry.message = redactText(event.logentry.message);

  for (const exception of event.exception?.values ?? []) {
    if (typeof exception.value === 'string') exception.value = redactText(exception.value);
    for (const frame of exception.stacktrace?.frames ?? []) delete frame.vars;
  }

  if (event.breadcrumbs) {
    event.breadcrumbs = event.breadcrumbs
      .filter((crumb) => crumb.category !== 'console')
      .map((crumb) => ({
        ...crumb,
        ...(typeof crumb.message === 'string' ? { message: redactText(crumb.message) } : {}),
        ...(crumb.data ? { data: scrubValue(crumb.data) as Record<string, unknown> } : {}),
      }));
  }

  if (event.extra) event.extra = scrubValue(event.extra) as Record<string, unknown>;
  // Contextes d'exécution (os, runtime…) : leurs clés « name » sont techniques, on nettoie seulement les chaînes.
  if (event.contexts) event.contexts = scrubValue(event.contexts, 0, false) as Record<string, unknown>;
  return event;
}

/**
 * Erreurs ATTENDUES (refus métier, validation, droits, limites de débit) : elles font partie du fonctionnement
 * normal et ne doivent pas ouvrir d'incident. Seules les erreurs inattendues (5xx, exceptions) remontent.
 */
const EXPECTED_CODES = new Set([
  'BAD_REQUEST', 'UNAUTHORIZED', 'FORBIDDEN', 'NOT_FOUND', 'METHOD_NOT_SUPPORTED', 'TIMEOUT', 'CONFLICT',
  'PRECONDITION_FAILED', 'PAYLOAD_TOO_LARGE', 'UNSUPPORTED_MEDIA_TYPE', 'UNPROCESSABLE_CONTENT',
  'TOO_MANY_REQUESTS', 'CLIENT_CLOSED_REQUEST',
  // Codes métier du module voyage (src/lib/voyage-codes.ts)
  'APPLICATION_CLOSED', 'APPLICATION_DEADLINE_PASSED', 'APPLICATION_DUPLICATE', 'APPLICATION_EMAIL_CONFLICT',
  'DEPARTURE_SOLD_OUT', 'CHECKOUT_EXPIRED', 'PAYMENT_FAILED', 'PAYMENT_AMOUNT_MISMATCH', 'RESERVATION_ALREADY_CONFIRMED',
]);

export function isExpectedError(error: unknown): boolean {
  if (error === null || typeof error !== 'object') return false;
  const candidate = error as { code?: unknown; type?: unknown };
  if (candidate.type === 'AstroActionInputError') return true;
  return typeof candidate.code === 'string' && EXPECTED_CODES.has(candidate.code);
}
