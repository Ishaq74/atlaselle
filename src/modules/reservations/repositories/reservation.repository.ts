import { and, eq, inArray } from "drizzle-orm";
import { getDrizzle } from "@database/drizzle";
import { reservations } from "@database/schemas/reservations.schema";

type Db = ReturnType<typeof getDrizzle>;

/** Repository du module reservations — seul propriétaire de la table `reservations`. */
export async function getReservationById(reservationId: string, dbOverride?: Db): Promise<(typeof reservations.$inferSelect) | null> {
  const db = dbOverride ?? getDrizzle();
  const [row] = await db.select().from(reservations).where(eq(reservations.id, reservationId)).limit(1);
  return row ?? null;
}

export async function countConfirmedByDeparture(departureId: string, dbOverride?: Db): Promise<number> {
  const db = dbOverride ?? getDrizzle();
  const rows = await db
    .select({ id: reservations.id })
    .from(reservations)
    .where(and(eq(reservations.departureId, departureId), inArray(reservations.status, ["confirmed", "balance_due", "completed"])));
  return rows.length;
}

/** Passe une réservation en `awaiting_payment` (tunnel checkout, orchestrateur payments). */
export async function markReservationAwaitingPayment(reservationId: string, dbOverride?: Db) {
  const db = dbOverride ?? getDrizzle();
  const [row] = await db
    .update(reservations)
    .set({ status: "awaiting_payment" })
    .where(eq(reservations.id, reservationId))
    .returning();
  return row ?? null;
}

/** Supprime une réservation (rollback orchestrateur payments). */
export async function deleteReservationById(reservationId: string, dbOverride?: Db) {
  const db = dbOverride ?? getDrizzle();
  await db.delete(reservations).where(eq(reservations.id, reservationId));
}
