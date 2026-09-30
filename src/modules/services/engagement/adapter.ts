/**
 * Adaptateur domaine services → contrats du module d'engagement partagé.
 *
 * Les atomes de `molecules/Engagement` sont agnostiques : ils reçoivent des
 * objets `EngagementCommentItem` / `EngagementReviewItem`. Chaque domaine a ses
 * tables, ses statuts et ses libellés ; c'est ici que se fait la traduction,
 * une fois, plutôt que dans chaque composant d'affichage.
 *
 * Les formes de lignes viennent du loader (`loadServiceEngagement`) : le
 * composant ne connaît plus SQL, et l'adaptateur n'invente pas de type.
 */
import type { EngagementCommentItem } from "@/components/molecules/Engagement/EngagementCommentThread.astro";
import type { EngagementReviewItem } from "@/components/molecules/Engagement/EngagementReviewCard.astro";
import type {
  ServiceEngagementCommentRow,
  ServiceEngagementReviewRow,
} from "@/modules/services/loaders/service-engagement.loader";

export function toCommentItem(
  row: ServiceEngagementCommentRow,
  anonymousLabel: string,
): EngagementCommentItem {
  return {
    id: row.comment.id,
    content: row.comment.content,
    createdAt: row.comment.createdAt,
    authorName: row.author?.name ?? anonymousLabel,
    authorImage: row.author?.image ?? null,
    status: row.comment.status,
  };
}

export function toReviewItem(
  row: ServiceEngagementReviewRow,
  anonymousLabel: string,
  viewerHelpful = false,
): EngagementReviewItem {
  return {
    id: row.review.id,
    rating: row.review.rating,
    title: row.review.title,
    content: row.review.content,
    isRecommended: row.review.isRecommended,
    helpfulCount: row.review.helpfulCount,
    createdAt: row.review.createdAt,
    authorName: row.author?.name ?? anonymousLabel,
    authorImage: row.author?.image ?? null,
    viewerHelpful,
  };
}

/** Moyenne des notes, arrondie à une décimale. */
export function averageRating(rows: ServiceEngagementReviewRow[]): number {
  if (rows.length === 0) return 0;
  const total = rows.reduce((sum, row) => sum + row.review.rating, 0);
  return Math.round((total / rows.length) * 10) / 10;
}

/** Répartition 5→1 pour `EngagementReviewStats`. */
export function ratingDistribution(
  rows: ServiceEngagementReviewRow[],
): { rating: number; count: number }[] {
  return [5, 4, 3, 2, 1].map((rating) => ({
    rating,
    count: rows.filter((row) => row.review.rating === rating).length,
  }));
}
