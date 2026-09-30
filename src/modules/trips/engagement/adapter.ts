/**
 * Adaptateur domaine voyages → contrats du module d'engagement partagé.
 *
 * Même rôle que `modules/services/engagement/adapter.ts` : les atomes de
 * `molecules/Engagement` sont agnostiques, chaque domaine traduit ses lignes
 * une seule fois, ici.
 */
import type { EngagementCommentItem } from "@/components/molecules/Engagement/EngagementCommentThread.astro";
import type { EngagementReviewItem } from "@/components/molecules/Engagement/EngagementReviewCard.astro";
import type { TripEngagementDTO } from "@/modules/trips/loaders/trip-engagement.loader";

/** Libellé de substitution quand l'auteur est inconnu. */
const ANONYMOUS = "—";

export function toReviewItem(
  review: TripEngagementDTO["reviews"][number],
): EngagementReviewItem {
  return {
    id: review.id,
    rating: review.rating,
    title: review.title,
    content: review.content,
    isRecommended: review.isRecommended,
    helpfulCount: review.helpfulCount,
    createdAt: review.createdAt,
    authorName: review.authorName ?? ANONYMOUS,
    authorImage: null,
    viewerHelpful: review.viewerHelpful,
  };
}

export function toCommentItem(
  comment: TripEngagementDTO["comments"][number],
): EngagementCommentItem {
  return {
    id: comment.id,
    content: comment.content,
    createdAt: comment.createdAt,
    authorName: comment.authorName ?? comment.guestName ?? ANONYMOUS,
    authorImage: null,
    status: "APPROVED",
    replies: (comment.replies ?? []).map(toCommentItem),
  };
}
