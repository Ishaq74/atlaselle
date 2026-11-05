import { and, eq, inArray, isNotNull, ne, or, sql } from "drizzle-orm";
import { getDrizzle } from "@database/drizzle";
import {
  applicationDecisions,
  applicationInternalNotes,
  applications,
  emailDeliveries,
  reservationInternalNotes,
  reservations,
  travelerInternalNotes,
  travelers,
} from "@database/schemas";
import { canClaimTraveler, normalizeEmail } from "./traveler-email";
import { codedError } from "@/lib/voyage-codes";
import type { Locale } from "@/i18n/config";

export interface FindOrCreateTravelerInput {
  email: string;
  legalName?: string | null;
  phone?: string | null;
  locale?: Locale | null;
  userId?: string | null;
}

// Déduplication sans fusion auto (TODO §11.1) : réutilise si email vérifié,
// sinon rattache la preuve du compte (claim) ou refuse — APPLICATION_EMAIL_CONFLICT.
export async function findOrCreateTraveler(input: FindOrCreateTravelerInput) {
  const email = normalizeEmail(input.email);
  const db = getDrizzle();
  const [existing] = await db
    .select()
    .from(travelers)
    .where(sql`lower(${travelers.email}) = ${email}`)
    .limit(1);
  if (existing) {
    const traveler = await reuseOrClaimTraveler(existing, input.userId);
    if (traveler) return { traveler, created: false as const };
    throw codedError("APPLICATION_EMAIL_CONFLICT", "Cet email est déjà utilisé par un autre dossier non vérifié.");
  }
  try {
    const [created] = await db
      .insert(travelers)
      .values({
        email,
        legalName: input.legalName ?? null,
        phone: input.phone ?? null,
        locale: input.locale ?? null,
        userId: input.userId ?? null,
      })
      .returning();
    if (!created) throw new Error("Traveler creation failed");
    return { traveler: created, created: true as const };
  } catch (err) {
    if (!isUniqueViolation(err)) throw err;
    // Course : deux créations simultanées du même email — relire une fois.
    const [retry] = await db
      .select()
      .from(travelers)
      .where(sql`lower(${travelers.email}) = ${email}`)
      .limit(1);
    if (retry) {
      const traveler = await reuseOrClaimTraveler(retry, input.userId);
      if (traveler) return { traveler, created: false as const };
      throw codedError("APPLICATION_EMAIL_CONFLICT", "Cet email est déjà utilisé par un autre dossier non vérifié.");
    }
    throw err;
  }
}

/**
 * Réutilise un dossier existant :
 * - déjà vérifié → réutilisé tel quel ;
 * - non vérifié mais réclamable (preuve du compte vérifié : pré-auth ou le
 *   sien) → backfill idempotent `emailVerifiedAt` (+ `userId` si libre) —
 *   c'est ce qui débloque les candidatures multi-trips d'un compte vérifié ;
 * - non vérifié d'un autre compte → `null` (le conflit anti-spam répond).
 * Rattacher ne fusionne rien : aucune donnée du dossier n'est écrasée.
 */
async function reuseOrClaimTraveler(
  existing: typeof travelers.$inferSelect,
  sessionUserId: string | null | undefined,
) {
  if (existing.emailVerifiedAt) return existing;
  if (!canClaimTraveler(existing, sessionUserId)) return null;
  const db = getDrizzle();
  const [claimed] = await db
    .update(travelers)
    .set({
      emailVerifiedAt: existing.emailVerifiedAt ?? new Date(),
      ...(existing.userId === null && sessionUserId ? { userId: sessionUserId } : {}),
    })
    .where(eq(travelers.id, existing.id))
    .returning();
  return claimed ?? null;
}

function isUniqueViolation(err: unknown): boolean {
  const e = err as { code?: string; cause?: { code?: string } | null } | null;
  return e?.code === "23505" || e?.cause?.code === "23505";
}

/** Statuts de réservation qui interdisent l'anonymisation (dossier en cours). */
export const ACTIVE_RESERVATION_STATUSES = ["pending", "awaiting_payment", "confirmed", "balance_due"] as const;

export function anonymizedEmail(travelerId: string): string {
  return `deleted-${travelerId.slice(0, 8)}@deleted.local`;
}

export interface AnonymizeResult {
  /** Le dossier existe. */
  found: boolean;
  /** Nombre de lignes réellement modifiées ou supprimées (0 = déjà entièrement effacé). */
  scrubbed: number;
}

type TransactionRunner = Pick<ReturnType<typeof getDrizzle>, "transaction">;

/**
 * Efface les données personnelles d'un dossier, transactions conservées (TODO §19, docs/database/erasure-ledger.md).
 *
 * Effacé : identité et coordonnées (`travelers`), lien vers le compte, textes libres des candidatures
 * (régime, accessibilité, motivation, attentes), notes internes (dossier, candidature, réservation, décision),
 * adresse et dernière erreur des e-mails envoyés (`email_deliveries`).
 * Conservé : réservations, paiements, montants et statuts (obligations comptables), sans donnée personnelle.
 * Non couvert ici : le compte utilisateur lié (`adminRemoveUser` / auto-suppression), les abonnements newsletter,
 * les avis et commentaires du compte, les données chez Stripe, l'audit (rétention) et les sauvegardes.
 *
 * Point d'application UNIQUE : l'action `anonymizeTraveler` et le rejeu après restauration
 * (`pnpm db:replay-erasures`) l'appellent tous deux, ils ne peuvent donc pas diverger.
 * Transactionnel et idempotent : un second appel ne modifie rien (`scrubbed: 0`).
 * Les garde-fous « dossier en cours » restent à la charge de l'appelant.
 */
export async function anonymizeTravelerRecord(travelerId: string, dbOverride?: TransactionRunner): Promise<AnonymizeResult> {
  const db = dbOverride ?? getDrizzle();
  return db.transaction(async (tx) => {
    const [row] = await tx.select({ email: travelers.email }).from(travelers).where(eq(travelers.id, travelerId)).limit(1);
    if (!row) return { found: false, scrubbed: 0 };

    const replacement = anonymizedEmail(travelerId);
    const originalEmail = row.email.toLowerCase();
    const ownApplications = tx.select({ id: applications.id }).from(applications).where(eq(applications.travelerId, travelerId));
    const ownReservations = tx.select({ id: reservations.id }).from(reservations).where(eq(reservations.travelerId, travelerId));
    let scrubbed = 0;

    scrubbed += (
      await tx
        .update(travelers)
        .set({ email: replacement, phone: null, legalName: null, preferredName: null, dateOfBirth: null, userId: null })
        .where(
          and(
            eq(travelers.id, travelerId),
            or(
              ne(travelers.email, replacement),
              isNotNull(travelers.phone),
              isNotNull(travelers.legalName),
              isNotNull(travelers.preferredName),
              isNotNull(travelers.dateOfBirth),
              isNotNull(travelers.userId),
            ),
          ),
        )
        .returning({ id: travelers.id })
    ).length;

    scrubbed += (
      await tx
        .update(applications)
        .set({ dietaryRequirements: null, accessibilityNeeds: null, motivation: null, expectations: null })
        .where(
          and(
            eq(applications.travelerId, travelerId),
            or(
              isNotNull(applications.dietaryRequirements),
              isNotNull(applications.accessibilityNeeds),
              isNotNull(applications.motivation),
              isNotNull(applications.expectations),
            ),
          ),
        )
        .returning({ id: applications.id })
    ).length;

    scrubbed += (
      await tx
        .update(applicationDecisions)
        .set({ internalNote: null })
        .where(and(inArray(applicationDecisions.applicationId, ownApplications), isNotNull(applicationDecisions.internalNote)))
        .returning({ id: applicationDecisions.id })
    ).length;

    scrubbed += (await tx.delete(applicationInternalNotes).where(inArray(applicationInternalNotes.applicationId, ownApplications)).returning({ id: applicationInternalNotes.id })).length;
    scrubbed += (await tx.delete(reservationInternalNotes).where(inArray(reservationInternalNotes.reservationId, ownReservations)).returning({ id: reservationInternalNotes.id })).length;
    scrubbed += (await tx.delete(travelerInternalNotes).where(eq(travelerInternalNotes.travelerId, travelerId)).returning({ id: travelerInternalNotes.id })).length;

    // Les e-mails sont retrouvés par dossier, par réservation ET par adresse : certains partent avant tout rattachement.
    const ownDelivery = or(
      eq(emailDeliveries.travelerId, travelerId),
      inArray(emailDeliveries.reservationId, ownReservations),
      originalEmail === replacement ? undefined : sql`lower(${emailDeliveries.toEmail}) = ${originalEmail}`,
    );
    scrubbed += (
      await tx
        .update(emailDeliveries)
        .set({ toEmail: replacement, lastError: null })
        .where(and(ownDelivery, or(ne(emailDeliveries.toEmail, replacement), isNotNull(emailDeliveries.lastError))))
        .returning({ id: emailDeliveries.id })
    ).length;

    return { found: true, scrubbed };
  });
}