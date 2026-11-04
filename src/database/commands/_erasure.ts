/**
 * Rejeu des effacements RGPD après une restauration, et import de l'historique depuis l'audit.
 * Fonctions testables : la base est passée en paramètre, aucune lecture de l'environnement ici.
 */
import { eq, inArray } from 'drizzle-orm';
import type { getDrizzle } from '../drizzle';
import { applications, reservations, travelers, user } from '../schemas';
import { ACTIVE_APPLICATION_STATUSES } from '@/modules/applications/domain/application-transitions';
import { ACTIVE_RESERVATION_STATUSES, anonymizeTravelerRecord, anonymizedEmail } from '@/modules/travelers/domain/travelers-service';
import type { ErasureEntry, ErasureKind } from '@/lib/erasure-ledger';

type Db = ReturnType<typeof getDrizzle>;

export type ReplayOutcome = 'applied' | 'already' | 'absent' | 'error';

export interface ReplayRow {
  entry: ErasureEntry;
  outcome: ReplayOutcome;
  /** À examiner par un humain, sans empêcher l'effacement (la personne a demandé l'effacement). */
  warnings: string[];
  error?: string;
}

export interface ReplayOptions {
  db: Db;
  dryRun?: boolean;
}

async function replayTraveler(entry: ErasureEntry, { db, dryRun }: ReplayOptions): Promise<Pick<ReplayRow, 'outcome' | 'warnings'>> {
  const [row] = await db.select({ id: travelers.id, email: travelers.email }).from(travelers).where(eq(travelers.id, entry.subject)).limit(1);
  if (!row) return { outcome: 'absent', warnings: [] };
  if (row.email === anonymizedEmail(row.id)) return { outcome: 'already', warnings: [] };

  // Le dossier restauré peut être plus ancien que l'effacement : il a pu être « en cours » à l'époque.
  // L'effacement demandé prime ; on le signale pour examen (réservation ou candidature à clarifier).
  const warnings: string[] = [];
  const apps = await db.select({ status: applications.status }).from(applications).where(eq(applications.travelerId, row.id));
  const reservationRows = await db.select({ status: reservations.status }).from(reservations).where(eq(reservations.travelerId, row.id));
  if (apps.some((a) => (ACTIVE_APPLICATION_STATUSES as readonly string[]).includes(a.status))) warnings.push('candidature en cours dans la base restaurée');
  if (reservationRows.some((r) => (ACTIVE_RESERVATION_STATUSES as readonly string[]).includes(r.status))) warnings.push('réservation en cours dans la base restaurée');

  if (!dryRun) await anonymizeTravelerRecord(row.id, db);
  return { outcome: 'applied', warnings };
}

async function replayUser(entry: ErasureEntry, { db, dryRun }: ReplayOptions): Promise<Pick<ReplayRow, 'outcome' | 'warnings'>> {
  const [row] = await db.select({ id: user.id }).from(user).where(eq(user.id, entry.subject)).limit(1);
  if (!row) return { outcome: 'absent', warnings: [] };
  // Les clés étrangères en cascade ou « set null » reproduisent la suppression d'origine.
  if (!dryRun) await db.delete(user).where(inArray(user.id, [row.id]));
  return { outcome: 'applied', warnings: [] };
}

const REPLAYERS: Record<ErasureKind, (entry: ErasureEntry, options: ReplayOptions) => Promise<Pick<ReplayRow, 'outcome' | 'warnings'>>> = {
  'traveler.anonymize': replayTraveler,
  'user.delete': replayUser,
};

/** Rejoue chaque effacement dans l'ordre du registre. Une erreur n'arrête pas les suivants. */
export async function replayErasures(entries: readonly ErasureEntry[], options: ReplayOptions): Promise<ReplayRow[]> {
  const rows: ReplayRow[] = [];
  for (const entry of entries) {
    try {
      rows.push({ entry, ...(await REPLAYERS[entry.kind](entry, options)) });
    } catch (error) {
      rows.push({ entry, outcome: 'error', warnings: [], error: error instanceof Error ? error.message : String(error) });
    }
  }
  return rows;
}
