import { and, asc, eq, inArray } from "drizzle-orm";
import { getDrizzle } from "@database/drizzle";
import { cached } from "@database/cache";
import {
  trips,
  tripTranslations,
  tripHighlights,
  tripHighlightTranslations,
  type TripStatus,
} from "@database/schemas/trips.schema";
import { itineraryDays, itineraryDayTranslations } from "@database/schemas/itinerary.schema";
import { departures } from "@database/schemas/departures.schema";
import { mediaFiles, mediaFileAlts } from "@database/schemas/media.schema";
import { reservations } from "@database/schemas/reservations.schema";
import { seatHolds } from "@database/schemas/departures.schema";
import { isValidLocale } from "@/i18n/utils";
import { type Locale, LOCALES } from "@/i18n/config";
import { type TripId } from "@/i18n/routes";
import { availableSeats } from "@/modules/availability/domain/availability";
import { quoteForDeparture } from "@/modules/pricing/domain/pricing-service";

export type TripPageStatus = "open" | "interest-list";

export interface TripCopy {
  slug: string;
  title: string;
  summary: string;
  difficulty: string;
  highlights: string[];
  itinerary: { title: string; text: string }[];
}

export interface TripHero {
  url: string;
  alt: string;
  width: number | null;
  height: number | null;
}

export interface TripPageDTO {
  id: TripId;
  dates: string;
  price: number;
  currency: string;
  capacity: number;
  remainingPlaces: number;
  status: TripPageStatus;
  /** true = candidature réservée aux comptes vérifiés (/apply redirige vers sign-in). */
  requireAccount: boolean;
  deposit: number;
  finalPaymentDue: string;
  roomRule: string;
  hero: TripHero | null;
  commentStatus: "OPEN" | "CLOSED" | "DISABLED";
  allowReviews: boolean;
  ratingAverage: number;
  ratingCount: number;
  viewCount: number;
  translations: Record<Locale, TripCopy>;
  /** Locales publiées (localeVisible) — seules indexables (hreflang/sitemap, TODO §7.5). */
  visibleLocales: Locale[];
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
  hero: TripHero | null;
  ratingAverage: number;
  ratingCount: number;
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

async function loadHero(heroMediaId: string | null, locale: Locale): Promise<TripHero | null> {
  if (!heroMediaId) return null;
  const db = getDrizzle();
  const [file] = await db.select().from(mediaFiles).where(eq(mediaFiles.id, heroMediaId)).limit(1);
  if (!file) return null;
  const alts = await db.select().from(mediaFileAlts).where(eq(mediaFileAlts.fileId, heroMediaId));
  const alt = alts.find((a) => a.locale === locale)?.alt
    ?? alts.find((a) => a.locale === "en")?.alt
    ?? alts.find((a) => a.locale === "fr")?.alt
    ?? "";
  return { url: file.url, alt, width: file.width ?? null, height: file.height ?? null };
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
  // Complet (0 place restante) → liste d'intérêt, même avec un départ ouvert.
  const status: TripPageStatus = dep && remaining > 0 ? "open" : "interest-list";
  // Acompte recalculé serveur (gère le type percent — jamais le montant brut).
  const quote = dep ? await quoteForDeparture(dep.id) : null;
  const ratingAverage = trip.ratingCount > 0 ? Math.round((trip.ratingAverage100 / 100) * 10) / 10 : 0;
  const hero = await loadHero(trip.heroMediaId ?? null, locale);
  return {
    id: tripId,
    dates: dep ? formatRange(locale, dep.startDate, dep.endDate) : "",
    price: dep ? Math.round(dep.priceAmount / 100) : 0,
    currency: dep?.currency ?? trip.defaultCurrency,
    capacity: dep?.capacityMax ?? trip.groupMax,
    remainingPlaces: remaining,
    status,
    requireAccount: trip.requireAccount ?? false,
    deposit: quote ? Math.round(quote.depositAmount / 100) : 0,
    finalPaymentDue: dep ? formatDate(locale, dep.balanceDueDate) : "",
    roomRule: main.lodging ?? "",
    hero,
    commentStatus: (trip.commentStatus as TripPageDTO["commentStatus"]) ?? "OPEN",
    allowReviews: trip.allowReviews ?? true,
    ratingAverage,
    ratingCount: trip.ratingCount ?? 0,
    viewCount: trip.viewCount ?? 0,
    translations,
    visibleLocales: LOCALES.filter((loc) => byLocale.get(loc)?.localeVisible ?? false),
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
    // Spec §7.5 : une locale masquée n'est ni listée, ni alternée, ni indexée.
    // Pas de repli EN ici (un repli produirait des URLs /locale/slug → 404).
    const tr = trs.find((t) => t.locale === locale && t.localeVisible);
    if (!tr) continue;
    const deps = await db
      .select()
      .from(departures)
      .where(and(eq(departures.tripId, trip.id), inArray(departures.status, [...OPEN_DEPARTURE_STATUSES])))
      .orderBy(asc(departures.startDate))
      .limit(1);
    const dep = deps[0] ?? null;
    const remaining = dep ? await departureAvailability(dep.id, dep.capacityMax) : 0;
    const hero = await loadHero(trip.heroMediaId ?? null, locale);
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
      status: dep && remaining > 0 ? "open" : "interest-list",
      hero,
      ratingAverage: trip.ratingCount > 0 ? Math.round((trip.ratingAverage100 / 100) * 10) / 10 : 0,
      ratingCount: trip.ratingCount ?? 0,
    });
  }
  return out;
};

export const loadTripsList = cached((locale: Locale) => `trips:list:${locale}`, loadTripsListInner);
