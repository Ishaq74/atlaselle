import { describe, expect, it, vi } from 'vitest';

vi.mock('node:crypto', async (importOriginal) => {
  const mod = await importOriginal<typeof import('node:crypto')>();
  return {
    ...mod,
    randomUUID: () => {
      throw new Error('no crypto');
    },
  };
});

import { newRequestId } from '@/lib/request-id';

describe('request-id — repli sans randomUUID', () => {
  it('retourne un id Date-Math', () => {
    expect(newRequestId()).toMatch(/^[0-9a-z]+-[0-9a-z]+$/);
    void vi;
  });
});
