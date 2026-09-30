/**
 * Barre d'engagement d'une prestation.
 *
 * Même mécanique que le blog et les voyages
 * (`core/engagement/client/binding.ts`) : l'action, la traduction du code
 * d'erreur et les messages sont les seuls éléments propres au domaine.
 */
import { actions } from "astro:actions";
import { toast } from "@atoms/toast";
import { getServiceErrorMessage } from "@/modules/services/i18n";
import {
  bindEngagementFavorite,
  bindEngagementReactions,
} from "@/core/engagement/client/binding";

export function initServiceEngagementBar(): void {
  for (const bar of document.querySelectorAll<HTMLElement>("[data-service-reaction-bar]")) {
    const serviceId = bar.dataset.serviceId;
    if (!serviceId) continue;
    const locale = bar.dataset.locale ?? "fr";

    // Le service traduit ses propres codes d'erreur ; le blog et les voyages
    // se contentent du message renvoyé par l'action.
    const fail = (error: { code?: string; message?: string } | undefined, fallback: string): void => {
      toast.error((error && getServiceErrorMessage(locale, error.code)) || error?.message || fallback);
    };

    bindEngagementReactions(bar, {
      toggle: (reaction) => actions.toggleServiceReaction({ serviceId, reactionType: reaction }),
      errorText: bar.dataset.tError ?? "",
      updatedText: bar.dataset.tUpdated ?? "",
      onError: fail,
      onSuccess: (message) => toast.success(message),
    });

    bindEngagementFavorite(bar, {
      toggle: () => actions.toggleServiceFavorite({ serviceId }),
      errorText: bar.dataset.tError ?? "",
      onError: fail,
      onSuccess: () => toast.success(bar.dataset.tUpdated ?? ""),
    });
  }
}
