import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { appendFileSync, existsSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  buildEntry,
  checksum,
  hasEntry,
  ledgerPath,
  parseLedger,
  planAuditImport,
  readLedger,
  recordErasure,
  recordErasureSafe,
} from '@/lib/erasure-ledger';

const SUBJECT = '0b9f9a3e-3b5c-4f4e-9d0e-6d1a2b3c4d5e';
let dir: string;
let file: string;

beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), 'atl-ledger-'));
  file = path.join(dir, 'nested', 'erasure-ledger.ndjson');
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe('ledgerPath', () => {
  it('chemin explicite prioritaire, défaut data/, désactivé en test sans chemin', () => {
    expect(ledgerPath({ ERASURE_LEDGER_PATH: 'x/l.ndjson' }, '/srv/app')).toBe(path.resolve('/srv/app', 'x/l.ndjson'));
    expect(ledgerPath({ NODE_ENV: 'production' }, '/srv/app')).toBe(path.resolve('/srv/app', 'data', 'erasure-ledger.ndjson'));
    expect(ledgerPath({}, '/srv/app')).toBe(path.resolve('/srv/app', 'data', 'erasure-ledger.ndjson'));
    expect(ledgerPath({ NODE_ENV: 'test' }, '/srv/app')).toBeNull();
    expect(ledgerPath({ NODE_ENV: 'test', ERASURE_LEDGER_PATH: ' /tmp/x ' }, '/srv/app')).toBe(path.resolve('/tmp/x'));
  });

  it("n'écrit jamais dans le dépôt quand il est désactivé", async () => {
    expect(await recordErasure({ kind: 'user.delete', subject: SUBJECT, source: 'action' }, null)).toBe('disabled');
  });
});

describe('buildEntry', () => {
  it('produit une entrée signée sans donnée personnelle', () => {
    const entry = buildEntry({ kind: 'traveler.anonymize', subject: SUBJECT, actor: 'admin_1', source: 'action' }, 'fixed-id');
    expect(entry).toMatchObject({ v: 1, id: 'fixed-id', kind: 'traveler.anonymize', subject: SUBJECT, actor: 'admin_1', source: 'action' });
    expect(entry.sum).toBe(checksum({ v: 1, id: 'fixed-id', at: entry.at, kind: entry.kind, subject: SUBJECT, actor: 'admin_1', source: 'action' }));
    expect(Object.keys(entry).sort()).toEqual(['actor', 'at', 'id', 'kind', 'source', 'subject', 'sum', 'v']);
  });

  it('refuse un sujet qui ressemble à une donnée personnelle ou un type inconnu', () => {
    for (const subject of ['jane@example.com', 'Jane Doe', '+33 6 12 34 56 78', '', 'a'.repeat(65), 'x/../y']) {
      expect(() => buildEntry({ kind: 'user.delete', subject, source: 'action' })).toThrow(/invalide/);
    }
    expect(() => buildEntry({ kind: 'user.delete', subject: SUBJECT, actor: 'jane@example.com', source: 'action' })).toThrow(/acteur/);
    expect(() => buildEntry({ kind: 'nope' as never, subject: SUBJECT, source: 'action' })).toThrow(/inconnu/);
    expect(() => buildEntry({ kind: 'user.delete', subject: SUBJECT, source: 'web' as never })).toThrow(/Source/);
  });
});

describe('recordErasure / readLedger', () => {
  it('crée le dossier, écrit une ligne par effacement et ignore les doublons', async () => {
    expect(await recordErasure({ kind: 'traveler.anonymize', subject: SUBJECT, actor: 'a1', source: 'action' }, file)).toBe('recorded');
    expect(await recordErasure({ kind: 'traveler.anonymize', subject: SUBJECT, actor: 'a2', source: 'hook' }, file)).toBe('duplicate');
    expect(await recordErasure({ kind: 'user.delete', subject: SUBJECT, source: 'hook' }, file)).toBe('recorded');
    const { entries, problems } = await readLedger(file);
    expect(problems).toEqual([]);
    expect(entries.map((e) => e.kind)).toEqual(['traveler.anonymize', 'user.delete']);
    expect(hasEntry(entries, 'user.delete', SUBJECT)).toBe(true);
    expect(readFileSync(file, 'utf8').split('\n').filter(Boolean)).toHaveLength(2);
  });

  it('reste sans doublon sous écritures concurrentes', async () => {
    const results = await Promise.all(Array.from({ length: 20 }, () => recordErasure({ kind: 'user.delete', subject: SUBJECT, source: 'hook' }, file)));
    expect(results.filter((r) => r === 'recorded')).toHaveLength(1);
    expect((await readLedger(file)).entries).toHaveLength(1);
  });

  it('enregistre la date d’origine d’un import', async () => {
    await recordErasure({ kind: 'user.delete', subject: SUBJECT, source: 'audit-import', at: new Date('2026-01-02T03:04:05.000Z') }, file);
    expect((await readLedger(file)).entries[0].at).toBe('2026-01-02T03:04:05.000Z');
  });

  it('un fichier absent est un registre vide', async () => {
    expect(await readLedger(path.join(dir, 'absent.ndjson'))).toEqual({ entries: [], problems: [] });
  });

  it.skipIf(process.platform === 'win32')('crée le fichier en 0600', async () => {
    await recordErasure({ kind: 'user.delete', subject: SUBJECT, source: 'hook' }, file);
    expect(statSync(file).mode & 0o777).toBe(0o600);
  });

  it('ne contient jamais de donnée personnelle', async () => {
    await recordErasure({ kind: 'traveler.anonymize', subject: SUBJECT, actor: 'admin_1', source: 'action' }, file);
    const raw = readFileSync(file, 'utf8');
    expect(raw).not.toMatch(/@|legalName|phone|email/i);
  });
});

describe('recordErasureSafe', () => {
  it('renvoie false et journalise sans lever quand l’écriture est impossible', async () => {
    const blocker = path.join(dir, 'blocker');
    writeFileSync(blocker, 'x');
    const errors: unknown[][] = [];
    const original = console.error;
    console.error = (...args: unknown[]) => void errors.push(args);
    try {
      expect(await recordErasureSafe({ kind: 'user.delete', subject: SUBJECT, source: 'hook' }, path.join(blocker, 'sub', 'l.ndjson'))).toBe(false);
      expect(await recordErasureSafe({ kind: 'user.delete', subject: 'jane@example.com', source: 'hook' }, file)).toBe(false);
    } finally {
      console.error = original;
    }
    expect(errors).toHaveLength(2);
    expect(String(errors[0][0])).toContain('CRITIQUE');
    expect(existsSync(file)).toBe(false);
  });

  it('renvoie true en cas de succès, doublon ou désactivation', async () => {
    expect(await recordErasureSafe({ kind: 'user.delete', subject: SUBJECT, source: 'hook' }, file)).toBe(true);
    expect(await recordErasureSafe({ kind: 'user.delete', subject: SUBJECT, source: 'hook' }, file)).toBe(true);
    expect(await recordErasureSafe({ kind: 'user.delete', subject: SUBJECT, source: 'hook' }, null)).toBe(true);
  });
});

describe('parseLedger — le contrôle n’est pas vacueux', () => {
  const good = (subject: string) => JSON.stringify(buildEntry({ kind: 'user.delete', subject, source: 'hook' }));

  it('accepte des lignes valides, ignore les lignes vides', () => {
    const text = `${good('u1')}\n\n${good('u2')}\n`;
    const parsed = parseLedger(text);
    expect(parsed.problems).toEqual([]);
    expect(parsed.entries.map((e) => e.subject)).toEqual(['u1', 'u2']);
  });

  it('détecte une ligne modifiée (somme de contrôle) sans perdre les autres', () => {
    const tampered = good('u1').replace('"u1"', '"u9"');
    const parsed = parseLedger(`${tampered}\n${good('u2')}\n`);
    expect(parsed.entries.map((e) => e.subject)).toEqual(['u2']);
    expect(parsed.problems).toEqual(['ligne 1 : somme de contrôle incorrecte (ligne altérée)']);
  });

  it('détecte JSON invalide, structure invalide et écriture incomplète finale', () => {
    const half = good('u3').slice(0, 40);
    const parsed = parseLedger(`pas du json\n{"v":2}\n${good('u1')}\n${half}`);
    expect(parsed.entries).toHaveLength(1);
    expect(parsed.problems).toEqual([
      'ligne 1 : JSON invalide',
      'ligne 2 : structure invalide',
      'ligne 4 : écriture incomplète en fin de fichier',
    ]);
  });

  it('relit un fichier réel contenant une ligne altérée', async () => {
    await recordErasure({ kind: 'user.delete', subject: 'u1', source: 'hook' }, file);
    appendFileSync(file, 'garbage\n');
    const { entries, problems } = await readLedger(file);
    expect(entries).toHaveLength(1);
    expect(problems).toHaveLength(1);
  });
});

describe('planAuditImport', () => {
  const at = new Date('2026-05-06T07:08:09.000Z');
  const existing = [buildEntry({ kind: 'user.delete', subject: 'already_1', source: 'hook' })];

  it('convertit les USER_DELETE, déduplique et signale ce qui est inexploitable', () => {
    const plan = planAuditImport(
      [
        { userId: 'admin1', resource: 'travelers', resourceId: SUBJECT, createdAt: at },
        { userId: 'admin1', resource: 'user', resourceId: 'victim_1', createdAt: at },
        { userId: 'admin1', resource: 'user', resourceId: 'victim_1', createdAt: at },
        { userId: 'self_1', resource: 'user', resourceId: null, createdAt: at },
        { userId: 'admin1', resource: 'user', resourceId: 'already_1', createdAt: at },
        { userId: 'admin1', resource: 'blog', resourceId: 'x', createdAt: at },
        { userId: null, resource: 'user', resourceId: null, createdAt: at },
        { userId: 'admin1', resource: 'user', resourceId: 'jane@example.com', createdAt: at },
      ],
      existing,
    );
    expect(plan.toAdd.map((e) => `${e.kind}:${e.subject}:${e.actor}:${e.source}`)).toEqual([
      `traveler.anonymize:${SUBJECT}:admin1:audit-import`,
      'user.delete:victim_1:admin1:audit-import',
      'user.delete:self_1:self_1:audit-import',
    ]);
    expect(plan.toAdd.every((e) => e.at === at.toISOString())).toBe(true);
    expect(plan.alreadyInLedger).toBe(1);
    expect(plan.skipped).toHaveLength(3);
  });
});
