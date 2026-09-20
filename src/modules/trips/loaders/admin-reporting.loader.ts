import { and, eq, gte, lte, sql } from "drizzle-orm";
import { getDrizzle } from "@database/drizzle";
import { cached } from "@database/cache";
import { applications } from "@database/schemas/applications.schema";
import { departures } from "@database/schemas/departures.schema";
import { reservations } from "@database/schemas/reservations.schema";
import { trips, tripTranslations, tripComments, tripReports, tripReviews, tripViewStats } from "@database/schemas/trips.schema";

export interface VoyageReportingRange {
  day: { applications: number; reservations: number; revenueGross: number; views: number };
  week: { applications: number; reservations: number; revenueGross: number; views: number };
  month: { applications: number; reservations: number; revenueGross: number; views: number };
}

export interface VoyageTripReportRow {
  tripId: string;
  title: string | null;
  applications: number;
  approvalRate: number;
  reservations: number;
  revenueGross: number;
  revenueCollected: number;
  revenuePending: number;
  revenueRefunded: number;
  occupancyRate: number;
  ratingAverage: number;
  ratingCount: number;
  pendingComments: number;
  pendingReviews: number;
  pendingReports: number;
}

export interface VoyageDepartureReportRow {
  departureId: string;
  tripId: string;
  startDate: Date;
  status: string;
  capacityMax: number;
  confirmedSeats: number;
  occupancyRate: number;
  revenueGross: number;
}

function startOfDay(now: Date): Date {
  const d = new Date(now);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

export async function loadVoyageReporting(now = new Date()): Promise<VoyageReportingRange> {
  const db = getDrizzle();
  const dayStart = startOfDay(now);
  const weekStart = new Date(now.getTime() - 7 * 86_400_000);
  const monthStart = new Date(now.getTime() - 30 * 86_400_000);
  const range = async (from: Date) => {
    const [[apps], [resas], [revenue], [views]] = await Promise.all([
      db.select({ n: sql<number>`count(*)::int` }).from(applications).where(gte(applications.createdAt, from)),
      db.select({ n: sql<number>`count(*)::int` }).from(reservations).where(gte(reservations.createdAt, from)),
      db.select({ total: sql<number>`coalesce(sum(${reservations.totalAmount}),0)::int` }).from(reservations).where(gte(reservations.createdAt, from)),
      db.select({ n: sql<number>`count(*)::int` }).from(tripViewStats).where(gte(tripViewStats.viewedAt, from)),
    ]);
    return { applications: apps?.n ?? 0, reservations: resas?.n ?? 0, revenueGross: revenue?.total ?? 0, views: views?.n ?? 0 };
  };
  const [day, week, month] = await Promise.all([range(dayStart), range(weekStart), range(monthStart)]);
  return { day, week, month };
}

export const loadVoyageReportingCached = cached(() => "voyage:reporting:range", loadVoyageReporting);

export async function loadVoyageTripReports(): Promise<VoyageTripReportRow[]> {
  const db = getDrizzle();
  const allTrips = await db.select({ id: trips.id, ratingAverage100: trips.ratingAverage100, ratingCount: trips.ratingCount }).from(trips);
  const out: VoyageTripReportRow[] = [];
  for (const trip of allTrips) {
    const [tr] = await db.select({ title: tripTranslations.title }).from(tripTranslations).where(eq(tripTranslations.tripId, trip.id)).limit(1);
    const [[apps], [approved], [resas], [gross], [collected], [refunded], [pendingComments], [pendingReviews], [pendingReports]] = await Promise.all([
      db.select({ n: sql<number>`count(*)::int` }).from(applications).where(eq(applications.tripId, trip.id)),
      db.select({ n: sql<number>`count(*)::int` }).from(applications).where(and(eq(applications.tripId, trip.id), eq(applications.status, "approved"))),
      db.select({ n: sql<number>`count(*)::int` }).from(reservations).where(eq(reservations.tripId, trip.id)),
      db.select({ total: sql<number>`coalesce(sum(${reservations.totalAmount}),0)::int` }).from(reservations).where(eq(reservations.tripId, trip.id)),
      db.select({ total: sql<number>`coalesce(sum(${reservations.amountPaid}),0)::int` }).from(reservations).where(eq(reservations.tripId, trip.id)),
      db.select({ n: sql<number>`count(*)::int` }).from(reservations).where(and(eq(reservations.tripId, trip.id), eq(reservations.status, "refunded"))),
      db.select({ n: sql<number>`count(*)::int` }).from(tripComments).where(and(eq(tripComments.tripId, trip.id), eq(tripComments.status, "PENDING"))),
      db.select({ n: sql<number>`count(*)::int` }).from(tripReviews).where(and(eq(tripReviews.tripId, trip.id), eq(tripReviews.status, "PENDING"))),
      db.select({ n: sql<number>`count(*)::int` }).from(tripReports).where(and(eq(tripReports.tripId, trip.id), eq(tripReports.status, "PENDING"))),
    ]);
    const applicationsCount = apps?.n ?? 0;
    const approvalRate = applicationsCount > 0 ? Math.round(((approved?.n ?? 0) / applicationsCount) * 100) : 0;
    const revenueGross = gross?.total ?? 0;
    const revenueCollected = collected?.total ?? 0;
    out.push({
      tripId: trip.id,
      title: tr?.title ?? null,
      applications: applicationsCount,
      approvalRate,
      reservations: resas?.n ?? 0,
      revenueGross,
      revenueCollected,
      revenuePending: Math.max(0, revenueGross - revenueCollected),
      revenueRefunded: refunded?.n ?? 0,
      occupancyRate: 0,
      ratingAverage: Math.round((trip.ratingAverage100 / 100) * 10) / 10,
      ratingCount: trip.ratingCount,
      pendingComments: pendingComments?.n ?? 0,
      pendingReviews: pendingReviews?.n ?? 0,
      pendingReports: pendingReports?.n ?? 0,
    });
  }
  return out;
}

export async function loadVoyageDepartureReports(): Promise<VoyageDepartureReportRow[]> {
  const db = getDrizzle();
  const deps = await db.select().from(departures);
  const out: VoyageDepartureReportRow[] = [];
  for (const dep of deps) {
    const [[confirmed], [gross]] = await Promise.all([
      db.select({ n: sql<number>`count(*)::int` }).from(reservations).where(and(eq(reservations.departureId, dep.id), lte(reservations.createdAt, new Date("2999-01-01")))),
      db.select({ total: sql<number>`coalesce(sum(${reservations.totalAmount}),0)::int` }).from(reservations).where(eq(reservations.departureId, dep.id)),
    ]);
    const confirmedSeats = confirmed?.n ?? 0;
    out.push({
      departureId: dep.id,
      tripId: dep.tripId,
      startDate: dep.startDate,
      status: dep.status,
      capacityMax: dep.capacityMax,
      confirmedSeats,
      occupancyRate: dep.capacityMax > 0 ? Math.round((confirmedSeats / dep.capacityMax) * 100) : 0,
      revenueGross: gross?.total ?? 0,
    });
  }
  return out;
}
