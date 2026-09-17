import { and, eq, inArray, lte } from "drizzle-orm";
import { getDrizzle } from "@database/drizzle";
import { checkoutSessions } from "@database/schemas";
import { applications } from "@database/schemas";

// Lien checkout signé par opacité (uuid) + TTL 7 j (TODO §11.5).
export const CHECKOUT_LINK_TTL_DAYS = 7;

export async function createApplicationCheckout(applicationId: string, departureId: string) {
  const [created] = await getDrizzle()
    .insert(checkoutSessions)
    .values({
      applicationId,
      departureId,
      expiresAt: new Date(Date.now() + CHECKOUT_LINK_TTL_DAYS * 24 * 3600_000),
    })
    .returning();
  if (!created) throw new Error("Checkout session creation failed");
  return created;
}

export async function getValidCheckoutSession(sessionId: string) {
  const [session] = await getDrizzle().select().from(checkoutSessions).where(eq(checkoutSessions.id, sessionId)).limit(1);
  if (!session || session.status !== "open") return null;
  if (session.expiresAt.getTime() <= Date.now()) {
    await getDrizzle().update(checkoutSessions).set({ status: "expired" }).where(eq(checkoutSessions.id, sessionId));
    return null;
  }
  const [application] = await getDrizzle().select().from(applications).where(eq(applications.id, session.applicationId)).limit(1);
  if (!application || application.status !== "approved") return null;
  return { session, application };
}

export async function markCheckoutCompleted(sessionId: string, reservationId: string) {
  await getDrizzle()
    .update(checkoutSessions)
    .set({ status: "completed", reservationId })
    .where(and(eq(checkoutSessions.id, sessionId), eq(checkoutSessions.status, "open")));
}

// Job expireCheckoutSessions (TODO §14.2).
export async function expireCheckoutSessions(now = new Date()): Promise<number> {
  const expired = await getDrizzle()
    .update(checkoutSessions)
    .set({ status: "expired" })
    .where(and(eq(checkoutSessions.status, "open"), lte(checkoutSessions.expiresAt, now)))
    .returning({ id: checkoutSessions.id });
  return expired.length;
}

// Rétention : supprime les sessions expirées/annulées anciennes. Jamais les
// `completed` (reçus consultables via booking-confirmed) ni les `open`.
export async function purgeExpiredCheckoutSessions(olderThanDays = 30, now = new Date()): Promise<number> {
  const cutoff = new Date(now.getTime() - olderThanDays * 86_400_000);
  const removed = await getDrizzle()
    .delete(checkoutSessions)
    .where(
      and(
        inArray(checkoutSessions.status, ["expired", "cancelled"]),
        lte(checkoutSessions.expiresAt, cutoff),
      ),
    )
    .returning({ id: checkoutSessions.id });
  return removed.length;
}
