import { sql } from "drizzle-orm";
import { getDrizzle } from "@database/drizzle";
import { travelers } from "@database/schemas";
import { normalizeEmail, resolveEmailConflict } from "./traveler-email";
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
// sinon APPLICATION_EMAIL_CONFLICT.
export async function findOrCreateTraveler(input: FindOrCreateTravelerInput) {
  const email = normalizeEmail(input.email);
  const db = getDrizzle();
  const [existing] = await db
    .select()
    .from(travelers)
    .where(sql`lower(${travelers.email}) = ${email}`)
    .limit(1);
  if (existing) {
    const resolution = resolveEmailConflict({ id: existing.id, emailVerifiedAt: existing.emailVerifiedAt });
    if (resolution?.action === "reuse") return { traveler: existing, created: false as const };
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
      const resolution = resolveEmailConflict({ id: retry.id, emailVerifiedAt: retry.emailVerifiedAt });
      if (resolution?.action === "reuse") return { traveler: retry, created: false as const };
      throw codedError("APPLICATION_EMAIL_CONFLICT", "Cet email est déjà utilisé par un autre dossier non vérifié.");
    }
    throw err;
  }
}

function isUniqueViolation(err: unknown): boolean {
  const e = err as { code?: string; cause?: { code?: string } | null } | null;
  return e?.code === "23505" || e?.cause?.code === "23505";
}
