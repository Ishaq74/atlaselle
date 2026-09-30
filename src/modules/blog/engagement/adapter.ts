/**
 * Adaptateur domaine blog → contrats du module d'engagement partagé.
 *
 * Même rôle que `modules/services/engagement/adapter.ts` et
 * `modules/trips/engagement/adapter.ts` : les atomes de `molecules/Engagement`
 * sont agnostiques, chaque domaine traduit ses lignes une seule fois, ici.
 *
 * Ces deux fonctions vivaient dans les sections blog. Les sortir évite d'avoir
 * la même traduction dupliquée dans chaque composant, et rend le contrat
 * réutilisable.
 */
import type { EngagementCommentItem } from "@/components/molecules/Engagement/EngagementCommentThread.astro";
import type { EngagementReviewItem } from "@/components/molecules/Engagement/EngagementReviewCard.astro";
import type { BlogCommentWithAuthor, BlogReviewWithAuthor } from "@/lib/blog/types";

/** Libellé de substitution quand l'auteur est inconnu. */
const ANONYMOUS = "Anonymous";

export function toCommentItem(comment: BlogCommentWithAuthor): EngagementCommentItem {
  return {
    id: comment.id,
    content: comment.content,
    createdAt: comment.createdAt,
    // Un commentaire peut être signé sans compte : le nom saisi est alors la
    // seule identité disponible.
    authorName: comment.author?.name ?? comment.guestName ?? ANONYMOUS,
    authorImage: comment.author?.image ?? null,
    status: comment.status,
    replies: (comment.replies ?? []).map(toCommentItem),
  };
}

export function toReviewItem(review: BlogReviewWithAuthor): EngagementReviewItem {
  return {
    id: review.id,
    rating: review.rating,
    title: review.title,
    content: review.content,
    isRecommended: review.isRecommended,
    helpfulCount: review.helpfulCount,
    createdAt: review.createdAt,
    authorName: review.author?.name ?? ANONYMOUS,
    authorImage: review.author?.image ?? null,
    viewerHelpful: review.userVote ?? null,
  };
}
