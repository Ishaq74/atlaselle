import { ActionError, defineAction } from "astro:actions";
import { and, eq, ne } from "drizzle-orm";
import { z } from "astro/zod";
import { getDrizzle } from "@database/drizzle";
import { policyDocuments, policyVersions, POLICY_TYPES } from "@database/schemas";
import { LOCALES } from "@i18n/config";
import { assertVoyagePermission, auditVoyage } from "./_helpers";

// Nouvelle version brouillon (TODO §13.7 — révision juridique par langue).
export const createPolicyVersion = defineAction({
  input: z.object({
    type: z.enum(POLICY_TYPES),
    locale: z.enum(LOCALES),
    title: z.string().min(1).max(300),
    content: z.string().min(1),
  }),
  handler: async (input, context) => {
    const user = await assertVoyagePermission(context, { policy: ["create"] });
    const db = getDrizzle();
    const [doc] = await db
      .select()
      .from(policyDocuments)
      .where(and(eq(policyDocuments.type, input.type), eq(policyDocuments.locale, input.locale)))
      .limit(1);
    if (!doc) throw new ActionError({ code: "NOT_FOUND", message: "Document introuvable." });
    const existing = await db.select({ version: policyVersions.version }).from(policyVersions).where(eq(policyVersions.documentId, doc.id));
    const version = Math.max(0, ...existing.map((v) => v.version)) + 1;
    const [created] = await db
      .insert(policyVersions)
      .values({ documentId: doc.id, version, title: input.title, content: input.content })
      .returning({ id: policyVersions.id });
    if (!created) throw new ActionError({ code: "INTERNAL_SERVER_ERROR", message: "Version impossible." });
    auditVoyage(context, user.id, "POLICY_PUBLISH", {
      resource: "policy_versions",
      resourceId: created.id,
      metadata: { draft: true, version },
    });
    return { id: created.id, version };
  },
});

// Publication : une seule version publiée par document (reviewedBy = qualifié).
export const publishPolicyVersion = defineAction({
  input: z.object({ id: z.uuid() }),
  handler: async (input, context) => {
    const user = await assertVoyagePermission(context, { policy: ["publish"] });
    const db = getDrizzle();
    const [version] = await db.select().from(policyVersions).where(eq(policyVersions.id, input.id)).limit(1);
    if (!version) throw new ActionError({ code: "NOT_FOUND", message: "Version introuvable." });
    await db.transaction(async (tx) => {
      await tx
        .update(policyVersions)
        .set({ published: false })
        .where(and(eq(policyVersions.documentId, version.documentId), ne(policyVersions.id, version.id)));
      await tx
        .update(policyVersions)
        .set({ published: true, reviewedBy: user.id, reviewedAt: new Date(), publishedAt: new Date() })
        .where(eq(policyVersions.id, version.id));
    });
    auditVoyage(context, user.id, "POLICY_PUBLISH", {
      resource: "policy_versions",
      resourceId: version.id,
      metadata: { documentId: version.documentId, version: version.version },
    });
    return { success: true };
  },
});
