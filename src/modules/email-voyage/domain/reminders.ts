import { and, desc, eq, gt, gte, inArray, lte } from "drizzle-orm";
import { getDrizzle } from "@database/drizzle";
import { reservations } from "@database/schemas";
import { departures } from "@database/schemas";
import { travelers } from "@database/schemas";
import { tripTranslations } from "@database/schemas";
import { emailDeliveries } from "@database/schemas";
import { checkoutSessions } from "@database/schemas";
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

function addCalendarMonthsClamped(anchor: Date, months: number): Date {
  const monthIndex = anchor.getUTCMonth() + months;
  const year = anchor.getUTCFullYear() + Math.floor(monthIndex / 12);
  const month = ((monthIndex % 12) + 12) % 12;
  const day = Math.min(anchor.getUTCDate(), new Date(Date.UTC(year, month + 1, 0)).getUTCDate());
  return new Date(Date.UTC(
    year,
    month,
    day,
    anchor.getUTCHours(),
    anchor.getUTCMinutes(),
    anchor.getUTCSeconds(),
    anchor.getUTCMilliseconds(),
  ));
}

export function balanceReminderSchedule(confirmedAt: Date, balanceDueDate: Date): Date[] {
  if (balanceDueDate <= confirmedAt) return [];
  const dates: Date[] = [];
  const firstReminder = new Date(confirmedAt.getTime() + 2 * 86_400_000);
  if (firstReminder < balanceDueDate) dates.push(firstReminder);
  for (let month = 1; month <= 120; month += 1) {
    const reminder = addCalendarMonthsClamped(confirmedAt, month);
    if (reminder >= balanceDueDate) break;
    dates.push(reminder);
  }
  return [...new Map(dates.map((date) => [date.toISOString().slice(0, 10), date])).values()];
}

// Rappel J+2 puis mensuel depuis la confirmation, sans dépasser l'échéance.
export async function sendBalanceReminders(now = new Date(), sender?: SendFn): Promise<number> {
  const db = getDrizzle();
  const rows = await db
    .select({ reservation: reservations, departure: departures, traveler: travelers })
    .from(reservations)
    .innerJoin(departures, eq(reservations.departureId, departures.id))
    .innerJoin(travelers, eq(reservations.travelerId, travelers.id))
    .where(
      and(
        inArray(reservations.status, ["confirmed", "balance_due"]),
        gte(reservations.balanceDueDate, now),
        lte(reservations.balanceDueDate, new Date(now.getTime() + 7 * 86_400_000)),
        // Pas de relance pour un solde nul (réservation déjà soldée).
        gt(reservations.amountDue, 0),
      ),
    );
  let sent = 0;
  for (const { reservation, departure, traveler } of rows) {
    if (!reservation.confirmedAt || !reservation.balanceDueDate) continue;
    const scheduledAt = balanceReminderSchedule(reservation.confirmedAt, reservation.balanceDueDate)
      .filter((date) => date <= now)
      .at(-1);
    if (!scheduledAt) continue;
    const locale: Locale = isValidLocale(traveler.locale) ? traveler.locale : "en";
    const [tr] = await db.select({ title: tripTranslations.title }).from(tripTranslations).where(eq(tripTranslations.tripId, reservation.tripId)).limit(1);
    const [checkout] = await db
      .select({ providerSessionId: checkoutSessions.providerSessionId })
      .from(checkoutSessions)
      .where(eq(checkoutSessions.reservationId, reservation.id))
      .orderBy(desc(checkoutSessions.createdAt))
      .limit(1);
    const origin = process.env.SITE_URL ?? "http://localhost:4321";
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
        url: checkout?.providerSessionId
          ? `${origin}/${locale}/booking-confirmed?session_id=${encodeURIComponent(checkout.providerSessionId)}`
          : undefined,
        dedupeKey: `balance:${reservation.id}:${scheduledAt.toISOString().slice(0, 10)}`,
      },
      sender,
    );
    if (res.sent) sent += 1;
    void departure;
  }
  return sent;
}

// Pré/post voyage : préparation J-30, rappel J-14, suivi J+3 (TODO §14.2).
export async function sendTripReminders(now = new Date(), sender?: SendFn): Promise<{ preparation: number; pre: number; post: number }> {
  const db = getDrizzle();
  let preparation = 0;
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
    if (daysToStart <= 30 && daysToStart > 14 && !(await alreadySent("pre_trip_preparation", traveler.id, reservation.id))) {
      const res = await sendVoyageEmail({
        template: "pre_trip_preparation", locale, toEmail: traveler.email,
        travelerId: traveler.id, reservationId: reservation.id,
        vars: { name, trip: tr?.title ?? reservation.tripId, dates },
      }, sender);
      if (res.sent) preparation += 1;
    }
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
  return { preparation, pre, post };
}
