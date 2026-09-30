/**
 * Soumission des formulaires d'engagement d'un voyage.
 *
 * La mécanique est partagée (`core/engagement/client/form.ts`) ; seules les
 * actions du domaine voyage sont propres ici.
 */
import { actions } from "astro:actions";
import { toast } from "@atoms/toast";
import { bindEngagementForm } from "@/core/engagement/client/form";

export function initTripEngagementForms(): void {
  const fail = (error: { message?: string } | undefined, fallback: string): void => {
    toast.error(error?.message ?? fallback);
  };

  bindEngagementForm({
    selector: "#trip-review-form",
    buildPayload: (data) => ({
      tripId: String(data.get("tripId") ?? ""),
      rating: Number(data.get("rating")),
      title: String(data.get("title") ?? ""),
      content: String(data.get("content") ?? ""),
      isRecommended: data.get("isRecommended") === "true",
    }),
    submit: (payload) => actions.createTripReview(payload),
    onError: fail,
    onSuccess: (message) => toast.success(message),
  });

  bindEngagementForm({
    selector: "#trip-comment-form",
    buildPayload: (data) => ({
      tripId: String(data.get("tripId") ?? ""),
      content: String(data.get("content") ?? ""),
    }),
    submit: (payload) => actions.createTripComment(payload),
    onError: fail,
    onSuccess: (message) => toast.success(message),
  });
}
