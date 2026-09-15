import { asc, desc, eq } from "drizzle-orm";
import { getDrizzle } from "@database/drizzle";
import { policyDocuments, policyVersions } from "@database/schemas/policies.schema";

export async function loadAdminPolicies() {
  const db = getDrizzle();
  const docs = await db.select().from(policyDocuments).orderBy(asc(policyDocuments.type), asc(policyDocuments.locale));
  const out = [];
  for (const doc of docs) {
    const versions = await db
      .select()
      .from(policyVersions)
      .where(eq(policyVersions.documentId, doc.id))
      .orderBy(desc(policyVersions.version));
    out.push({ document: doc, versions, published: versions.find((v) => v.published) ?? null });
  }
  return out;
}
