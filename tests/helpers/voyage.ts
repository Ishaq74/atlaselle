import { eq, inArray, sql } from "drizzle-orm";
import { getDrizzle } from "@database/drizzle";
import { applications } from "@database/schemas/applications.schema";
import { reservations } from "@database/schemas/reservations.schema";
import { checkoutSessions, payments } from "@database/schemas/payments.schema";
import { emailDeliveries } from "@database/schemas/email-voyage.schema";
import { outboxEvents } from "@database/schemas/outbox.schema";

type Db = ReturnType<typeof getDrizzle>;

/**
 * Purge globale des fixtures de test voyage (ids préfixés test- ou e2e-, emails @test.com).
 * Les seeds n'utilisent ni ces préfixes ni @test.com : la purge est sans danger.
 * À appeler en beforeAll : un run précédent interrompu ne doit jamais
 * empoisonner le suivant (contraintes d'unicité).
 */
export async function purgeVoyageTestFixtures(): Promise<void> {
  const db = getDrizzle();
  const tripScope = sql`trip_id LIKE 'test-%' OR trip_id LIKE 'e2e-%'`;
  await db.execute(sql`DELETE FROM payments WHERE reservation_id IN (SELECT id FROM reservations WHERE ${tripScope})`);
  await db.execute(
    sql`DELETE FROM checkout_sessions WHERE application_id IN (SELECT id FROM applications WHERE ${tripScope}) OR reservation_id IN (SELECT id FROM reservations WHERE ${tripScope})`,
  );
  await db.execute(sql`DELETE FROM application_decisions WHERE application_id IN (SELECT id FROM applications WHERE ${tripScope})`);
  await db.execute(sql`DELETE FROM application_events WHERE application_id IN (SELECT id FROM applications WHERE ${tripScope})`);
  await db.execute(sql`DELETE FROM seat_holds WHERE departure_id IN (SELECT id FROM departures WHERE ${tripScope})`);
  await db.execute(sql`DELETE FROM reservation_price_snapshots WHERE reservation_id IN (SELECT id FROM reservations WHERE ${tripScope})`);
  await db.execute(sql`DELETE FROM reservations WHERE ${tripScope}`);
  await db.execute(sql`DELETE FROM applications WHERE ${tripScope}`);
  await db.execute(sql`DELETE FROM itinerary_day_translations WHERE day_id IN (SELECT id FROM itinerary_days WHERE ${tripScope})`);
  await db.execute(sql`DELETE FROM itinerary_days WHERE ${tripScope}`);
  await db.execute(sql`DELETE FROM trip_highlight_translations WHERE highlight_id IN (SELECT id FROM trip_highlights WHERE ${tripScope})`);
  await db.execute(sql`DELETE FROM trip_highlights WHERE ${tripScope}`);
  await db.execute(sql`DELETE FROM trip_inclusion_translations WHERE inclusion_id IN (SELECT id FROM trip_inclusions WHERE ${tripScope})`);
  await db.execute(sql`DELETE FROM trip_inclusions WHERE ${tripScope}`);
  await db.execute(sql`DELETE FROM trip_exclusion_translations WHERE exclusion_id IN (SELECT id FROM trip_exclusions WHERE ${tripScope})`);
  await db.execute(sql`DELETE FROM trip_exclusions WHERE ${tripScope}`);
  await db.execute(sql`DELETE FROM trip_faqs WHERE ${tripScope}`);
  await db.execute(sql`DELETE FROM trip_translations WHERE ${tripScope}`);
  await db.execute(sql`DELETE FROM departures WHERE ${tripScope}`);
  await db.execute(sql`DELETE FROM email_deliveries WHERE traveler_id IN (SELECT id FROM travelers WHERE email LIKE '%@test.com')`);
  await db.execute(sql`DELETE FROM travelers WHERE email LIKE '%@test.com'`);
  await db.execute(sql`DELETE FROM trips WHERE id LIKE 'test-%' OR id LIKE 'e2e-%'`);
  await db.execute(sql`DELETE FROM outbox_events WHERE aggregate_id LIKE 'test-%' OR aggregate_id LIKE 'e2e-%'`);
  // Heros insérés par tests/helpers/trip-factory.ts (trips supprimés d'abord,
  // FK hero_media_id en ON DELETE SET NULL de toute façon).
  await db.execute(sql`DELETE FROM media_files WHERE id LIKE 'test-media-%'`);
}

/**
 * Supprime les événements outbox émis pour des agrégats exacts (ids listés +
 * checkout/paiements/livraisons rattachés). Ciblé par ids : ne touche jamais
 * les événements des autres workers parallèles (même table partagée).
 * À appeler dans les cleanups AVANT de supprimer les lignes liées.
 */
export async function deleteOutboxFor(
  db: Db,
  input: { applicationIds?: string[]; reservationIds?: string[]; travelerIds?: string[]; tripIds?: string[] },
): Promise<void> {
  const ids = new Set<string>();
  for (const id of [...(input.applicationIds ?? []), ...(input.reservationIds ?? []), ...(input.tripIds ?? [])]) {
    if (id) ids.add(id);
  }
  if ((input.applicationIds ?? []).length) {
    const rows = await db
      .select({ id: checkoutSessions.id })
      .from(checkoutSessions)
      .where(inArray(checkoutSessions.applicationId, input.applicationIds as string[]));
    for (const r of rows) ids.add(r.id);
  }
  if ((input.reservationIds ?? []).length) {
    const resIds = input.reservationIds as string[];
    const rows = await db
      .select({ id: checkoutSessions.id })
      .from(checkoutSessions)
      .where(inArray(checkoutSessions.reservationId, resIds));
    for (const r of rows) ids.add(r.id);
    const pays = await db.select({ id: payments.id }).from(payments).where(inArray(payments.reservationId, resIds));
    for (const r of pays) ids.add(r.id);
    const dels = await db.select({ id: emailDeliveries.id }).from(emailDeliveries).where(inArray(emailDeliveries.reservationId, resIds));
    for (const r of dels) ids.add(r.id);
  }
  if ((input.travelerIds ?? []).length) {
    const dels = await db
      .select({ id: emailDeliveries.id })
      .from(emailDeliveries)
      .where(inArray(emailDeliveries.travelerId, input.travelerIds as string[]));
    for (const r of dels) ids.add(r.id);
  }
  if (!ids.size) return;
  await db.delete(outboxEvents).where(inArray(outboxEvents.aggregateId, [...ids]));
}

type TripRow = { id: string };

async function scopedIds(db: Db, tripIds: string[]): Promise<{ appIds: string[]; resIds: string[] }> {
  const appIds: string[] = [];
  const resIds: string[] = [];
  for (const tid of tripIds) {
    const apps = (await db
      .select({ id: applications.id })
      .from(applications)
      .where(eq(applications.tripId, tid))
      .catch(() => [] as TripRow[])) as TripRow[];
    const res = (await db
      .select({ id: reservations.id })
      .from(reservations)
      .where(eq(reservations.tripId, tid))
      .catch(() => [] as TripRow[])) as TripRow[];
    appIds.push(...apps.map((a) => a.id));
    resIds.push(...res.map((r) => r.id));
  }
  return { appIds, resIds };
}

/**
 * Purge outbox ciblée par voyages : récupère les candidatures/réservations des
 * trips listés puis supprime leurs événements. Sûr en parallèle (ids exacts).
 */
export async function purgeOutboxForTrips(db: Db, tripIds: string[], travelerIds: string[] = []): Promise<void> {
  const { appIds, resIds } = await scopedIds(db, tripIds);
  await deleteOutboxFor(db, { applicationIds: appIds, reservationIds: resIds, travelerIds, tripIds }).catch(() => {});
}
