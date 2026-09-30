/**
 * Soumission des formulaires d'engagement d'une prestation.
 *
 * La mécanique est partagée (`core/engagement/client/form.ts`) ; seules les
 * actions et la traduction des codes d'erreur sont propres aux services.
 */
import { actions } from "astro:actions";
import { toast } from "@atoms/toast";
import { getServiceErrorMessage } from "@/modules/services/i18n";
import { bindEngagementForm } from "@/core/engagement/client/form";

export function initServiceEngagementForms(): void {
  // La langue du formulaire est portée par la section qui l'enveloppe ; à
  // défaut le français, comme partout ailleurs dans le module.
  const locale = document.documentElement.lang || "fr";

  // L'identifiant vient d'un attribut porté par la section, et non d'un
  // `querySelector` global : la page peut porter plusieurs blocs, et le
  // formulaire ne doit pas écrire dans le mauvais service.
  const serviceId = (): string =>
    document.querySelector<HTMLElement>("[data-service-engagement]")?.dataset.serviceId ?? "";

  const fail = (error: { code?: string; message?: string } | undefined, fallback: string): void => {
    toast.error((error && getServiceErrorMessage(locale, error.code)) || error?.message || fallback);
  };

  bindEngagementForm({
    selector: "#service-review-form",
    buildPayload: (data) => ({
      serviceId: serviceId(),
      rating: Number(data.get("rating")),
      // Le titre est rendu par l'atome et accepté par l'action : sans cette
      // ligne, ce que l'utilisateur saisit était perdu.
      title: String(data.get("title") ?? "").trim() || undefined,
      content: String(data.get("content") ?? ""),
      isRecommended: data.get("isRecommended") === "true",
    }),
    submit: (payload) => actions.createServiceReview(payload),
    onError: fail,
    onSuccess: (message) => toast.success(message),
  });

  bindEngagementForm({
    selector: "#service-comment-form",
    buildPayload: (data) => ({
      serviceId: serviceId(),
      content: String(data.get("content") ?? ""),
    }),
    submit: (payload) => actions.createServiceComment(payload),
    onError: fail,
    onSuccess: (message) => toast.success(message),
  });
}
