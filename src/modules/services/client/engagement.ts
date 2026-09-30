/**
 * Engagement d'une prestation : votes « utile » et signalements.
 *
 * Les réactions et le favori sont branchés par `engagement-bar.ts`, sur le
 * modèle du blog et des voyages. Ce module ne couvre que ce qui est porté par
 * les cartes d'avis et de commentaires.
 *
 * Il lisait auparavant les réactions et le favori en plus — avec l'ancienne
 * mécanique qui basculait des classes Tailwind inexistantes, donc sans effet
 * visible. Cette doublon est supprimé.
 */
import { actions } from "astro:actions";
import { toast } from "@atoms/toast";
import { getServiceErrorMessage } from "@/modules/services/i18n";

export function bindServiceEngagement(): void {
  for (const root of document.querySelectorAll<HTMLElement>("[data-service-engagement]")) {
    if (root.dataset.bound === "true") continue;
    root.dataset.bound = "true";

    const serviceId = root.dataset.serviceId;
    if (!serviceId) continue;
    const locale = root.dataset.locale ?? "fr";
    const status = root.querySelector<HTMLElement>("[data-service-engagement-status]");

    const fail = (error: { code?: string; message?: string } | undefined, fallback: string): void => {
      const message =
        (error && getServiceErrorMessage(locale, error.code)) || error?.message || fallback;
      if (status) status.textContent = message;
      if (error) toast.error(message);
    };

    // ── Vote « utile » sur un avis ─────────────────────────────────────────
    root.querySelectorAll<HTMLButtonElement>("[data-engagement-helpful]").forEach((button) => {
      button.addEventListener("click", async () => {
        const reviewId = button.dataset.engagementHelpful;
        if (!reviewId) return;
        const isHelpful = button.dataset.value !== "true";

        button.disabled = true;
        const { error, data } = await actions.voteServiceReviewHelpful({
          serviceId,
          reviewId,
          isHelpful,
        });
        button.disabled = false;

        if (error) {
          fail(error, root.dataset.errorLabel ?? "");
          return;
        }

        button.dataset.value = String(isHelpful);
        button.setAttribute("aria-pressed", String(isHelpful));

        // Le libellé est dans un span, le compteur dans un <bdi> encapsulé :
        // viser le parent écraserait l'un ou l'autre.
        const btnLabel = button.querySelector("[data-engagement-helpful-label]");
        if (btnLabel) {
          btnLabel.textContent = isHelpful
            ? (root.dataset.helpfulUnmarkLabel ?? "")
            : (root.dataset.helpfulMarkLabel ?? "");
        }
        const counter = root.querySelector<HTMLElement>(
          `[data-helpful-count="${CSS.escape(reviewId)}"] bdi`,
        );
        if (counter) counter.textContent = String(data?.helpfulCount ?? 0);
      });
    });

    // ── Signalements ───────────────────────────────────────────────────────
    // Avis et commentaires visent la même action mais deux tables distinctes.
    const targets: [
      string,
      (button: HTMLButtonElement) => { reviewId?: string; commentId?: string },
    ][] = [
      ["[data-engagement-report-review]", (b) => ({ reviewId: b.dataset.engagementReportReview })],
      ["[data-engagement-report-comment]", (b) => ({ commentId: b.dataset.engagementReportComment })],
    ];

    for (const [selector, pick] of targets) {
      root.querySelectorAll<HTMLButtonElement>(selector).forEach((button) => {
        button.addEventListener("click", async () => {
          const target = pick(button);
          if (!target.reviewId && !target.commentId) return;

          button.disabled = true;
          const { error } = await actions.createServiceReport({
            serviceId,
            ...target,
            reason: "OTHER",
          });
          button.disabled = false;

          if (error) fail(error, root.dataset.errorLabel ?? "");
          else {
            const message = root.dataset.successLabel ?? "";
            if (status) status.textContent = message;
            toast.success(message);
          }
        });
      });
    }
  }
}
