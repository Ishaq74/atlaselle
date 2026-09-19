import { describe, expect, it } from 'vitest';
import { getProjectStats } from '../../readme-builder/generateStats';

describe('readme-builder generateStats', () => {
  it('lit la version Astro depuis package.json', async () => {
    const stats = await getProjectStats();
    expect(stats.astroVersion).toMatch(/^\d+\.\d+\.\d+/);
    expect(stats.astroVersion.startsWith('7.')).toBe(true);
  });

  it('compte les atomes et les tests', async () => {
    const stats = await getProjectStats();
    expect(stats.atomsCount).toBeGreaterThan(40);
    expect(stats.unitCount).toBeGreaterThan(50);
    expect(stats.e2eCount).toBeGreaterThanOrEqual(7);
    expect(stats.defaultLocale).toBe('en');
  });
});
