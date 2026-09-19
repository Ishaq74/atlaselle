import { eq } from "drizzle-orm";
import { getDrizzle } from "@database/drizzle";
import { tripTranslations } from "@database/schemas/trips.schema";

type Db = ReturnType<typeof getDrizzle>;

/** Repository du module trips — accès lecture aux traductions (titre). */
export async function getTripTitle(tripId: string, dbOverride?: Db): Promise<string | null> {
  const db = dbOverride ?? getDrizzle();
  const [tr] = await db
    .select({ title: tripTranslations.title })
    .from(tripTranslations)
    .where(eq(tripTranslations.tripId, tripId))
    .limit(1);
  return tr?.title ?? null;
}
