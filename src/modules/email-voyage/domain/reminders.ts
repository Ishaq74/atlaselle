import { and, desc, eq, gt, inArray } from "drizzle-orm";
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
import { subtractCalendarMonths } from "@/modules/pricing/domain/pricing";

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

export const BALANCE_FIRST_REMINDER_DAYS = 2;
// Dernier rappel : une semaine avant la date limite finale du solde.
export const BALANCE_FINAL_REMINDER_DAYS = 7;
// Un rappel manqué (worker à l'arrêt) n'est rattrapé que pendant ce délai : pas de rafale rétroactive.
export const BALANCE_REMINDER_GRACE_DAYS = 7;

export type BalanceReminderKind = "reminder" | "final";
export interface BalanceReminder { at: Date; kind: BalanceReminderKind }

const DAY_MS = 86_400_000;
// L'échéance d'une réservation tardive est posée à l'instant de la réservation, à quelques ms de la confirmation.
const LATE_BOOKING_TOLERANCE_MS = 60_000;

export function isLateBooking(confirmedAt: Date, balanceDueDate: Date): boolean {
  return balanceDueDate.getTime() <= confirmedAt.getTime() + LATE_BOOKING_TOLERANCE_MS;
}

// Calendrier stable, calculé depuis la confirmation de l'acompte (jamais depuis l'exécution du worker) :
// J+2, puis un rappel par mois calendaire (fin de mois ramenée au dernier jour), puis un dernier
// rappel à J-7 de la date limite finale (départ - 2 mois, déjà ramenée à la réservation si tardive).
// Réservation tardive (échéance <= confirmation) : solde exigible immédiatement ; mêmes rappels
// J+2 puis mensuels, jusqu'au départ ; pas de rappel « dernier délai » rétroactif.
export function balanceReminderSchedule(confirmedAt: Date, balanceDueDate: Date, departureStart: Date): BalanceReminder[] {
  const lateBooking = isLateBooking(confirmedAt, balanceDueDate);
  const horizon = lateBooking ? departureStart : balanceDueDate;
  if (horizon <= confirmedAt) return [];
  let reminders: BalanceReminder[] = [];
  const first = new Date(confirmedAt.getTime() + BALANCE_FIRST_REMINDER_DAYS * DAY_MS);
  if (first < horizon) reminders.push({ at: first, kind: "reminder" });
  const monthly: BalanceReminder[] = [];
  for (let month = 1; month <= 120; month += 1) {
    const at = subtractCalendarMonths(confirmedAt, -month);
    if (!at || at >= horizon) break;
    monthly.push({ at, kind: "reminder" });
  }
  reminders.push(...monthly);
  if (!lateBooking) {
    const finalAt = new Date(balanceDueDate.getTime() - BALANCE_FINAL_REMINDER_DAYS * DAY_MS);
    if (finalAt > confirmedAt) {
      // Le J+2 est toujours envoyé ; un rappel mensuel trop proche du dernier rappel est absorbé par lui.
      reminders = reminders.filter((r) => !monthly.includes(r) || Math.abs(r.at.getTime() - finalAt.getTime()) >= BALANCE_FINAL_REMINDER_DAYS * DAY_MS);
      reminders.push({ at: finalAt, kind: "final" });
    }
  }
  reminders.sort((a, b) => a.at.getTime() - b.at.getTime());
  const byDay = new Map<string, BalanceReminder>();
  for (const reminder of reminders) {
    const key = reminder.at.toISOString().slice(0, 10);
    if (byDay.get(key)?.kind !== "final") byDay.set(key, reminder);
  }
  return [...byDay.values()];
}

// Rappels de solde : un seul par date planifiée (dedupeKey), uniquement si un solde reste dû.
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
        // Pas de relance pour un solde nul (réservation déjà soldée) ni pour un voyage parti.
        gt(reservations.amountDue, 0),
        gt(departures.startDate, now),
      ),
    );
  let sent = 0;
  for (const { reservation, departure, traveler } of rows) {
    if (!reservation.confirmedAt) continue;
    const dueDate = reservation.balanceDueDate ?? departure.balanceDueDate ?? subtractCalendarMonths(departure.startDate, 2);
    if (!dueDate) continue;
    const graceStart = now.getTime() - BALANCE_REMINDER_GRACE_DAYS * DAY_MS;
    const scheduled = balanceReminderSchedule(reservation.confirmedAt, dueDate, departure.startDate)
      .filter((reminder) => reminder.at <= now && reminder.at.getTime() >= graceStart)
      .at(-1);
    if (!scheduled) continue;
    const lateBooking = isLateBooking(reservation.confirmedAt, dueDate);
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
        template: scheduled.kind === "final" ? "balance_final_reminder" : "balance_reminder",
        locale,
        toEmail: traveler.email,
        travelerId: traveler.id,
        reservationId: reservation.id,
        vars: {
          name: traveler.preferredName ?? traveler.legalName ?? traveler.email,
          trip: tr?.title ?? reservation.tripId,
          amount: fmtMoney(reservation.amountDue, reservation.currency),
          date: fmtDate(locale, lateBooking ? departure.startDate : dueDate),
        },
        url: checkout?.providerSessionId
          ? `${origin}/${locale}/booking-confirmed?session_id=${encodeURIComponent(checkout.providerSessionId)}`
          : undefined,
        dedupeKey: `balance:${reservation.id}:${scheduled.at.toISOString().slice(0, 10)}`,
      },
      sender,
    );
    if (res.sent) sent += 1;
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
