import { getDrizzle } from "@database/drizzle";
import { outboxEvents } from "@database/schemas";

// TODO §14.4 — seule voie de communication inter-modules (avec les interfaces).
export async function emitOutboxEvent(input: {
  eventType: string;
  aggregateType: string;
  aggregateId: string;
  payload?: Record<string, unknown>;
  availableAt?: Date;
}): Promise<string> {
  const [created] = await getDrizzle()
    .insert(outboxEvents)
    .values({
      eventType: input.eventType,
      aggregateType: input.aggregateType,
      aggregateId: input.aggregateId,
      payload: input.payload ?? {},
      availableAt: input.availableAt ?? new Date(),
    })
    .returning({ id: outboxEvents.id });
  if (!created) throw new Error("Outbox emit failed");
  return created.id;
}
