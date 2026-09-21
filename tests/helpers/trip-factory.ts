import { getDrizzle } from "@database/drizzle";
import { trips } from "@database/schemas/trips.schema";
import { mediaFiles } from "@database/schemas/media.schema";

type Db = ReturnType<typeof getDrizzle>;
type TripInsert = typeof trips.$inferInsert;

export interface InsertedTestTrip {
  tripId: string | undefined;
  heroMediaId: string | null;
}

let mediaSeq = 0;

/**
 * Insère un media minimal valide pour servir de hero aux trips de test.
 * Respecte les contraintes `media_files_size_positive` (size > 0) et
 * `media_files_url_uidx` (url unique via l'id).
 * Ids préfixés `test-media-` : purgés par purgeVoyageTestFixtures.
 */
async function insertTestMedia(db: Db): Promise<string> {
  mediaSeq += 1;
  const id = `test-media-${Date.now().toString(36)}-${mediaSeq.toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  await db.insert(mediaFiles).values({
    id,
    filename: `${id}.jpg`,
    url: `/uploads/media/${id}.jpg`,
    mimeType: "image/jpeg",
    size: 1024,
    width: 1600,
    height: 900,
  });
  return id;
}

/**
 * Remplace `db.insert(trips).values(...)` dans les fixtures d'intégration.
 *
 * La contrainte métier `trips_hero_ck` impose un hero à tout trip published :
 * un media de test est inséré et rattaché automatiquement dès que
 * `heroMediaId` n'est pas fourni (y compris pour les drafts, afin que les
 * transitions ultérieures vers `published` restent valides). Passer
 * explicitement `heroMediaId: null` permet de tester un trip sans hero.
 * `publishedAt` est également renseigné par défaut quand status='published'
 * (contrainte `trips_publish_ck`).
 *
 * Accepte un objet ou un tableau, comme `db.insert(trips).values(...)`.
 */
export async function insertTestTrip(
  db: Db,
  values: TripInsert | TripInsert[],
): Promise<InsertedTestTrip[]> {
  const input = Array.isArray(values) ? values : [values];
  const rows: TripInsert[] = [];
  const inserted: InsertedTestTrip[] = [];
  for (const row of input) {
    const next: TripInsert = { ...row };
    let heroMediaId = next.heroMediaId ?? null;
    if (next.heroMediaId === undefined) {
      heroMediaId = await insertTestMedia(db);
      next.heroMediaId = heroMediaId;
    }
    if (next.status === "published" && next.publishedAt === undefined) {
      next.publishedAt = new Date();
    }
    rows.push(next);
    inserted.push({ tripId: next.id, heroMediaId });
  }
  await db.insert(trips).values(rows);
  return inserted;
}
