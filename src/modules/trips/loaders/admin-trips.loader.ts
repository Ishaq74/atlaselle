import { and, asc, desc, eq, ilike, or, sql } from "drizzle-orm";
import { z } from "zod";
import { parseListFilters } from "@/lib/query-filters";
import { getDrizzle } from "@database/drizzle";
import { trips, tripTranslations, tripRevisions } from "@database/schemas/trips.schema";
import { departures } from "@database/schemas/departures.schema";
import type { TripStatus } from "@database/schemas/trips.schema";

export const adminTripFiltersSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().max(160).optional(),
  status: z.enum(["draft", "review", "approved", "published", "unpublished", "archived"]).optional(),
  countryCode: z.string().length(2).optional(),
  sortBy: z.enum(["createdAt", "updatedAt"]).default("updatedAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

export type AdminTripFilters = z.infer<typeof adminTripFiltersSchema>;

export interface AdminTripRow {
  id: string;
  status: TripStatus;
  countryCode: string;
  title: string | null;
  departuresCount: number;
  updatedAt: Date;
}

export async function loadAdminTrips(raw: Record<string, string | undefined>): Promise<{
  rows: AdminTripRow[];
  meta: { total: number; page: number; pageSize: number };
}> {
  const filters = parseListFilters(adminTripFiltersSchema, {
    page: raw.page,
    pageSize: raw.pageSize,
    search: raw.search || undefined,
    status: raw.status || undefined,
    countryCode: raw.countryCode || undefined,
    sortBy: raw.sortBy,
    sortOrder: raw.sortOrder,
  });
  const db = getDrizzle();
  const conditions = [];
  if (filters.status) conditions.push(eq(trips.status, filters.status));
  if (filters.countryCode) conditions.push(eq(trips.countryCode, filters.countryCode.toUpperCase()));
  if (filters.search) {
    const like = `%${filters.search}%`;
    const matching = await db
      .select({ tripId: tripTranslations.tripId })
      .from(tripTranslations)
      .where(or(ilike(tripTranslations.title, like), ilike(tripTranslations.slug, like)));
    const ids = [...new Set(matching.map((m) => m.tripId))];
    conditions.push(ids.length ? or(...ids.map((id) => eq(trips.id, id)))! : sql`false`);
  }
  const where = conditions.length ? and(...conditions) : undefined;
  const order = filters.sortBy === "createdAt"
    ? (filters.sortOrder === "asc" ? asc(trips.createdAt) : desc(trips.createdAt))
    : filters.sortOrder === "asc" ? asc(trips.updatedAt) : desc(trips.updatedAt);

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(trips)
    .where(where);
  const rows = await db
    .select()
    .from(trips)
    .where(where)
    .orderBy(order)
    .limit(filters.pageSize)
    .offset((filters.page - 1) * filters.pageSize);

  const out: AdminTripRow[] = [];
  for (const row of rows) {
    const [tr] = await db
      .select({ title: tripTranslations.title })
      .from(tripTranslations)
      .where(eq(tripTranslations.tripId, row.id))
      .limit(1);
    const [{ count: depCount }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(departures)
      .where(eq(departures.tripId, row.id));
    out.push({
      id: row.id,
      status: row.status as TripStatus,
      countryCode: row.countryCode,
      title: tr?.title ?? null,
      departuresCount: depCount,
      updatedAt: row.updatedAt,
    });
  }
  return { rows: out, meta: { total: count, page: filters.page, pageSize: filters.pageSize } };
}

export interface AdminTripDetail {
  trip: typeof trips.$inferSelect;
  translations: (typeof tripTranslations.$inferSelect)[];
  departures: (typeof departures.$inferSelect)[];
}

export async function loadAdminTrip(id: string): Promise<AdminTripDetail | null> {
  const db = getDrizzle();
  const [trip] = await db.select().from(trips).where(eq(trips.id, id)).limit(1);
  if (!trip) return null;
  const translations = await db.select().from(tripTranslations).where(eq(tripTranslations.tripId, id));
  const deps = await db
    .select()
    .from(departures)
    .where(eq(departures.tripId, id))
    .orderBy(asc(departures.startDate));
  return { trip, translations, departures: deps };
}

export async function listTripRevisions(tripId: string, limit = 10) {
  return getDrizzle()
    .select()
    .from(tripRevisions)
    .where(eq(tripRevisions.tripId, tripId))
    .orderBy(desc(tripRevisions.createdAt))
    .limit(limit);
}
