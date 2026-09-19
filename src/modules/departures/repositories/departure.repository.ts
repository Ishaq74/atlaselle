import { and, eq } from "drizzle-orm";
import { getDrizzle } from "@database/drizzle";
import { departures, seatHolds } from "@database/schemas/departures.schema";

type Db = ReturnType<typeof getDrizzle>;

/** Repository du module departures — seul propriétaire de `departures` + `seatHolds`. */
export async function getDepartureById(departureId: string, dbOverride?: Db): Promise<(typeof departures.$inferSelect) | null> {
  const db = dbOverride ?? getDrizzle();
  const [row] = await db.select().from(departures).where(eq(departures.id, departureId)).limit(1);
  return row ?? null;
}

export async function getActiveHoldsByDeparture(departureId: string, dbOverride?: Db) {
  const db = dbOverride ?? getDrizzle();
  return db
    .select({ quantity: seatHolds.quantity, expiresAt: seatHolds.expiresAt })
    .from(seatHolds)
    .where(and(eq(seatHolds.departureId, departureId), eq(seatHolds.status, "active")));
}

export async function getActiveHoldIdsByApplication(applicationId: string, dbOverride?: Db) {
  const db = dbOverride ?? getDrizzle();
  return db
    .select({ id: seatHolds.id })
    .from(seatHolds)
    .where(and(eq(seatHolds.applicationId, applicationId), eq(seatHolds.status, "active")));
}

/** Verrou FOR UPDATE sur un départ (transaction de capacité, TODO §10.4). */
export async function lockDepartureForUpdate(departureId: string, tx: Db): Promise<(typeof departures.$inferSelect) | null> {
  const [row] = await tx.select().from(departures).where(eq(departures.id, departureId)).for("update").limit(1);
  return row ?? null;
}
