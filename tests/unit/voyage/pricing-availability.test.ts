import { describe, expect, it } from 'vitest';
import { computeLine, priceQuote, type PricingInput } from '@/modules/pricing/domain/pricing';
import { availableSeats, canHold, isHoldActive } from '@/modules/availability/domain/availability';
import { normalizeEmail, resolveEmailConflict } from '@/modules/travelers/domain/traveler-email';

const base: PricingInput = {
  priceAmount: 389000,
  currency: 'EUR',
  depositType: 'fixed',
  depositAmount: 75000,
  depositPercent: 0,
  singleSupplementType: 'fixed',
  singleSupplementAmount: 45000,
  taxType: 'none',
  taxAmount: 0,
  feeType: 'none',
  feeAmount: 0,
  discountType: 'none',
  discountAmount: 0,
  roomType: 'shared',
};

describe('computeLine', () => {
  it('handles fixed, percent and none', () => {
    expect(computeLine('fixed', 5000, 0, 100000)).toBe(5000);
    expect(computeLine('percent', 0, 20, 100000)).toBe(20000);
    expect(computeLine('none', 5000, 20, 100000)).toBe(0);
  });

  it('never returns negative amounts', () => {
    expect(computeLine('fixed', -100, 0, 1000)).toBe(0);
  });
});

describe('priceQuote (TODO §12.2, centimes)', () => {
  it('quotes shared room with fixed deposit', () => {
    const q = priceQuote(base);
    expect(q.totalAmount).toBe(389000);
    expect(q.depositAmount).toBe(75000);
    expect(q.balanceAmount).toBe(314000);
    expect(q.currency).toBe('EUR');
  });

  it('adds single supplement only for single rooms', () => {
    expect(priceQuote({ ...base, roomType: 'single' }).totalAmount).toBe(434000);
  });

  it('applies percent deposit and caps it at total', () => {
    const q = priceQuote({ ...base, depositType: 'percent', depositAmount: 0, depositPercent: 30 });
    expect(q.depositAmount).toBe(Math.round(389000 * 0.3));
    const over = priceQuote({ ...base, depositType: 'percent', depositAmount: 0, depositPercent: 200 });
    expect(over.depositAmount).toBe(over.totalAmount);
  });

  it('applies early-bird pricing rules', () => {
    const q = priceQuote({ ...base, pricingRules: { earlyBirdPercent: 10 } });
    expect(q.discountAmount).toBe(38900);
    expect(q.totalAmount).toBe(350100);
  });
});

describe('availability math (TODO §10)', () => {
  it('computes available seats', () => {
    expect(availableSeats({ capacityMax: 14, confirmedSeats: 8, heldSeats: 2 })).toBe(4);
    expect(availableSeats({ capacityMax: 14, confirmedSeats: 14, heldSeats: 0 })).toBe(0);
  });

  it('refuses overbooking', () => {
    expect(canHold({ capacityMax: 14, confirmedSeats: 13, heldSeats: 0 }, 2)).toBe(false);
    expect(canHold({ capacityMax: 14, confirmedSeats: 13, heldSeats: 0 }, 1)).toBe(true);
    expect(canHold({ capacityMax: 14, confirmedSeats: 0, heldSeats: 0 }, 0)).toBe(false);
  });

  it('ignores expired holds', () => {
    const now = new Date('2027-01-01T12:00:00Z');
    expect(isHoldActive({ status: 'active', expiresAt: new Date('2027-01-01T12:30:00Z') }, now)).toBe(true);
    expect(isHoldActive({ status: 'active', expiresAt: new Date('2027-01-01T11:59:00Z') }, now)).toBe(false);
    expect(isHoldActive({ status: 'released', expiresAt: new Date('2027-01-01T12:30:00Z') }, now)).toBe(false);
  });
});

describe('traveler email (TODO §11.1)', () => {
  it('normalizes emails', () => {
    expect(normalizeEmail('  Voyage@Example.COM ')).toBe('voyage@example.com');
  });

  it('reuses verified travelers, conflicts otherwise', () => {
    expect(resolveEmailConflict(null)).toBeNull();
    expect(resolveEmailConflict({ id: 't1', emailVerifiedAt: new Date() })).toEqual({ action: 'reuse', travelerId: 't1' });
    expect(resolveEmailConflict({ id: 't1', emailVerifiedAt: null })).toEqual({
      action: 'conflict',
      code: 'APPLICATION_EMAIL_CONFLICT',
    });
  });
});
