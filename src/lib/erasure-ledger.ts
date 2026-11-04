/**
 * Registre d'effacements RGPD, HORS base de données.
 *
 * Pourquoi : une restauration de sauvegarde ramène les données telles qu'elles étaient à la date
 * du dump, y compris celles d'une personne dont l'effacement a été traité depuis. La trace de cet
 * effacement (table `audit_log`) est dans la même base et disparaît avec elle. Ce fichier survit
 * à la restauration et permet de rejouer les effacements (`pnpm db:replay-erasures`).
 *
 * Contenu : un identifiant opaque (id de dossier ou de compte), la date, le type d'effacement,
 * l'acteur. JAMAIS d'e-mail, de nom ni de téléphone : la ligne ne ressuscite aucune donnée.
 *
 * Format : ndjson, une ligne par effacement, somme de contrôle SHA-256 par ligne (détecte
 * corruption et écriture partielle ; une troncature à la fin n'est pas détectable : le fichier
 * doit être sauvegardé, voir docs/database/erasure-ledger.md). Jamais purgé par `logs.rotate`.
 */
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, open, readFile } from 'node:fs/promises';
import path from 'node:path';

export const ERASURE_KINDS = ['traveler.anonymize', 'user.delete'] as const;
export type ErasureKind = (typeof ERASURE_KINDS)[number];

export const ERASURE_SOURCES = ['action', 'hook', 'audit-import'] as const;
export type ErasureSource = (typeof ERASURE_SOURCES)[number];

export interface ErasureEntry {
  v: 1;
  id: string;
  at: string;
  kind: ErasureKind;
  subject: string;
  actor: string | null;
  source: ErasureSource;
  sum: string;
}

export interface ErasureInput {
  kind: ErasureKind;
  subject: string;
  actor?: string | null;
  source: ErasureSource;
  /** Date de l'effacement d'origine (import d'audit) ; par défaut maintenant. */
  at?: Date;
}

const SUBJECT_RE = /^[A-Za-z0-9_-]{1,64}$/;
const DEFAULT_RELATIVE = path.join('data', 'erasure-ledger.ndjson');

/** `null` = désactivé (tests sans chemin explicite : ne jamais écrire dans le dépôt). */
export function ledgerPath(env: NodeJS.ProcessEnv = process.env, cwd: string = process.cwd()): string | null {
  const explicit = env.ERASURE_LEDGER_PATH?.trim();
  if (explicit) return path.resolve(cwd, explicit);
  if (env.NODE_ENV === 'test') return null;
  return path.resolve(cwd, DEFAULT_RELATIVE);
}

export function checksum(entry: Omit<ErasureEntry, 'sum'>): string {
  const canonical = [entry.v, entry.id, entry.at, entry.kind, entry.subject, entry.actor ?? '', entry.source].join('|');
  return createHash('sha256').update(canonical, 'utf8').digest('hex');
}

export function buildEntry(input: ErasureInput, id: string = randomUUID()): ErasureEntry {
  if (!(ERASURE_KINDS as readonly string[]).includes(input.kind)) throw new Error(`Type d'effacement inconnu : ${input.kind}`);
  if (!(ERASURE_SOURCES as readonly string[]).includes(input.source)) throw new Error(`Source inconnue : ${input.source}`);
  if (!SUBJECT_RE.test(input.subject)) throw new Error('Identifiant de personne invalide (attendu : identifiant opaque, jamais une donnée personnelle).');
  const actor = input.actor ?? null;
  if (actor !== null && !SUBJECT_RE.test(actor)) throw new Error("Identifiant d'acteur invalide.");
  const base = { v: 1 as const, id, at: (input.at ?? new Date()).toISOString(), kind: input.kind, subject: input.subject, actor, source: input.source };
  return { ...base, sum: checksum(base) };
}

export interface ParsedLedger {
  entries: ErasureEntry[];
  problems: string[];
}

export function parseLedger(text: string): ParsedLedger {
  const entries: ErasureEntry[] = [];
  const problems: string[] = [];
  const lines = text.split('\n');
  const endsWithNewline = text.endsWith('\n');
  lines.forEach((raw, index) => {
    const line = raw.trim();
    if (!line) return;
    const label = `ligne ${index + 1}`;
    if (!endsWithNewline && index === lines.length - 1) {
      problems.push(`${label} : écriture incomplète en fin de fichier`);
      return;
    }
    let parsed: Partial<ErasureEntry>;
    try {
      parsed = JSON.parse(line) as Partial<ErasureEntry>;
    } catch {
      problems.push(`${label} : JSON invalide`);
      return;
    }
    if (
      parsed.v !== 1 ||
      typeof parsed.id !== 'string' ||
      typeof parsed.at !== 'string' ||
      Number.isNaN(Date.parse(parsed.at)) ||
      !(ERASURE_KINDS as readonly string[]).includes(parsed.kind as string) ||
      typeof parsed.subject !== 'string' ||
      !SUBJECT_RE.test(parsed.subject) ||
      !(parsed.actor === null || typeof parsed.actor === 'string') ||
      !(ERASURE_SOURCES as readonly string[]).includes(parsed.source as string) ||
      typeof parsed.sum !== 'string'
    ) {
      problems.push(`${label} : structure invalide`);
      return;
    }
    const entry = parsed as ErasureEntry;
    const { sum, ...base } = entry;
    if (checksum(base) !== sum) {
      problems.push(`${label} : somme de contrôle incorrecte (ligne altérée)`);
      return;
    }
    entries.push(entry);
  });
  return { entries, problems };
}

export function hasEntry(entries: readonly ErasureEntry[], kind: ErasureKind, subject: string): boolean {
  return entries.some((entry) => entry.kind === kind && entry.subject === subject);
}

export async function readLedger(file: string): Promise<ParsedLedger> {
  try {
    return parseLedger(await readFile(file, 'utf8'));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return { entries: [], problems: [] };
    throw error;
  }
}

// Sérialise lecture-puis-ajout dans ce processus. Entre processus, deux écritures simultanées
// du même sujet peuvent produire un doublon : sans effet (le rejeu est idempotent).
let queue: Promise<unknown> = Promise.resolve();

export type RecordResult = 'recorded' | 'duplicate' | 'disabled';

export function recordErasure(input: ErasureInput, file: string | null = ledgerPath()): Promise<RecordResult> {
  if (file === null) return Promise.resolve('disabled');
  const target = file;
  const task = queue.then(async (): Promise<RecordResult> => {
    const entry = buildEntry(input);
    const existing = await readLedger(target);
    if (hasEntry(existing.entries, entry.kind, entry.subject)) return 'duplicate';
    await mkdir(path.dirname(target), { recursive: true, mode: 0o700 });
    const handle = await open(target, 'a', 0o600);
    try {
      await handle.appendFile(`${JSON.stringify(entry)}\n`, 'utf8');
      await handle.sync();
    } finally {
      await handle.close();
    }
    return 'recorded';
  });
  queue = task.catch(() => undefined);
  return task;
}

/**
 * Enregistre sans jamais faire échouer l'effacement déjà commis en base : en cas d'échec, l'erreur
 * est journalisée bruyamment et `false` est renvoyé (l'appelant l'inscrit à l'audit). Le registre
 * peut ensuite être reconstitué avec `pnpm db:erasure-ledger -- --import-audit`.
 */
export async function recordErasureSafe(input: ErasureInput, file: string | null = ledgerPath()): Promise<boolean> {
  try {
    await recordErasure(input, file);
    return true;
  } catch (error) {
    console.error(`[erasure-ledger] CRITIQUE : effacement ${input.kind} non enregistré (${input.subject}) :`, error);
    return false;
  }
}

// ─── Import de l'historique depuis l'audit (pur : testable sans base) ──
export interface AuditDeletion {
  userId: string | null;
  resource: string | null;
  resourceId: string | null;
  createdAt: Date;
}

export interface AuditImportPlan {
  toAdd: ErasureEntry[];
  alreadyInLedger: number;
  skipped: string[];
}

/** Transforme les `USER_DELETE` de l'audit en entrées de registre, sans doublon avec l'existant. */
export function planAuditImport(rows: readonly AuditDeletion[], existing: readonly ErasureEntry[]): AuditImportPlan {
  const toAdd: ErasureEntry[] = [];
  const seen = new Set<string>();
  const skipped: string[] = [];
  let alreadyInLedger = 0;

  for (const row of rows) {
    let kind: ErasureKind | null = null;
    let subject: string | null = null;
    if (row.resource === 'travelers') {
      kind = 'traveler.anonymize';
      subject = row.resourceId;
    } else if (row.resource === 'user') {
      kind = 'user.delete';
      // Auto-suppression : l'audit ne porte parfois que l'auteur, qui est aussi la personne supprimée.
      subject = row.resourceId ?? row.userId;
    }
    if (kind === null || subject === null) {
      skipped.push(`entrée d'audit sans cible exploitable (ressource : ${row.resource ?? 'aucune'})`);
      continue;
    }
    const key = `${kind}:${subject}`;
    if (hasEntry(existing, kind, subject)) {
      alreadyInLedger++;
      continue;
    }
    if (seen.has(key)) continue;
    try {
      toAdd.push(buildEntry({ kind, subject, actor: row.userId, source: 'audit-import', at: row.createdAt }));
      seen.add(key);
    } catch (error) {
      skipped.push(`${subject.slice(0, 12)}… : ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  return { toAdd, alreadyInLedger, skipped };
}

