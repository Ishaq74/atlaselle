import { and, eq, gte, lte, sql } from "drizzle-orm";
import { getDrizzle } from "@database/drizzle";
import { applications } from "@database/schemas/applications.schema";
import { departures } from "@database/schemas/departures.schema";
import { payments } from "@database/schemas/payments.schema";
import { reservations } from "@database/schemas/reservations.schema";
import { tripTranslations } from "@database/schemas/trips.schema";

export interface VoyageHealth {
  pendingApplications: number;
  openDepartures: number;
  upcomingDepartures7d: number;
  recentReservations7d: number;
  failedPayments: number;
  balancesDue: number;
  unpublishedTrips: number;
}

// Tableau de bord : priorités opérationnelles (TODO §16.6).
export async function loadVoyageHealth(now = new Date()): Promise<VoyageHealth> {
  const db = getDrizzle();
  const week = new Date(now.getTime() + 7 * 86_400_000);
  const lastWeek = new Date(now.getTime() - 7 * 86_400_000);
  const [[pending], [open], [upcoming], [recent], [failed], [balances], [unpub]] = await Promise.all([
    db.select({ n: sql<number>`count(*)::int` }).from(applications).where(eq(applications.status, "under_review")),
    db.select({ n: sql<number>`count(*)::int` }).from(departures).where(eq(departures.status, "open")),
    db.select({ n: sql<number>`count(*)::int` }).from(departures).where(and(gte(departures.startDate, now), lte(departures.startDate, week))),
    db.select({ n: sql<number>`count(*)::int` }).from(reservations).where(gte(reservations.createdAt, lastWeek)),
    db.select({ n: sql<number>`count(*)::int` }).from(payments).where(eq(payments.status, "failed")),
    db.select({ n: sql<number>`count(*)::int` }).from(reservations).where(eq(reservations.status, "balance_due")),
    db.select({ n: sql<number>`count(*)::int` }).from(tripTranslations).where(eq(tripTranslations.localeVisible, false)),
  ]);
  return {
    pendingApplications: pending?.n ?? 0,
    openDepartures: open?.n ?? 0,
    upcomingDepartures7d: upcoming?.n ?? 0,
    recentReservations7d: recent?.n ?? 0,
    failedPayments: failed?.n ?? 0,
    balancesDue: balances?.n ?? 0,
    unpublishedTrips: unpub?.n ?? 0,
  };
}
