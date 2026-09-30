/**
 * Barre de réactions d'un voyage.
 *
 * La mécanique est celle du blog et des services
 * (`core/engagement/client/binding.ts`) ; seule l'action diffère. Un voyage a
 * en plus un favori, que le blog n'a pas.
 */
import { actions } from "astro:actions";
import { toast } from "@atoms/toast";
import {
  bindEngagementFavorite,
  bindEngagementReactions,
} from "@/core/engagement/client/binding";

export function bindTripEngagementBar(): void {
  for (const bar of document.querySelectorAll<HTMLElement>("[data-trip-reaction-bar]")) {
    const tripId = bar.dataset.tripId;
    if (!tripId) continue;

    bindEngagementReactions(bar, {
      toggle: (reaction) => actions.toggleTripReaction({ tripId, reactionType: reaction }),
      errorText: bar.dataset.tError ?? "",
      updatedText: bar.dataset.tUpdated ?? "",
      onError: (error, fallback) => toast.error(error?.message ?? fallback),
      onSuccess: (message) => toast.success(message),
    });

    bindEngagementFavorite(bar, {
      toggle: () => actions.toggleTripFavorite({ tripId }),
      errorText: bar.dataset.tError ?? "",
      onError: (error, fallback) => toast.error(error?.message ?? fallback),
      onSuccess: () => toast.success(bar.dataset.tUpdated ?? ""),
    });
  }
}
