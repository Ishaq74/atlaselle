import { and, eq, inArray, lte } from "drizzle-orm";
import { getDrizzle } from "@database/drizzle";
import { departures, seatHolds, SEAT_HOLD_TTL_MINUTES } from "@database/schemas/departures.schema";
import { reservations } from "@database/schemas/reservations.schema";
import { availableSeats, canHold } from "./availability";
import { codedError } from "@/lib/voyage-codes";

// NOTE : la capacité est intrinsèquement transverse (departures + reservations
// + holds). Ce service est l'unique lecteur croisé autorisé (TODO §10).

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

export async function getAvailability(departureId: string, now = new Date()): Promise<AvailabilitySnapshot | null> {
  const db = getDrizzle();
  const [dep] = await db.select().from(departures).where(eq(departures.id, departureId)).limit(1);
  if (!dep) return null;
  const confirmed = await db
    .select({ id: reservations.id })
    .from(reservations)
    .where(and(eq(reservations.departureId, departureId), inArray(reservations.status, ["confirmed", "balance_due", "completed"])));
  const holds = await db
    .select({ quantity: seatHolds.quantity, expiresAt: seatHolds.expiresAt })
    .from(seatHolds)
    .where(and(eq(seatHolds.departureId, departureId), eq(seatHolds.status, "active")));
  const heldSeats = holds
    .filter((h) => h.expiresAt.getTime() > now.getTime())
    .reduce((n, h) => n + h.quantity, 0);
  return {
    departureId,
    status: dep.status,
    capacityMax: dep.capacityMax,
    confirmedSeats: confirmed.length,
    heldSeats,
    availableSeats: availableSeats({ capacityMax: dep.capacityMax, confirmedSeats: confirmed.length, heldSeats }),
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
    const [dep] = await tx.select().from(departures).where(eq(departures.id, departureId)).for("update").limit(1);
    if (!dep) throw codedError("DEPARTURE_SOLD_OUT", "Départ introuvable.");
    if (!(BOOKABLE_STATUSES as readonly string[]).includes(dep.status)) {
      throw codedError("DEPARTURE_SOLD_OUT", "Départ non réservable.");
    }
    const confirmed = await tx
      .select({ id: reservations.id })
      .from(reservations)
      .where(and(eq(reservations.departureId, departureId), inArray(reservations.status, ["confirmed", "balance_due", "completed"])));
    const holds = await tx
      .select({ quantity: seatHolds.quantity, expiresAt: seatHolds.expiresAt })
      .from(seatHolds)
      .where(and(eq(seatHolds.departureId, departureId), eq(seatHolds.status, "active")));
    const heldSeats = holds
      .filter((h) => h.expiresAt.getTime() > now.getTime())
      .reduce((n, h) => n + h.quantity, 0);
    if (!canHold({ capacityMax: dep.capacityMax, confirmedSeats: confirmed.length, heldSeats }, quantity)) {
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
  return expired.length;
}
