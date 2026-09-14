import { defineAction } from "astro:actions";
import { and, eq } from "drizzle-orm";
import { z } from "astro/zod";
import { getDrizzle } from "@database/drizzle";
import { serviceReactions } from "@database/schemas";
import { assertServiceExists, assertServicePermission, serviceRateLimit } from "./_helpers";
import { auditService, invalidateServicesCache } from "./_helpers";
import type { ServiceReactionType } from "@/modules/services/domain";

export const toggleServiceReaction = defineAction({
  input: z.object({ serviceId: z.uuid(), reactionType: z.enum(["LIKE", "LOVE", "FIRE", "CLAP"]) }),
  handler: async (input, context) => {
    const user = await assertServicePermission(context, { service: ["read"] });
    await assertServiceExists(input.serviceId);
    serviceRateLimit(context, user.id, "reaction");
    const db = getDrizzle();
    let result: { active: ServiceReactionType | null; previous: ServiceReactionType | null } = { active: null, previous: null };
    await db.transaction(async (tx) => {
      const existing = (await tx.select().from(serviceReactions).where(and(eq(serviceReactions.serviceId, input.serviceId), eq(serviceReactions.userId, user.id))).limit(1))[0];
      if (!existing) {
        await tx.insert(serviceReactions).values({ serviceId: input.serviceId, userId: user.id, reactionType: input.reactionType as ServiceReactionType });
        result = { active: input.reactionType as ServiceReactionType, previous: null };
        return;
      }
      if (existing.reactionType === input.reactionType) {
        await tx.delete(serviceReactions).where(and(eq(serviceReactions.serviceId, input.serviceId), eq(serviceReactions.userId, user.id)));
        result = { active: null, previous: existing.reactionType as ServiceReactionType };
        return;
      }
      await tx.update(serviceReactions).set({ reactionType: input.reactionType as ServiceReactionType, updatedAt: new Date() }).where(and(eq(serviceReactions.serviceId, input.serviceId), eq(serviceReactions.userId, user.id)));
      result = { active: input.reactionType as ServiceReactionType, previous: existing.reactionType as ServiceReactionType };
    });
    if (result.active === null) auditService(context, user.id, "SERVICE_REACTION_REMOVE", { resource: "services", resourceId: input.serviceId, metadata: { reactionType: result.previous } });
    else if (result.previous === null) auditService(context, user.id, "SERVICE_REACTION_ADD", { resource: "services", resourceId: input.serviceId, metadata: { reactionType: result.active } });
    else auditService(context, user.id, "SERVICE_REACTION_ADD", { resource: "services", resourceId: input.serviceId, metadata: { from: result.previous, to: result.active } });
    invalidateServicesCache();
    return { active: result.active };
  },
});
