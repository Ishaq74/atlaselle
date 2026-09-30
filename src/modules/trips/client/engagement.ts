/**
 * Branchement des actions voyages sur les atomes d'engagement partagés.
 *
 * Isolé du composant pour qu'il reste un simple chef d'orchestre. Les
 * sélecteurs proviennent du CONTRAT émis par les atomes de
 * `components/molecules/Engagement` : les écrire ailleurs produirait des
 * gestionnaires qui n'écoutent jamais rien.
 */
import { actions } from "astro:actions";
import { toast } from "@atoms/toast";

function initTripEngagement(root: HTMLElement): void {
  // Garde `data-bound` : sans elle, les gestionnaires se doublent à chaque
  // swap de vue et un clic déclenche deux requêtes.
  if (root.dataset.bound === "true") return;
  root.dataset.bound = "true";

  const tripId = root.dataset.tripId;
  if (!tripId) return;
  const label = (key: "error" | "success" | "pending"): string =>
    root.dataset[key === "error" ? "tError" : key === "success" ? "tSuccess" : "tPending"] ?? "";

  // ── Vote « utile » ───────────────────────────────────────────────────────
  root.querySelectorAll<HTMLButtonElement>("[data-engagement-helpful]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const reviewId = btn.dataset.engagementHelpful;
      if (!reviewId) return;
      const isHelpful = btn.dataset.value !== "true";
      const { error } = await actions.voteTripReviewHelpful({ reviewId, isHelpful });
      if (error) {
        toast.error(error.message ?? label("error"));
        return;
      }
      btn.dataset.value = String(isHelpful);
      btn.setAttribute("aria-pressed", String(isHelpful));
      // Le libellé est dans un span ; le compteur dans un <bdi> encapsulé.
      const btnLabel = btn.querySelector("[data-engagement-helpful-label]");
      if (btnLabel) {
        btnLabel.textContent = isHelpful ? btn.dataset.unmarkLabel ?? "" : btn.dataset.markLabel ?? "";
      }
      const counter = root.querySelector<HTMLElement>(
        `[data-helpful-count="${CSS.escape(reviewId)}"] bdi`,
      );
      if (counter && typeof btn.dataset.count === "string") {
        const next = Number(btn.dataset.count) + (isHelpful ? 1 : -1);
        btn.dataset.count = String(next);
        counter.textContent = String(next);
      }
      toast.success(label("success"));
    });
  });

  // ── Signalement d'avis ───────────────────────────────────────────────────
  root.querySelectorAll<HTMLButtonElement>("[data-engagement-report-review]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const reviewId = btn.dataset.engagementReportReview;
      if (!reviewId) return;
      btn.disabled = true;
      const { error } = await actions.createTripReport({ tripId, reviewId, reason: "OTHER" });
      btn.disabled = false;
      if (error) toast.error(error.message ?? label("error"));
      else toast.success(label("success"));
    });
  });

  // ── Formulaire d'avis ────────────────────────────────────────────────────
  // Les atomes exposent leurs textes via `data-t-error` / `data-t-submitted` sur
  // le <form> et ne rendent aucun élément de statut : le retour passe par le
  // toast, comme sur le blog et les services.
  const reviewForm = root.querySelector<HTMLFormElement>("#trip-review-form");
  reviewForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const submit = reviewForm.querySelector<HTMLButtonElement>('button[type="submit"]');
    if (submit) submit.disabled = true;
    const data = new FormData(reviewForm);
    const { error } = await actions.createTripReview({
      tripId,
      rating: Number(data.get("rating")),
      title: String(data.get("title") ?? ""),
      content: String(data.get("content") ?? ""),
      isRecommended: data.get("isRecommended") === "true",
    });
    if (submit) submit.disabled = false;
    if (error) toast.error(error.message ?? reviewForm.dataset.tError ?? "");
    else {
      toast.success(reviewForm.dataset.tSubmitted ?? label("success"));
      reviewForm.reset();
    }
  });

  // ── Formulaire de question ───────────────────────────────────────────────
  const commentForm = root.querySelector<HTMLFormElement>("#trip-comment-form");
  commentForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const submit = commentForm.querySelector<HTMLButtonElement>('button[type="submit"]');
    if (submit) submit.disabled = true;
    const data = new FormData(commentForm);
    const { error } = await actions.createTripComment({
      tripId,
      content: String(data.get("content") ?? ""),
    });
    if (submit) submit.disabled = false;
    if (error) toast.error(error.message ?? commentForm.dataset.tError ?? "");
    else {
      toast.success(commentForm.dataset.tSubmitted ?? label("success"));
      commentForm.reset();
    }
  });
}

export function bindTripEngagement(): void {
  document.querySelectorAll<HTMLElement>("[data-trip-engagement]").forEach(initTripEngagement);
}
