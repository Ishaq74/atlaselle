import { asc, desc, eq, ilike, or, sql } from "drizzle-orm";
import { z } from "zod";
import { parseListFilters } from "@/lib/query-filters";
import { getDrizzle } from "@database/drizzle";
import { travelers } from "@database/schemas/travelers.schema";
import { applications } from "@database/schemas/applications.schema";
import { reservations } from "@database/schemas/reservations.schema";

export const adminTravelerFiltersSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().max(160).optional(),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

// Liste RGPD-safe : jamais de données sensibles (régime, santé, notes).
export async function loadAdminTravelers(raw: Record<string, string | undefined>) {
  const filters = parseListFilters(adminTravelerFiltersSchema, {
    page: raw.page, pageSize: raw.pageSize, search: raw.search || undefined, sortOrder: raw.sortOrder,
  });
  const db = getDrizzle();
  const where = filters.search
    ? or(ilike(travelers.email, `%${filters.search}%`), ilike(travelers.legalName, `%${filters.search}%`))
    : undefined;

  const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(travelers).where(where);
  const rows = await db
    .select()
    .from(travelers)
    .where(where)
    .orderBy(filters.sortOrder === "asc" ? asc(travelers.createdAt) : desc(travelers.createdAt))
    .limit(filters.pageSize)
    .offset((filters.page - 1) * filters.pageSize);

  const out = [];
  for (const row of rows) {
    const [{ count: appCount }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(applications)
      .where(eq(applications.travelerId, row.id));
    const [{ count: resCount }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(reservations)
      .where(eq(reservations.travelerId, row.id));
    out.push({
      id: row.id,
      email: row.email,
      legalName: row.legalName,
      locale: row.locale,
      emailVerifiedAt: row.emailVerifiedAt,
      applicationsCount: appCount,
      reservationsCount: resCount,
      createdAt: row.createdAt,
    });
  }
  return { rows: out, meta: { total: count, page: filters.page, pageSize: filters.pageSize } };
}
