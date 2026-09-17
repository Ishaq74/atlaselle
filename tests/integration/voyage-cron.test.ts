import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@/modules/availability/domain/availability-service', () => ({
  expireHolds: vi.fn(async () => 7),
  purgeTerminalHolds: vi.fn(async () => 2),
}));
vi.mock('@/modules/payments/domain/checkout-service', () => ({
  expireCheckoutSessions: vi.fn(async () => 6),
  purgeExpiredCheckoutSessions: vi.fn(async () => 1),
}));
vi.mock('@/modules/applications/domain/application-service', () => ({
  expireApplications: vi.fn(async () => 5),
}));
vi.mock('@/modules/reservations/domain/reservation-service', () => ({
  markBalanceDue: vi.fn(async () => 4),
}));
vi.mock('@/modules/email-voyage/domain/voyage-email-worker', () => ({
  processEmailOutboxBatch: vi.fn(async () => ({ done: 3, failed: 0, skipped: 2 })),
}));
vi.mock('@/modules/email-voyage/domain/reminders', () => ({
  sendBalanceReminders: vi.fn(async () => 1),
  sendTripReminders: vi.fn(async () => ({ preparation: 0, pre: 1, post: 0 })),
}));
vi.mock('@/modules/outbox/domain/retention', () => ({
  purgeOldOutbox: vi.fn(async () => 9),
}));

import { POST } from '@/pages/api/cron/voyage';
import { expireHolds, purgeTerminalHolds } from '@/modules/availability/domain/availability-service';
import { expireCheckoutSessions, purgeExpiredCheckoutSessions } from '@/modules/payments/domain/checkout-service';
import { expireApplications } from '@/modules/applications/domain/application-service';
import { markBalanceDue } from '@/modules/reservations/domain/reservation-service';
import { processEmailOutboxBatch } from '@/modules/email-voyage/domain/voyage-email-worker';
import { sendBalanceReminders, sendTripReminders } from '@/modules/email-voyage/domain/reminders';
import { purgeOldOutbox } from '@/modules/outbox/domain/retention';

const mockExpireHolds = vi.mocked(expireHolds);
const mockExpireCheckouts = vi.mocked(expireCheckoutSessions);
const mockExpireApplications = vi.mocked(expireApplications);
const mockMarkBalanceDue = vi.mocked(markBalanceDue);
const mockOutbox = vi.mocked(processEmailOutboxBatch);
const mockBalance = vi.mocked(sendBalanceReminders);
const mockTrip = vi.mocked(sendTripReminders);
const mockPurgeOutbox = vi.mocked(purgeOldOutbox);
const mockPurgeHolds = vi.mocked(purgeTerminalHolds);
const mockPurgeCheckouts = vi.mocked(purgeExpiredCheckoutSessions);

const loopback = () => new Request('http://localhost/api/cron/voyage', { method: 'POST' });

describe('POST /api/cron/voyage', () => {
  beforeEach(() => {
    delete process.env.CRON_SECRET;
    vi.clearAllMocks();
    mockExpireHolds.mockResolvedValue(7);
    mockExpireCheckouts.mockResolvedValue(6);
    mockExpireApplications.mockResolvedValue(5);
    mockMarkBalanceDue.mockResolvedValue(4);
    mockOutbox.mockResolvedValue({ done: 3, failed: 0, skipped: 2 });
    mockBalance.mockResolvedValue(1);
    mockTrip.mockResolvedValue({ preparation: 0, pre: 1, post: 0 });
    mockPurgeOutbox.mockResolvedValue(9);
    mockPurgeHolds.mockResolvedValue(2);
    mockPurgeCheckouts.mockResolvedValue(1);
  });

  it('refuse les proxied sans secret (401)', async () => {
    const res = await POST({
      request: new Request('http://localhost/api/cron/voyage', {
        method: 'POST',
        headers: { 'x-forwarded-for': '1.2.3.4' },
      }),
    } as never);
    expect(res.status).toBe(401);
    expect(mockExpireHolds).not.toHaveBeenCalled();
  });

  it('exécute tous les jobs et retourne le récapitulatif', async () => {
    const res = await POST({ request: loopback() } as never);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      expiredHolds: 7,
      expiredCheckouts: 6,
      expiredApplications: 5,
      balanceDueMarked: 4,
      outbox: { done: 3, failed: 0, skipped: 2 },
      balanceReminders: 1,
      tripReminders: { preparation: 0, pre: 1, post: 0 },
      retention: { outbox: 9, checkouts: 1, holds: 2 },
      errors: {},
    });
  });

  it('isole les pannes : un job en échec ne bloque pas les autres', async () => {
    mockExpireHolds.mockRejectedValueOnce(new Error('db down'));
    const res = await POST({ request: loopback() } as never);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.errors).toEqual({ expireHolds: 'db down' });
    expect(body.expiredHolds).toBe(0);
    expect(body.expiredCheckouts).toBe(6);
    expect(mockExpireCheckouts).toHaveBeenCalled();
    expect(mockExpireApplications).toHaveBeenCalled();
    expect(mockMarkBalanceDue).toHaveBeenCalled();
    expect(mockOutbox).toHaveBeenCalled();
    expect(mockBalance).toHaveBeenCalled();
    expect(mockTrip).toHaveBeenCalled();
    expect(mockPurgeOutbox).toHaveBeenCalled();
    expect(mockPurgeHolds).toHaveBeenCalled();
    expect(mockPurgeCheckouts).toHaveBeenCalled();
  });
});
