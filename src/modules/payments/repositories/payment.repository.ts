import { eq } from "drizzle-orm";
import { getDrizzle } from "@database/drizzle";
import { checkoutSessions, payments } from "@database/schemas/payments.schema";

type Db = ReturnType<typeof getDrizzle>;

/** Repository du module payments — seul propriétaire de `payments` + `checkoutSessions`. */
export async function getCheckoutById(checkoutId: string, dbOverride?: Db): Promise<(typeof checkoutSessions.$inferSelect) | null> {
  const db = dbOverride ?? getDrizzle();
  const [row] = await db.select().from(checkoutSessions).where(eq(checkoutSessions.id, checkoutId)).limit(1);
  return row ?? null;
}

export async function getCheckoutByProviderSessionId(providerSessionId: string, dbOverride?: Db): Promise<(typeof checkoutSessions.$inferSelect) | null> {
  const db = dbOverride ?? getDrizzle();
  const [row] = await db.select().from(checkoutSessions).where(eq(checkoutSessions.providerSessionId, providerSessionId)).limit(1);
  return row ?? null;
}

export async function getPaymentByReservationId(reservationId: string, dbOverride?: Db): Promise<(typeof payments.$inferSelect) | null> {
  const db = dbOverride ?? getDrizzle();
  const [row] = await db.select().from(payments).where(eq(payments.reservationId, reservationId)).limit(1);
  return row ?? null;
}

export async function getPaymentByProviderId(providerPaymentId: string, dbOverride?: Db): Promise<(typeof payments.$inferSelect) | null> {
  const db = dbOverride ?? getDrizzle();
  const [row] = await db.select().from(payments).where(eq(payments.providerPaymentId, providerPaymentId)).limit(1);
  return row ?? null;
}

export async function getPaymentByIdempotencyKey(idempotencyKey: string, dbOverride?: Db): Promise<(typeof payments.$inferSelect) | null> {
  const db = dbOverride ?? getDrizzle();
  const [row] = await db.select().from(payments).where(eq(payments.idempotencyKey, idempotencyKey)).limit(1);
  return row ?? null;
}

/** Annule les checkouts ouverts d'une réservation (annulation dossier). */
export async function cancelOpenCheckoutsForReservation(reservationId: string, dbOverride?: Db): Promise<number> {
  const { and } = await import("drizzle-orm");
  const db = dbOverride ?? getDrizzle();
  const rows = await db
    .update(checkoutSessions)
    .set({ status: "cancelled" })
    .where(and(eq(checkoutSessions.reservationId, reservationId), eq(checkoutSessions.status, "open")))
    .returning({ id: checkoutSessions.id });
  return rows.length;
}
