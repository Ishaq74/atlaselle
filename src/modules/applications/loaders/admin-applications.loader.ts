import { and, asc, desc, eq, sql } from "drizzle-orm";
import { z } from "astro/zod";
import { getDrizzle } from "@database/drizzle";
import { applications, applicationDecisions, applicationEvents } from "@database/schemas/applications.schema";
import { travelers } from "@database/schemas/travelers.schema";
import type { ApplicationStatus } from "@database/schemas/applications.schema";

export const adminApplicationFiltersSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(["draft", "submitted", "under_review", "contact_required", "approved", "declined", "withdrawn", "expired"]).optional(),
  tripId: z.string().uuid().optional(),
  departureId: z.string().uuid().optional(),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

export interface AdminApplicationRow {
  id: string;
  status: ApplicationStatus;
  travelerEmail: string;
  tripId: string;
  departureId: string;
  submittedAt: Date | null;
  createdAt: Date;
}

export async function loadAdminApplications(raw: Record<string, string | undefined>): Promise<{
  rows: AdminApplicationRow[];
  meta: { total: number; page: number; pageSize: number };
}> {
  const filters = adminApplicationFiltersSchema.parse({
    page: raw.page, pageSize: raw.pageSize, status: raw.status || undefined,
    tripId: raw.tripId || undefined, departureId: raw.departureId || undefined, sortOrder: raw.sortOrder,
  });
  const db = getDrizzle();
  const conditions = [];
  if (filters.status) conditions.push(eq(applications.status, filters.status));
  if (filters.tripId) conditions.push(eq(applications.tripId, filters.tripId));
  if (filters.departureId) conditions.push(eq(applications.departureId, filters.departureId));
  const where = conditions.length ? and(...conditions) : undefined;
  const order = filters.sortOrder === "asc" ? asc(applications.createdAt) : desc(applications.createdAt);

  const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(applications).where(where);
  const rows = await db
    .select({ application: applications, travelerEmail: travelers.email })
    .from(applications)
    .innerJoin(travelers, eq(applications.travelerId, travelers.id))
    .where(where)
    .orderBy(order)
    .limit(filters.pageSize)
    .offset((filters.page - 1) * filters.pageSize);

  return {
    rows: rows.map((r) => ({
      id: r.application.id,
      status: r.application.status as ApplicationStatus,
      travelerEmail: r.travelerEmail,
      tripId: r.application.tripId,
      departureId: r.application.departureId,
      submittedAt: r.application.submittedAt,
      createdAt: r.application.createdAt,
    })),
    meta: { total: count, page: filters.page, pageSize: filters.pageSize },
  };
}

export async function loadAdminApplication(id: string) {
  const db = getDrizzle();
  const [application] = await db.select().from(applications).where(eq(applications.id, id)).limit(1);
  if (!application) return null;
  const [traveler] = await db.select().from(travelers).where(eq(travelers.id, application.travelerId)).limit(1);
  const decisions = await db
    .select()
    .from(applicationDecisions)
    .where(eq(applicationDecisions.applicationId, id))
    .orderBy(desc(applicationDecisions.createdAt));
  const events = await db
    .select()
    .from(applicationEvents)
    .where(eq(applicationEvents.applicationId, id))
    .orderBy(asc(applicationEvents.createdAt));
  return { application, traveler, decisions, events };
}
