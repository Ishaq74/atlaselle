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
import { insertTestTrip } from '../helpers/trip-factory';
import { invalidateCache } from '@database/cache';
import { trips, tripTranslations } from '@database/schemas/trips.schema';
import { itineraryDays, itineraryDayTranslations } from '@database/schemas/itinerary.schema';
import { tripHighlights, tripHighlightTranslations } from '@database/schemas/trips.schema';
import { departures, seatHolds } from '@database/schemas/departures.schema';
import { travelers } from '@database/schemas/travelers.schema';
import { applications } from '@database/schemas/applications.schema';
import { reservations } from '@database/schemas/reservations.schema';
import { payments } from '@database/schemas/payments.schema';
import { emailDeliveries } from '@database/schemas/email-voyage.schema';
import { loadTripPage, loadTripsList } from '@/modules/trips/loaders/trip.loader';
import { loadVoyageHealth } from '@/modules/trips/loaders/admin-health.loader';
import { sendBalanceReminders, sendTripReminders } from '@/modules/email-voyage/domain/reminders';
import { routeOutboxToEmail } from '@/modules/email-voyage/domain/voyage-email-worker';
import type { Locale } from '@/i18n/config';

const db = getDrizzle();
const stamp = Date.now().toString(36);
const TRIP = `test-pg-${stamp}`;
const stub = async () => {};

async function mkTraveler(email: string, locale = 'en') {
  const [t] = await db.insert(travelers).values({ email, locale: locale as never }).returning({ id: travelers.id });
  return t.id;
}

async function cleanup() {
  const apps = await db.select({ id: applications.id }).from(applications).where(eq(applications.tripId, TRIP)).catch(() => [] as { id: string }[]);
  for (const a of apps) await db.delete(applications).where(eq(applications.id, a.id)).catch(() => {});
  const res = await db.select({ id: reservations.id }).from(reservations).where(eq(reservations.tripId, TRIP)).catch(() => [] as { id: string }[]);
  for (const r of res) {
    await db.delete(payments).where(eq(payments.reservationId, r.id)).catch(() => {});
    await db.delete(emailDeliveries).where(eq(emailDeliveries.reservationId, r.id)).catch(() => {});
    await db.delete(reservations).where(eq(reservations.id, r.id)).catch(() => {});
  }
  const myDays = await db.select({ id: itineraryDays.id }).from(itineraryDays).where(eq(itineraryDays.tripId, TRIP)).catch(() => [] as { id: string }[]);
  for (const d of myDays) {
    await db.delete(itineraryDayTranslations).where(eq(itineraryDayTranslations.dayId, d.id)).catch(() => {});
    await db.delete(itineraryDays).where(eq(itineraryDays.id, d.id)).catch(() => {});
  }
  const hls = await db.select({ id: tripHighlights.id }).from(tripHighlights).where(eq(tripHighlights.tripId, TRIP)).catch(() => [] as { id: string }[]);
  for (const h of hls) {
    await db.delete(tripHighlightTranslations).where(eq(tripHighlightTranslations.highlightId, h.id)).catch(() => {});
    await db.delete(tripHighlights).where(eq(tripHighlights.id, h.id)).catch(() => {});
  }
  await db.delete(tripTranslations).where(eq(tripTranslations.tripId, TRIP)).catch(() => {});
  await db.delete(departures).where(eq(departures.tripId, TRIP)).catch(() => {});
  await db.delete(trips).where(eq(trips.id, TRIP)).catch(() => {});
  await db.delete(tripTranslations).where(eq(tripTranslations.tripId, `pg-hl-trip-${stamp}`)).catch(() => {});
  await db.delete(trips).where(eq(trips.id, `pg-hl-trip-${stamp}`)).catch(() => {});
  const trs = await db.select({ id: travelers.id, email: travelers.email }).from(travelers).catch(() => [] as { id: string; email: string }[]);
  for (const t of trs) {
    if (t.email.includes(stamp)) {
      await db.delete(emailDeliveries).where(eq(emailDeliveries.travelerId, t.id)).catch(() => {});
      await db.delete(travelers).where(eq(travelers.id, t.id)).catch(() => {});
    }
  }
  invalidateCache();
}

beforeAll(async () => {
  await cleanup();
  await insertTestTrip(db, {
    id: TRIP, status: 'published', countryCode: 'FR', defaultCurrency: 'EUR',
    durationDays: 4, durationNights: 3, groupMin: 2, groupMax: 8, difficulty: 'easy', difficultyLevel: 2,
    publishedAt: new Date(),
  });
  await db.insert(tripTranslations).values([
    { id: `pg-fr-${stamp}`, tripId: TRIP, locale: 'fr', slug: `pg-fr-${stamp}`, title: 'PG FR', summary: 'S', overview: 'O', localeVisible: true, lodging: 'Gîte' },
    { id: `pg-en-${stamp}`, tripId: TRIP, locale: 'en', slug: `pg-en-${stamp}`, title: 'PG EN', summary: 'S', overview: 'O', localeVisible: true },
    { id: `pg-es-${stamp}`, tripId: TRIP, locale: 'es', slug: `pg-es-${stamp}`, title: 'PG ES', summary: 'S', overview: 'O', localeVisible: false },
    { id: `pg-ar-${stamp}`, tripId: TRIP, locale: 'ar', slug: `pg-en-${stamp}`, title: 'PG AR', summary: 'S', overview: 'O', localeVisible: true },
  ]);
  const [day] = await db.insert(itineraryDays).values({ tripId: TRIP, dayNumber: 1, location: 'X' }).returning({ id: itineraryDays.id });
  await db.insert(itineraryDayTranslations).values({ dayId: day.id, locale: 'en', title: 'EN Day', morning: 'Sun' });
  const [hl] = await db.insert(tripHighlights).values({ tripId: TRIP, sortOrder: 0 }).returning({ id: tripHighlights.id });
  await db.insert(tripHighlightTranslations).values({ highlightId: hl.id, locale: 'en', title: 'EN Highlight' });
});

afterAll(cleanup);

describe('trip.loader — fallbacks page publique', () => {
  it('non-publié et locale masquée -> null', async () => {
    expect(await loadTripPage('en', 'does-not-exist-pg')).toBeNull();
    expect(await loadTripPage('es', `pg-es-${stamp}`)).toBeNull();
    await db.update(trips).set({ status: 'draft' }).where(eq(trips.id, TRIP));
    invalidateCache();
    expect(await loadTripPage('fr', `pg-fr-${stamp}`)).toBeNull();
    await db.update(trips).set({ status: 'published' }).where(eq(trips.id, TRIP));
    invalidateCache();
  });

  it('sans départ -> interest-list, 0 restant, prix 0, devise/capacité repli, roomRule', async () => {
    const dto = await loadTripPage('fr', `pg-fr-${stamp}`);
    expect(dto?.status).toBe('interest-list');
    expect(dto?.remainingPlaces).toBe(0);
    expect(dto?.price).toBe(0);
    expect(dto?.currency).toBe('EUR');
    expect(dto?.capacity).toBe(8);
    expect(dto?.roomRule).toBe('Gîte');
    expect(dto?.dates).toBe('');
  });

  it('repli EN pour itinéraire/highlights, traductions es/ar présentes, locales visibles', async () => {
    const dto = await loadTripPage('fr', `pg-fr-${stamp}`);
    expect(dto?.translations.fr.itinerary[0].title).toBe('EN Day');
    expect(dto?.translations.fr.highlights).toEqual(['EN Highlight']);
    expect(dto?.translations.es.slug).toBeTruthy();
    expect(dto?.translations.ar.slug).toBeTruthy();
    // spec §7.5 : es masqué -> ni listé ni alterné
    expect(dto?.visibleLocales).toEqual(expect.arrayContaining(['fr', 'en', 'ar']));
    expect(dto?.visibleLocales).not.toContain('es');
    const listEs = await loadTripsList('es');
    expect(listEs.find((t) => t.id === TRIP)).toBeUndefined();
    const listEn = await loadTripsList('en');
    expect(listEn.find((t) => t.id === TRIP)?.slug).toBe(`pg-en-${stamp}`);
  });

  it('capacité : holds expirés ignorés, confirmés comptés', async () => {
    const t = await mkTraveler(`holds-${stamp}@test.com`);
    const [dep] = await db.insert(departures).values({
      id: `pg-hold-dep-${stamp}`, tripId: TRIP,
      startDate: new Date('2027-06-01T08:00:00.000Z'), endDate: new Date('2027-06-04T18:00:00.000Z'),
      status: 'open', capacityMin: 1, capacityMax: 5, priceAmount: 100, currency: 'EUR', pricingRules: {},
    }).returning({ id: departures.id });
    await db.insert(seatHolds).values([
      { departureId: dep.id, quantity: 1, status: 'active', expiresAt: new Date(Date.now() + 30 * 60_000) },
      { departureId: dep.id, quantity: 2, status: 'active', expiresAt: new Date(Date.now() - 60_000) },
    ]);
    const [r] = await db.insert(reservations).values({
      reservationNumber: `ATL-2027-H${stamp.slice(-4).toUpperCase()}`,
      travelerId: t, tripId: TRIP, departureId: dep.id, status: 'confirmed',
      currency: 'EUR', baseAmount: 100, totalAmount: 100, amountPaid: 100, amountDue: 0,
    }).returning({ id: reservations.id });
    const { getAvailability } = await import('@/modules/availability/domain/availability-service');
    const snap = await getAvailability(dep.id);
    // 5 - 1 confirmé - 1 hold actif (l'expiré de 2 ignoré)
    expect(snap?.availableSeats).toBe(3);
    await db.delete(reservations).where(eq(reservations.id, r.id));
    await db.delete(seatHolds).where(eq(seatHolds.departureId, dep.id));
    await db.delete(departures).where(eq(departures.id, dep.id));
  });

  it('closed seul -> interest-list ; limited -> open ; arrondis prix/acompte', async () => {
    await db.insert(departures).values({
      id: `pg-dep-c-${stamp}`, tripId: TRIP,
      startDate: new Date('2027-06-01T08:00:00.000Z'), endDate: new Date('2027-06-04T18:00:00.000Z'),
      status: 'closed', capacityMin: 1, capacityMax: 5, priceAmount: 10050, currency: 'USD',
      depositType: 'fixed', depositAmount: 1999, pricingRules: {},
    });
    invalidateCache();
    const closed = await loadTripPage('en', `pg-en-${stamp}`);
    expect(closed?.status).toBe('interest-list');
    await db.update(departures).set({ status: 'limited' }).where(eq(departures.id, `pg-dep-c-${stamp}`));
    invalidateCache();
    const lim = await loadTripPage('en', `pg-en-${stamp}`);
    expect(lim?.status).toBe('open');
    expect(lim?.price).toBe(101);
    expect(lim?.deposit).toBe(20);
    expect(lim?.currency).toBe('USD');
    // acompte percent recalculé serveur (pas le montant brut)
    await db.update(departures).set({ depositType: 'percent', depositPercent: 25, depositAmount: 0 }).where(eq(departures.id, `pg-dep-c-${stamp}`));
    invalidateCache();
    const pct = await loadTripPage('en', `pg-en-${stamp}`);
    expect(pct?.deposit).toBe(25);
    await db.delete(departures).where(eq(departures.id, `pg-dep-c-${stamp}`));
    invalidateCache();
  });
});

describe('admin-health — sémantique exacte', () => {
  it('chaque compteur égale sa requête directe (stable après retries)', async () => {
    const { and, gte, lte, sql } = await import('drizzle-orm');
    const { applications: apps } = await import('@database/schemas/applications.schema');
    const { departures: deps } = await import('@database/schemas/departures.schema');
    const { payments: pays } = await import('@database/schemas/payments.schema');
    const { reservations: ress } = await import('@database/schemas/reservations.schema');
    const { tripTranslations: trs } = await import('@database/schemas/trips.schema');
    const now = new Date();
    const week = new Date(now.getTime() + 7 * 86_400_000);
    const lastWeek = new Date(now.getTime() - 7 * 86_400_000);
    const one = async (q: Promise<{ n: number }[]>) => (await q)[0]?.n ?? 0;
    // Workers parallèles partagent la DB : un setup/teardown voisin peut tomber
    // entre les deux lectures. On reconverge (une divergence SQL réelle échoue
    // à chaque tentative de façon déterministe).
    let last = '';
    for (let attempt = 0; attempt < 5; attempt++) {
      const health = await loadVoyageHealth(now);
      const directs = [
        health.pendingApplications,
        await one(db.select({ n: sql<number>`count(*)::int` }).from(apps).where(eq(apps.status, 'under_review'))),
        health.openDepartures,
        await one(db.select({ n: sql<number>`count(*)::int` }).from(deps).where(eq(deps.status, 'open'))),
        health.upcomingDepartures7d,
        await one(
          db.select({ n: sql<number>`count(*)::int` }).from(deps).where(and(gte(deps.startDate, now), lte(deps.startDate, week))),
        ),
        health.recentReservations7d,
        await one(db.select({ n: sql<number>`count(*)::int` }).from(ress).where(gte(ress.createdAt, lastWeek))),
        health.failedPayments,
        await one(db.select({ n: sql<number>`count(*)::int` }).from(pays).where(eq(pays.status, 'failed'))),
        health.balancesDue,
        await one(db.select({ n: sql<number>`count(*)::int` }).from(ress).where(eq(ress.status, 'balance_due'))),
        health.unpublishedTrips,
        await one(db.select({ n: sql<number>`count(*)::int` }).from(trs).where(eq(trs.localeVisible, false))),
      ];
      let ok = true;
      for (let i = 0; i < directs.length; i += 2) {
        if (directs[i] !== directs[i + 1]) {
          ok = false;
          break;
        }
      }
      for (const v of Object.values(health)) {
        expect(Number.isInteger(v)).toBe(true);
        expect(v).toBeGreaterThanOrEqual(0);
      }
      if (ok) return;
      last = JSON.stringify(health);
      await new Promise((r) => setTimeout(r, 100));
    }
    expect.unreachable(`compteurs instables après retries : ${last}`);
  });
});

describe('reminders — fenêtres et exclusions', () => {
  // now FIGÉ en 2028 : les fenêtres [now, +7j] / [J-30, J+3] ne recoupent aucune
  // fixture des autres workers (dates réelles 2026-2027) — isolation temporelle.
  // Les scans post ouverts (passé sans borne) restent globaux : asserts idempotents.
  const now = new Date('2028-06-01T00:00:00.000Z');
  let mkResCount = 0;

  async function mkRes(status: 'confirmed' | 'pending' | 'completed', balanceDueDate: Date | null, startInDays: number, endInDays: number, email: string, currency = 'EUR', locale = 'en') {
    mkResCount += 1;
    const t = await mkTraveler(email, locale);
    const [dep] = await db.insert(departures).values({
      id: `pg-rm-${email.split('@')[0]}`, tripId: TRIP,
      startDate: new Date(now.getTime() + startInDays * 86_400_000),
      endDate: new Date(now.getTime() + endInDays * 86_400_000),
      status: 'open', capacityMin: 1, capacityMax: 5, priceAmount: 100000, currency, pricingRules: {},
    }).returning({ id: departures.id });
    const [res] = await db.insert(reservations).values({
      reservationNumber: `ATL-2027-R${mkResCount.toString(36).toUpperCase()}${stamp.slice(-4).toUpperCase()}`,
      travelerId: t, tripId: TRIP, departureId: dep.id, status,
      currency, baseAmount: 100000, totalAmount: 100000, amountPaid: 20000, amountDue: 80000,
      balanceDueDate,
    }).returning({ id: reservations.id });
    return { travelerId: t, reservationId: res.id };
  }

  async function balanceRows(reservationId: string) {
    return db.select().from(emailDeliveries).where(eq(emailDeliveries.reservationId, reservationId));
  }

  it('solde J+3 envoyé (USD), J+10 et passé exclus, pending exclu, dédupliqué', async () => {
    const a = await mkRes('confirmed', new Date(now.getTime() + 3 * 86_400_000), 30, 33, `rm1-${stamp}@test.com`, 'USD');
    const b = await mkRes('confirmed', new Date(now.getTime() + 10 * 86_400_000), 30, 33, `rm2-${stamp}@test.com`);
    const c = await mkRes('confirmed', new Date(now.getTime() - 1 * 86_400_000), 30, 33, `rm3-${stamp}@test.com`);
    const d = await mkRes('pending', new Date(now.getTime() + 3 * 86_400_000), 30, 33, `rm4-${stamp}@test.com`);
    const e = await mkRes('confirmed', new Date(now.getTime() + 3 * 86_400_000), 30, 33, `rm0-${stamp}@test.com`);
    await db.update(reservations).set({ amountDue: 0 }).where(eq(reservations.id, e.reservationId));
    const f = await mkRes('confirmed', new Date(now.getTime() + 3 * 86_400_000), 30, 33, `rmx-${stamp}@test.com`, 'EUR', 'xx');
    await sendBalanceReminders(now, stub);
    const sentFor = async (id: string) =>
      (await balanceRows(id)).filter((r) => r.templateKey === 'balance_reminder' && r.status === 'sent');
    expect((await sentFor(a.reservationId)).length).toBeGreaterThanOrEqual(1);
    // exclus : aucune requête (quel que soit l'appelant) ne peut matcher ces lignes
    expect(await balanceRows(b.reservationId)).toHaveLength(0);
    expect(await balanceRows(c.reservationId)).toHaveLength(0);
    expect(await balanceRows(d.reservationId)).toHaveLength(0);
    expect(await balanceRows(e.reservationId)).toHaveLength(0);
    // locale invalide -> repli en
    const fRows = (await balanceRows(f.reservationId)).filter((r) => r.templateKey === 'balance_reminder' && r.status === 'sent');
    expect(fRows).toHaveLength(1);
    expect(fRows[0].locale).toBe('en');
    const before = (await sentFor(a.reservationId)).length;
    await sendBalanceReminders(now, stub);
    // dédupliqué : le 2e passage n'ajoute rien pour une ligne déjà envoyée
    expect((await sentFor(a.reservationId)).length).toBe(before);
  });

  it('préparation J-20, rappel J-10, bornes 30/14/0, post J+5 vs J+1, fallback locale', async () => {
    const prep = await mkRes('confirmed', null, 20, 23, `rm5-${stamp}@test.com`);
    const pre = await mkRes('confirmed', null, 10, 13, `rm6-${stamp}@test.com`, 'EUR', 'xx');
    const far = await mkRes('confirmed', null, 40, 43, `rm7-${stamp}@test.com`);
    const post = await mkRes('completed', null, -10, -5, `rm8-${stamp}@test.com`);
    const early = await mkRes('completed', null, -10, -1, `rm9-${stamp}@test.com`);
    const pend = await mkRes('pending', null, 10, 13, `rm10-${stamp}@test.com`);
    await sendTripReminders(now, stub);
    const kinds = async (id: string) => (await balanceRows(id)).map((r) => r.templateKey);
    // lignes reçues (quel que soit l'appelant qui les a envoyées en premier)
    expect(await kinds(prep.reservationId)).toContain('pre_trip_preparation');
    expect(await kinds(pre.reservationId)).toContain('pre_trip_reminder');
    expect(await kinds(post.reservationId)).toContain('post_trip_followup');
    // fenêtres exclues : aucun appelant ne peut matcher ces lignes
    expect(await kinds(prep.reservationId)).not.toContain('pre_trip_reminder');
    expect(await kinds(far.reservationId)).toHaveLength(0);
    expect(await kinds(early.reservationId)).toHaveLength(0);
    // statut pending exclu même en pleine fenêtre
    expect(await kinds(pend.reservationId)).toHaveLength(0);
    const preRows = await balanceRows(pre.reservationId);
    expect(preRows[0].locale).toBe('en');
  });
});

describe('email-worker contexte + expiry null', () => {
  it('nom repli email, locale invalide -> en', async () => {
    const t = await mkTraveler(`ctx-${stamp}@test.com`, 'xx');
    const [a] = await db.insert(applications).values({
      travelerId: t, tripId: TRIP, departureId: `pg-hl-dep-${stamp}`, status: 'submitted',
      activityAcknowledgement: true, consent: true, submittedAt: new Date(),
    }).returning({ id: applications.id }).catch(async () => {
      await db.insert(departures).values({
        id: `pg-hl-dep-${stamp}`, tripId: TRIP,
        startDate: new Date(Date.now() + 2 * 86_400_000), endDate: new Date(Date.now() + 5 * 86_400_000),
        status: 'draft', capacityMin: 1, capacityMax: 5, priceAmount: 100, currency: 'EUR', pricingRules: {},
      });
      const [a2] = await db.insert(applications).values({
        travelerId: t, tripId: TRIP, departureId: `pg-hl-dep-${stamp}`, status: 'submitted',
        activityAcknowledgement: true, consent: true, submittedAt: new Date(),
      }).returning({ id: applications.id });
      return [a2] as never;
    });
    expect(await routeOutboxToEmail('application.submitted', { applicationId: (a as { id: string }).id }, stub)).toBe(true);
    const rows = await db.select().from(emailDeliveries).where(eq(emailDeliveries.travelerId, t));
    expect(rows.some((r) => r.locale === 'en')).toBe(true);
    void (0 as unknown as Locale);
  });
});
