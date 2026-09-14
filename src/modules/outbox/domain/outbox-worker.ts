import { and, eq, lte, sql } from "drizzle-orm";
import { getDrizzle } from "@database/drizzle";
import { outboxEvents } from "@database/schemas";

export const OUTBOX_MAX_ATTEMPTS = 5;

// Claim avec SKIP LOCKED : plusieurs workers sans double traitement (TODO §14.4).
export async function claimOutboxBatch(limit = 25) {
  const db = getDrizzle();
  const result = await db.execute(sql`
    UPDATE outbox_events SET status = 'processing'
    WHERE id IN (
      SELECT id FROM outbox_events
      WHERE status = 'pending' AND available_at <= now()
      ORDER BY created_at ASC
      LIMIT ${limit}
      FOR UPDATE SKIP LOCKED
    )
    RETURNING id, event_type, aggregate_type, aggregate_id, payload, attempts
  `);
  const rows = (result as unknown as { rows?: unknown }).rows ?? result;
  return rows as {
    id: string;
    event_type: string;
    aggregate_type: string;
    aggregate_id: string;
    payload: Record<string, unknown>;
    attempts: number;
  }[];
}

export async function completeOutbox(id: string): Promise<void> {
  await getDrizzle()
    .update(outboxEvents)
    .set({ status: "done", processedAt: new Date() })
    .where(eq(outboxEvents.id, id));
}

export async function failOutbox(id: string, attempts: number, error: string): Promise<void> {
  void error;
  if (attempts + 1 >= OUTBOX_MAX_ATTEMPTS) {
    await getDrizzle()
      .update(outboxEvents)
      .set({ status: "dead_letter", processedAt: new Date() })
      .where(eq(outboxEvents.id, id));
    return;
  }
  const backoffMin = 2 ** attempts;
  await getDrizzle()
    .update(outboxEvents)
    .set({
      status: "pending",
      attempts: attempts + 1,
      availableAt: new Date(Date.now() + backoffMin * 60_000),
    })
    .where(eq(outboxEvents.id, id));
}

export async function pendingOutboxCount(now = new Date()): Promise<number> {
  const [row] = await getDrizzle()
    .select({ count: sql<number>`count(*)::int` })
    .from(outboxEvents)
    .where(and(eq(outboxEvents.status, "pending"), lte(outboxEvents.availableAt, now)));
  return row?.count ?? 0;
}
