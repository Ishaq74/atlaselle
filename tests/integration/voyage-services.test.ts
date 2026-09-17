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

import { eq } from 'drizzle-orm';
import { getDrizzle } from '@database/drizzle';
import { invalidateCache } from '@database/cache';
import { trips } from '@database/schemas/trips.schema';
import { departures } from '@database/schemas/departures.schema';
import { travelers } from '@database/schemas/travelers.schema';
import { applications, applicationEvents } from '@database/schemas/applications.schema';
import { reservations, reservationPriceSnapshots } from '@database/schemas/reservations.schema';
import { payments, checkoutSessions } from '@database/schemas/payments.schema';
import { outboxEvents } from '@database/schemas/outbox.schema';
import { emailDeliveries } from '@database/schemas/email-voyage.schema';
import { deleteOutboxFor } from '../helpers/voyage';
import { createReservation,
  applyPaymentToReservation,
  cancelReservation as cancelReservationService,
  markBalanceDue,
  newReservationNumber,
} from '@/modules/reservations/domain/reservation-service';
import { expireApplications } from '@/modules/applications/domain/application-service';
import { refundReservationPayments } from '@/modules/payments/domain/refund-service';
import {
  createApplicationCheckout,
  getValidCheckoutSession,
  markCheckoutCompleted,
  expireCheckoutSessions,
} from '@/modules/payments/domain/checkout-service';
import { routeOutboxToEmail } from '@/modules/email-voyage/domain/voyage-email-worker';
import { sendVoyageEmail } from '@/modules/email-voyage/domain/voyage-email';

const db = getDrizzle();
const stamp = Date.now().toString(36);
const TRIP_ID = `test-svc-${stamp}`;
const DEP_ID = `test-svc-dep-${stamp}`;

const QUOTE = {
  baseAmount: 100000, supplementAmount: 0, discountAmount: 0, taxAmount: 0,
  feeAmount: 0, totalAmount: 100000, depositAmount: 20000, balanceAmount: 80000, currency: 'EUR',
};

async function mkTraveler(email: string) {
  const [t] = await db.insert(travelers).values({ email, locale: 'en' }).returning({ id: travelers.id });
  return t.id;
}

async function cleanup() {
  const apps = await db.select({ id: applications.id }).from(applications).where(eq(applications.tripId, TRIP_ID)).catch(() => [] as { id: string }[]);
  const res = await db.select({ id: reservations.id }).from(reservations).where(eq(reservations.tripId, TRIP_ID)).catch(() => [] as { id: string }[]);
  const trs = await db.select({ id: travelers.id, email: travelers.email }).from(travelers).catch(() => [] as { id: string; email: string }[]);
  const mine = trs.filter((t) => t.email.includes(stamp));
  await deleteOutboxFor(db, {
    applicationIds: apps.map((a) => a.id),
    reservationIds: res.map((r) => r.id),
    travelerIds: mine.map((t) => t.id),
    tripIds: [TRIP_ID],
  }).catch(() => {});
  for (const a of apps) {
    await db.delete(applicationEvents).where(eq(applicationEvents.applicationId, a.id)).catch(() => {});
    await db.delete(checkoutSessions).where(eq(checkoutSessions.applicationId, a.id)).catch(() => {});
    await db.delete(applications).where(eq(applications.id, a.id)).catch(() => {});
  }
  for (const r of res) {
    await db.delete(payments).where(eq(payments.reservationId, r.id)).catch(() => {});
    await db.delete(reservationPriceSnapshots).where(eq(reservationPriceSnapshots.reservationId, r.id)).catch(() => {});
    await db.delete(checkoutSessions).where(eq(checkoutSessions.reservationId, r.id)).catch(() => {});
    await db.delete(reservations).where(eq(reservations.id, r.id)).catch(() => {});
  }
  for (const t of mine) {
    await db.delete(emailDeliveries).where(eq(emailDeliveries.travelerId, t.id)).catch(() => {});
    await db.delete(travelers).where(eq(travelers.id, t.id)).catch(() => {});
  }
  await db.delete(departures).where(eq(departures.tripId, TRIP_ID)).catch(() => {});
  await db.delete(trips).where(eq(trips.id, TRIP_ID)).catch(() => {});
  invalidateCache();
}

beforeAll(cleanup);

describe('reservation-service direct', () => {
  let travelerId: string;

  beforeAll(async () => {
    await db.insert(trips).values({
      id: TRIP_ID, status: 'published', countryCode: 'FR', defaultCurrency: 'EUR',
      durationDays: 4, durationNights: 3, groupMin: 1, groupMax: 5, difficulty: 'easy', difficultyLevel: 1,
      publishedAt: new Date(),
    });
    await db.insert(departures).values({
      id: DEP_ID, tripId: TRIP_ID,
      startDate: new Date(Date.now() + 60 * 86_400_000), endDate: new Date(Date.now() + 63 * 86_400_000),
      status: 'open', capacityMin: 1, capacityMax: 5, priceAmount: 100000, currency: 'EUR', pricingRules: {},
    });
    travelerId = await mkTraveler(`svc-${stamp}@test.com`);
  });

  it('createReservation pending + snapshot immuable + accord', async () => {
    const created = await createReservation({
      travelerId, tripId: TRIP_ID, departureId: DEP_ID, applicationId: null,
      quote: QUOTE, agreementVersionId: 'v1',
    });
    expect(created.status).toBe('pending');
    expect(created.amountDue).toBe(100000);
    expect(created.acceptedAt).not.toBeNull();
    const snaps = await db.select().from(reservationPriceSnapshots).where(eq(reservationPriceSnapshots.reservationId, created.id));
    expect(snaps).toHaveLength(1);
    expect((snaps[0].snapshot as typeof QUOTE).totalAmount).toBe(100000);
    const noAgreement = await createReservation({ travelerId, tripId: TRIP_ID, departureId: DEP_ID, quote: QUOTE });
    expect(noAgreement.acceptedAt).toBeNull();
  });

  it('collision de numéro -> rejoue sans jeter', async () => {
    const rand = vi.spyOn(Math, 'random').mockReturnValueOnce(0.123456789);
    const taken = newReservationNumber();
    rand.mockRestore();
    await db.insert(reservations).values({
      reservationNumber: taken,
      travelerId, tripId: TRIP_ID, departureId: DEP_ID, status: 'pending',
      currency: 'EUR', baseAmount: 1, totalAmount: 1, amountPaid: 0, amountDue: 1,
    });
    const retry = vi.spyOn(Math, 'random').mockReturnValueOnce(0.123456789).mockReturnValue(0.987654321);
    try {
      const created = await createReservation({ travelerId, tripId: TRIP_ID, departureId: DEP_ID, quote: QUOTE });
      expect(created.reservationNumber).not.toBe(taken);
    } finally {
      retry.mockRestore();
    }
  });

  it('collision persistante (3 essais) -> jette la dernière erreur', async () => {
    const stuck = vi.spyOn(Math, 'random').mockReturnValue(0.111111111);
    const first = newReservationNumber();
    await db.insert(reservations).values({
      reservationNumber: first,
      travelerId, tripId: TRIP_ID, departureId: DEP_ID, status: 'pending',
      currency: 'EUR', baseAmount: 1, totalAmount: 1, amountPaid: 0, amountDue: 1,
    });
    try {
      await expect(
        createReservation({ travelerId, tripId: TRIP_ID, departureId: DEP_ID, quote: QUOTE }),
      ).rejects.toMatchObject({ cause: { code: '23505' } });
    } finally {
      stuck.mockRestore();
    }
  });

  it('applyPayment awaiting->confirmed->completed, stay, erreurs', async () => {
    const r = await createReservation({ travelerId, tripId: TRIP_ID, departureId: DEP_ID, quote: QUOTE });
    await db.update(reservations).set({ status: 'awaiting_payment' }).where(eq(reservations.id, r.id));
    const c1 = await applyPaymentToReservation(r.id, 20000);
    expect(c1.status).toBe('confirmed');
    expect(c1.amountPaid).toBe(20000);
    expect(c1.confirmedAt).not.toBeNull();
    const c2 = await applyPaymentToReservation(r.id, 10000);
    expect(c2.status).toBe('confirmed');
    expect(c2.confirmedAt).toEqual(c1.confirmedAt);
    const c3 = await applyPaymentToReservation(r.id, 70000);
    expect(c3.status).toBe('completed');
    await expect(applyPaymentToReservation('00000000-0000-0000-0000-000000000000', 10)).rejects.toThrow(/introuvable/);
    const p = await createReservation({ travelerId, tripId: TRIP_ID, departureId: DEP_ID, quote: QUOTE });
    await expect(applyPaymentToReservation(p.id, 10)).rejects.toThrow(/impossible/);
  });

  it('cancelReservation direct : inconnu, transition illégale, sans départ, happy + outbox', async () => {
    await expect(cancelReservationService('00000000-0000-0000-0000-000000000000')).rejects.toThrow(/introuvable/);
    const done = await createReservation({ travelerId, tripId: TRIP_ID, departureId: DEP_ID, quote: QUOTE });
    await db.update(reservations).set({ status: 'refunded' }).where(eq(reservations.id, done.id));
    await expect(cancelReservationService(done.id)).rejects.toThrow();
    // Note : le cas "départ manquant → refund 0" est inatteignable sous FK
    // (reservations.departure_id → departures) ; couvert par le happy path.
    const ok = await createReservation({ travelerId, tripId: TRIP_ID, departureId: DEP_ID, quote: QUOTE });
    await db.update(reservations).set({ status: 'confirmed', amountPaid: 100000 }).where(eq(reservations.id, ok.id));
    const r2 = await cancelReservationService(ok.id);
    expect(r2.refundAmount).toBe(100000);
    expect(r2.tier).toBe('free');
    expect(r2.reservation?.cancelledAt).not.toBeNull();
    const events = await db.select().from(outboxEvents).where(eq(outboxEvents.aggregateId, ok.id));
    expect(events.some((e) => e.eventType === 'reservation.cancelled')).toBe(true);
  });

  it('markBalanceDue ignore non-éligibles', async () => {
    expect(await markBalanceDue(new Date('2020-01-01'))).toBe(0);
  });

  it('cancel expire les sessions checkout ouvertes liées', async () => {
    const t = await mkTraveler(`cx2-${stamp}@test.com`);
    const [a] = await db.insert(applications).values({
      travelerId: t, tripId: TRIP_ID, departureId: DEP_ID, status: 'approved',
      activityAcknowledgement: true, consent: true, submittedAt: new Date(),
    }).returning({ id: applications.id });
    const r = await createReservation({ travelerId: t, tripId: TRIP_ID, departureId: DEP_ID, applicationId: a.id, quote: QUOTE });
    await db.update(reservations).set({ status: 'confirmed', amountPaid: 20000 }).where(eq(reservations.id, r.id));
    const s = await createApplicationCheckout(a.id, DEP_ID);
    await db.update(checkoutSessions).set({ reservationId: r.id }).where(eq(checkoutSessions.id, s.id));
    await cancelReservationService(r.id);
    const [sess] = await db.select().from(checkoutSessions).where(eq(checkoutSessions.id, s.id)).limit(1);
    expect(sess.status).toBe('cancelled');
  });
});

afterAll(cleanup);

describe('expireApplications direct', () => {
  it('stale -> expired + event ; récents, décidés et null ignorés (now figé 2021)', async () => {
    // now figé en 2021 : cutoff 2021-05-02. Les fixtures des autres workers
    // (dates réelles) sont intouchables, et leurs appels n'atteignent pas 2021.
    const now = new Date('2021-06-01T00:00:00.000Z');
    const old = new Date('2021-01-01T00:00:00.000Z');
    const mk = async (status: 'submitted' | 'under_review' | 'contact_required' | 'approved', submittedAt: Date | null, email: string) => {
      const tid = await mkTraveler(email);
      const [a] = await db.insert(applications).values({
        travelerId: tid, tripId: TRIP_ID, departureId: DEP_ID, status,
        activityAcknowledgement: true, consent: true, submittedAt,
      }).returning({ id: applications.id });
      return a.id;
    };
    const t = await mkTraveler(`exp-${stamp}@test.com`);
    const s1 = await mk('submitted', old, `exp1-${stamp}@test.com`);
    const s2 = await mk('under_review', old, `exp2-${stamp}@test.com`);
    const s3 = await mk('contact_required', old, `exp3-${stamp}@test.com`);
    const exact = await mk('submitted', new Date('2021-05-02T00:00:00.000Z'), `exp4-${stamp}@test.com`);
    const keep1 = await mk('submitted', new Date(), `exp5-${stamp}@test.com`);
    const keep2 = await mk('approved', old, `exp6-${stamp}@test.com`);
    const [nullSubRow] = await db.insert(applications).values({
      travelerId: t, tripId: TRIP_ID, departureId: DEP_ID, status: 'submitted',
      activityAcknowledgement: true, consent: true, submittedAt: null,
    }).returning({ id: applications.id });
    const nullSub = nullSubRow.id;
    const n = await expireApplications(now);
    expect(typeof n).toBe('number');
    for (const id of [s1, s2, s3, exact]) {
      const [row] = await db.select().from(applications).where(eq(applications.id, id)).limit(1);
      expect(row.status).toBe('expired');
    }
    const ev = await db.select().from(applicationEvents).where(eq(applicationEvents.applicationId, s1));
    expect(ev.some((e) => e.event === 'expired')).toBe(true);
    for (const [id, expected] of [[keep1, 'submitted'], [keep2, 'approved'], [nullSub, 'submitted']] as const) {
      const [row] = await db.select().from(applications).where(eq(applications.id, id)).limit(1);
      expect(row.status).toBe(expected);
    }
  });
});

describe('refund-service direct', () => {
  it('aucun paid, montants invalides', async () => {
    const t = await mkTraveler(`ref-${stamp}@test.com`);
    const r = await createReservation({ travelerId: t, tripId: TRIP_ID, departureId: DEP_ID, quote: QUOTE });
    await expect(refundReservationPayments(r.id)).rejects.toThrow(/remboursable/);
    await db.insert(payments).values({
      reservationId: r.id, provider: 'mock', type: 'full_payment', status: 'paid',
      amount: 100000, currency: 'EUR', idempotencyKey: `ref-${stamp}`, providerPaymentId: `mock_pi_${stamp}`,
    });
    await expect(refundReservationPayments(r.id, 0)).rejects.toThrow(/invalide/);
    await expect(refundReservationPayments(r.id, -5)).rejects.toThrow(/invalide/);
    await expect(refundReservationPayments(r.id, 200000)).rejects.toThrow(/invalide/);
  });

  it('deux remboursements concurrents -> un seul passe (verrou FOR UPDATE)', async () => {
    const t = await mkTraveler(`refcc-${stamp}@test.com`);
    const r = await createReservation({ travelerId: t, tripId: TRIP_ID, departureId: DEP_ID, quote: QUOTE });
    await db.update(reservations).set({ status: 'cancelled', amountPaid: 100000 }).where(eq(reservations.id, r.id));
    await db.insert(payments).values({
      reservationId: r.id, provider: 'mock', type: 'full_payment', status: 'paid',
      amount: 100000, currency: 'EUR', idempotencyKey: `refcc-${stamp}`, providerPaymentId: `mock_pi_cc_${stamp}`,
    });
    const [one, two] = await Promise.allSettled([
      refundReservationPayments(r.id, 60000),
      refundReservationPayments(r.id, 60000),
    ]);
    const fulfilled = [one, two].filter((s) => s.status === 'fulfilled');
    const rejected = [one, two].filter((s) => s.status === 'rejected');
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    const [p] = await db.select().from(payments).where(eq(payments.reservationId, r.id)).limit(1);
    expect(p.status).toBe('partially_refunded');
    expect((p.metadata as { refundedAmount?: number }).refundedAmount).toBe(60000);
  });

  it('partiel garde cancelled, total passe refunded + outbox', async () => {
    const t = await mkTraveler(`ref2-${stamp}@test.com`);
    const r = await createReservation({ travelerId: t, tripId: TRIP_ID, departureId: DEP_ID, quote: QUOTE });
    await db.update(reservations).set({ status: 'cancelled', amountPaid: 100000 }).where(eq(reservations.id, r.id));
    await db.insert(payments).values({
      reservationId: r.id, provider: 'mock', type: 'full_payment', status: 'paid',
      amount: 100000, currency: 'EUR', idempotencyKey: `ref2-${stamp}`, providerPaymentId: `mock_pi2_${stamp}`,
    });
    const part = await refundReservationPayments(r.id, 50000);
    expect(part.refunded).toBe(true);
    expect(part.amount).toBe(50000);
    const [p1] = await db.select().from(payments).where(eq(payments.reservationId, r.id)).limit(1);
    expect(p1.status).toBe('partially_refunded');
    const [stillCancelled] = await db.select().from(reservations).where(eq(reservations.id, r.id)).limit(1);
    expect(stillCancelled.status).toBe('cancelled');
    // second partiel au-delà du restant -> refusé (pas de sur-remboursement)
    await expect(refundReservationPayments(r.id, 60000)).rejects.toThrow(/invalide/);
    const full = await refundReservationPayments(r.id, 50000);
    expect(full.refunded).toBe(true);
    const [p2] = await db.select().from(payments).where(eq(payments.reservationId, r.id)).limit(1);
    expect(p2.status).toBe('refunded');
    const [res] = await db.select().from(reservations).where(eq(reservations.id, r.id)).limit(1);
    expect(res.status).toBe('refunded');
    const events = await db.select().from(outboxEvents).where(eq(outboxEvents.aggregateId, p2.id));
    expect(events.some((e) => e.eventType === 'payment.refunded')).toBe(true);
  });
});

describe('checkout-service happy + expire multi', () => {
  it('session valide puis complétée -> null ; expire 2 sessions', async () => {
    let n = 0;
    const mkApp = async (status: 'approved' | 'submitted') => {
      n += 1;
      const tid = await mkTraveler(`cko${n}-${stamp}@test.com`);
      const [a] = await db.insert(applications).values({
        travelerId: tid, tripId: TRIP_ID, departureId: DEP_ID, status,
        activityAcknowledgement: true, consent: true, submittedAt: new Date(),
      }).returning({ id: applications.id });
      return { appId: a.id, travelerId: tid };
    };
    const { appId: okId, travelerId: t } = await mkApp('approved');
    const s = await createApplicationCheckout(okId, DEP_ID);
    const valid = await getValidCheckoutSession(s.id);
    expect(valid?.session.id).toBe(s.id);
    expect(valid?.application.id).toBe(okId);
    await markCheckoutCompleted(s.id, (await createReservation({ travelerId: t, tripId: TRIP_ID, departureId: DEP_ID, quote: QUOTE })).id);
    expect(await getValidCheckoutSession(s.id)).toBeNull();
    const { appId: a1 } = await mkApp('approved');
    const { appId: a2 } = await mkApp('approved');
    const e1 = await createApplicationCheckout(a1, DEP_ID);
    const e2 = await createApplicationCheckout(a2, DEP_ID);
    await db.update(checkoutSessions).set({ expiresAt: new Date('2021-01-01') }).where(eq(checkoutSessions.id, e1.id));
    await db.update(checkoutSessions).set({ expiresAt: new Date('2021-01-01') }).where(eq(checkoutSessions.id, e2.id));
    await db.update(checkoutSessions).set({ status: 'completed' }).where(eq(checkoutSessions.id, e1.id));
    expect(await expireCheckoutSessions(new Date())).toBeGreaterThanOrEqual(1);
    const [done] = await db.select().from(checkoutSessions).where(eq(checkoutSessions.id, e1.id)).limit(1);
    expect(done.status).toBe('completed');
  });
});

describe('email routing + batch', () => {
  const stub = async () => {};
  let appId: string;

  beforeAll(async () => {
    const t = await mkTraveler(`mail-${stamp}@test.com`);
    const [a] = await db.insert(applications).values({
      travelerId: t, tripId: TRIP_ID, departureId: DEP_ID, status: 'submitted',
      activityAcknowledgement: true, consent: true, submittedAt: new Date(),
    }).returning({ id: applications.id });
    appId = a.id;
  });

  it('route les 7 templates, inconnu -> false, sans traveler -> false', async () => {
    for (const evt of ['application.submitted', 'application.approved', 'application.contact_required', 'application.declined', 'checkout.started', 'payment.received', 'booking.confirmed']) {
      expect(await routeOutboxToEmail(evt, { applicationId: appId }, stub)).toBe(true);
    }
    expect(await routeOutboxToEmail('nope.unknown', { applicationId: appId }, stub)).toBe(false);
    expect(await routeOutboxToEmail('application.submitted', { applicationId: '00000000-0000-0000-0000-000000000000' }, stub)).toBe(false);
  });

  it('SITE_URL absent -> repli localhost dans les liens', async () => {
    const calls: { html: string }[] = [];
    const capture = async (p: { html: string }) => {
      calls.push(p);
    };
    const { createApplicationCheckout: mkCheckout } = await import('@/modules/payments/domain/checkout-service');
    await mkCheckout(appId, DEP_ID);
    const prev = process.env.SITE_URL;
    delete process.env.SITE_URL;
    try {
      expect(await routeOutboxToEmail('application.submitted', { applicationId: appId }, capture)).toBe(true);
    } finally {
      if (prev === undefined) delete process.env.SITE_URL;
      else process.env.SITE_URL = prev;
    }
    expect(calls.length).toBeGreaterThanOrEqual(1);
    expect(calls[0].html).toContain('http://localhost:4321');
  });

  it('sendVoyageEmail fallback locale + lastError unknown', async () => {
    const ok = await sendVoyageEmail({ template: 'application_received', locale: 'xx' as never, toEmail: `x-${stamp}@test.com` }, stub);
    expect(ok.sent).toBe(true);
    const [row] = await db.select().from(emailDeliveries).where(eq(emailDeliveries.id, ok.deliveryId)).limit(1);
    expect(row.locale).toBe('en');
    const boom = async () => { throw 'chaîne non-Error'; };
    const ko = await sendVoyageEmail({ template: 'application_received', locale: 'en', toEmail: `y-${stamp}@test.com` }, boom as never);
    expect(ko.sent).toBe(false);
    const [row2] = await db.select().from(emailDeliveries).where(eq(emailDeliveries.id, ko.deliveryId)).limit(1);
    expect(row2.lastError).toBe('unknown');
  });
  // Note : processEmailOutboxBatch() n'est pas appelé ici — il réclame les plus
  // anciens pending GLOBAUX et affamerait les autres workers parallèles.
  // Le routage (dont inconnu -> false) est couvert ci-dessus, le batch par email-worker.test.ts.
});
