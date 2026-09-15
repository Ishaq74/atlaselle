import { desc, eq } from "drizzle-orm";
import { getDrizzle } from "@database/drizzle";
import { outboxEvents } from "@database/schemas/outbox.schema";

export async function loadDeadLetterOutbox(limit = 50) {
  return getDrizzle()
    .select()
    .from(outboxEvents)
    .where(eq(outboxEvents.status, "dead_letter"))
    .orderBy(desc(outboxEvents.createdAt))
    .limit(limit);
}
