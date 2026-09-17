import { and, asc, desc, eq, sql } from "drizzle-orm";
import { z } from "astro/zod";
import { parseListFilters } from "@/lib/query-filters";
import { getDrizzle } from "@database/drizzle";
import { reservations } from "@database/schemas/reservations.schema";
import { travelers } from "@database/schemas/travelers.schema";
import { payments } from "@database/schemas/payments.schema";
import { tripTranslations } from "@database/schemas/trips.schema";
import type { ReservationStatus } from "@database/schemas/reservations.schema";

export const adminReservationFiltersSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(["pending", "awaiting_payment", "confirmed", "balance_due", "completed", "cancelled", "refunded"]).optional(),
  tripId: z.string().min(1).max(160).optional(),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

export async function loadAdminReservations(raw: Record<string, string | undefined>) {
  const filters = parseListFilters(adminReservationFiltersSchema, {
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
    .orderBy(filters.sortOrder === "asc" ? asc(reservations.createdAt) : desc(reservations.createdAt))
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

export async function loadAdminReservation(id: string) {
  const db = getDrizzle();
  const [reservation] = await db.select().from(reservations).where(eq(reservations.id, id)).limit(1);
  if (!reservation) return null;
  const [traveler] = await db.select().from(travelers).where(eq(travelers.id, reservation.travelerId)).limit(1);
  const paymentRows = await db.select().from(payments).where(eq(payments.reservationId, id)).orderBy(desc(payments.createdAt));
  const [tr] = await db
    .select({ title: tripTranslations.title })
    .from(tripTranslations)
    .where(eq(tripTranslations.tripId, reservation.tripId))
    .limit(1);
  return { reservation, traveler, payments: paymentRows, tripTitle: tr?.title ?? reservation.tripId };
}
