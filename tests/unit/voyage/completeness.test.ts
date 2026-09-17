import { describe, expect, it, vi } from 'vitest';

vi.mock('astro:actions', () => {
  class ActionError extends Error {
    code: string;
    constructor({ code, message }: { code: string; message: string }) {
      super(message);
      this.code = code;
    }
  }
  return { ActionError, defineAction: (def: unknown) => def };
});

import { canTransitionTrip, assertTransitionTrip } from '@/modules/trips/domain/trip-transitions';
import { canTransitionDeparture, assertTransitionDeparture } from '@/modules/departures/domain/departure-transitions';
import { canTransitionApplication, assertTransitionApplication } from '@/modules/applications/domain/application-transitions';
import { canTransitionReservation, assertTransitionReservation } from '@/modules/reservations/domain/reservation-transitions';
import { canTransitionPayment, assertTransitionPayment, newIdempotencyKey } from '@/modules/payments/domain/payment-transitions';
import { computeLine, priceQuote, pricingRulesSchema } from '@/modules/pricing/domain/pricing';
import { availableSeats, canHold, isHoldActive, countActiveHolds } from '@/modules/availability/domain/availability';
import { quoteCancellation } from '@/modules/reservations/domain/cancellation-policy';
import { VOYAGE_ERROR_CODES, codedError, isVoyageErrorCode } from '@/lib/voyage-codes';
import { normalizeEmail, resolveEmailConflict } from '@/modules/travelers/domain/traveler-email';
import { domainError, toActionError } from '@/lib/voyage-errors';
import { ActionError } from 'astro:actions';

describe('trip transitions — branches manquantes', () => {
  it('review->draft et unpublished->published/archived', () => {
    expect(canTransitionTrip('review', 'draft')).toBe(true);
    expect(canTransitionTrip('unpublished', 'published')).toBe(true);
    expect(canTransitionTrip('unpublished', 'archived')).toBe(true);
  });
  it('assert succès ne jette pas', () => {
    expect(() => assertTransitionTrip('review', 'draft')).not.toThrow();
    expect(() => assertTransitionTrip('unpublished', 'published')).not.toThrow();
  });
  it('fallback clé inconnue -> false', () => {
    expect(canTransitionTrip('draft' as never, 'unknown' as never)).toBe(false);
  });
});

describe('departure transitions — exhaustif', () => {
  it('open vers tous les états', () => {
    expect(canTransitionDeparture('open', 'waitlist')).toBe(true);
    expect(canTransitionDeparture('open', 'closed')).toBe(true);
    expect(canTransitionDeparture('open', 'cancelled')).toBe(true);
  });
  it('limited et waitlist', () => {
    expect(canTransitionDeparture('limited', 'waitlist')).toBe(true);
    expect(canTransitionDeparture('limited', 'closed')).toBe(true);
    expect(canTransitionDeparture('waitlist', 'open')).toBe(true);
    expect(canTransitionDeparture('waitlist', 'closed')).toBe(true);
  });
  it('terminaux cancelled/completed', () => {
    expect(canTransitionDeparture('cancelled', 'open')).toBe(false);
    expect(canTransitionDeparture('completed', 'open')).toBe(false);
  });
  it('assert succès et échec', () => {
    expect(() => assertTransitionDeparture('open', 'closed')).not.toThrow();
    expect(() => assertTransitionDeparture('closed', 'open')).toThrow();
  });
});

describe('application transitions — exhaustif', () => {
  it('withdrawn/expired depuis draft/submitted', () => {
    expect(canTransitionApplication('draft', 'withdrawn')).toBe(true);
    expect(canTransitionApplication('submitted', 'withdrawn')).toBe(true);
    expect(canTransitionApplication('submitted', 'expired')).toBe(true);
  });
  it('under_review complet', () => {
    expect(canTransitionApplication('under_review', 'approved')).toBe(true);
    expect(canTransitionApplication('under_review', 'declined')).toBe(true);
    expect(canTransitionApplication('under_review', 'expired')).toBe(true);
  });
  it('contact_required complet', () => {
    expect(canTransitionApplication('contact_required', 'under_review')).toBe(true);
    expect(canTransitionApplication('contact_required', 'declined')).toBe(true);
    expect(canTransitionApplication('contact_required', 'expired')).toBe(true);
  });
  it('assert', () => {
    expect(() => assertTransitionApplication('draft', 'withdrawn')).not.toThrow();
    expect(() => assertTransitionApplication('approved', 'submitted')).toThrow();
    expect(canTransitionApplication('approved' as never, 'x' as never)).toBe(false);
  });
});

describe('reservation transitions — exhaustif', () => {
  it('pending/awaiting/confirmed/balance/completed/cancelled', () => {
    expect(canTransitionReservation('pending', 'cancelled')).toBe(true);
    expect(canTransitionReservation('awaiting_payment', 'cancelled')).toBe(true);
    expect(canTransitionReservation('awaiting_payment', 'pending')).toBe(true);
    expect(canTransitionReservation('confirmed', 'balance_due')).toBe(true);
    expect(canTransitionReservation('confirmed', 'cancelled')).toBe(true);
    expect(canTransitionReservation('balance_due', 'completed')).toBe(true);
    expect(canTransitionReservation('balance_due', 'cancelled')).toBe(true);
    expect(canTransitionReservation('completed', 'refunded')).toBe(true);
    expect(canTransitionReservation('cancelled', 'refunded')).toBe(true);
    expect(canTransitionReservation('refunded', 'completed')).toBe(false);
  });
  it('assert', () => {
    expect(() => assertTransitionReservation('pending', 'cancelled')).not.toThrow();
    expect(() => assertTransitionReservation('refunded', 'pending')).toThrow();
  });
});

describe('payment transitions — exhaustif', () => {
  it('tous les arcs', () => {
    expect(canTransitionPayment('created', 'cancelled')).toBe(true);
    expect(canTransitionPayment('pending', 'paid')).toBe(true);
    expect(canTransitionPayment('pending', 'failed')).toBe(true);
    expect(canTransitionPayment('pending', 'cancelled')).toBe(true);
    expect(canTransitionPayment('authorized', 'failed')).toBe(true);
    expect(canTransitionPayment('authorized', 'cancelled')).toBe(true);
    expect(canTransitionPayment('paid', 'partially_refunded')).toBe(true);
    expect(canTransitionPayment('failed', 'pending')).toBe(true);
    expect(canTransitionPayment('partially_refunded', 'refunded')).toBe(true);
    expect(canTransitionPayment('cancelled', 'pending')).toBe(false);
    expect(canTransitionPayment('refunded', 'pending')).toBe(false);
  });
  it('assert + idempotency uuid', () => {
    expect(() => assertTransitionPayment('failed', 'pending')).not.toThrow();
    expect(() => assertTransitionPayment('refunded', 'pending')).toThrow();
    const a = newIdempotencyKey();
    const b = newIdempotencyKey();
    expect(a).not.toBe(b);
    expect(a).toMatch(/^[0-9a-f-]{36}$/i);
  });
});

describe('pricing — cas limites', () => {
  const base = {
    priceAmount: 100000, currency: 'EUR',
    depositType: 'none' as const, depositAmount: 0, depositPercent: 0,
    singleSupplementType: 'none' as const, singleSupplementAmount: 0,
    taxType: 'none' as const, taxAmount: 0,
    feeType: 'none' as const, feeAmount: 0,
    discountType: 'none' as const, discountAmount: 0,
    roomType: 'shared' as const, pricingRules: {},
  };
  it('computeLine percent négatif et arrondi', () => {
    expect(computeLine('percent', 0, -10, 100000)).toBe(0);
    expect(computeLine('percent', 0, 33, 100)).toBe(33);
    expect(computeLine('fixed', -50, 0, 100)).toBe(0);
    expect(computeLine('none', 999, 50, 100)).toBe(0);
  });
  it('pricingRules invalides jettent, earlyBirdBefore/groupDiscounts parsés', () => {
    expect(() => pricingRulesSchema.parse({ earlyBirdPercent: 200 })).toThrow();
    const parsed = pricingRulesSchema.parse({ earlyBirdBefore: '2027-01-01', groupDiscounts: [{ minTravelers: 4, percent: 10 }] });
    expect(parsed.earlyBirdBefore).toBe('2027-01-01');
    // groupDiscounts parsés mais non consommés par priceQuote (code mort documenté)
    const q = priceQuote({ ...base, pricingRules: parsed });
    expect(q.totalAmount).toBe(100000);
  });
  it('earlyBirdBefore borne, groupe meilleur palier', () => {
    const rules = { earlyBirdPercent: 10, earlyBirdBefore: '2027-01-01', groupDiscounts: [{ minTravelers: 2, percent: 5 }, { minTravelers: 4, percent: 10 }] };
    const q1 = priceQuote({ ...base, pricingRules: rules }, { now: new Date('2026-06-01') });
    expect(q1.discountAmount).toBe(10000);
    const q2 = priceQuote({ ...base, pricingRules: rules }, { now: new Date('2027-06-01') });
    expect(q2.discountAmount).toBe(0);
    const q3 = priceQuote({ ...base, pricingRules: { ...rules, earlyBirdBefore: 'pas-une-date' } }, { now: new Date('2027-06-01') });
    expect(q3.discountAmount).toBe(10000);
    const g1 = priceQuote({ ...base, pricingRules: rules }, { travelerCount: 1, now: new Date('2026-06-01') });
    expect(g1.discountAmount).toBe(10000);
    const g3 = priceQuote({ ...base, pricingRules: rules }, { travelerCount: 3, now: new Date('2027-06-01') });
    expect(g3.discountAmount).toBe(5000);
    const g4 = priceQuote({ ...base, pricingRules: rules }, { travelerCount: 4, now: new Date('2027-06-01') });
    expect(g4.discountAmount).toBe(10000);
  });

  it('tax/fee percent, discount percent, deposit fixe capé, subtotal clamp', () => {
    const q1 = priceQuote({ ...base, taxType: 'percent', taxAmount: 0, feeType: 'fixed', feeAmount: 500 });
    // tax percent avec percent=0 -> 0 (percent passé en dur à 0 dans priceQuote)
    expect(q1.taxAmount).toBe(0);
    expect(q1.feeAmount).toBe(500);
    const q2 = priceQuote({ ...base, discountType: 'fixed', discountAmount: 200000 });
    expect(q2.totalAmount).toBe(0);
    expect(q2.discountAmount).toBeLessThanOrEqual(100000);
    const q3 = priceQuote({ ...base, depositType: 'fixed', depositAmount: 999999 });
    expect(q3.depositAmount).toBe(q3.totalAmount);
    const q4 = priceQuote({ ...base, priceAmount: -500 });
    expect(q4.baseAmount).toBe(0);
  });
});

describe('availability — cas limites', () => {
  it('availableSeats clamp à 0', () => {
    expect(availableSeats({ capacityMax: 5, confirmedSeats: 10, heldSeats: 0 })).toBe(0);
  });
  it('canHold refuse non-entiers/négatifs', () => {
    const c = { capacityMax: 8, confirmedSeats: 0, heldSeats: 0 };
    expect(canHold(c, 1.5)).toBe(false);
    expect(canHold(c, NaN)).toBe(false);
    expect(canHold(c, -1)).toBe(false);
    expect(canHold(c, 0)).toBe(false);
  });
  it('isHoldActive égalité et statuts', () => {
    const now = new Date('2027-01-01T00:00:00Z');
    expect(isHoldActive({ status: 'active', expiresAt: now }, now)).toBe(false);
    expect(isHoldActive({ status: 'converted', expiresAt: new Date('2027-02-01') }, now)).toBe(false);
    expect(isHoldActive({ status: 'expired', expiresAt: new Date('2027-02-01') }, now)).toBe(false);
    expect(isHoldActive({ status: 'pending', expiresAt: new Date('2027-02-01') }, now)).toBe(false);
  });
  it('countActiveHolds', () => {
    const now = new Date('2027-01-01T00:00:00Z');
    const holds = [
      { status: 'active', expiresAt: new Date('2027-02-01') },
      { status: 'active', expiresAt: new Date('2026-01-01') },
      { status: 'released', expiresAt: new Date('2027-02-01') },
    ];
    expect(countActiveHolds(holds, now)).toBe(1);
    expect(countActiveHolds([], now)).toBe(0);
  });
});

describe('cancellation — frontières', () => {
  const d = (days: number) => new Date(Date.now() + days * 86_400_000);
  it('45j free vs 44j half', () => {
    expect(quoteCancellation(d(45), 10000).tier).toBe('free');
    expect(quoteCancellation(d(44), 10000).tier).toBe('half');
  });
  it('15j half vs 14j none', () => {
    expect(quoteCancellation(d(15), 10000).tier).toBe('half');
    expect(quoteCancellation(d(14), 10000).tier).toBe('none');
  });
  it('départ passé et montants', () => {
    const q = quoteCancellation(d(-1), 10000);
    expect(q.tier).toBe('none');
    expect(q.refundAmount).toBe(0);
    expect(quoteCancellation(d(60), -500).refundAmount).toBe(0);
    expect(quoteCancellation(d(20), 1).refundAmount).toBe(1);
  });
});

describe('traveler-email — normalisation et conflit', () => {
  it('trim + lowercase', () => {
    expect(normalizeEmail('  Foo@X.COM  ')).toBe('foo@x.com');
    expect(normalizeEmail('')).toBe('');
  });
  it('resolveEmailConflict : null, reuse si vérifié, conflit sinon', () => {
    expect(resolveEmailConflict(null)).toBeNull();
    expect(resolveEmailConflict({ id: 't1', emailVerifiedAt: new Date() })).toEqual({ action: 'reuse', travelerId: 't1' });
    expect(resolveEmailConflict({ id: 't1', emailVerifiedAt: null })).toEqual({ action: 'conflict', code: 'APPLICATION_EMAIL_CONFLICT' });
  });
});

describe('voyage-codes', () => {
  it('9 codes stables', () => {
    expect(VOYAGE_ERROR_CODES).toHaveLength(9);
  });
  it('codedError format + .code', () => {
    const e = codedError('CHECKOUT_EXPIRED', 'expiré');
    expect(e.message).toBe('[CHECKOUT_EXPIRED] expiré');
    expect(e.code).toBe('CHECKOUT_EXPIRED');
  });
  it('isVoyageErrorCode', () => {
    expect(isVoyageErrorCode('CHECKOUT_EXPIRED')).toBe(true);
    expect(isVoyageErrorCode('NOPE')).toBe(false);
    expect(isVoyageErrorCode(123)).toBe(false);
    expect(isVoyageErrorCode(null)).toBe(false);
  });
});

describe('voyage-errors — mapping complet', () => {
  it('domainError préfixe', () => {
    const e = domainError('GONE', 'CHECKOUT_EXPIRED', 'lien expiré');
    expect(e.code).toBe('GONE');
    expect(e.message).toContain('[CHECKOUT_EXPIRED]');
  });
  it('toActionError passthrough ActionError', () => {
    const orig = new ActionError({ code: 'NOT_FOUND', message: 'x' });
    expect(toActionError(orig)).toBe(orig);
  });
  it('toActionError mappe les 8 codes', () => {
    const cases: Array<[string, string]> = [
      ['APPLICATION_CLOSED', 'BAD_REQUEST'],
      ['APPLICATION_DEADLINE_PASSED', 'BAD_REQUEST'],
      ['APPLICATION_DUPLICATE', 'CONFLICT'],
      ['APPLICATION_EMAIL_CONFLICT', 'CONFLICT'],
      ['DEPARTURE_SOLD_OUT', 'CONFLICT'],
      ['CHECKOUT_EXPIRED', 'GONE'],
      ['PAYMENT_FAILED', 'BAD_REQUEST'],
      ['PAYMENT_AMOUNT_MISMATCH', 'BAD_REQUEST'],
      ['RESERVATION_ALREADY_CONFIRMED', 'CONFLICT'],
    ];
    for (const [code, transport] of cases) {
      const err = Object.assign(new Error(`[${code}] détail`), { code });
      const out = toActionError(err) as unknown as { code: string; message: string };
      expect(out.code).toBe(transport);
      expect(out.message).not.toMatch(/^\[[A-Z_]+\] \[[A-Z_]+\]/);
    }
  });
  it('toActionError fallback', () => {
    const bad = toActionError(new Error('boom')) as unknown as { code: string };
    expect(bad.code).toBe('BAD_REQUEST');
    const nonErr = toActionError('chaîne') as unknown as { code: string; message: string };
    expect(nonErr.code).toBe('BAD_REQUEST');
    expect(nonErr.message).toBe('Requête invalide.');
    const coded = toActionError({ code: 'DEPARTURE_SOLD_OUT' }) as unknown as { code: string; message: string };
    expect(coded.code).toBe('CONFLICT');
    expect(coded.message).toContain('[DEPARTURE_SOLD_OUT]');
  });
});
