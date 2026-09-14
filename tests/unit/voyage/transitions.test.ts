import { describe, expect, it } from 'vitest';
import { TRIP_TRANSITIONS, canTransitionTrip, assertTransitionTrip } from '@/modules/trips/domain/trip-transitions';
import { DEPARTURE_TRANSITIONS, canTransitionDeparture } from '@/modules/departures/domain/departure-transitions';
import { APPLICATION_TRANSITIONS, canTransitionApplication } from '@/modules/applications/domain/application-transitions';
import { RESERVATION_TRANSITIONS, canTransitionReservation } from '@/modules/reservations/domain/reservation-transitions';
import { PAYMENT_TRANSITIONS, canTransitionPayment, newIdempotencyKey } from '@/modules/payments/domain/payment-transitions';

describe('trip transitions (TODO §8.3)', () => {
  it('allows the nominal editorial flow', () => {
    expect(canTransitionTrip('draft', 'review')).toBe(true);
    expect(canTransitionTrip('review', 'approved')).toBe(true);
    expect(canTransitionTrip('approved', 'published')).toBe(true);
    expect(canTransitionTrip('published', 'archived')).toBe(true);
  });

  it('rejects generic status jumps', () => {
    expect(canTransitionTrip('draft', 'published')).toBe(false);
    expect(() => assertTransitionTrip('draft', 'published')).toThrow();
  });

  it('restores archived trips to unpublished', () => {
    expect(canTransitionTrip('archived', 'unpublished')).toBe(true);
    expect(canTransitionTrip('published', 'unpublished')).toBe(true);
  });

  it('covers every declared status', () => {
    expect(Object.keys(TRIP_TRANSITIONS).sort()).toEqual(
      ['approved', 'archived', 'draft', 'published', 'review', 'unpublished'].sort(),
    );
  });
});

describe('departure transitions (TODO §8.4)', () => {
  it('opens, limits and completes', () => {
    expect(canTransitionDeparture('draft', 'open')).toBe(true);
    expect(canTransitionDeparture('open', 'limited')).toBe(true);
    expect(canTransitionDeparture('limited', 'open')).toBe(true);
    expect(canTransitionDeparture('closed', 'completed')).toBe(true);
  });

  it('never reopens a completed departure', () => {
    expect(canTransitionDeparture('completed', 'open')).toBe(false);
  });
});

describe('application transitions (TODO §11.3)', () => {
  it('flows through review to a decision', () => {
    expect(canTransitionApplication('draft', 'submitted')).toBe(true);
    expect(canTransitionApplication('submitted', 'under_review')).toBe(true);
    expect(canTransitionApplication('under_review', 'contact_required')).toBe(true);
    expect(canTransitionApplication('contact_required', 'approved')).toBe(true);
  });

  it('is terminal after decision', () => {
    for (const s of ['approved', 'declined', 'withdrawn', 'expired'] as const) {
      expect(APPLICATION_TRANSITIONS[s]).toEqual([]);
      expect(canTransitionApplication(s, 'under_review')).toBe(false);
    }
  });
});

describe('reservation transitions (TODO §12.1)', () => {
  it('confirms then completes', () => {
    expect(canTransitionReservation('pending', 'awaiting_payment')).toBe(true);
    expect(canTransitionReservation('awaiting_payment', 'confirmed')).toBe(true);
    expect(canTransitionReservation('confirmed', 'completed')).toBe(true);
  });
});

describe('payment transitions (TODO §13)', () => {
  it('authorizes then captures', () => {
    expect(canTransitionPayment('created', 'pending')).toBe(true);
    expect(canTransitionPayment('pending', 'authorized')).toBe(true);
    expect(canTransitionPayment('authorized', 'paid')).toBe(true);
    expect(canTransitionPayment('paid', 'refunded')).toBe(true);
  });

  it('generates unique idempotency keys', () => {
    expect(newIdempotencyKey()).not.toBe(newIdempotencyKey());
  });
});
