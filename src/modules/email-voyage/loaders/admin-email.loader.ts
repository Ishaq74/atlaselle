import { and, desc, eq, sql } from "drizzle-orm";
import { z } from "astro/zod";
import { getDrizzle } from "@database/drizzle";
import { emailDeliveries, VOYAGE_EMAIL_TEMPLATES, EMAIL_DELIVERY_STATUSES } from "@database/schemas/email-voyage.schema";

export const adminEmailFiltersSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(EMAIL_DELIVERY_STATUSES).optional(),
  templateKey: z.enum(VOYAGE_EMAIL_TEMPLATES).optional(),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

export async function loadAdminDeliveries(raw: Record<string, string | undefined>) {
  const filters = adminEmailFiltersSchema.parse({
    page: raw.page, pageSize: raw.pageSize, status: raw.status || undefined,
    templateKey: raw.templateKey || undefined, sortOrder: raw.sortOrder,
  });
  const db = getDrizzle();
  const conditions = [];
  if (filters.status) conditions.push(eq(emailDeliveries.status, filters.status));
  if (filters.templateKey) conditions.push(eq(emailDeliveries.templateKey, filters.templateKey));
  const where = conditions.length ? and(...conditions) : undefined;

  const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(emailDeliveries).where(where);
  const rows = await db
    .select()
    .from(emailDeliveries)
    .where(where)
    .orderBy(desc(emailDeliveries.createdAt))
    .limit(filters.pageSize)
    .offset((filters.page - 1) * filters.pageSize);

  return {
    rows: rows.map((r) => ({
      id: r.id,
      templateKey: r.templateKey,
      locale: r.locale,
      toEmail: r.toEmail,
      status: r.status,
      attempts: r.attempts,
      lastError: r.lastError,
      sentAt: r.sentAt,
      createdAt: r.createdAt,
    })),
    meta: { total: count, page: filters.page, pageSize: filters.pageSize },
  };
}
