import { and, count, eq, sql } from "drizzle-orm";
import { ActionError, defineAction } from "astro:actions";
import { z } from "astro/zod";
import { getDrizzle } from "@database/drizzle";
import {
  trips,
  tripComments,
  tripFavorites,
  tripReactions,
  tripReports,
  tripReviews,
  tripReviewHelpful,
  tripViewStats,
} from "@database/schemas/trips.schema";
import { sanitizeHtml } from "@/lib/sanitize";
import { stripHtml } from "@/core/content/text";
import { extractIp } from "@/lib/audit";
import {
  tripCommentFormSchema,
  tripReportFormSchema,
  tripReviewFormSchema,
} from "@/modules/trips/validation";
import {
  assertPublishedTripExists,
  assertVoyagePermission,
  auditVoyage,
  invalidateVoyageCache,
  voyagePublicRateLimit,
  voyageRateLimit,
} from "./_helpers";
import { createTripNotification } from "./notification";

const MAX_COMMENT_REPLY_DEPTH = 1;

export const createTripComment = defineAction({
  input: tripCommentFormSchema,
  handler: async (input, context) => {
    voyagePublicRateLimit(context, "comment-create", { window: 300, max: 5 });
    const db = getDrizzle();
    const [trip] = await db
      .select({ id: trips.id, commentStatus: trips.commentStatus })
      .from(trips)
      .where(and(eq(trips.id, input.tripId), eq(trips.status, "published")))
      .limit(1);
    if (!trip) throw new ActionError({ code: "NOT_FOUND", message: "Voyage introuvable." });
    if (trip.commentStatus === "DISABLED" || trip.commentStatus === "CLOSED") {
      throw new ActionError({ code: "FORBIDDEN", message: "Les commentaires sont désactivés pour ce voyage." });
    }
    const user = context.locals.user;
    const content = sanitizeHtml(input.content);
    if (!content.trim()) throw new ActionError({ code: "BAD_REQUEST", message: "Contenu invalide." });
    const guestName = input.guestName ? sanitizeHtml(input.guestName) : undefined;
    const guestEmail = input.guestEmail ? sanitizeHtml(input.guestEmail) : undefined;

    if (input.parentId) {
      let ancestorId: string | null | undefined = input.parentId;
      let depth = 0;
      while (ancestorId) {
        const [ancestor] = await db
          .select({ parentId: tripComments.parentId })
          .from(tripComments)
          .where(and(eq(tripComments.id, ancestorId), eq(tripComments.tripId, input.tripId), eq(tripComments.status, "APPROVED")))
          .limit(1);
        if (!ancestor) {
          throw new ActionError({ code: "BAD_REQUEST", message: "Le commentaire parent n'appartient pas à ce voyage ou n'est pas public." });
        }
        depth += 1;
        if (depth > MAX_COMMENT_REPLY_DEPTH) {
          throw new ActionError({ code: "BAD_REQUEST", message: "La profondeur maximale des réponses est atteinte." });
        }
        ancestorId = ancestor.parentId;
      }
    }

    const [comment] = await db
      .insert(tripComments)
      .values({
        tripId: input.tripId,
        authorId: user?.id ?? null,
        parentId: input.parentId ?? null,
        guestName: user ? null : guestName,
        guestEmail: user ? null : guestEmail,
        content,
        status: "PENDING",
        ipAddress: extractIp(context.request.headers, context.clientAddress),
        userAgent: context.request.headers.get("user-agent"),
      })
      .returning({ id: tripComments.id, status: tripComments.status });
    if (user) {
      auditVoyage(context, user.id, "TRIP_COMMENT_CREATE", { resource: "trip_comments", resourceId: comment.id });
    }
    return { id: comment.id, status: comment.status };
  },
});

export const createTripReview = defineAction({
  input: tripReviewFormSchema,
  handler: async (input, context) => {
    const user = context.locals.user;
    if (!user) throw new ActionError({ code: "UNAUTHORIZED", message: "Vous devez être connecté pour laisser un avis." });
    voyageRateLimit(context, user.id, "review-create", { window: 3600, max: 10 });
    const content = sanitizeHtml(input.content);
    if (!content.trim()) throw new ActionError({ code: "BAD_REQUEST", message: "Contenu invalide." });
    const title = input.title ? stripHtml(input.title).trim().slice(0, 180) || null : null;
    const db = getDrizzle();
    const [trip] = await db
      .select({ id: trips.id, allowReviews: trips.allowReviews })
      .from(trips)
      .where(and(eq(trips.id, input.tripId), eq(trips.status, "published")))
      .limit(1);
    if (!trip) throw new ActionError({ code: "NOT_FOUND", message: "Voyage introuvable." });
    if (!trip.allowReviews) throw new ActionError({ code: "FORBIDDEN", message: "Les avis sont désactivés pour ce voyage." });
    const existing = await db
      .select({ id: tripReviews.id })
      .from(tripReviews)
      .where(and(eq(tripReviews.tripId, input.tripId), eq(tripReviews.authorId, user.id)))
      .limit(1);
    if (existing[0]) throw new ActionError({ code: "CONFLICT", message: "Vous avez déjà laissé un avis pour ce voyage." });
    const [review] = await db
      .insert(tripReviews)
      .values({
        tripId: input.tripId,
        authorId: user.id,
        rating: input.rating,
        title,
        content,
        isRecommended: input.isRecommended ?? true,
        status: "PENDING",
        ipAddress: extractIp(context.request.headers, context.clientAddress),
      })
      .returning({ id: tripReviews.id, status: tripReviews.status });
    auditVoyage(context, user.id, "TRIP_REVIEW_CREATE", { resource: "trip_reviews", resourceId: review.id });
    invalidateVoyageCache();
    return { id: review.id, status: review.status };
  },
});

export const createTripReport = defineAction({
  input: tripReportFormSchema,
  handler: async (input, context) => {
    const user = context.locals.user;
    if (!user) throw new ActionError({ code: "UNAUTHORIZED", message: "Vous devez être connecté pour signaler un contenu." });
    voyageRateLimit(context, user.id, "report-create", { window: 3600, max: 20 });
    const db = getDrizzle();
    if (input.commentId) {
      const [comment] = await db.select({ id: tripComments.id, tripId: tripComments.tripId }).from(tripComments).where(eq(tripComments.id, input.commentId)).limit(1);
      if (!comment) throw new ActionError({ code: "NOT_FOUND", message: "Commentaire introuvable." });
      if (input.tripId && comment.tripId !== input.tripId) throw new ActionError({ code: "BAD_REQUEST", message: "Cible incohérente." });
      await assertPublishedTripExists(comment.tripId);
    }
    if (input.reviewId) {
      const [review] = await db.select({ id: tripReviews.id, tripId: tripReviews.tripId }).from(tripReviews).where(eq(tripReviews.id, input.reviewId)).limit(1);
      if (!review) throw new ActionError({ code: "NOT_FOUND", message: "Avis introuvable." });
      if (input.tripId && review.tripId !== input.tripId) throw new ActionError({ code: "BAD_REQUEST", message: "Cible incohérente." });
      await assertPublishedTripExists(review.tripId);
    }
    if (input.tripId && !input.commentId && !input.reviewId) {
      await assertPublishedTripExists(input.tripId);
    }
    const description = input.description ? stripHtml(input.description).trim().slice(0, 1000) || null : null;
    const [report] = await db
      .insert(tripReports)
      .values({
        tripId: input.commentId || input.reviewId ? null : (input.tripId ?? null),
        commentId: input.commentId ?? null,
        reviewId: input.reviewId ?? null,
        reporterId: user.id,
        reason: input.reason,
        description,
      })
      .returning({ id: tripReports.id });
    auditVoyage(context, user.id, "TRIP_REPORT_CREATE", { resource: "trip_reports", resourceId: report.id });
    invalidateVoyageCache();
    return { id: report.id };
  },
});

export const voteTripReviewHelpful = defineAction({
  input: z.object({ reviewId: z.uuid(), isHelpful: z.boolean() }),
  handler: async (input, context) => {
    const user = context.locals.user;
    if (!user) throw new ActionError({ code: "UNAUTHORIZED", message: "Connexion requise." });
    voyageRateLimit(context, user.id, "review-helpful", { window: 60, max: 30 });
    const db = getDrizzle();
    await db.transaction(async (tx) => {
      const [review] = await tx
        .select({ id: tripReviews.id, tripId: tripReviews.tripId })
        .from(tripReviews)
        .innerJoin(trips, eq(tripReviews.tripId, trips.id))
        .where(and(eq(tripReviews.id, input.reviewId), eq(tripReviews.status, "APPROVED"), eq(trips.status, "published")))
        .limit(1);
      if (!review) throw new ActionError({ code: "NOT_FOUND", message: "Avis introuvable." });
      await tx
        .insert(tripReviewHelpful)
        .values({ reviewId: input.reviewId, userId: user.id, isHelpful: input.isHelpful })
        .onConflictDoUpdate({ target: [tripReviewHelpful.reviewId, tripReviewHelpful.userId], set: { isHelpful: input.isHelpful } });
      const [{ helpful }] = await tx
        .select({ helpful: count() })
        .from(tripReviewHelpful)
        .where(and(eq(tripReviewHelpful.reviewId, input.reviewId), eq(tripReviewHelpful.isHelpful, true)));
      await tx.update(tripReviews).set({ helpfulCount: Number(helpful) }).where(eq(tripReviews.id, input.reviewId));
    });
    auditVoyage(context, user.id, "TRIP_REVIEW_HELPFUL", { resource: "trip_reviews", resourceId: input.reviewId, metadata: { isHelpful: input.isHelpful } });
    invalidateVoyageCache();
    return { success: true };
  },
});

export const toggleTripFavorite = defineAction({
  input: z.object({ tripId: z.string().min(1).max(160) }),
  handler: async (input, context) => {
    const user = await assertVoyagePermission(context, { trip: ["engage"] });
    await assertPublishedTripExists(input.tripId);
    voyageRateLimit(context, user.id, "favorite");
    const db = getDrizzle();
    const existing = await db
      .select()
      .from(tripFavorites)
      .where(and(eq(tripFavorites.tripId, input.tripId), eq(tripFavorites.userId, user.id)))
      .limit(1);
    if (existing[0]) {
      await db.delete(tripFavorites).where(and(eq(tripFavorites.tripId, input.tripId), eq(tripFavorites.userId, user.id)));
      auditVoyage(context, user.id, "TRIP_FAVORITE_REMOVE", { resource: "trips", resourceId: input.tripId });
      invalidateVoyageCache();
      return { active: false };
    }
    await db.insert(tripFavorites).values({ tripId: input.tripId, userId: user.id });
    auditVoyage(context, user.id, "TRIP_FAVORITE_ADD", { resource: "trips", resourceId: input.tripId });
    invalidateVoyageCache();
    return { active: true };
  },
});

export const toggleTripReaction = defineAction({
  input: z.object({ tripId: z.string().min(1).max(160), reactionType: z.enum(["LIKE", "LOVE", "FIRE", "CLAP"]) }),
  handler: async (input, context) => {
    const user = await assertVoyagePermission(context, { trip: ["engage"] });
    await assertPublishedTripExists(input.tripId);
    voyageRateLimit(context, user.id, "reaction");
    const db = getDrizzle();
    const existing = await db
      .select({ reactionType: tripReactions.reactionType })
      .from(tripReactions)
      .where(and(eq(tripReactions.tripId, input.tripId), eq(tripReactions.userId, user.id)))
      .limit(1);
    if (existing[0]?.reactionType === input.reactionType) {
      await db.delete(tripReactions).where(and(eq(tripReactions.tripId, input.tripId), eq(tripReactions.userId, user.id)));
      auditVoyage(context, user.id, "TRIP_REACTION_REMOVE", { resource: "trips", resourceId: input.tripId });
      invalidateVoyageCache();
      return { active: null };
    }
    await db
      .insert(tripReactions)
      .values({ tripId: input.tripId, userId: user.id, reactionType: input.reactionType })
      .onConflictDoUpdate({ target: [tripReactions.tripId, tripReactions.userId], set: { reactionType: input.reactionType } });
    auditVoyage(context, user.id, "TRIP_REACTION_ADD", { resource: "trips", resourceId: input.tripId, metadata: { reactionType: input.reactionType } });
    invalidateVoyageCache();
    return { active: input.reactionType };
  },
});

export const recordTripView = defineAction({
  input: z.object({ tripId: z.string().min(1).max(160), referrer: z.string().max(500).optional(), country: z.string().length(2).optional() }),
  handler: async (input) => {
    await assertPublishedTripExists(input.tripId);
    const now = new Date();
    const date = now.toISOString().slice(0, 10);
    const hour = now.getUTCHours();
    const db = getDrizzle();
    await db.insert(tripViewStats).values({
      tripId: input.tripId,
      viewedAt: now,
      date,
      hour,
      referrer: input.referrer ? stripHtml(input.referrer).slice(0, 500) : null,
      country: input.country?.toUpperCase() ?? null,
    });
    await db.update(trips).set({ viewCount: sql`${trips.viewCount} + 1` }).where(eq(trips.id, input.tripId));
    return { success: true };
  },
});

export async function notifyTripModerationEvent(params: {
  tripId: string;
  actorId: string | null;
  commentId?: string | null;
  reviewId?: string | null;
  type: "NEW_COMMENT" | "REPLY_TO_COMMENT" | "NEW_REVIEW" | "REVIEW_APPROVED" | "REVIEW_REJECTED";
  title: string;
  message: string;
  recipientId: string;
}): Promise<void> {
  await createTripNotification({
    recipientId: params.recipientId,
    actorId: params.actorId,
    tripId: params.tripId,
    commentId: params.commentId ?? null,
    reviewId: params.reviewId ?? null,
    type: params.type,
    title: params.title,
    message: params.message,
  });
}
