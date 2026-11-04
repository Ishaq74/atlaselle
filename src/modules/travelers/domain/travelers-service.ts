import { eq, sql } from "drizzle-orm";
import { getDrizzle } from "@database/drizzle";
import { travelers } from "@database/schemas";
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

/**
 * Efface les données personnelles d'un dossier (transactions conservées sans PII, TODO §19).
 * Point d'application UNIQUE : l'action `anonymizeTraveler` et le rejeu après restauration
 * (`pnpm db:replay-erasures`) l'appellent tous deux, ils ne peuvent donc pas diverger.
 * Idempotent. Les garde-fous « dossier en cours » restent à la charge de l'appelant.
 */
export async function anonymizeTravelerRecord(travelerId: string, dbOverride?: ReturnType<typeof getDrizzle>): Promise<boolean> {
  const db = dbOverride ?? getDrizzle();
  const updated = await db
    .update(travelers)
    .set({
      email: anonymizedEmail(travelerId),
      phone: null,
      legalName: null,
      preferredName: null,
      dateOfBirth: null,
    })
    .where(eq(travelers.id, travelerId))
    .returning({ id: travelers.id });
  return updated.length > 0;
}
