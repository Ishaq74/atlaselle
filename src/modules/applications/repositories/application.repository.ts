import { eq } from "drizzle-orm";
import { getDrizzle } from "@database/drizzle";
import { applications } from "@database/schemas/applications.schema";

type Db = ReturnType<typeof getDrizzle>;

/** Repository du module applications — seul propriétaire de la table `applications`. */
export async function getApplicationById(applicationId: string, dbOverride?: Db): Promise<(typeof applications.$inferSelect) | null> {
  const db = dbOverride ?? getDrizzle();
  const [row] = await db.select().from(applications).where(eq(applications.id, applicationId)).limit(1);
  return row ?? null;
}
