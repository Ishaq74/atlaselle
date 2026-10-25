import { and, asc, eq, lte } from "drizzle-orm";
import { getDrizzle } from "@database/drizzle";
import {
  applications,
  applicationDecisions,
  applicationEvents,
  checkoutSessions,
  outboxEvents,
  seatHolds,
  waitlistEntries,
  WAITLIST_OFFER_TTL_MINUTES,
} from "@database/schemas";
import { getAvailability, holdSeatsInTransaction } from "@/modules/availability/domain/availability-service";
import { lockDepartureForUpdate } from "@/modules/departures/repositories/departure.repository";
import { assertTransitionApplication } from "./application-transitions";
import { emitOutboxEvent } from "@/modules/outbox/domain/outbox";

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

export async function promoteNextWaitlistApplicant(departureId: string, now = new Date()) {
  const db = getDrizzle();
  return db.transaction(async (tx) => {
    const departure = await lockDepartureForUpdate(departureId, tx);
    if (!departure || !["open", "limited", "waitlist"].includes(departure.status)) return null;

    const [activeOffer] = await tx
      .select()
      .from(waitlistEntries)
      .where(and(eq(waitlistEntries.departureId, departureId), eq(waitlistEntries.status, "offered")))
      .for("update")
      .limit(1);
    if (activeOffer) {
      if (!activeOffer.expiresAt || activeOffer.expiresAt > now) return null;
      await tx
        .update(waitlistEntries)
        .set({ status: "expired", updatedAt: now })
        .where(and(eq(waitlistEntries.id, activeOffer.id), eq(waitlistEntries.status, "offered")));
      await tx
        .update(seatHolds)
        .set({ status: "expired", releasedAt: now })
        .where(and(eq(seatHolds.applicationId, activeOffer.applicationId), eq(seatHolds.status, "active")));
      await tx
        .update(checkoutSessions)
        .set({ status: "expired" })
        .where(and(eq(checkoutSessions.applicationId, activeOffer.applicationId), eq(checkoutSessions.status, "open")));
    }

    const availability = await getAvailability(departureId, now, tx);
    if (!availability || availability.availableSeats < 1) return null;

    const candidates = await tx
      .select({ entry: waitlistEntries, application: applications })
      .from(waitlistEntries)
      .innerJoin(applications, eq(applications.id, waitlistEntries.applicationId))
      .where(and(eq(waitlistEntries.departureId, departureId), eq(waitlistEntries.status, "waiting")))
      .orderBy(asc(waitlistEntries.joinedAt), asc(waitlistEntries.id));

    let selected: (typeof candidates)[number] | undefined;
    for (const candidate of candidates) {
      if (candidate.application.status === "submitted" || candidate.application.status === "approved") {
        selected = candidate;
        break;
      }
      await tx
        .update(waitlistEntries)
        .set({ status: "removed", updatedAt: now })
        .where(and(eq(waitlistEntries.id, candidate.entry.id), eq(waitlistEntries.status, "waiting")));
    }
    if (!selected) return null;

    const expiresAt = new Date(now.getTime() + WAITLIST_OFFER_TTL_MINUTES * 60_000);
    const hold = await holdSeatsInTransaction(
      departureId,
      { applicationId: selected.application.id, quantity: 1, ttlMinutes: WAITLIST_OFFER_TTL_MINUTES, now, allowWaitlist: true },
      tx,
    );
    if (selected.application.status === "submitted") {
      assertTransitionApplication("submitted", "under_review");
      await tx.update(applications).set({ status: "under_review" }).where(eq(applications.id, selected.application.id));
      assertTransitionApplication("under_review", "approved");
      await tx.insert(applicationEvents).values([
        { applicationId: selected.application.id, event: "review_started" },
        { applicationId: selected.application.id, event: "approved" },
      ]);
      await tx.insert(applicationDecisions).values({
        applicationId: selected.application.id,
        decision: "approved",
        internalNote: "Promoted automatically from the FIFO waitlist.",
      });
      await tx.update(applications).set({ status: "approved" }).where(eq(applications.id, selected.application.id));
    }
    const [checkout] = await tx
      .insert(checkoutSessions)
      .values({
        applicationId: selected.application.id,
        departureId,
        expiresAt,
      })
      .returning({ id: checkoutSessions.id });
    if (!checkout) throw new Error("Waitlist checkout creation failed.");

    await tx
      .update(waitlistEntries)
      .set({ status: "offered", offeredAt: now, expiresAt, updatedAt: now })
      .where(and(eq(waitlistEntries.id, selected.entry.id), eq(waitlistEntries.status, "waiting")));
    await tx.insert(outboxEvents).values({
      eventType: "waitlist.offered",
      aggregateType: "application",
      aggregateId: selected.application.id,
      payload: { applicationId: selected.application.id, departureId, checkoutSessionId: checkout.id, holdId: hold.id, expiresAt: expiresAt.toISOString() },
    });
    return { applicationId: selected.application.id, checkoutSessionId: checkout.id, expiresAt };
  });
}

export async function expireWaitlistOffers(now = new Date()): Promise<number> {
  const db = getDrizzle();
  const expired = await db
    .select({ id: waitlistEntries.id, applicationId: waitlistEntries.applicationId, departureId: waitlistEntries.departureId })
    .from(waitlistEntries)
    .where(and(eq(waitlistEntries.status, "offered"), lte(waitlistEntries.expiresAt, now)));
  let count = 0;
  for (const offer of expired) {
    const changed = await db.transaction(async (tx) => {
      await lockDepartureForUpdate(offer.departureId, tx);
      const [row] = await tx
        .update(waitlistEntries)
        .set({ status: "expired", updatedAt: now })
        .where(and(eq(waitlistEntries.id, offer.id), eq(waitlistEntries.status, "offered"), lte(waitlistEntries.expiresAt, now)))
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
    });
    if (changed) {
      count += 1;
      await promoteNextWaitlistApplicant(offer.departureId, now);
    }
  }
  return count;
}

export async function promoteWaitingApplicants(now = new Date()): Promise<number> {
  const departures = await getDrizzle()
    .selectDistinct({ departureId: waitlistEntries.departureId })
    .from(waitlistEntries)
    .where(eq(waitlistEntries.status, "waiting"));
  let promoted = 0;
  for (const { departureId } of departures) {
    if (await promoteNextWaitlistApplicant(departureId, now)) promoted += 1;
  }
  return promoted;
}

export async function removeWaitlistEntry(applicationId: string, now = new Date()): Promise<void> {
  const db = getDrizzle();
  const [entry] = await db
    .update(waitlistEntries)
    .set({ status: "removed", updatedAt: now })
    .where(and(eq(waitlistEntries.applicationId, applicationId), eq(waitlistEntries.status, "waiting")))
    .returning({ departureId: waitlistEntries.departureId });
  if (entry) await promoteNextWaitlistApplicant(entry.departureId, now);
}
