import { and, desc, eq, sql } from "drizzle-orm";
import { z } from "astro/zod";
import { getDrizzle } from "@database/drizzle";
import { reservations } from "@database/schemas/reservations.schema";
import { travelers } from "@database/schemas/travelers.schema";
import type { ReservationStatus } from "@database/schemas/reservations.schema";

export const adminReservationFiltersSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(["pending", "awaiting_payment", "confirmed", "balance_due", "completed", "cancelled", "refunded"]).optional(),
  tripId: z.string().min(1).max(160).optional(),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

export async function loadAdminReservations(raw: Record<string, string | undefined>) {
  const filters = adminReservationFiltersSchema.parse({
    page: raw.page, pageSize: raw.pageSize, status: raw.status || undefined,
    tripId: raw.tripId || undefined, sortOrder: raw.sortOrder,
  });
  const db = getDrizzle();
  const conditions = [];
  if (filters.status) conditions.push(eq(reservations.status, filters.status));
  if (filters.tripId) conditions.push(eq(reservations.tripId, filters.tripId));
  const where = conditions.length ? and(...conditions) : undefined;

  const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(reservations).where(where);
  const rows = await db
    .select({ reservation: reservations, travelerEmail: travelers.email })
    .from(reservations)
    .innerJoin(travelers, eq(reservations.travelerId, travelers.id))
    .where(where)
    .orderBy(desc(reservations.createdAt))
    .limit(filters.pageSize)
    .offset((filters.page - 1) * filters.pageSize);

  return {
    rows: rows.map((r) => ({
      id: r.reservation.id,
      reservationNumber: r.reservation.reservationNumber,
      status: r.reservation.status as ReservationStatus,
      travelerEmail: r.travelerEmail,
      totalAmount: r.reservation.totalAmount,
      amountPaid: r.reservation.amountPaid,
      amountDue: r.reservation.amountDue,
      currency: r.reservation.currency,
      createdAt: r.reservation.createdAt,
    })),
    meta: { total: count, page: filters.page, pageSize: filters.pageSize },
  };
}
