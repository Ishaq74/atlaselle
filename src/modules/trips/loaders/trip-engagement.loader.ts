import { and, desc, eq, inArray } from "drizzle-orm";
import { getDrizzle } from "@database/drizzle";
import { cached } from "@database/cache";
import { user } from "@database/schemas/auth.schema";
import {
  tripComments,
  tripFavorites,
  tripReactions,
  tripReviews,
  tripReviewHelpful,
} from "@database/schemas/trips.schema";
import { averageFrom100 } from "@/modules/trips/domain/trip-engagement";

export interface TripReviewDTO {
  id: string;
  rating: number;
  title: string | null;
  content: string;
  isRecommended: boolean;
  helpfulCount: number;
  createdAt: Date;
  authorName: string | null;
  viewerHelpful: boolean | null;
}

export interface TripCommentDTO {
  id: string;
  parentId: string | null;
  content: string;
  createdAt: Date;
  authorName: string | null;
  guestName: string | null;
  replies: TripCommentDTO[];
}

export interface TripEngagementDTO {
  ratingAverage: number;
  ratingAverage100: number;
  ratingCount: number;
  approvedReviewsCount: number;
  approvedCommentsCount: number;
  favoritesCount: number;
  viewerFavorite: boolean;
  viewerReaction: "LIKE" | "LOVE" | "FIRE" | "CLAP" | null;
  reviews: TripReviewDTO[];
  comments: TripCommentDTO[];
  distribution: { rating: number; count: number }[];
}

async function loadEngagementInner(tripId: string, viewerId: string | null): Promise<TripEngagementDTO> {
  const db = getDrizzle();
  const [reviewsRaw, commentsRaw, favoritesRaw, reactionRaw, favoritesCountRaw] = await Promise.all([
    db
      .select({ review: tripReviews, author: { id: user.id, name: user.name } })
      .from(tripReviews)
      .leftJoin(user, eq(user.id, tripReviews.authorId))
      .where(and(eq(tripReviews.tripId, tripId), eq(tripReviews.status, "APPROVED")))
      .orderBy(desc(tripReviews.createdAt))
      .limit(50),
    db
      .select({ comment: tripComments, author: { id: user.id, name: user.name } })
      .from(tripComments)
      .leftJoin(user, eq(user.id, tripComments.authorId))
      .where(and(eq(tripComments.tripId, tripId), eq(tripComments.status, "APPROVED")))
      .orderBy(desc(tripComments.createdAt))
      .limit(100),
    viewerId
      ? db.select().from(tripFavorites).where(and(eq(tripFavorites.tripId, tripId), eq(tripFavorites.userId, viewerId))).limit(1)
      : Promise.resolve([]),
    viewerId
      ? db.select({ reactionType: tripReactions.reactionType }).from(tripReactions).where(and(eq(tripReactions.tripId, tripId), eq(tripReactions.userId, viewerId))).limit(1)
      : Promise.resolve([]),
    db.select({ tripId: tripFavorites.tripId }).from(tripFavorites).where(eq(tripFavorites.tripId, tripId)),
  ]);

  const helpfulVotes =
    viewerId && reviewsRaw.length > 0
      ? await db
          .select({ reviewId: tripReviewHelpful.reviewId, isHelpful: tripReviewHelpful.isHelpful })
          .from(tripReviewHelpful)
          .where(and(eq(tripReviewHelpful.userId, viewerId), inArray(tripReviewHelpful.reviewId, reviewsRaw.map((r) => r.review.id))))
      : [];
  const helpfulByReview = new Map(helpfulVotes.map((v) => [v.reviewId, v.isHelpful]));

  const distribution = [5, 4, 3, 2, 1].map((rating) => ({
    rating,
    count: reviewsRaw.filter((r) => r.review.rating === rating).length,
  }));
  const total = reviewsRaw.length;
  const sum = reviewsRaw.reduce((n, r) => n + r.review.rating, 0);
  const ratingAverage = total > 0 ? Math.round((sum / total) * 10) / 10 : 0;

  const reviews: TripReviewDTO[] = reviewsRaw.map(({ review, author }) => ({
    id: review.id,
    rating: review.rating,
    title: review.title,
    content: review.content,
    isRecommended: review.isRecommended,
    helpfulCount: review.helpfulCount,
    createdAt: review.createdAt,
    authorName: author?.name ?? null,
    viewerHelpful: helpfulByReview.get(review.id) ?? null,
  }));

  const byId = new Map<string, TripCommentDTO>();
  const roots: TripCommentDTO[] = [];
  const sorted = [...commentsRaw].sort((a, b) => a.comment.createdAt.getTime() - b.comment.createdAt.getTime());
  for (const { comment, author } of sorted) {
    byId.set(comment.id, {
      id: comment.id,
      parentId: comment.parentId,
      content: comment.content,
      createdAt: comment.createdAt,
      authorName: author?.name ?? null,
      guestName: comment.guestName,
      replies: [],
    });
  }
  for (const node of byId.values()) {
    if (node.parentId && byId.has(node.parentId)) {
      byId.get(node.parentId)?.replies.push(node);
    } else {
      roots.push(node);
    }
  }
  roots.reverse();

  return {
    ratingAverage,
    ratingAverage100: Math.round(ratingAverage * 100),
    ratingCount: total,
    approvedReviewsCount: total,
    approvedCommentsCount: commentsRaw.length,
    favoritesCount: favoritesCountRaw.length,
    viewerFavorite: favoritesRaw.length > 0,
    viewerReaction: (reactionRaw[0]?.reactionType as TripEngagementDTO["viewerReaction"]) ?? null,
    reviews,
    comments: roots,
    distribution,
  };
}

export const loadTripEngagement = cached(
  (tripId: string, viewerId: string | null) => `trip:engagement:${tripId}:${viewerId ?? "anon"}`,
  loadEngagementInner,
);

export async function loadTripEngagementSummary(tripId: string): Promise<{ ratingAverage: number; ratingCount: number; commentsCount: number }> {
  const engagement = await loadEngagementInner(tripId, null);
  void averageFrom100;
  return { ratingAverage: engagement.ratingAverage, ratingCount: engagement.ratingCount, commentsCount: engagement.approvedCommentsCount };
}
