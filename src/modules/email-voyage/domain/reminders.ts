import { and, eq, gte, inArray, lte } from "drizzle-orm";
import { getDrizzle } from "@database/drizzle";
import { reservations } from "@database/schemas";
import { departures } from "@database/schemas";
import { travelers } from "@database/schemas";
import { tripTranslations } from "@database/schemas";
import { emailDeliveries } from "@database/schemas";
import type { VoyageEmailTemplate } from "@database/schemas/email-voyage.schema";
import { isValidLocale } from "@/i18n/utils";
import type { Locale } from "@/i18n/config";
import { sendVoyageEmail, type SendFn } from "./voyage-email";

function fmtMoney(cents: number, currency: string): string {
  const major = (cents / 100).toLocaleString("en");
  return currency === "EUR" ? `€${major}` : `${major} ${currency}`;
}

function fmtDate(locale: Locale, d: Date): string {
  return new Intl.DateTimeFormat(locale, { day: "numeric", month: "long", year: "numeric" }).format(d);
}

async function alreadySent(template: VoyageEmailTemplate, travelerId: string, reservationId: string): Promise<boolean> {
  const [row] = await getDrizzle()
    .select({ id: emailDeliveries.id })
    .from(emailDeliveries)
    .where(
      and(
        eq(emailDeliveries.templateKey, template),
        eq(emailDeliveries.travelerId, travelerId),
        eq(emailDeliveries.reservationId, reservationId),
        eq(emailDeliveries.status, "sent"),
      ),
    )
    .limit(1);
  return !!row;
}

// Soldes dus sous 7 j, réservations confirmed/balance_due (TODO §14.2).
export async function sendBalanceReminders(now = new Date(), sender?: SendFn): Promise<number> {
  const db = getDrizzle();
  const horizon = new Date(now.getTime() + 7 * 24 * 3600_000);
  const rows = await db
    .select({ reservation: reservations, departure: departures, traveler: travelers })
    .from(reservations)
    .innerJoin(departures, eq(reservations.departureId, departures.id))
    .innerJoin(travelers, eq(reservations.travelerId, travelers.id))
    .where(
      and(
        inArray(reservations.status, ["confirmed", "balance_due"]),
        gte(reservations.balanceDueDate, now),
        lte(reservations.balanceDueDate, horizon),
      ),
    );
  let sent = 0;
  for (const { reservation, departure, traveler } of rows) {
    if (!reservation.balanceDueDate) continue;
    if (await alreadySent("balance_reminder", traveler.id, reservation.id)) continue;
    const locale: Locale = isValidLocale(traveler.locale) ? traveler.locale : "en";
    const [tr] = await db.select({ title: tripTranslations.title }).from(tripTranslations).where(eq(tripTranslations.tripId, reservation.tripId)).limit(1);
    void departure;
    const res = await sendVoyageEmail(
      {
        template: "balance_reminder",
        locale,
        toEmail: traveler.email,
        travelerId: traveler.id,
        reservationId: reservation.id,
        vars: {
          name: traveler.preferredName ?? traveler.legalName ?? traveler.email,
          trip: tr?.title ?? reservation.tripId,
          amount: fmtMoney(reservation.amountDue, reservation.currency),
          date: fmtDate(locale, reservation.balanceDueDate),
        },
      },
      sender,
    );
    if (res.sent) sent += 1;
  }
  return sent;
}

// Pré/post voyage : J-14 rappel, J+3 suivi (TODO §14.2).
export async function sendTripReminders(now = new Date(), sender?: SendFn): Promise<{ pre: number; post: number }> {
  const db = getDrizzle();
  let pre = 0;
  let post = 0;
  const upcoming = await db
    .select({ reservation: reservations, departure: departures, traveler: travelers })
    .from(reservations)
    .innerJoin(departures, eq(reservations.departureId, departures.id))
    .innerJoin(travelers, eq(reservations.travelerId, travelers.id))
    .where(inArray(reservations.status, ["confirmed", "balance_due", "completed"]));

  for (const { reservation, departure, traveler } of upcoming) {
    const locale: Locale = isValidLocale(traveler.locale) ? traveler.locale : "en";
    const [tr] = await db.select({ title: tripTranslations.title }).from(tripTranslations).where(eq(tripTranslations.tripId, reservation.tripId)).limit(1);
    const name = traveler.preferredName ?? traveler.legalName ?? traveler.email;
    const dates = `${fmtDate(locale, departure.startDate)} – ${fmtDate(locale, departure.endDate)}`;
    const daysToStart = Math.ceil((departure.startDate.getTime() - now.getTime()) / 86_400_000);
    if (daysToStart <= 14 && daysToStart >= 0 && !(await alreadySent("pre_trip_reminder", traveler.id, reservation.id))) {
      const res = await sendVoyageEmail({
        template: "pre_trip_reminder", locale, toEmail: traveler.email,
        travelerId: traveler.id, reservationId: reservation.id,
        vars: { name, trip: tr?.title ?? reservation.tripId, dates },
      }, sender);
      if (res.sent) pre += 1;
    }
    const daysSinceEnd = Math.ceil((now.getTime() - departure.endDate.getTime()) / 86_400_000);
    if (daysSinceEnd >= 3 && !(await alreadySent("post_trip_followup", traveler.id, reservation.id))) {
      const res = await sendVoyageEmail({
        template: "post_trip_followup", locale, toEmail: traveler.email,
        travelerId: traveler.id, reservationId: reservation.id,
        vars: { name, trip: tr?.title ?? reservation.tripId },
      }, sender);
      if (res.sent) post += 1;
    }
  }
  return { pre, post };
}
