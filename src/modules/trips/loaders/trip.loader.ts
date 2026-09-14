import { and, asc, eq, inArray } from "drizzle-orm";
import { getDrizzle } from "@database/drizzle";
import { cached } from "@database/cache";
import {
  trips,
  tripTranslations,
  tripHighlights,
  tripHighlightTranslations,
  tripInclusions,
  tripInclusionTranslations,
  tripExclusions,
  tripExclusionTranslations,
  faqs,
  faqTranslations,
  tripFaqs,
  type TripStatus,
} from "@database/schemas/trips.schema";
import { itineraryDays, itineraryDayTranslations } from "@database/schemas/itinerary.schema";
import { departures } from "@database/schemas/departures.schema";
import { reservations } from "@database/schemas/reservations.schema";
import { seatHolds } from "@database/schemas/departures.schema";
import { isValidLocale } from "@/i18n/utils";
import { type Locale } from "@/i18n/config";
import { type TripId } from "@/i18n/routes";
import { availableSeats } from "@/modules/availability/domain/availability";

export type TripPageStatus = "open" | "interest-list";

export interface TripCopy {
  slug: string;
  title: string;
  summary: string;
  difficulty: string;
  highlights: string[];
  itinerary: { title: string; text: string }[];
}

export interface TripPageDTO {
  id: TripId;
  dates: string;
  price: number;
  currency: string;
  capacity: number;
  remainingPlaces: number;
  status: TripPageStatus;
  deposit: number;
  finalPaymentDue: string;
  roomRule: string;
  translations: Record<Locale, TripCopy>;
}

export interface TripSummaryDTO {
  id: TripId;
  slug: string;
  title: string;
  summary: string;
  dates: string;
  durationDays: number;
  difficulty: string;
  difficultyLevel: number;
  priceFrom: number;
  currency: string;
  status: TripPageStatus;
}

const OPEN_DEPARTURE_STATUSES = ["open", "limited", "waitlist"] as const;

function formatRange(locale: Locale, start: Date, end: Date): string {
  const fmt = new Intl.DateTimeFormat(locale, { day: "numeric", month: "long", year: "numeric" });
  return `${fmt.format(start)} – ${fmt.format(end)}`;
}

function formatDate(locale: Locale, d: Date | null): string {
  if (!d) return "";
  return new Intl.DateTimeFormat(locale, { day: "numeric", month: "long", year: "numeric" }).format(d);
}

async function departureAvailability(departureId: string, capacityMax: number): Promise<number> {
  const db = getDrizzle();
  const confirmed = await db
    .select({ id: reservations.id })
    .from(reservations)
    .where(and(eq(reservations.departureId, departureId), inArray(reservations.status, ["confirmed", "balance_due", "completed"])));
  const now = new Date();
  const holds = await db
    .select({ quantity: seatHolds.quantity, expiresAt: seatHolds.expiresAt, status: seatHolds.status })
    .from(seatHolds)
    .where(and(eq(seatHolds.departureId, departureId), eq(seatHolds.status, "active")));
  const held = holds.filter((h) => h.expiresAt.getTime() > now.getTime()).reduce((n, h) => n + h.quantity, 0);
  return availableSeats({ capacityMax, confirmedSeats: confirmed.length, heldSeats: held });
}

const loadTripPageInner = async (locale: Locale, slug: string): Promise<TripPageDTO | null> => {
  if (!isValidLocale(locale)) return null;
  const db = getDrizzle();

  // Résolution DB (source de vérité) : (locale, slug) → trip.
  const [match] = await db
    .select({ tripId: tripTranslations.tripId })
    .from(tripTranslations)
    .where(and(eq(tripTranslations.locale, locale), eq(tripTranslations.slug, slug)))
    .limit(1);
  if (!match) return null;
  const tripId = match.tripId as TripId;

  const [trip] = await db.select().from(trips).where(eq(trips.id, tripId)).limit(1);
  if (!trip || (trip.status as TripStatus) !== "published") return null;

  const trs = await db.select().from(tripTranslations).where(eq(tripTranslations.tripId, tripId));
  const byLocale = new Map(trs.map((t) => [t.locale, t]));
  const main = byLocale.get(locale);
  if (!main || !main.localeVisible) return null;

  const deps = await db
    .select()
    .from(departures)
    .where(and(eq(departures.tripId, tripId), inArray(departures.status, [...OPEN_DEPARTURE_STATUSES])))
    .orderBy(asc(departures.startDate))
    .limit(1);
  const dep = deps[0] ?? null;

  const days = await db
    .select()
    .from(itineraryDays)
    .where(eq(itineraryDays.tripId, tripId))
    .orderBy(asc(itineraryDays.dayNumber));
  const dayIds = days.map((d) => d.id);
  const dayTrs = dayIds.length
    ? await db.select().from(itineraryDayTranslations).where(inArray(itineraryDayTranslations.dayId, dayIds))
    : [];
  const dayTrByDay = new Map<string, typeof dayTrs>();
  for (const t of dayTrs) {
    const list = dayTrByDay.get(t.dayId) ?? [];
    list.push(t);
    dayTrByDay.set(t.dayId, list);
  }

  const hls = await db.select().from(tripHighlights).where(eq(tripHighlights.tripId, tripId));
  const hlIds = hls.map((h) => h.id);
  const hlTrs = hlIds.length
    ? await db.select().from(tripHighlightTranslations).where(inArray(tripHighlightTranslations.highlightId, hlIds))
    : [];

  const buildCopy = (loc: Locale): TripCopy => {
    const tr = byLocale.get(loc) ?? main;
    const dayList = days.map((d) => {
      const dt = (dayTrByDay.get(d.id) ?? []).find((x) => x.locale === loc)
        ?? (dayTrByDay.get(d.id) ?? []).find((x) => x.locale === "en");
      const text = [dt?.morning, dt?.afternoon, dt?.evening].filter(Boolean).join(" ");
      return { title: dt?.title ?? `Day ${d.dayNumber}`, text };
    });
    const highlights = hls
      .map((h) => hlTrs.find((x) => x.highlightId === h.id && x.locale === loc) ?? hlTrs.find((x) => x.highlightId === h.id && x.locale === "en"))
      .filter((x): x is NonNullable<typeof x> => !!x)
      .map((x) => x.title);
    return {
      slug: tr.slug,
      title: tr.title,
      summary: tr.summary,
      difficulty: tr.fitness ?? `${trip.difficultyLevel}/5`,
      highlights,
      itinerary: dayList,
    };
  };

  const translations = {
    fr: buildCopy("fr"),
    en: buildCopy("en"),
    es: buildCopy("es"),
    ar: buildCopy("ar"),
  };

  const remaining = dep ? await departureAvailability(dep.id, dep.capacityMax) : 0;
  const status: TripPageStatus = dep ? "open" : "interest-list";
  return {
    id: tripId,
    dates: dep ? formatRange(locale, dep.startDate, dep.endDate) : "",
    price: dep ? Math.round(dep.priceAmount / 100) : 0,
    currency: dep?.currency ?? trip.defaultCurrency,
    capacity: dep?.capacityMax ?? trip.groupMax,
    remainingPlaces: remaining,
    status,
    deposit: dep ? Math.round(dep.depositAmount / 100) : 0,
    finalPaymentDue: dep ? formatDate(locale, dep.balanceDueDate) : "",
    roomRule: main.lodging ?? "",
    translations,
  };
};

export const loadTripPage = cached(
  (locale: Locale, slug: string) => `trip:page:${locale}:${slug}`,
  loadTripPageInner,
);

const loadTripsListInner = async (locale: Locale): Promise<TripSummaryDTO[]> => {
  if (!isValidLocale(locale)) return [];
  const db = getDrizzle();
  const published = await db.select().from(trips).where(eq(trips.status, "published"));
  const out: TripSummaryDTO[] = [];
  for (const trip of published) {
    const trs = await db.select().from(tripTranslations).where(eq(tripTranslations.tripId, trip.id));
    const tr = trs.find((t) => t.locale === locale && t.localeVisible) ?? trs.find((t) => t.locale === "en");
    if (!tr) continue;
    const deps = await db
      .select()
      .from(departures)
      .where(and(eq(departures.tripId, trip.id), inArray(departures.status, [...OPEN_DEPARTURE_STATUSES])))
      .orderBy(asc(departures.startDate))
      .limit(1);
    const dep = deps[0] ?? null;
    out.push({
      id: trip.id as TripId,
      slug: tr.slug,
      title: tr.title,
      summary: tr.summary,
      dates: dep ? formatRange(locale, dep.startDate, dep.endDate) : "",
      durationDays: trip.durationDays,
      difficulty: tr.fitness ?? `${trip.difficultyLevel}/5`,
      difficultyLevel: trip.difficultyLevel,
      priceFrom: dep ? Math.round(dep.priceAmount / 100) : 0,
      currency: dep?.currency ?? trip.defaultCurrency,
      status: dep ? "open" : "interest-list",
    });
  }
  return out;
};

export const loadTripsList = cached((locale: Locale) => `trips:list:${locale}`, loadTripsListInner);
