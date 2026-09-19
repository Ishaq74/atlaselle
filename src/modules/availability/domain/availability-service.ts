import { and, eq, inArray, lte } from "drizzle-orm";
import { getDrizzle } from "@database/drizzle";
import { invalidateCache } from "@database/cache";
import { seatHolds, SEAT_HOLD_TTL_MINUTES } from "@database/schemas/departures.schema";
import { getDepartureById, getActiveHoldsByDeparture, lockDepartureForUpdate } from "@/modules/departures/repositories/departure.repository";
import { countConfirmedByDeparture } from "@/modules/reservations/repositories/reservation.repository";
import { availableSeats, canHold } from "./availability";
import { codedError } from "@/lib/voyage-codes";

// NOTE : la capacité est intrinsèquement transverse (departures + reservations
// + holds). Ce service est l'unique lecteur croisé autorisé (TODO §10).
// P1-4 : injection Db/Tx — chaque fonction accepte un `dbOverride` optionnel
// (db ou tx Drizzle) pour tests + compositions transactionnelles futures.
// Sans override, `getDrizzle()` est utilisé (comportement inchangé).

type Db = ReturnType<typeof getDrizzle>;

const BOOKABLE_STATUSES = ["open", "limited"] as const;

export interface AvailabilitySnapshot {
  departureId: string;
  status: string;
  capacityMax: number;
  confirmedSeats: number;
  heldSeats: number;
  availableSeats: number;
  bookable: boolean;
}

export async function getAvailability(departureId: string, now = new Date(), dbOverride?: Db): Promise<AvailabilitySnapshot | null> {
  const db = dbOverride ?? getDrizzle();
  const dep = await getDepartureById(departureId, db);
  if (!dep) return null;
  const confirmedSeats = await countConfirmedByDeparture(departureId, db);
  const holds = await getActiveHoldsByDeparture(departureId, db);
  const heldSeats = holds
    .filter((h) => h.expiresAt.getTime() > now.getTime())
    .reduce((n, h) => n + h.quantity, 0);
  return {
    departureId,
    status: dep.status,
    capacityMax: dep.capacityMax,
    confirmedSeats,
    heldSeats,
    availableSeats: availableSeats({ capacityMax: dep.capacityMax, confirmedSeats, heldSeats }),
    bookable: (BOOKABLE_STATUSES as readonly string[]).includes(dep.status),
  };
}

export interface HoldSeatsInput {
  applicationId?: string | null;
  quantity?: number;
  ttlMinutes?: number;
  now?: Date;
}

// Transaction + verrou FOR UPDATE : deux holds concurrents sur la dernière
// place → un seul réussit (TODO §10.4, §26.5).
export async function holdSeats(departureId: string, input: HoldSeatsInput = {}) {
  const quantity = input.quantity ?? 1;
  const now = input.now ?? new Date();
  const ttl = input.ttlMinutes ?? SEAT_HOLD_TTL_MINUTES;
  return getDrizzle().transaction(async (tx) => {
    const dep = await lockDepartureForUpdate(departureId, tx);
    if (!dep) throw codedError("DEPARTURE_SOLD_OUT", "Départ introuvable.");
    if (!(BOOKABLE_STATUSES as readonly string[]).includes(dep.status)) {
      throw codedError("DEPARTURE_SOLD_OUT", "Départ non réservable.");
    }
    const confirmedSeats = await countConfirmedByDeparture(departureId, tx);
    const holds = await getActiveHoldsByDeparture(departureId, tx);
    const heldSeats = holds
      .filter((h) => h.expiresAt.getTime() > now.getTime())
      .reduce((n, h) => n + h.quantity, 0);
    if (!canHold({ capacityMax: dep.capacityMax, confirmedSeats, heldSeats }, quantity)) {
      throw codedError("DEPARTURE_SOLD_OUT", "Plus de place disponible sur ce départ.");
    }
    const [hold] = await tx
      .insert(seatHolds)
      .values({
        departureId,
        applicationId: input.applicationId ?? null,
        quantity,
        expiresAt: new Date(now.getTime() + ttl * 60_000),
      })
      .returning();
    if (!hold) throw new Error("Hold creation failed");
    return hold;
  });
}

export async function releaseHold(holdId: string) {
  const [hold] = await getDrizzle()
    .update(seatHolds)
    .set({ status: "released", releasedAt: new Date() })
    .where(eq(seatHolds.id, holdId))
    .returning();
  return hold ?? null;
}

export async function convertHold(holdId: string) {
  const [hold] = await getDrizzle()
    .update(seatHolds)
    .set({ status: "converted" })
    .where(eq(seatHolds.id, holdId))
    .returning();
  return hold ?? null;
}

// Job expireSeatHolds (TODO §14.2) : marque expirés les holds actifs dépassés.
export async function expireHolds(now = new Date()): Promise<number> {
  const expired = await getDrizzle()
    .update(seatHolds)
    .set({ status: "expired", releasedAt: now })
    .where(and(eq(seatHolds.status, "active"), lte(seatHolds.expiresAt, now)))
    .returning({ id: seatHolds.id });
  if (expired.length > 0) {
    await invalidateCache("trip:");
    await invalidateCache("trips:list");
  }
  return expired.length;
}

// Rétention : supprime les holds terminés anciens (expired/released/converted).
// Jamais les `active` (même dépassés : c'est expireHolds qui les traite).
export async function purgeTerminalHolds(olderThanDays = 30, now = new Date()): Promise<number> {
  const cutoff = new Date(now.getTime() - olderThanDays * 86_400_000);
  const removed = await getDrizzle()
    .delete(seatHolds)
    .where(
      and(
        inArray(seatHolds.status, ["expired", "released", "converted"]),
        lte(seatHolds.createdAt, cutoff),
      ),
    )
    .returning({ id: seatHolds.id });
  return removed.length;
}
