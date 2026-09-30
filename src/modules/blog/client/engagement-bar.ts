/**
 * Barre de réactions d'un article de blog.
 *
 * La mécanique (état, compteurs, aria) est dans
 * `core/engagement/client/binding.ts` ; ce module ne fournit que l'action du
 * domaine et les messages.
 */
import { actions } from "astro:actions";
import { toast } from "@atoms/toast";
import { bindEngagementReactions } from "@/core/engagement/client/binding";

export function initBlogEngagementBar(): void {
  // CIBLE SCOPÉE au conteneur : la version précédente interrogeait
  // `document`, donc sur une page portant deux barres (article + section
  // alike) chaque clic déclenchait deux requêtes.
  for (const bar of document.querySelectorAll<HTMLElement>("[data-blog-engagement-bar]")) {
    const postId = bar.dataset.postId;
    if (!postId) continue;

    bindEngagementReactions(bar, {
      toggle: (reaction) => actions.toggleBlogReaction({ postId, reactionType: reaction }),
      errorText: bar.dataset.tError ?? "",
      updatedText: bar.dataset.tUpdated ?? "",
      onError: (error, fallback) => toast.error(error?.message ?? fallback),
      onSuccess: (message) => toast.success(message),
    });
  }
}
