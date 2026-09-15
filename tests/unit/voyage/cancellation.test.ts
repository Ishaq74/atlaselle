import { describe, expect, it } from 'vitest';
import { quoteCancellation } from '@/modules/reservations/domain/cancellation-policy';

const NOW = new Date('2027-01-01T12:00:00.000Z');
const days = (n: number) => new Date(NOW.getTime() + n * 86_400_000);

describe('quoteCancellation (politique V1)', () => {
  it('refunds 100% at 45+ days', () => {
    expect(quoteCancellation(days(60), 100000, NOW)).toEqual({
      daysBeforeDeparture: 60,
      refundPercent: 100,
      refundAmount: 100000,
      tier: 'free',
    });
  });

  it('refunds 50% between 15 and 45 days', () => {
    const q = quoteCancellation(days(20), 100000, NOW);
    expect(q.tier).toBe('half');
    expect(q.refundAmount).toBe(50000);
  });

  it('refunds nothing under 15 days', () => {
    const q = quoteCancellation(days(5), 100000, NOW);
    expect(q).toMatchObject({ tier: 'none', refundAmount: 0, refundPercent: 0 });
  });

  it('never refunds more than paid', () => {
    expect(quoteCancellation(days(60), 0, NOW).refundAmount).toBe(0);
  });
});
