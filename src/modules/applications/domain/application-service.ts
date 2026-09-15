import { and, eq, inArray, lte } from "drizzle-orm";
import { getDrizzle } from "@database/drizzle";
import { applications, applicationEvents } from "@database/schemas";

// Candidatures sans décision depuis 30 j → expired (TODO §11.5, §14.2).
export const APPLICATION_EXPIRY_DAYS = 30;

export async function expireApplications(now = new Date()): Promise<number> {
  const db = getDrizzle();
  const cutoff = new Date(now.getTime() - APPLICATION_EXPIRY_DAYS * 86_400_000);
  const stale = await db
    .select({ id: applications.id })
    .from(applications)
    .where(
      and(
        inArray(applications.status, ["submitted", "under_review", "contact_required"]),
        lte(applications.submittedAt, cutoff),
      ),
    );
  for (const row of stale) {
    await db.transaction(async (tx) => {
      await tx.update(applications).set({ status: "expired" }).where(eq(applications.id, row.id));
      await tx.insert(applicationEvents).values({ applicationId: row.id, event: "expired" });
    });
  }
  return stale.length;
}
