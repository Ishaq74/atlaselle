import { and, avg, count, eq } from "drizzle-orm";
import { getDrizzle } from "@database/drizzle";
import { trips, tripReviews } from "@database/schemas/trips.schema";

export interface TripRatingAggregate {
  ratingCount: number;
  ratingAverage100: number;
}

export async function recalculateTripRating(tripId: string): Promise<TripRatingAggregate> {
  const db = getDrizzle();
  const [aggregate] = await db
    .select({ average: avg(tripReviews.rating), count: count() })
    .from(tripReviews)
    .where(and(eq(tripReviews.tripId, tripId), eq(tripReviews.status, "APPROVED")));
  const ratingCount = Number(aggregate?.count ?? 0);
  const ratingAverage100 = ratingCount > 0 ? Math.round(Number(aggregate?.average ?? 0) * 100) : 0;
  await db.update(trips).set({ ratingAverage100, ratingCount }).where(eq(trips.id, tripId));
  return { ratingCount, ratingAverage100 };
}

export function averageFrom100(ratingAverage100: number): number {
  return Math.round((ratingAverage100 / 100) * 10) / 10;
}
