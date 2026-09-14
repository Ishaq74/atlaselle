import { and, asc, eq, inArray } from "drizzle-orm";
import { getDrizzle } from "@database/drizzle";
import { cached } from "@database/cache";
import { departures } from "@database/schemas/departures.schema";

export interface OpenDepartureDTO {
  id: string;
  startDate: Date;
  endDate: Date;
  status: string;
  priceAmount: number;
  currency: string;
  depositAmount: number;
}

const loadOpenDeparturesInner = async (tripId: string): Promise<OpenDepartureDTO[]> => {
  const db = getDrizzle();
  const rows = await db
    .select({
      id: departures.id,
      startDate: departures.startDate,
      endDate: departures.endDate,
      status: departures.status,
      priceAmount: departures.priceAmount,
      currency: departures.currency,
      depositAmount: departures.depositAmount,
    })
    .from(departures)
    .where(and(eq(departures.tripId, tripId), inArray(departures.status, ["open", "limited", "waitlist"])))
    .orderBy(asc(departures.startDate));
  return rows;
};

export const loadOpenDepartures = cached((tripId: string) => `departures:open:${tripId}`, loadOpenDeparturesInner);
