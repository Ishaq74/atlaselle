import { and, asc, eq, inArray, lte } from "drizzle-orm";
import { getDrizzle } from "@database/drizzle";
import {
  applications,
  applicationDecisions,
  applicationEvents,
  checkoutSessions,
  outboxEvents,
  seatHolds,
  waitlistEntries,
  WAITLIST_OFFER_DEFAULT_TTL_HOURS,
} from "@database/schemas";
import { getAvailability, holdSeatsInTransaction } from "@/modules/availability/domain/availability-service";
import { lockDepartureForUpdate } from "@/modules/departures/repositories/departure.repository";
import { assertTransitionApplication } from "./application-transitions";
import { emitOutboxEvent } from "@/modules/outbox/domain/outbox";

type Db = ReturnType<typeof getDrizzle>;
type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
type DbScope = Db | Tx;

export interface WaitlistPromotion {
  applicationId: string;
  checkoutSessionId: string;
  holdId: string;
  expiresAt: Date;
}

export async function enqueueWaitlist(applicationId: string, departureId: string, joinedAt = new Date()) {
  const [entry] = await getDrizzle()
    .insert(waitlistEntries)
    .values({ applicationId, departureId, joinedAt })
    .onConflictDoNothing({ target: waitlistEntries.applicationId })
    .returning({ id: waitlistEntries.id });
  if (entry) {
    await emitOutboxEvent({
      eventType: "waitlist.joined",
      aggregateType: "application",
      aggregateId: applicationId,
      payload: { applicationId, departureId },
    });
  }
  return entry ?? null;
}

// Une liste d'attente active (candidats en attente ou proposition en cours) a priorité
// sur toute nouvelle inscription : la place libre lui est réservée.
export async function hasActiveWaitlist(departureId: string, dbOverride?: DbScope): Promise<boolean> {
  const db = dbOverride ?? getDrizzle();
  const [row] = await db
    .select({ id: waitlistEntries.id })
    .from(waitlistEntries)
    .where(and(eq(waitlistEntries.departureId, departureId), eq(waitlistEntries.status, "waiting")))
    .limit(1);
  return Boolean(row);
}

// Expire une proposition (idempotent) : libère le hold, neutralise le checkout, trace l'événement.
async function expireOfferInTransaction(
  tx: Tx,
  offer: { id: string; applicationId: string; departureId: string },
  now: Date,
): Promise<boolean> {
  const [row] = await tx
    .update(waitlistEntries)
    .set({ status: "expired", updatedAt: now })
    .where(and(eq(waitlistEntries.id, offer.id), eq(waitlistEntries.status, "offered")))
    .returning({ id: waitlistEntries.id });
  if (!row) return false;
  await tx
    .update(seatHolds)
    .set({ status: "expired", releasedAt: now })
    .where(and(eq(seatHolds.applicationId, offer.applicationId), eq(seatHolds.status, "active")));
  await tx
    .update(checkoutSessions)
    .set({ status: "expired" })
    .where(and(eq(checkoutSessions.applicationId, offer.applicationId), eq(checkoutSessions.status, "open")));
  await tx.insert(outboxEvents).values({
    eventType: "waitlist.offer_expired",
    aggregateType: "application",
    aggregateId: offer.applicationId,
    payload: { applicationId: offer.applicationId, departureId: offer.departureId },
  });
  return true;
}

// Propose les places réellement libres aux premiers candidats éligibles (FIFO : joinedAt, id).
// Sous verrou du départ : deux workers concurrents ne peuvent pas attribuer la même place.
export async function promoteWaitlist(departureId: string, now = new Date()): Promise<WaitlistPromotion[]> {
  const db = getDrizzle();
  return db.transaction(async (tx) => {
    const departure = await lockDepartureForUpdate(departureId, tx);
    if (!departure || !["open", "limited", "waitlist"].includes(departure.status)) return [];
    if (departure.bookingDeadline && departure.bookingDeadline < now) return [];

    const staleOffers = await tx
      .select({ id: waitlistEntries.id, applicationId: waitlistEntries.applicationId, departureId: waitlistEntries.departureId })
      .from(waitlistEntries)
      .where(and(eq(waitlistEntries.departureId, departureId), eq(waitlistEntries.status, "offered"), lte(waitlistEntries.expiresAt, now)))
      .for("update");
    for (const offer of staleOffers) await expireOfferInTransaction(tx, offer, now);

    const availability = await getAvailability(departureId, now, tx);
    if (!availability || availability.availableSeats < 1) return [];

    const candidates = await tx
      .select({ entry: waitlistEntries, application: applications })
      .from(waitlistEntries)
      .innerJoin(applications, eq(applications.id, waitlistEntries.applicationId))
      .where(and(eq(waitlistEntries.departureId, departureId), eq(waitlistEntries.status, "waiting")))
      .orderBy(asc(waitlistEntries.joinedAt), asc(waitlistEntries.id))
      .for("update", { of: waitlistEntries });

    const ttlHours = departure.waitlistOfferTtlHours ?? WAITLIST_OFFER_DEFAULT_TTL_HOURS;
    const ttlMinutes = ttlHours * 60;
    const promotions: WaitlistPromotion[] = [];
    let seatsLeft = availability.availableSeats;

    for (const candidate of candidates) {
      if (seatsLeft < 1) break;
      const { entry, application } = candidate;
      if (application.status !== "submitted" && application.status !== "approved") {
        await tx
          .update(waitlistEntries)
          .set({ status: "removed", updatedAt: now })
          .where(and(eq(waitlistEntries.id, entry.id), eq(waitlistEntries.status, "waiting")));
        continue;
      }

      const expiresAt = new Date(now.getTime() + ttlMinutes * 60_000);
      const hold = await holdSeatsInTransaction(
        departureId,
        { applicationId: application.id, quantity: 1, ttlMinutes, now, allowWaitlist: true },
        tx,
      );
      if (application.status === "submitted") {
        assertTransitionApplication("submitted", "under_review");
        assertTransitionApplication("under_review", "approved");
        await tx.update(applications).set({ status: "approved" }).where(eq(applications.id, application.id));
        await tx.insert(applicationEvents).values([
          { applicationId: application.id, event: "review_started" },
          { applicationId: application.id, event: "approved" },
        ]);
        await tx.insert(applicationDecisions).values({
          applicationId: application.id,
          decision: "approved",
          internalNote: "Promoted automatically from the FIFO waitlist.",
        });
      }
      await tx
        .update(checkoutSessions)
        .set({ status: "expired" })
        .where(and(eq(checkoutSessions.applicationId, application.id), eq(checkoutSessions.status, "open")));
      const [checkout] = await tx
        .insert(checkoutSessions)
        .values({ applicationId: application.id, departureId, expiresAt })
        .returning({ id: checkoutSessions.id });
      if (!checkout) throw new Error("Waitlist checkout creation failed.");

      await tx
        .update(waitlistEntries)
        .set({ status: "offered", offeredAt: now, expiresAt, updatedAt: now })
        .where(and(eq(waitlistEntries.id, entry.id), eq(waitlistEntries.status, "waiting")));
      await tx.insert(outboxEvents).values({
        eventType: "waitlist.offered",
        aggregateType: "application",
        aggregateId: application.id,
        payload: {
          applicationId: application.id,
          departureId,
          checkoutSessionId: checkout.id,
          holdId: hold.id,
          expiresAt: expiresAt.toISOString(),
        },
      });
      promotions.push({ applicationId: application.id, checkoutSessionId: checkout.id, holdId: hold.id, expiresAt });
      seatsLeft -= 1;
    }
    return promotions;
  });
}

// Job : propositions échues → expirées, puis place proposée au candidat suivant.
export async function expireWaitlistOffers(now = new Date()): Promise<number> {
  const db = getDrizzle();
  const expired = await db
    .select({ id: waitlistEntries.id, applicationId: waitlistEntries.applicationId, departureId: waitlistEntries.departureId })
    .from(waitlistEntries)
    .where(and(eq(waitlistEntries.status, "offered"), lte(waitlistEntries.expiresAt, now)));
  let count = 0;
  const departureIds = new Set<string>();
  for (const offer of expired) {
    const changed = await db.transaction(async (tx) => {
      await lockDepartureForUpdate(offer.departureId, tx);
      return expireOfferInTransaction(tx, offer, now);
    });
    if (changed) {
      count += 1;
      departureIds.add(offer.departureId);
    }
  }
  for (const departureId of departureIds) await promoteWaitlist(departureId, now);
  return count;
}

// Job : filet de sécurité (places libérées sans déclencheur direct : hold expiré, départ rouvert…).
export async function promoteWaitingApplicants(now = new Date()): Promise<number> {
  const departures = await getDrizzle()
    .selectDistinct({ departureId: waitlistEntries.departureId })
    .from(waitlistEntries)
    .where(eq(waitlistEntries.status, "waiting"));
  let promoted = 0;
  for (const { departureId } of departures) {
    promoted += (await promoteWaitlist(departureId, now)).length;
  }
  return promoted;
}

// Retire un candidat encore en attente (retrait, refus, expiration de candidature).
// Ne libère aucune place : pas de promotion déclenchée.
export async function removeWaitlistEntries(applicationIds: string[], now = new Date()): Promise<void> {
  if (applicationIds.length === 0) return;
  await getDrizzle()
    .update(waitlistEntries)
    .set({ status: "removed", updatedAt: now })
    .where(and(inArray(waitlistEntries.applicationId, applicationIds), eq(waitlistEntries.status, "waiting")));
}

export async function removeWaitlistEntry(applicationId: string, now = new Date()): Promise<void> {
  await removeWaitlistEntries([applicationId], now);
}
