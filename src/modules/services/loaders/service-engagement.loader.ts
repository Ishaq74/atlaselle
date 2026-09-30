/**
 * Loader d'engagement d'une prestation.
 *
 * Seule source de données du composant `ServiceEngagement.astro` : le
 * composant ne touche plus la base, il reçoit un DTO. Même frontière que
 * `modules/trips/loaders/trip-engagement.loader.ts` et que
 * `getBlogPostBySlug` pour le blog.
 */
import { and, desc, eq, inArray } from "drizzle-orm";
import { getDrizzle } from "@database/drizzle";
import {
  serviceComments,
  serviceFavorites,
  serviceReactions,
  serviceReviews,
  serviceReviewHelpful,
  user,
} from "@database/schemas";

export type ServiceReactionKey = "LIKE" | "LOVE" | "FIRE" | "CLAP";

/** Jointure avis + auteur, telle que renvoyée par la requête. */
export interface ServiceEngagementReviewRow {
  review: {
    id: string;
    rating: number;
    title: string | null;
    content: string;
    isRecommended: boolean;
    helpfulCount: number;
    createdAt: Date;
  };
  author: { id: string; name: string | null; image: string | null } | null;
}

/** Jointure commentaire + auteur, telle que renvoyée par la requête. */
export interface ServiceEngagementCommentRow {
  comment: {
    id: string;
    content: string;
    createdAt: Date;
    status: string;
  };
  author: { id: string; name: string | null; image: string | null } | null;
}

/**
 * Forme publique consommée par les composants. Les lignes brutes restent
 * exportées pour l'adaptateur, qui les traduit en contrats du module
 * d'engagement partagé.
 */
export interface ServiceEngagementDTO {
  reviews: ServiceEngagementReviewRow[];
  comments: ServiceEngagementCommentRow[];
  /** Le visiteur a-t-il mis cette prestation en favori ? */
  isFavorite: boolean;
  /** Réaction du visiteur, ou null. */
  viewerReaction: ServiceReactionKey | null;
  /** Compteurs par type de réaction. */
  reactionCounts: Record<ServiceReactionKey, number>;
  /** Vote « utile » du visiteur, par avis. */
  viewerHelpfulByReview: Map<string, boolean>;
}

const REACTION_KEYS: ServiceReactionKey[] = ["LIKE", "LOVE", "FIRE", "CLAP"];

export async function loadServiceEngagement(
  serviceId: string,
  viewerId: string | null,
): Promise<ServiceEngagementDTO> {
  const db = getDrizzle();

  const [reviews, comments, favorite, reaction, reactionRows] = await Promise.all([
    db
      .select({
        review: serviceReviews,
        author: { id: user.id, name: user.name, image: user.image },
      })
      .from(serviceReviews)
      .leftJoin(user, eq(user.id, serviceReviews.authorId))
      .where(and(eq(serviceReviews.serviceId, serviceId), eq(serviceReviews.status, "APPROVED")))
      .orderBy(desc(serviceReviews.createdAt))
      .limit(50),
    db
      .select({
        comment: serviceComments,
        author: { id: user.id, name: user.name, image: user.image },
      })
      .from(serviceComments)
      .leftJoin(user, eq(user.id, serviceComments.authorId))
      .where(and(eq(serviceComments.serviceId, serviceId), eq(serviceComments.status, "APPROVED")))
      .orderBy(desc(serviceComments.createdAt))
      .limit(100),
    viewerId
      ? db
          .select({ serviceId: serviceFavorites.serviceId })
          .from(serviceFavorites)
          .where(and(eq(serviceFavorites.serviceId, serviceId), eq(serviceFavorites.userId, viewerId)))
          .limit(1)
      : Promise.resolve([]),
    viewerId
      ? db
          .select({ reactionType: serviceReactions.reactionType })
          .from(serviceReactions)
          .where(
            and(
              eq(serviceReactions.serviceId, serviceId),
              eq(serviceReactions.userId, viewerId),
            ),
          )
          .limit(1)
      : Promise.resolve([]),
    db
      .select({ reactionType: serviceReactions.reactionType })
      .from(serviceReactions)
      .where(eq(serviceReactions.serviceId, serviceId))
      .groupBy(serviceReactions.reactionType),
  ]);

  // Le vote « utile » n'a de sens que pour un visiteur connecté et des avis
  // affichés : `inArray` sur une liste vide produirait une requête invalide.
  const helpfulVotes =
    viewerId && reviews.length > 0
      ? await db
          .select({
            reviewId: serviceReviewHelpful.reviewId,
            isHelpful: serviceReviewHelpful.isHelpful,
          })
          .from(serviceReviewHelpful)
          .where(
            and(
              eq(serviceReviewHelpful.userId, viewerId),
              inArray(
                serviceReviewHelpful.reviewId,
                reviews.map(({ review }) => review.id),
              ),
            ),
          )
      : [];

  const viewerReaction = (reaction[0]?.reactionType ?? null) as ServiceReactionKey | null;

  const reactionCounts = Object.fromEntries(
    REACTION_KEYS.map((key) => [key, 0]),
  ) as Record<ServiceReactionKey, number>;
  for (const row of reactionRows) {
    if (row.reactionType in reactionCounts) reactionCounts[row.reactionType] += 1;
  }

  return {
    reviews: reviews as ServiceEngagementReviewRow[],
    comments: comments as ServiceEngagementCommentRow[],
    isFavorite: favorite.length > 0,
    viewerReaction,
    reactionCounts,
    viewerHelpfulByReview: new Map(helpfulVotes.map((v) => [v.reviewId, v.isHelpful])),
  };
}
