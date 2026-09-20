import { ActionError, defineAction } from "astro:actions";
import { and, eq } from "drizzle-orm";
import { z } from "astro/zod";
import { getDrizzle } from "@database/drizzle";
import {
  trips,
  tripComments,
  tripCommentModerations,
  tripReports,
  tripReviews,
} from "@database/schemas/trips.schema";
import { sanitizeHtml } from "@/lib/sanitize";
import { tripCommentModerationSchema, tripReviewModerationSchema } from "@/modules/trips/validation";
import { recalculateTripRating } from "@/modules/trips/domain/trip-engagement";
import { assertVoyagePermission, auditVoyage, invalidateVoyageCache } from "./_helpers";
import { createTripNotification } from "./notification";

export const moderateTripComment = defineAction({
  input: tripCommentModerationSchema,
  handler: async (input, context) => {
    const user = await assertVoyagePermission(context, { tripComment: ["moderate"] });
    const db = getDrizzle();
    const { newStatus } = await db.transaction(async (tx) => {
      const [comment] = await tx
        .select({
          id: tripComments.id,
          tripId: tripComments.tripId,
          parentId: tripComments.parentId,
          authorId: tripComments.authorId,
          content: tripComments.content,
          status: tripComments.status,
        })
        .from(tripComments)
        .innerJoin(trips, eq(tripComments.tripId, trips.id))
        .where(eq(tripComments.id, input.commentId))
        .limit(1);
      if (!comment) throw new ActionError({ code: "NOT_FOUND", message: "Commentaire introuvable." });
      const newStatus =
        input.moderationAction === "APPROVE"
          ? "APPROVED"
          : input.moderationAction === "REJECT"
            ? "REJECTED"
            : input.moderationAction === "DELETE"
              ? "TRASH"
              : input.moderationAction === "RESTORE"
                ? "PENDING"
                : comment.status;
      const newContent = input.moderationAction === "EDIT" && input.content ? sanitizeHtml(input.content) : comment.content;
      if (!newContent.trim()) throw new ActionError({ code: "BAD_REQUEST", message: "Contenu invalide." });
      const becameApproved = newStatus === "APPROVED" && comment.status !== "APPROVED";
      await tx.update(tripComments).set({ status: newStatus, content: newContent, isEdited: input.moderationAction === "EDIT" }).where(eq(tripComments.id, input.commentId));
      await tx.insert(tripCommentModerations).values({
        commentId: input.commentId,
        moderatorId: user.id,
        action: input.moderationAction,
        reason: input.reason ?? null,
        previousValues: { status: comment.status, content: comment.content },
      });
      if (becameApproved && comment.authorId && comment.authorId !== user.id) {
        await createTripNotification({
          recipientId: comment.authorId,
          actorId: user.id,
          tripId: comment.tripId,
          commentId: comment.id,
          type: comment.parentId ? "REPLY_TO_COMMENT" : "NEW_COMMENT",
          title: "Commentaire approuvé",
          message: "Votre commentaire sur le voyage a été approuvé.",
        }).catch(() => {});
      }
      return { newStatus };
    });
    auditVoyage(context, user.id, "TRIP_COMMENT_MODERATE", { resource: "trip_comments", resourceId: input.commentId, metadata: { action: input.moderationAction, newStatus } });
    invalidateVoyageCache();
    return { success: true, status: newStatus };
  },
});

export const moderateTripReview = defineAction({
  input: tripReviewModerationSchema,
  handler: async (input, context) => {
    const user = await assertVoyagePermission(context, { tripReview: ["moderate"] });
    const db = getDrizzle();
    const [review] = await db
      .select({ id: tripReviews.id, authorId: tripReviews.authorId, status: tripReviews.status, tripId: tripReviews.tripId })
      .from(tripReviews)
      .innerJoin(trips, eq(tripReviews.tripId, trips.id))
      .where(eq(tripReviews.id, input.reviewId))
      .limit(1);
    if (!review) throw new ActionError({ code: "NOT_FOUND", message: "Avis introuvable." });
    await db.update(tripReviews).set({ status: input.status }).where(eq(tripReviews.id, input.reviewId));
    const { ratingCount, ratingAverage100 } = await recalculateTripRating(review.tripId);
    if (review.authorId && review.authorId !== user.id && (input.status === "APPROVED" || input.status === "REJECTED")) {
      await createTripNotification({
        recipientId: review.authorId,
        actorId: user.id,
        tripId: review.tripId,
        reviewId: review.id,
        type: input.status === "APPROVED" ? "REVIEW_APPROVED" : "REVIEW_REJECTED",
        title: input.status === "APPROVED" ? "Avis approuvé" : "Avis refusé",
        message: input.status === "APPROVED" ? "Votre avis sur le voyage a été approuvé." : "Votre avis sur le voyage n'a pas été retenu.",
      }).catch(() => {});
    }
    auditVoyage(context, user.id, "TRIP_REVIEW_MODERATE", { resource: "trip_reviews", resourceId: input.reviewId, metadata: { status: input.status, ratingCount, ratingAverage100 } });
    invalidateVoyageCache();
    return { success: true, ratingCount, ratingAverage100 };
  },
});

export const resolveTripReport = defineAction({
  input: z.object({ id: z.uuid(), status: z.enum(["REVIEWED", "RESOLVED", "REJECTED"]) }),
  handler: async (input, context) => {
    const user = await assertVoyagePermission(context, { trip: ["moderate"] });
    const db = getDrizzle();
    const [report] = await db.select().from(tripReports).where(eq(tripReports.id, input.id)).limit(1);
    if (!report) throw new ActionError({ code: "NOT_FOUND", message: "Signalement introuvable." });
    if (report.commentId) {
      const [comment] = await db.select({ tripId: tripComments.tripId }).from(tripComments).where(eq(tripComments.id, report.commentId)).limit(1);
      if (!comment) throw new ActionError({ code: "NOT_FOUND", message: "Commentaire cible introuvable." });
    }
    if (report.reviewId) {
      const [review] = await db.select({ tripId: tripReviews.tripId }).from(tripReviews).where(eq(tripReviews.id, report.reviewId)).limit(1);
      if (!review) throw new ActionError({ code: "NOT_FOUND", message: "Avis cible introuvable." });
    }
    await db.update(tripReports).set({ status: input.status, resolvedBy: user.id, resolvedAt: new Date() }).where(eq(tripReports.id, input.id));
    auditVoyage(context, user.id, "TRIP_REPORT_RESOLVE", { resource: "trip_reports", resourceId: input.id, metadata: { status: input.status } });
    invalidateVoyageCache();
    return { success: true };
  },
});

export const updateTripEngagementSettings = defineAction({
  input: z.object({
    tripId: z.string().min(1).max(160),
    commentStatus: z.enum(["OPEN", "CLOSED", "DISABLED"]),
    allowReviews: z.boolean(),
  }),
  handler: async (input, context) => {
    const user = await assertVoyagePermission(context, { trip: ["update"] });
    const db = getDrizzle();
    const [trip] = await db.select({ id: trips.id }).from(trips).where(eq(trips.id, input.tripId)).limit(1);
    if (!trip) throw new ActionError({ code: "NOT_FOUND", message: "Voyage introuvable." });
    await db.update(trips).set({ commentStatus: input.commentStatus, allowReviews: input.allowReviews }).where(eq(trips.id, input.tripId));
    auditVoyage(context, user.id, "TRIP_UPDATE", { resource: "trips", resourceId: input.tripId, metadata: { commentStatus: input.commentStatus, allowReviews: input.allowReviews } });
    invalidateVoyageCache();
    return { success: true };
  },
});

export async function assertTripCommentTarget(tripId: string, commentId: string): Promise<void> {
  const [comment] = await getDrizzle()
    .select({ id: tripComments.id })
    .from(tripComments)
    .where(and(eq(tripComments.id, commentId), eq(tripComments.tripId, tripId)))
    .limit(1);
  if (!comment) throw new ActionError({ code: "NOT_FOUND", message: "Commentaire introuvable pour ce voyage." });
}
