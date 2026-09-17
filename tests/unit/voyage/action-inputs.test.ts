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

import { tripFactsInput, tripTranslationInput } from '@/actions/voyage/trips';
import { departureInput } from '@/actions/voyage/departures';
import { applicationSubmitInput, applicationReviewInput, applicationWithdrawInput } from '@/actions/voyage/applications';
import { checkoutInitiateInput } from '@/actions/voyage/checkout';
import { paymentRefundInput, payBalanceInput } from '@/actions/voyage/payments';

const UUID = '123e4567-e89b-42d3-a456-426614174000';

describe('trip inputs', () => {
  it('accepts readable seed ids (not only UUIDs)', () => {
    expect(tripFactsInput.safeParse({ id: 'trip-south-africa', groupMax: 14 }).success).toBe(true);
  });

  it('rejects bad group and difficulty facts', () => {
    expect(tripFactsInput.safeParse({ id: UUID, difficultyLevel: 9 }).success).toBe(false);
    expect(tripFactsInput.safeParse({ id: UUID, durationDays: 0 }).success).toBe(false);
  });

  it('enforces ASCII slugs on translations', () => {
    const base = { tripId: UUID, locale: 'fr', slug: 'afrique-du-sud', title: 'T', summary: 'S', overview: 'O' };
    expect(tripTranslationInput.safeParse(base).success).toBe(true);
    expect(tripTranslationInput.safeParse({ ...base, slug: 'Afrique du Sud' }).success).toBe(false);
    expect(tripTranslationInput.safeParse({ ...base, slug: 'من-نحن' }).success).toBe(false);
  });
});

describe('departure input', () => {
  const base = {
    tripId: UUID, startDate: '2027-06-01', endDate: '2027-06-08',
    capacityMin: 2, capacityMax: 8, priceAmount: 100000,
  };
  it('accepts minimal pricing (admin-driven cents)', () => {
    expect(departureInput.safeParse(base).success).toBe(true);
  });

  it('rejects negative prices and bad amounts', () => {
    expect(departureInput.safeParse({ ...base, priceAmount: -1 }).success).toBe(false);
    expect(departureInput.safeParse({ ...base, depositPercent: 101 }).success).toBe(false);
  });

  it('rejects percent outside deposit (no percent column in DB)', () => {
    expect(departureInput.safeParse({ ...base, depositType: 'percent', depositPercent: 20 }).success).toBe(true);
    for (const field of ['singleSupplementType', 'taxType', 'feeType', 'discountType'] as const) {
      expect(departureInput.safeParse({ ...base, [field]: 'percent' }).success).toBe(false);
      expect(departureInput.safeParse({ ...base, [field]: 'fixed' }).success).toBe(true);
    }
  });
});

describe('application inputs', () => {
  const base = {
    tripId: UUID, departureId: UUID, legalName: 'Test', email: 't@test.com',
    activityAcknowledgement: true, consent: true,
  };
  it('requires acknowledgement and consent literals', () => {
    expect(applicationSubmitInput.safeParse(base).success).toBe(true);
    expect(applicationSubmitInput.safeParse({ ...base, consent: false }).success).toBe(false);
    expect(applicationSubmitInput.safeParse({ ...base, activityAcknowledgement: false }).success).toBe(false);
  });

  it('rejects bad emails', () => {
    expect(applicationSubmitInput.safeParse({ ...base, email: 'nope' }).success).toBe(false);
  });

  it('restricts review decisions and withdraw shape', () => {
    expect(applicationReviewInput.safeParse({ id: UUID, decision: 'approved' }).success).toBe(true);
    expect(applicationReviewInput.safeParse({ id: UUID, decision: 'maybe' }).success).toBe(false);
    expect(applicationWithdrawInput.safeParse({ id: UUID, email: 't@test.com' }).success).toBe(true);
  });
});

describe('checkout and payment inputs', () => {
  it('requires uuid session, email, room and terms proof', () => {
    const base = { checkoutSessionId: UUID, travelerEmail: 't@test.com', termsAccepted: true as const };
    expect(checkoutInitiateInput.safeParse(base).success).toBe(true);
    expect(checkoutInitiateInput.safeParse({ checkoutSessionId: 'nope', travelerEmail: 't@test.com', termsAccepted: true }).success).toBe(false);
    expect(checkoutInitiateInput.safeParse({ checkoutSessionId: UUID, travelerEmail: 't@test.com' }).success).toBe(false);
    expect(checkoutInitiateInput.safeParse({ ...base, termsAccepted: false }).success).toBe(false);
  });

  it('validates refund and balance shapes', () => {
    expect(paymentRefundInput.safeParse({ reservationId: UUID }).success).toBe(true);
    expect(paymentRefundInput.safeParse({ reservationId: UUID, amount: -5 }).success).toBe(false);
    expect(payBalanceInput.safeParse({ reservationId: UUID, travelerEmail: 't@test.com', locale: 'xx' }).success).toBe(false);
    expect(payBalanceInput.safeParse({ reservationId: UUID, travelerEmail: 't@test.com', locale: 'ar', termsAccepted: true }).success).toBe(true);
    expect(payBalanceInput.safeParse({ reservationId: UUID, travelerEmail: 't@test.com', locale: 'ar' }).success).toBe(false);
  });
});
