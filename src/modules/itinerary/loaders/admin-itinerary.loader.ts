import { asc, eq } from "drizzle-orm";
import { getDrizzle } from "@database/drizzle";
import { itineraryDays, itineraryDayTranslations } from "@database/schemas/itinerary.schema";

export async function loadAdminItinerary(tripId: string) {
  const db = getDrizzle();
  const days = await db
    .select()
    .from(itineraryDays)
    .where(eq(itineraryDays.tripId, tripId))
    .orderBy(asc(itineraryDays.dayNumber));
  const out = [];
  for (const day of days) {
    const translations = await db
      .select()
      .from(itineraryDayTranslations)
      .where(eq(itineraryDayTranslations.dayId, day.id));
    out.push({ day, translations });
  }
  return out;
}
