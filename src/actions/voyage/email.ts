import { ActionError, defineAction } from "astro:actions";
import { eq } from "drizzle-orm";
import { z } from "astro/zod";
import { getDrizzle } from "@database/drizzle";
import { emailDeliveries } from "@database/schemas";
import { emitOutboxEvent } from "@/modules/outbox/domain/outbox";
import { assertVoyagePermission, auditVoyage } from "./_helpers";

// Remet un email échoué en file (TODO §14.1 — retry manuel).
export const retryEmailDelivery = defineAction({
  input: z.object({ id: z.uuid() }),
  handler: async (input, context) => {
    const user = await assertVoyagePermission(context, { email: ["retry"] });
    const db = getDrizzle();
    const [delivery] = await db.select().from(emailDeliveries).where(eq(emailDeliveries.id, input.id)).limit(1);
    if (!delivery) throw new ActionError({ code: "NOT_FOUND", message: "Envoi introuvable." });
    if (delivery.status !== "failed" && delivery.status !== "dead_letter") {
      throw new ActionError({ code: "BAD_REQUEST", message: "Seuls les envois échoués peuvent être relancés." });
    }
    await db
      .update(emailDeliveries)
      .set({ status: "queued", attempts: 0, lastError: null, scheduledAt: new Date() })
      .where(eq(emailDeliveries.id, input.id));
    await emitOutboxEvent({
      eventType: "email.retry_requested",
      aggregateType: "email_delivery",
      aggregateId: input.id,
      payload: { deliveryId: input.id, templateKey: delivery.templateKey },
    });
    auditVoyage(context, user.id, "EMAIL_RETRY", {
      resource: "email_deliveries",
      resourceId: input.id,
    });
    return { success: true };
  },
});
