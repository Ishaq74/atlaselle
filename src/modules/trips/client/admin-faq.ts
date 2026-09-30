/**
 * Back-office voyage : gestion de la FAQ (traductions, liens, création,
 * suppression).
 *
 * Chaque mutation recharge la page : la FAQ est rendue côté serveur et porte
 * un `expectedUpdatedAt` pour l'optimisme.
 */
import { actions } from "astro:actions";
import type { Locale } from "@i18n/config";
import { toast } from "@atoms/toast";
import { confirmAdminAction } from "@/core/admin";

export function initAdminFaqSection(): void {
  const root = document.querySelector<HTMLElement>("[data-trip-faq]");
  if (!root || root.dataset.bound === "true") return;
  root.dataset.bound = "true";

  const tripId = root.dataset.tripId ?? "";
  const labels = root.querySelector<HTMLElement>("[data-faq-i18n]");

  const fail = (message: string | null | undefined): void => {
    toast.error(message ?? labels?.dataset.error ?? "");
  };

  const ask = async (message: string): Promise<boolean> =>
    confirmAdminAction({
      title: message,
      message,
      confirmLabel: labels?.dataset.confirmLabel ?? "OK",
      cancelLabel: labels?.dataset.cancelLabel ?? "",
    });

  // ── Traductions ──────────────────────────────────────────────────────────
  root.querySelectorAll<HTMLFormElement>("[data-faq-tr]").forEach((form) => {
    if (form.dataset.bound === "true") return;
    form.dataset.bound = "true";

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const data = new FormData(form);
      const { error } = await actions.upsertFaqTranslation({
        faqId: form.getAttribute("data-id") ?? "",
        expectedUpdatedAt: String(data.get("expectedUpdatedAt") ?? "") || null,
        locale: (form.getAttribute("data-locale") ?? "en") as Locale,
        question: String(data.get("question") ?? ""),
        answer: String(data.get("answer") ?? ""),
      });
      if (error) fail(error.message);
      else window.location.reload();
    });
  });

  // ── Détachement d'une FAQ du voyage ──────────────────────────────────────
  root.querySelectorAll<HTMLButtonElement>("[data-faq-unlink]").forEach((button) => {
    if (button.dataset.bound === "true") return;
    button.dataset.bound = "true";

    button.addEventListener("click", async () => {
      const faqId = button.closest<HTMLElement>("[data-faq-id]")?.dataset.faqId ?? "";
      if (!faqId) return;
      const message = button.dataset.confirm ?? "";
      if (message && !(await ask(message))) return;
      const { error } = await actions.unlinkFaqFromTrip({ tripId, faqId });
      if (error) fail(error.message);
      else window.location.reload();
    });
  });

  // ── Suppression d'une FAQ ────────────────────────────────────────────────
  root.querySelectorAll<HTMLButtonElement>("[data-faq-delete]").forEach((button) => {
    if (button.dataset.bound === "true") return;
    button.dataset.bound = "true";

    button.addEventListener("click", async () => {
      const id = button.closest<HTMLElement>("[data-faq-id]")?.dataset.faqId ?? "";
      if (!id) return;
      const message = button.dataset.confirm ?? "";
      if (message && !(await ask(message))) return;
      const { error } = await actions.deleteFaq({ id });
      if (error) fail(error.message);
      else window.location.reload();
    });
  });

  // ── Liaison d'une FAQ existante ──────────────────────────────────────────
  const linkForm = root.querySelector<HTMLFormElement>("[data-faq-link]");
  if (linkForm && linkForm.dataset.bound !== "true") {
    linkForm.dataset.bound = "true";
    linkForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const data = new FormData(linkForm);
      const { error } = await actions.linkFaqToTrip({
        tripId,
        faqId: String(data.get("faqId") ?? ""),
      });
      if (error) fail(error.message);
      else {
        toast.success(labels?.dataset.linked ?? "");
        window.location.reload();
      }
    });
  }

  // ── Création d'une FAQ ───────────────────────────────────────────────────
  const createForm = root.querySelector<HTMLFormElement>("[data-faq-create]");
  if (createForm && createForm.dataset.bound !== "true") {
    createForm.dataset.bound = "true";
    createForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const data = new FormData(createForm);
      const { error } = await actions.createFaq({
        tripId,
        locale: String(data.get("locale") ?? "en") as Locale,
        question: String(data.get("question") ?? ""),
        answer: String(data.get("answer") ?? ""),
      });
      if (error) fail(error.message);
      else window.location.reload();
    });
  }
}
