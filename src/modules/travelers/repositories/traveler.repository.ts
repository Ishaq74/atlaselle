import { eq } from "drizzle-orm";
import { getDrizzle } from "@database/drizzle";
import { travelers } from "@database/schemas/travelers.schema";

type Db = ReturnType<typeof getDrizzle>;

/** Repository du module travelers — seul propriétaire de la table `travelers`. */
export async function getTravelerById(travelerId: string, dbOverride?: Db): Promise<(typeof travelers.$inferSelect) | null> {
  const db = dbOverride ?? getDrizzle();
  const [row] = await db.select().from(travelers).where(eq(travelers.id, travelerId)).limit(1);
  return row ?? null;
}
