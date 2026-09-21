import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';

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

vi.mock('@/modules/payments/domain/providers', async (importOriginal) => {
  const mod = await importOriginal<typeof import('@/modules/payments/domain/providers')>();
  return {
    ...mod,
    selectPaymentProvider: () => ({
      name: 'mock-boom',
      createCheckoutSession: async () => ({ providerSessionId: 'x', checkoutUrl: 'http://x/' }),
      verifyWebhook: async () => {
        throw new Error('nope');
      },
      createRefund: async () => {
        const { ActionError } = await import('astro:actions');
        throw new ActionError({ code: 'FORBIDDEN', message: 'refusé par le provider' });
      },
    }),
  };
});

import { ActionError } from 'astro:actions';
import { eq } from 'drizzle-orm';
import { getDrizzle } from '@database/drizzle';
import { insertTestTrip } from '../helpers/trip-factory';
import { invalidateCache } from '@database/cache';
import { trips } from '@database/schemas/trips.schema';
import { departures } from '@database/schemas/departures.schema';
import { travelers } from '@database/schemas/travelers.schema';
import { reservations } from '@database/schemas/reservations.schema';
import { payments } from '@database/schemas/payments.schema';
import { user } from '@database/schemas';
import { refundPayment } from '@/actions/voyage/payments';
import { getTestHelpers } from '../helpers/auth';
import { purgeOutboxForTrips } from '../helpers/voyage';

const refund = (refundPayment as never as { handler: Function }).handler as Function;

const db = getDrizzle();
const stamp = Date.now().toString(36);
const TRIP = `test-rfp-${stamp}`;
const DEP = `test-rfp-dep-${stamp}`;

const adminCtx = (userId: string) =>
  ({
    locals: { user: { id: userId, role: 'admin', email: 'admin@test.com', banned: false } },
    request: { headers: new Headers(), url: 'http://localhost:4321/en/admin/trips' },
    clientAddress: '127.0.0.1',
  }) as never;

async function cleanup() {
  const res = await db.select({ id: reservations.id }).from(reservations).where(eq(reservations.tripId, TRIP)).catch(() => [] as { id: string }[]);
  await purgeOutboxForTrips(db, [TRIP]).catch(() => {});
  for (const r of res) {
    await db.delete(payments).where(eq(payments.reservationId, r.id)).catch(() => {});
    await db.delete(reservations).where(eq(reservations.id, r.id)).catch(() => {});
  }
  const trs = await db.select({ id: travelers.id, email: travelers.email }).from(travelers).catch(() => [] as { id: string; email: string }[]);
  for (const t of trs) {
    if (t.email.includes(stamp)) await db.delete(travelers).where(eq(travelers.id, t.id)).catch(() => {});
  }
  await db.delete(departures).where(eq(departures.tripId, TRIP)).catch(() => {});
  await db.delete(trips).where(eq(trips.id, TRIP)).catch(() => {});
  invalidateCache();
}

describe('refundPayment — passthrough ActionError provider', () => {
  let adminId: string;
  let helpers: Awaited<ReturnType<typeof getTestHelpers>>;

  beforeAll(async () => {
    await cleanup();
    helpers = await getTestHelpers();
    const u = helpers.createUser({ email: `rfp-admin-${stamp}@test.com`, name: 'Rfp', emailVerified: true });
    const saved = await helpers.saveUser(u);
    adminId = saved.id;
    await db.update(user).set({ role: 'admin' }).where(eq(user.id, adminId));
    await insertTestTrip(db, {
      id: TRIP, status: 'published', countryCode: 'FR', defaultCurrency: 'EUR',
      durationDays: 2, durationNights: 1, groupMin: 1, groupMax: 2, difficulty: 'easy', difficultyLevel: 1,
      publishedAt: new Date(),
    });
    await db.insert(departures).values({
      id: DEP, tripId: TRIP,
      startDate: new Date('2027-06-01T08:00:00.000Z'), endDate: new Date('2027-06-02T18:00:00.000Z'),
      status: 'open', capacityMin: 1, capacityMax: 2, priceAmount: 10000, currency: 'EUR', pricingRules: {},
    });
  });

  afterAll(async () => {
    await cleanup();
    await helpers.deleteUser(adminId).catch(() => {});
  });

  it('ActionError du provider remonte telle quelle (pas de BAD_REQUEST)', async () => {
    const [t] = await db.insert(travelers).values({ email: `rfp-${stamp}@test.com`, locale: 'en' }).returning({ id: travelers.id });
    const [r] = await db.insert(reservations).values({
      reservationNumber: `ATL-2027-P${stamp.slice(-4).toUpperCase()}`,
      travelerId: t.id, tripId: TRIP, departureId: DEP, status: 'cancelled',
      currency: 'EUR', baseAmount: 10000, totalAmount: 10000, amountPaid: 10000, amountDue: 0,
    }).returning({ id: reservations.id });
    await db.insert(payments).values({
      reservationId: r.id, provider: 'mock-boom', type: 'full_payment', status: 'paid',
      amount: 10000, currency: 'EUR', idempotencyKey: `rfp-${stamp}`, providerPaymentId: `mock_pi_rfp_${stamp}`,
    });
    const err = await refund({ reservationId: r.id }, adminCtx(adminId)).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ActionError);
    expect((err as ActionError).code).toBe('FORBIDDEN');
  });
});
