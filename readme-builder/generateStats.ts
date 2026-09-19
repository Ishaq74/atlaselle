import path from 'path';
import { promises as fs } from 'fs';
import { PATHS, readFile } from './utils';

export interface ProjectStats {
  astroVersion: string;
  atomsCount: number;
  unitCount: number;
  integrationCount: number;
  e2eCount: number;
  defaultLocale: string;
}

async function countFiles(dir: string, pattern: RegExp): Promise<number> {
  let total = 0;
  async function walk(d: string): Promise<void> {
    let entries;
    try {
      entries = await fs.readdir(d, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (e.name.startsWith('.') || e.name === 'node_modules' || e.name === 'dist') continue;
      const full = path.join(d, e.name);
      if (e.isDirectory()) await walk(full);
      else if (pattern.test(e.name)) total++;
    }
  }
  await walk(dir);
  return total;
}

export async function getProjectStats(): Promise<ProjectStats> {
  const pkgRaw = await readFile(PATHS.packageJson);
  let astroVersion = '7';
  try {
    const pkg = JSON.parse(pkgRaw);
    const raw: string = pkg.dependencies?.astro ?? pkg.devDependencies?.astro ?? '7';
    const m = raw.match(/(\d+)\.(\d+)\.(\d+)/);
    astroVersion = m ? `${m[1]}.${m[2]}.${m[3]}` : raw.replace(/^[^\d]*/, '');
  } catch { /* keep default */ }

  let atomsCount = 0;
  try {
    const entries = await fs.readdir(path.join(PATHS.components, 'atoms'), { withFileTypes: true });
    atomsCount = entries.filter((e) => !e.name.startsWith('.')).length;
  } catch { /* keep 0 */ }

  const [unitCount, integrationCount, e2eCount] = await Promise.all([
    countFiles(path.join(PATHS.tests, 'unit'), /\.(test|spec)\.(ts|js)$/),
    countFiles(path.join(PATHS.tests, 'integration'), /\.(test|spec)\.(ts|js)$/),
    countFiles(path.join(PATHS.tests, 'e2e'), /\.(test|spec)\.(ts|js)$/),
  ]);

  let defaultLocale = 'en';
  try {
    const cfg = await readFile(path.join(PATHS.i18nDir, 'config.ts'));
    const m = cfg.match(/DEFAULT_LOCALE\s*=\s*['"](\w+)['"]/);
    if (m) defaultLocale = m[1];
  } catch { /* keep en */ }

  return { astroVersion, atomsCount, unitCount, integrationCount, e2eCount, defaultLocale };
}
