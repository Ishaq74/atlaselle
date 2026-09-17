import { and, inArray, lte } from "drizzle-orm";
import { getDrizzle } from "@database/drizzle";
import { outboxEvents } from "@database/schemas";

// Rétention des journaux opérationnels (TODO §14.2) : les événements terminés
// (done/dead_letter) s'accumulent sinon sans borne. Les livraisons email et
// les paiements (preuves) ne sont JAMAIS purgés ici.
export async function purgeOldOutbox(olderThanDays = 90, now = new Date()): Promise<number> {
  const cutoff = new Date(now.getTime() - olderThanDays * 86_400_000);
  const removed = await getDrizzle()
    .delete(outboxEvents)
    .where(
      and(
        inArray(outboxEvents.status, ["done", "dead_letter"]),
        lte(outboxEvents.createdAt, cutoff),
      ),
    )
    .returning({ id: outboxEvents.id });
  return removed.length;
}
