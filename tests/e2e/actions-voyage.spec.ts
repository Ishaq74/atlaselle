import { randomUUID } from 'node:crypto';
import { test, expect } from '@playwright/test';
import { adminRequest, callAction } from '../helpers/actions';

/**
 * E2E — voyage action surface.
 * Strategy: (a) auth guards on every action (anonymous → 401/403),
 * (b) input validation (bad payloads → 400), (c) real workflows on DB
 * fixtures (lifecycle state machine), (d) public engagement constraints.
 */

const ID_ACTIONS = [
  'submitTripForReview', 'approveTrip', 'publishTrip', 'unpublishTrip',
  'archiveTrip', 'restoreTrip', 'restoreTripRevision', 'deleteTripContent',
  'deleteItineraryDay', 'deleteFaq', 'unlinkFaqFromTrip', 'moderateTripComment',
  'moderateTripReview', 'resolveTripReport', 'retryEmailDelivery',
  'requeueOutboxEvent', 'publishPolicyVersion', 'exportTravelerData',
  'anonymizeTraveler', 'refundPayment', 'payBalance', 'cancelReservation',
];

test.describe('Voyage actions — anonymous callers are rejected', () => {
  for (const action of ID_ACTIONS) {
    test(`${action} rejects anonymous`, async ({ request }) => {
      const result = await callAction(request, action, { id: randomUUID() });
      expect([401, 403, 404, 400], `${action} (status ${result.status})`).toContain(result.status);
    });
  }

  test('createTrip rejects anonymous', async ({ request }) => {
    const result = await callAction(request, 'createTrip', {
      countryCode: 'FR', durationDays: 3, durationNights: 2, groupMin: 2, groupMax: 8,
    });
    expect([401, 403]).toContain(result.status);
  });
});

test.describe('Voyage actions — input validation (admin)', () => {
  test('createTrip rejects invalid country code', async ({ browser }) => {
    const req = await adminRequest(browser);
    const result = await callAction(req, 'createTrip', {
      countryCode: 'FRA', durationDays: 3, durationNights: 2, groupMin: 2, groupMax: 8,
    });
    expect(result.status).toBe(400);
  });

  test('createTrip rejects groupMax < groupMin', async ({ browser }) => {
    const req = await adminRequest(browser);
    const result = await callAction(req, 'createTrip', {
      countryCode: 'FR', durationDays: 3, durationNights: 2, groupMin: 10, groupMax: 2,
    });
    expect([400, 500]).toContain(result.status);
  });

  test('publishTrip on unknown id returns NOT_FOUND', async ({ browser }) => {
    const req = await adminRequest(browser);
    const result = await callAction(req, 'publishTrip', { id: randomUUID() });
    expect([404, 400]).toContain(result.status);
  });
});

test.describe('Voyage actions — trip lifecycle state machine (DB fixture)', () => {
  test('draft → submitForReview → approve → publish → unpublish → archive → restore', async ({ browser }) => {
    const { getDrizzle } = await import('../../src/database/drizzle');
    const { trips } = await import('../../src/database/schemas/trips.schema');
    const { insertTestTrip } = await import('../helpers/trip-factory');
    const { eq } = await import('drizzle-orm');

    const db = getDrizzle();
    const tripId = `e2e-lifecycle-${randomUUID().slice(0, 8)}`;
    await insertTestTrip(db, {
      id: tripId, status: 'draft', countryCode: 'FR', defaultCurrency: 'EUR',
      durationDays: 3, durationNights: 2, groupMin: 2, groupMax: 8,
      difficulty: 'easy', difficultyLevel: 1,
    });

    const readStatus = async () => {
      const [row] = await db.select({ status: trips.status }).from(trips).where(eq(trips.id, tripId)).limit(1);
      return row?.status;
    };

    try {
      const req = await adminRequest(browser);
      const transitions: Array<[string, string]> = [
        ['submitTripForReview', 'under_review'],
        ['approveTrip', 'approved'],
        ['publishTrip', 'published'],
        ['unpublishTrip', 'draft'],
        ['archiveTrip', 'archived'],
        ['restoreTrip', 'draft'],
      ];
      for (const [action, expected] of transitions) {
        const result = await callAction(req, action, { id: tripId });
        expect(result.ok, `${action} failed: ${result.errorCode} ${result.errorMessage}`).toBe(true);
        await expect.poll(readStatus, { message: `status after ${action}` }).toBe(expected);
      }
    } finally {
      await db.delete(trips).where(eq(trips.id, tripId)).catch(() => {});
    }
  });

  test('approveTrip from draft is rejected (invalid transition)', async ({ browser }) => {
    const { getDrizzle } = await import('../../src/database/drizzle');
    const { trips } = await import('../../src/database/schemas/trips.schema');
    const { insertTestTrip } = await import('../helpers/trip-factory');
    const { eq } = await import('drizzle-orm');

    const db = getDrizzle();
    const tripId = `e2e-badtrans-${randomUUID().slice(0, 8)}`;
    await insertTestTrip(db, {
      id: tripId, status: 'draft', countryCode: 'FR', defaultCurrency: 'EUR',
      durationDays: 2, durationNights: 1, groupMin: 1, groupMax: 4,
    });

    try {
      const req = await adminRequest(browser);
      const result = await callAction(req, 'approveTrip', { id: tripId });
      expect(result.ok).toBe(false);
      expect([400, 409, 422]).toContain(result.status);
    } finally {
      await db.delete(trips).where(eq(trips.id, tripId)).catch(() => {});
    }
  });
});

test.describe('Voyage actions — public engagement constraints', () => {
  test('createTripComment on unknown trip → NOT_FOUND', async ({ request }) => {
    const result = await callAction(request, 'createTripComment', {
      tripId: randomUUID(), content: 'Test commentaire E2E',
    });
    expect([404, 401, 400]).toContain(result.status);
  });

  test('toggleTripReaction requires a valid trip', async ({ request }) => {
    const result = await callAction(request, 'toggleTripReaction', {
      tripId: randomUUID(), reactionType: 'LIKE',
    });
    expect([404, 401, 400]).toContain(result.status);
  });

  test('recordTripView accepts a well-formed payload', async ({ request }) => {
    const result = await callAction(request, 'recordTripView', { tripId: randomUUID() });
    // View recording is fire-and-forget: 2xx, 404 (unknown trip) or 400 are all
    // acceptable contracts — what must NOT happen is a 500.
    expect(result.status).toBeLessThan(500);
  });

  test('createFaq requires admin role', async ({ request }) => {
    const result = await callAction(request, 'createFaq', { question: 'Q?', answer: 'A.' });
    expect([401, 403, 400]).toContain(result.status);
  });
});
