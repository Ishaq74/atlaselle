import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq, inArray } from 'drizzle-orm';
import { getDrizzle } from '@database/drizzle';
import {
  applicationDecisions,
  applicationInternalNotes,
  applications,
  departures,
  emailDeliveries,
  reservationInternalNotes,
  reservations,
  travelerInternalNotes,
  travelers,
  trips,
} from '@database/schemas';
import { anonymizedEmail, anonymizeTravelerRecord } from '@/modules/travelers/domain/travelers-service';
import { getTestHelpers } from '../helpers/auth';

const db = getDrizzle();
const stamp = Date.now().toString(36);
const TRIP_ID = `test-anon-trip-${stamp}`;
const DEP_ID = `test-anon-dep-${stamp}`;
const SECRET = 'Allergie sévère aux arachides';

const created = { travelers: [] as string[], users: [] as string[], applications: [] as string[], reservations: [] as string[], deliveries: [] as string[] };
let helpers: Awaited<ReturnType<typeof getTestHelpers>>;
let counter = 0;

async function fullDossier(label: string) {
  const email = `anon-${label}-${stamp}@test.com`;
  const saved = await helpers.saveUser(helpers.createUser({ email, name: `Anon ${label}`, emailVerified: true }));
  created.users.push(saved.id);
  const [t] = await db
    .insert(travelers)
    .values({ email, locale: 'fr', phone: '+33612345678', legalName: 'Jane Doe', preferredName: 'Janie', dateOfBirth: '1990-04-05', userId: saved.id })
    .returning({ id: travelers.id });
  created.travelers.push(t.id);
  const [a] = await db
    .insert(applications)
    .values({
      travelerId: t.id, tripId: TRIP_ID, departureId: DEP_ID, status: 'withdrawn',
      activityAcknowledgement: true, consent: true, submittedAt: new Date(),
      dietaryRequirements: SECRET, accessibilityNeeds: 'Fauteuil roulant', motivation: 'Voyage de ma vie', expectations: 'Rencontres',
    })
    .returning({ id: applications.id });
  created.applications.push(a.id);
  await db.insert(applicationDecisions).values({ applicationId: a.id, decision: 'approved', internalNote: 'Appeler Jane au +33612345678' });
  await db.insert(applicationInternalNotes).values({ applicationId: a.id, note: 'Jane Doe est sensible' });
  await db.insert(travelerInternalNotes).values({ travelerId: t.id, note: 'Cliente fidèle Jane' });
  const [r] = await db
    .insert(reservations)
    .values({
      reservationNumber: `ATL-2027-A${stamp.slice(-3).toUpperCase()}${(counter++).toString(36).toUpperCase()}`,
      travelerId: t.id, tripId: TRIP_ID, departureId: DEP_ID, status: 'cancelled' as const,
      currency: 'EUR', baseAmount: 40000, totalAmount: 40000, amountPaid: 12000, amountDue: 28000,
    })
    .returning({ id: reservations.id });
  created.reservations.push(r.id);
  await db.insert(reservationInternalNotes).values({ reservationId: r.id, note: 'Jane a demandé un remboursement' });
  const deliveries = await db
    .insert(emailDeliveries)
    .values([
      { templateKey: 'application_received', locale: 'fr', toEmail: email, travelerId: t.id, status: 'sent' },
      { templateKey: 'balance_reminder', locale: 'fr', toEmail: email, reservationId: r.id, status: 'failed', lastError: `550 5.1.1 <${email}> user unknown` },
      { templateKey: 'newsletter_notice', locale: 'fr', toEmail: email.toUpperCase(), status: 'sent' },
    ] as never)
    .returning({ id: emailDeliveries.id });
  created.deliveries.push(...deliveries.map((d) => d.id));
  return { travelerId: t.id, applicationId: a.id, reservationId: r.id, userId: saved.id, email, deliveryIds: deliveries.map((d) => d.id) };
}

beforeAll(async () => {
  helpers = await getTestHelpers();
  await db.insert(trips).values({
    id: TRIP_ID, status: 'draft', countryCode: 'FR', defaultCurrency: 'EUR',
    durationDays: 3, durationNights: 2, groupMin: 1, groupMax: 4, difficulty: 'easy', difficultyLevel: 1,
  });
  await db.insert(departures).values({
    id: DEP_ID, tripId: TRIP_ID,
    startDate: new Date('2027-10-01T08:00:00.000Z'), endDate: new Date('2027-10-03T18:00:00.000Z'),
    status: 'open', capacityMin: 1, capacityMax: 4, priceAmount: 40000, currency: 'EUR', pricingRules: {},
  });
});

afterAll(async () => {
  if (created.deliveries.length) await db.delete(emailDeliveries).where(inArray(emailDeliveries.id, created.deliveries)).catch(() => {});
  if (created.reservations.length) await db.delete(reservations).where(inArray(reservations.id, created.reservations)).catch(() => {});
  if (created.applications.length) await db.delete(applications).where(inArray(applications.id, created.applications)).catch(() => {});
  if (created.travelers.length) await db.delete(travelers).where(inArray(travelers.id, created.travelers)).catch(() => {});
  await db.delete(departures).where(eq(departures.tripId, TRIP_ID)).catch(() => {});
  await db.delete(trips).where(eq(trips.id, TRIP_ID)).catch(() => {});
  for (const id of created.users) await helpers.deleteUser(id).catch(() => {});
});

describe('anonymizeTravelerRecord — effacement complet, transactions conservées', () => {
  it('efface toutes les données personnelles du dossier et conserve les transactions', async () => {
    const d = await fullDossier('target');
    const other = await fullDossier('bystander');

    const result = await anonymizeTravelerRecord(d.travelerId);
    expect(result.found).toBe(true);
    // traveler + candidature + décision + 3 notes + 3 e-mails
    expect(result.scrubbed).toBe(1 + 1 + 1 + 1 + 1 + 1 + 3);

    const [t] = await db.select().from(travelers).where(eq(travelers.id, d.travelerId));
    expect(t).toMatchObject({ email: anonymizedEmail(d.travelerId), phone: null, legalName: null, preferredName: null, dateOfBirth: null, userId: null });

    const [a] = await db.select().from(applications).where(eq(applications.id, d.applicationId));
    expect(a).toMatchObject({ dietaryRequirements: null, accessibilityNeeds: null, motivation: null, expectations: null });
    expect(a.status).toBe('withdrawn');

    const [decision] = await db.select().from(applicationDecisions).where(eq(applicationDecisions.applicationId, d.applicationId));
    expect(decision.internalNote).toBeNull();
    expect(decision.decision).toBe('approved');
    expect(await db.select().from(applicationInternalNotes).where(eq(applicationInternalNotes.applicationId, d.applicationId))).toHaveLength(0);
    expect(await db.select().from(travelerInternalNotes).where(eq(travelerInternalNotes.travelerId, d.travelerId))).toHaveLength(0);
    expect(await db.select().from(reservationInternalNotes).where(eq(reservationInternalNotes.reservationId, d.reservationId))).toHaveLength(0);

    // Transaction conservée : montants et statut intacts.
    const [r] = await db.select().from(reservations).where(eq(reservations.id, d.reservationId));
    expect(r).toMatchObject({ status: 'cancelled', totalAmount: 40000, amountPaid: 12000, amountDue: 28000, currency: 'EUR', travelerId: d.travelerId });

    // E-mails retrouvés par dossier, par réservation et par adresse (casse différente) ; l'erreur SMTP citant l'adresse est effacée.
    const mails = await db.select().from(emailDeliveries).where(inArray(emailDeliveries.id, d.deliveryIds));
    expect(mails).toHaveLength(3);
    for (const mail of mails) {
      expect(mail.toEmail).toBe(anonymizedEmail(d.travelerId));
      expect(mail.lastError).toBeNull();
    }

    // Aucune trace résiduelle de la personne dans les tables concernées.
    const dump = JSON.stringify([t, a, decision, mails]);
    expect(dump).not.toMatch(new RegExp(`${SECRET}|Jane|\\+336|${d.email}`, 'i'));

    // Une autre personne n'est pas touchée.
    const [o] = await db.select().from(travelers).where(eq(travelers.id, other.travelerId));
    expect(o).toMatchObject({ email: other.email, legalName: 'Jane Doe', phone: '+33612345678', userId: other.userId });
    const [oa] = await db.select().from(applications).where(eq(applications.id, other.applicationId));
    expect(oa.dietaryRequirements).toBe(SECRET);
    expect(await db.select().from(travelerInternalNotes).where(eq(travelerInternalNotes.travelerId, other.travelerId))).toHaveLength(1);
    const otherMails = await db.select().from(emailDeliveries).where(inArray(emailDeliveries.id, other.deliveryIds));
    expect(otherMails.map((m) => m.toEmail.toLowerCase())).toEqual([other.email, other.email, other.email]);
  }, 60_000);

  it('est idempotent : un second appel ne modifie rien', async () => {
    const d = await fullDossier('twice');
    expect((await anonymizeTravelerRecord(d.travelerId)).scrubbed).toBeGreaterThan(0);
    expect(await anonymizeTravelerRecord(d.travelerId)).toEqual({ found: true, scrubbed: 0 });
  }, 60_000);

  it('rattrape un dossier déjà anonymisé par l’ancienne version (résidus dans les candidatures)', async () => {
    const d = await fullDossier('legacy');
    // État laissé par l'ancienne anonymisation : seul `travelers` était effacé.
    await db.update(travelers).set({ email: anonymizedEmail(d.travelerId), phone: null, legalName: null, preferredName: null, dateOfBirth: null }).where(eq(travelers.id, d.travelerId));
    const result = await anonymizeTravelerRecord(d.travelerId);
    expect(result.scrubbed).toBeGreaterThan(0);
    const [a] = await db.select().from(applications).where(eq(applications.id, d.applicationId));
    expect(a.dietaryRequirements).toBeNull();
    // Retrouvés par dossier et par réservation. Un e-mail sans aucun rattachement n'est plus identifiable par adresse
    // (elle a déjà été effacée par l'ancienne version) : seule la restauration d'une base non effacée le permet.
    const mails = await db.select().from(emailDeliveries).where(inArray(emailDeliveries.id, d.deliveryIds.slice(0, 2)));
    expect(mails.every((m) => m.toEmail === anonymizedEmail(d.travelerId))).toBe(true);
  }, 60_000);

  it('signale un dossier inexistant', async () => {
    expect(await anonymizeTravelerRecord('11111111-1111-4111-8111-111111111111')).toEqual({ found: false, scrubbed: 0 });
  });

  it('est atomique : une erreur en cours de route annule tout', async () => {
    const d = await fullDossier('atomic');
    const failing = {
      transaction: async (fn: (tx: unknown) => Promise<unknown>) =>
        db.transaction(async (tx) => {
          const proxy = new Proxy(tx, {
            get(target, prop, receiver) {
              if (prop === 'delete') return () => { throw new Error('panne simulée'); };
              return Reflect.get(target, prop, receiver);
            },
          });
          return fn(proxy);
        }),
    };
    await expect(anonymizeTravelerRecord(d.travelerId, failing as never)).rejects.toThrow('panne simulée');
    const [t] = await db.select().from(travelers).where(eq(travelers.id, d.travelerId));
    expect(t.legalName).toBe('Jane Doe');
    const [a] = await db.select().from(applications).where(eq(applications.id, d.applicationId));
    expect(a.dietaryRequirements).toBe(SECRET);
  }, 60_000);
});
