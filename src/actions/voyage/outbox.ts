import { ActionError, defineAction } from "astro:actions";
import { eq } from "drizzle-orm";
import { z } from "astro/zod";
import { getDrizzle } from "@database/drizzle";
import { outboxEvents } from "@database/schemas";
import { assertVoyagePermission, auditVoyage } from "./_helpers";

// Remet un événement dead-letter en file (observabilité, TODO §14.4).
export const requeueOutboxEvent = defineAction({
  input: z.object({ id: z.string().min(1).max(160) }),
  handler: async (input, context) => {
    const user = await assertVoyagePermission(context, { email: ["retry"] });
    const [updated] = await getDrizzle()
      .update(outboxEvents)
      .set({ status: "pending", attempts: 0, availableAt: new Date() })
      .where(eq(outboxEvents.id, input.id))
      .returning({ id: outboxEvents.id });
    if (!updated) throw new ActionError({ code: "NOT_FOUND", message: "Événement introuvable." });
    auditVoyage(context, user.id, "EMAIL_RETRY", { resource: "outbox_events", resourceId: input.id });
    return { success: true };
  },
});
