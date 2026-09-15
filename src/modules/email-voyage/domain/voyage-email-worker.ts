import { eq } from "drizzle-orm";
import { getDrizzle } from "@database/drizzle";
import { travelers } from "@database/schemas";
import { tripTranslations } from "@database/schemas";
import { departures } from "@database/schemas";
import { reservations } from "@database/schemas";
import { applications } from "@database/schemas";
import { checkoutSessions } from "@database/schemas";
import type { VoyageEmailTemplate } from "@database/schemas/email-voyage.schema";
import { isValidLocale } from "@/i18n/utils";
import type { Locale } from "@/i18n/config";
import { sendVoyageEmail, type SendFn } from "./voyage-email";
import { claimOutboxBatch, completeOutbox, failOutbox } from "@/modules/outbox/domain/outbox-worker";

function fmtMoney(cents: number, currency: string): string {
  const major = (cents / 100).toLocaleString("en");
  return currency === "EUR" ? `€${major}` : `${major} ${currency}`;
}

function fmtDate(locale: Locale, d: Date | null): string {
  if (!d) return "";
  return new Intl.DateTimeFormat(locale, { day: "numeric", month: "long", year: "numeric" }).format(d);
}

interface EmailContext {
  locale: Locale;
  toEmail: string;
  travelerId: string | null;
  reservationId: string | null;
  name: string;
  trip: string;
  dates: string;
  number: string;
  amount: string;
  date: string;
  url: string;
}

async function loadContext(payload: Record<string, unknown>): Promise<EmailContext | null> {
  const db = getDrizzle();
  const applicationId = typeof payload.applicationId === "string" ? payload.applicationId : null;
  const reservationId = typeof payload.reservationId === "string" ? payload.reservationId : null;

  const [reservation] = reservationId
    ? await db.select().from(reservations).where(eq(reservations.id, reservationId)).limit(1)
    : [];
  const [application] = applicationId
    ? await db.select().from(applications).where(eq(applications.id, applicationId)).limit(1)
    : reservation?.applicationId
      ? await db.select().from(applications).where(eq(applications.id, reservation.applicationId)).limit(1)
      : [];
  const travelerId = reservation?.travelerId ?? application?.travelerId ?? null;
  const [traveler] = travelerId
    ? await db.select().from(travelers).where(eq(travelers.id, travelerId)).limit(1)
    : [];
  if (!traveler) return null;

  const tripId = reservation?.tripId ?? application?.tripId ?? null;
  const departureId = reservation?.departureId ?? application?.departureId ?? null;
  const [tr] = tripId
    ? await db.select().from(tripTranslations).where(eq(tripTranslations.tripId, tripId)).limit(1)
    : [];
  const [dep] = departureId
    ? await db.select().from(departures).where(eq(departures.id, departureId)).limit(1)
    : [];
  const locale: Locale = isValidLocale(traveler.locale) ? traveler.locale : "en";
  const [checkout] = applicationId
    ? await db.select().from(checkoutSessions).where(eq(checkoutSessions.applicationId, applicationId)).limit(1)
    : [];
  const origin = process.env.SITE_URL ?? "http://localhost:4321";
  return {
    locale,
    toEmail: traveler.email,
    travelerId: traveler.id,
    reservationId: reservation?.id ?? null,
    name: traveler.preferredName ?? traveler.legalName ?? traveler.email,
    trip: tr?.title ?? tripId ?? "",
    dates: dep ? `${fmtDate(locale, dep.startDate)} – ${fmtDate(locale, dep.endDate)}` : "",
    number: reservation?.reservationNumber ?? "",
    amount: reservation ? fmtMoney(reservation.totalAmount, reservation.currency) : "",
    date: dep?.balanceDueDate ? fmtDate(locale, dep.balanceDueDate) : "",
    url: checkout ? `${origin}/${locale}/checkout/${checkout.id}` : "",
  };
}

// Route un événement outbox → template voyage (retourne false si non géré).
export async function routeOutboxToEmail(
  eventType: string,
  payload: Record<string, unknown>,
  sender?: SendFn,
): Promise<boolean> {
  const mapping: Record<string, VoyageEmailTemplate> = {
    "application.submitted": "application_received",
    "application.approved": "application_approved",
    "application.contact_required": "application_contact_required",
    "application.declined": "application_declined",
    "checkout.started": "checkout_started",
    "payment.received": "payment_received",
    "booking.confirmed": "booking_confirmed",
  };
  const template = mapping[eventType];
  if (!template) return false;
  const ctx = await loadContext(payload);
  if (!ctx) return false;
  await sendVoyageEmail(
    {
      template,
      locale: ctx.locale,
      toEmail: ctx.toEmail,
      travelerId: ctx.travelerId,
      reservationId: ctx.reservationId,
      vars: { name: ctx.name, trip: ctx.trip, number: ctx.number, dates: ctx.dates, amount: ctx.amount, date: ctx.date },
      url: ctx.url || undefined,
    },
    sender,
  );
  return true;
}

export async function processEmailOutboxBatch(limit = 25, sender?: SendFn): Promise<{ done: number; failed: number; skipped: number }> {
  const rows = await claimOutboxBatch(limit);
  let done = 0;
  let failed = 0;
  let skipped = 0;
  for (const row of rows) {
    try {
      const handled = await routeOutboxToEmail(row.event_type, row.payload ?? {}, sender);
      if (!handled) skipped += 1;
      await completeOutbox(row.id);
      done += 1;
    } catch (err) {
      await failOutbox(row.id, row.attempts, err instanceof Error ? err.message : "unknown");
      failed += 1;
    }
  }
  return { done, failed, skipped };
}
