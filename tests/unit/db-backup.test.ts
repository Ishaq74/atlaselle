import { describe, it, expect } from 'vitest';
import {
  assertScratchName,
  backupFileName,
  compareSnapshots,
  parseDbUrl,
  parseMajor,
  parseToolMajor,
  pgToolCandidates,
  pickTool,
  scratchDatabaseName,
  timestampSlug,
  withDatabase,
  type Snapshot,
} from '@database/commands/_backup';

const snap = (tables: Record<string, number>, migrations: string[] = ['0000_a']): Snapshot => ({ tables, migrations });

describe('parseDbUrl / withDatabase / pgEnv', () => {
  it('décode les identifiants et ne met le mot de passe que dans l’environnement', () => {
    const target = parseDbUrl('postgresql://app%40x:p%40ss%2Fw@db.example:6543/atlas?sslmode=require');
    expect(target).toEqual({ host: 'db.example', port: '6543', user: 'app@x', password: 'p@ss/w', database: 'atlas', sslmode: 'require' });
    const env = pgEnv(target);
    expect(env.PGPASSWORD).toBe('p@ss/w');
    expect(env.PGSSLMODE).toBe('require');
  });

  it('port par défaut 5432 et changement de base sans toucher aux identifiants', () => {
    expect(parseDbUrl('postgresql://u:p@h/db').port).toBe('5432');
    const swapped = withDatabase('postgresql://u:p@h:5432/atlas?sslmode=require', 'postgres');
    expect(parseDbUrl(swapped)).toMatchObject({ user: 'u', password: 'p', database: 'postgres', sslmode: 'require' });
  });
});

describe('noms de fichiers et de bases jetables', () => {
  it('nomme la sauvegarde avec la base et un horodatage UTC', () => {
    const date = new Date('2026-11-04T21:15:49.542Z');
    expect(timestampSlug(date)).toBe('20261104-211549Z');
    expect(backupFileName('atlaselle_prod', date)).toBe('atlaselle_prod-20261104-211549Z.dump');
    expect(backupFileName('../evil name', date)).toBe('.._evil_name-20261104-211549Z.dump');
  });

  it('ne produit que des noms acceptés par le garde-fou, et refuse tout le reste', () => {
    const name = scratchDatabaseName(new Date('2026-11-04T21:15:49Z'));
    expect(name).toMatch(/^restore_drill_20261104t211549z_[a-f0-9]{6}$/);
    expect(() => assertScratchName(name, 'atlaselle_prod')).not.toThrow();
    for (const bad of ['atlaselle_prod', 'postgres', 'restore_drill_', 'restore_drill_1; DROP DATABASE x', 'RESTORE_DRILL_20261104t211549z_aaaaaa']) {
      expect(() => assertScratchName(bad)).toThrow();
    }
    expect(() => assertScratchName(name, name)).toThrow(/source/);
  });
});

describe('compareSnapshots', () => {
  it('accepte deux instantanés identiques, quel que soit l’ordre des migrations', () => {
    expect(compareSnapshots(snap({ 'public.a': 2 }, ['0001', '0000']), snap({ 'public.a': 2 }, ['0000', '0001']))).toEqual([]);
  });

  it('signale ligne manquante, table absente, table en trop et journal différent', () => {
    const diffs = compareSnapshots(snap({ 'public.a': 3, 'public.b': 1 }), snap({ 'public.a': 2, 'public.c': 0 }, ['0000_a', '0001_b']));
    expect(diffs).toEqual(
      expect.arrayContaining([
        expect.stringContaining('public.a : 3 ligne(s) attendue(s), 2'),
        expect.stringContaining('table absente après restauration : public.b'),
        expect.stringContaining('table inattendue après restauration : public.c'),
        expect.stringContaining('journal des migrations différent'),
      ]),
    );
    expect(diffs).toHaveLength(4);
  });
});

describe('outils PostgreSQL', () => {
  it('lit la version majeure', () => {
    expect(parseMajor('17.2')).toBe(17);
    expect(parseMajor('16.4 (Debian 16.4-1)')).toBe(16);
    expect(parseMajor('n/a')).toBe(0);
  });

  it('lit la version majeure d’une ligne --version, y compris celle des paquets Debian/Ubuntu', () => {
    expect(parseToolMajor('pg_dump (PostgreSQL) 17.6')).toBe(17);
    expect(parseToolMajor('pg_dump (PostgreSQL) 16.15 (Ubuntu 16.15-1.pgdg24.04+2)')).toBe(16);
    expect(parseToolMajor('pg_restore (PostgreSQL) 14.19 (Debian 14.19-1.pgdg12+1)')).toBe(14);
    expect(parseToolMajor('pg_dump (PostgreSQL) 18beta1')).toBe(18);
    expect(parseToolMajor('inconnu')).toBe(0);
  });

  it('choisit la version majeure la plus proche du serveur, jamais la plus récente', () => {
    const tools = [
      { path: 'a', version: '17.2', major: 17 },
      { path: 'b', version: '16.4', major: 16 },
      { path: 'c', version: '14.1', major: 14 },
    ];
    expect(pickTool(tools, 16)?.path).toBe('b');
    expect(pickTool(tools, 15)?.path).toBe('b');
    expect(pickTool(tools, 17)?.path).toBe('a');
    expect(pickTool(tools, 18)).toBeNull();
    expect(pickTool([], 0)).toBeNull();
  });

  it('classe les candidats : PG_BIN_DIR, PATH, puis versions installées de la plus récente', () => {
    const win = pgToolCandidates('pg_dump', 'win32', { PG_BIN_DIR: 'D:\\pg\\bin' }, () => ['13', '17', '16', 'data']);
    expect(win[0]).toMatch(/pg_dump\.exe$/);
    expect(win[0]).toContain('D:\\pg\\bin');
    expect(win[1]).toBe('pg_dump.exe');
    expect(win.slice(2).map((p) => /PostgreSQL\\(\d+)/.exec(p)?.[1])).toEqual(['17', '16', '13']);

    const linux = pgToolCandidates('pg_restore', 'linux', {}, () => ['14', '16']);
    expect(linux).toEqual(['pg_restore', '/usr/lib/postgresql/16/bin/pg_restore', '/usr/lib/postgresql/14/bin/pg_restore']);
  });
});
