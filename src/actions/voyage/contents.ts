import { ActionError, defineAction } from "astro:actions";
import { and, eq } from "drizzle-orm";
import { z } from "astro/zod";
import { getDrizzle } from "@database/drizzle";
import {
  tripHighlights,
  tripHighlightTranslations,
  tripInclusions,
  tripInclusionTranslations,
  tripExclusions,
  tripExclusionTranslations,
} from "@database/schemas";
import { LOCALES, type Locale } from "@i18n/config";
import { assertVoyagePermission, assertTripExists, assertFresh, auditVoyage, invalidateVoyageCache } from "./_helpers";

const KIND = ["highlight", "inclusion", "exclusion"] as const;
export type ContentKind = (typeof KIND)[number];

const BASE = {
  highlight: { table: tripHighlights, fk: "tripId" as const },
  inclusion: { table: tripInclusions, fk: "tripId" as const },
  exclusion: { table: tripExclusions, fk: "tripId" as const },
} as const;

const TRANSLATIONS = {
  highlight: { table: tripHighlightTranslations, fk: "highlightId" as const },
  inclusion: { table: tripInclusionTranslations, fk: "inclusionId" as const },
  exclusion: { table: tripExclusionTranslations, fk: "exclusionId" as const },
} as const;

const kindSchema = z.enum(KIND);

export const createTripContent = defineAction({
  input: z.object({
    tripId: z.string().min(1).max(160),
    kind: kindSchema,
    sortOrder: z.number().int().min(0).default(0),
    iconKey: z.string().max(64).nullable().optional(),
  }),
  handler: async (input, context) => {
    const user = await assertVoyagePermission(context, { trip: ["update"] });
    await assertTripExists(input.tripId);
    const db = getDrizzle();
    let id: string | undefined;
    if (input.kind === "highlight") {
      const [row] = await db.insert(tripHighlights).values({ tripId: input.tripId, sortOrder: input.sortOrder, iconKey: input.iconKey ?? null }).returning({ id: tripHighlights.id });
      id = row?.id;
    } else if (input.kind === "inclusion") {
      const [row] = await db.insert(tripInclusions).values({ tripId: input.tripId, sortOrder: input.sortOrder }).returning({ id: tripInclusions.id });
      id = row?.id;
    } else {
      const [row] = await db.insert(tripExclusions).values({ tripId: input.tripId, sortOrder: input.sortOrder }).returning({ id: tripExclusions.id });
      id = row?.id;
    }
    if (!id) throw new ActionError({ code: "INTERNAL_SERVER_ERROR", message: "Création impossible." });
    auditVoyage(context, user.id, "TRIP_UPDATE", { resource: `trip_${input.kind}s`, resourceId: id, metadata: { tripId: input.tripId } });
    invalidateVoyageCache();
    return { id };
  },
});

export const deleteTripContent = defineAction({
  input: z.object({ kind: kindSchema, id: z.string().min(1).max(160) }),
  handler: async (input, context) => {
    const user = await assertVoyagePermission(context, { trip: ["update"] });
    await getDrizzle().delete(BASE[input.kind].table).where(eq(BASE[input.kind].table.id, input.id));
    auditVoyage(context, user.id, "TRIP_UPDATE", { resource: `trip_${input.kind}s`, resourceId: input.id, metadata: { deleted: true } });
    invalidateVoyageCache();
    return { success: true };
  },
});

export const upsertTripContentTranslation = defineAction({
  input: z.object({
    kind: kindSchema,
    id: z.string().min(1).max(160),
    expectedUpdatedAt: z.string().datetime({ offset: true }).nullable().optional(),
    locale: z.enum(LOCALES),
    title: z.string().max(300).nullable().optional(),
    description: z.string().max(4000).nullable().optional(),
    text: z.string().max(4000).nullable().optional(),
  }),
  handler: async (input, context) => {
    const user = await assertVoyagePermission(context, { trip: ["update"] });
    const { kind, id, locale, expectedUpdatedAt, title, description, text } = input;
    const T = TRANSLATIONS[kind];
    const db = getDrizzle();
    if (expectedUpdatedAt != null) {
      const [existing] = await db
        .select({ updatedAt: T.table.updatedAt })
        .from(T.table)
        .where(and(eq(T.table[T.fk], id), eq(T.table.locale, locale as Locale)))
        .limit(1);
      if (existing) assertFresh(existing.updatedAt, expectedUpdatedAt, "Contenu");
    }
    const values =
      kind === "highlight"
        ? { highlightId: id, locale: locale as Locale, title: title ?? "", description: description ?? null }
        : kind === "inclusion"
          ? { inclusionId: id, locale: locale as Locale, text: text ?? "" }
          : { exclusionId: id, locale: locale as Locale, text: text ?? "" };
    if (kind === "highlight") {
      if (!title) throw new ActionError({ code: "BAD_REQUEST", message: "Titre requis." });
      await db
        .insert(tripHighlightTranslations)
        .values(values as typeof tripHighlightTranslations.$inferInsert)
        .onConflictDoUpdate({
          target: [tripHighlightTranslations.highlightId, tripHighlightTranslations.locale],
          set: { title: title ?? "", description: description ?? null },
        });
    } else if (kind === "inclusion") {
      if (!text) throw new ActionError({ code: "BAD_REQUEST", message: "Texte requis." });
      await db
        .insert(tripInclusionTranslations)
        .values(values as typeof tripInclusionTranslations.$inferInsert)
        .onConflictDoUpdate({
          target: [tripInclusionTranslations.inclusionId, tripInclusionTranslations.locale],
          set: { text: text ?? "" },
        });
    } else {
      if (!text) throw new ActionError({ code: "BAD_REQUEST", message: "Texte requis." });
      await db
        .insert(tripExclusionTranslations)
        .values(values as typeof tripExclusionTranslations.$inferInsert)
        .onConflictDoUpdate({
          target: [tripExclusionTranslations.exclusionId, tripExclusionTranslations.locale],
          set: { text: text ?? "" },
        });
    }
    auditVoyage(context, user.id, "TRIP_TRANSLATION_UPSERT", { resource: `trip_${kind}_translations`, resourceId: id, metadata: { locale } });
    invalidateVoyageCache();
    return { success: true };
  },
});
