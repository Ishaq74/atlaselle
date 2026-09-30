/**
 * Soumission des formulaires d'engagement du blog.
 *
 * Le markup vient des atomes partagés ; la mécanique de soumission vient de
 * `core/engagement/client/form.ts`. Seules les actions et la traduction des
 * erreurs sont propres au blog.
 */
import { actions } from "astro:actions";
import { toast } from "@atoms/toast";
import { bindEngagementForm } from "@/core/engagement/client/form";

export function initBlogEngagementForms(): void {
  const fail = (error: { message?: string } | undefined, fallback: string): void => {
    toast.error(error?.message ?? fallback);
  };

  bindEngagementForm({
    selector: "#review-form",
    buildPayload: (data) => ({
      postId: String(data.get("postId") ?? ""),
      rating: Number(data.get("rating") ?? "5"),
      title: String(data.get("title") ?? ""),
      content: String(data.get("content") ?? "").trim(),
      isRecommended: data.get("isRecommended") === "true",
    }),
    submit: (payload) => actions.createBlogReview(payload),
    onError: fail,
    onSuccess: (message) => toast.success(message),
    defaultError: "Error",
  });

  bindEngagementForm({
    selector: "#comment-form",
    buildPayload: (data) => ({
      postId: String(data.get("postId") ?? ""),
      content: String(data.get("content") ?? "").trim(),
      parentId: data.get("parentId") ? String(data.get("parentId")) : undefined,
      guestName: data.get("guestName") ? String(data.get("guestName")) : undefined,
      guestEmail: data.get("guestEmail") ? String(data.get("guestEmail")) : undefined,
    }),
    submit: (payload) => actions.createBlogComment(payload),
    onError: fail,
    onSuccess: (message) => toast.success(message),
    defaultError: "Error",
  });
}
