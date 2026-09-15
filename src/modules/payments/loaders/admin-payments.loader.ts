import { and, desc, eq, sql } from "drizzle-orm";
import { z } from "astro/zod";
import { getDrizzle } from "@database/drizzle";
import { payments } from "@database/schemas/payments.schema";
import { reservations } from "@database/schemas/reservations.schema";

export const adminPaymentFiltersSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(["created", "pending", "authorized", "paid", "failed", "cancelled", "refunded", "partially_refunded"]).optional(),
  type: z.enum(["deposit", "balance", "full_payment", "refund"]).optional(),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

export async function loadAdminPayments(raw: Record<string, string | undefined>) {
  const filters = adminPaymentFiltersSchema.parse({
    page: raw.page, pageSize: raw.pageSize, status: raw.status || undefined,
    type: raw.type || undefined, sortOrder: raw.sortOrder,
  });
  const db = getDrizzle();
  const conditions = [];
  if (filters.status) conditions.push(eq(payments.status, filters.status));
  if (filters.type) conditions.push(eq(payments.type, filters.type));
  const where = conditions.length ? and(...conditions) : undefined;

  const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(payments).where(where);
  const rows = await db
    .select({ payment: payments, reservationNumber: reservations.reservationNumber })
    .from(payments)
    .innerJoin(reservations, eq(payments.reservationId, reservations.id))
    .where(where)
    .orderBy(desc(payments.createdAt))
    .limit(filters.pageSize)
    .offset((filters.page - 1) * filters.pageSize);

  return {
    rows: rows.map((r) => ({
      id: r.payment.id,
      reservationId: r.payment.reservationId,
      reservationNumber: r.reservationNumber,
      provider: r.payment.provider,
      type: r.payment.type,
      status: r.payment.status,
      amount: r.payment.amount,
      currency: r.payment.currency,
      createdAt: r.payment.createdAt,
      paidAt: r.payment.paidAt,
    })),
    meta: { total: count, page: filters.page, pageSize: filters.pageSize },
  };
}
