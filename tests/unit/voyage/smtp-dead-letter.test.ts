import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@smtp/env', () => ({
  getSmtpProvider: vi.fn(() => 'BREVO'),
  getSmtpFrom: vi.fn(() => ({ email: 'test@example.com', name: 'Test' })),
}));

const mockSend = vi.fn();
vi.mock('@smtp/providers/brevo', () => ({ send: mockSend }));
vi.mock('@smtp/providers/resend', () => ({ send: vi.fn() }));
vi.mock('@smtp/providers/nodemailer', () => ({ send: vi.fn() }));

const appendFileMock = vi.hoisted(() => vi.fn(async (_path: unknown, _data: unknown) => undefined));
vi.mock('node:fs/promises', async (importOriginal) => {
  const mod = await importOriginal<typeof import('node:fs/promises')>();
  return { ...mod, mkdir: async () => undefined, appendFile: appendFileMock };
});

import { sendEmail } from '@smtp/send';

describe('sendEmail — dead-letter forensique', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('enregistre le MESSAGE (pas seulement le nom) + tentatives', async () => {
    mockSend.mockRejectedValue(Object.assign(new Error('smtp 503 unavailable'), { code: 'EENVELOPE' }));
    await expect(sendEmail({ to: 'user@test.com', subject: 'Hello', html: '<p>Hi</p>' })).rejects.toThrow('503');
    expect(appendFileMock).toHaveBeenCalledOnce();
    const record = JSON.parse(String(appendFileMock.mock.calls[0][1]));
    expect(record.to).toBe('user@test.com');
    expect(record.error).toContain('503');
    expect(record.code).toBe('EENVELOPE');
    expect(record.attempts).toBe(3);
    expect(record.provider).toBe('BREVO');
  });
});
