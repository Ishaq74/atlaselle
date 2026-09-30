import { defineAction, ActionError } from "astro:actions";
import { z } from "astro/zod";
import { assertAdmin, adminRateLimit, auditAdmin } from "./_helpers";
import { auth } from "@/lib/auth";

const ROLE_ENUM = ["admin", "editor", "user"] as const;

const targetUser = z.object({
  userId: z.string().trim().min(1, "Identifiant utilisateur requis.").max(64),
});

/** Traduit une erreur Better Auth en ActionError sans fuser la réponse brute. */
function toActionError(err: unknown, fallback: string): ActionError {
  const message =
    err && typeof err === "object" && "body" in err
      ? ((err as { body?: { message?: string } }).body?.message ?? null)
      : null;
  return new ActionError({
    code: "BAD_REQUEST",
    message: message ?? fallback,
  });
}

function assertNotSelf(actorId: string, targetId: string) {
  if (actorId === targetId) {
    throw new ActionError({
      code: "BAD_REQUEST",
      message: "Vous ne pouvez pas appliquer cette action à votre propre compte.",
    });
  }
}

export const adminSetUserRole = defineAction({
  input: targetUser.extend({
    role: z.enum(ROLE_ENUM, {
      message: `Le rôle doit être l'un des suivants : ${ROLE_ENUM.join(", ")}.`,
    }),
  }),
  handler: async (input, context) => {
    const admin = assertAdmin(context);
    adminRateLimit(context, admin.id, "users", { window: 60, max: 20 });
    assertNotSelf(admin.id, input.userId);

    try {
      await auth.api.setRole({
        body: { userId: input.userId, role: input.role },
        headers: context.request.headers,
      });
    } catch (err) {
      throw toActionError(err, "Impossible de modifier le rôle de cet utilisateur.");
    }

    auditAdmin(context, admin.id, "USER_ROLE_CHANGE", {
      resource: "user",
      resourceId: input.userId,
      metadata: { role: input.role },
    });
    return { success: true };
  },
});

export const adminBanUser = defineAction({
  input: targetUser.extend({
    reason: z.string().trim().max(500).optional(),
  }),
  handler: async (input, context) => {
    const admin = assertAdmin(context);
    adminRateLimit(context, admin.id, "users", { window: 60, max: 20 });
    assertNotSelf(admin.id, input.userId);

    try {
      await auth.api.banUser({
        body: { userId: input.userId, banReason: input.reason },
        headers: context.request.headers,
      });
    } catch (err) {
      throw toActionError(err, "Impossible de suspendre cet utilisateur.");
    }

    auditAdmin(context, admin.id, "USER_BAN", {
      resource: "user",
      resourceId: input.userId,
      metadata: { reason: input.reason ?? null },
    });
    return { success: true };
  },
});

export const adminUnbanUser = defineAction({
  input: targetUser,
  handler: async (input, context) => {
    const admin = assertAdmin(context);
    adminRateLimit(context, admin.id, "users", { window: 60, max: 20 });

    try {
      await auth.api.unbanUser({
        body: { userId: input.userId },
        headers: context.request.headers,
      });
    } catch (err) {
      throw toActionError(err, "Impossible de réactiver cet utilisateur.");
    }

    auditAdmin(context, admin.id, "USER_UNBAN", {
      resource: "user",
      resourceId: input.userId,
    });
    return { success: true };
  },
});

export const adminRemoveUser = defineAction({
  input: targetUser,
  handler: async (input, context) => {
    const admin = assertAdmin(context);
    adminRateLimit(context, admin.id, "users", { window: 60, max: 10 });
    assertNotSelf(admin.id, input.userId);

    try {
      await auth.api.removeUser({
        body: { userId: input.userId },
        headers: context.request.headers,
      });
    } catch (err) {
      throw toActionError(err, "Impossible de supprimer cet utilisateur.");
    }

    auditAdmin(context, admin.id, "USER_DELETE", {
      resource: "user",
      resourceId: input.userId,
    });
    return { success: true };
  },
});

export const adminLogImpersonation = defineAction({
  input: targetUser,
  handler: async (input, context) => {
    const admin = assertAdmin(context);
    adminRateLimit(context, admin.id, "users", { window: 60, max: 20 });
    assertNotSelf(admin.id, input.userId);

    auditAdmin(context, admin.id, "IMPERSONATION_START", {
      resource: "user",
      resourceId: input.userId,
    });
    return { success: true };
  },
});
