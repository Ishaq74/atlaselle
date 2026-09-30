/**
 * Back-office voyage : contenus éditoriaux (points forts, inclus, exclusions).
 *
 * Chaque mutation recharge la page : les listes sont rendues côté serveur et
 * portent un `expectedUpdatedAt` pour l'optimisme — un rechargement garantit
 * que l'affichage reflète l'état réel en base.
 */
import { actions } from "astro:actions";
import type { Locale } from "@i18n/config";
import { toast } from "@atoms/toast";
import { confirmAdminAction } from "@/core/admin";

type ContentKind = "highlight" | "inclusion" | "exclusion";

/** Transforme une entrée de FormData : chaîne vide → null (champ optionnel). */
const optional = (value: FormDataEntryValue | null): string | null => {
  const text = String(value ?? "");
  return text === "" ? null : text;
};

export function initAdminContentsSection(): void {
  const root = document.querySelector<HTMLElement>("[data-trip-contents]");
  if (!root || root.dataset.bound === "true") return;
  root.dataset.bound = "true";

  const tripId = root.dataset.tripId ?? "";
  const labels = root.querySelector<HTMLElement>("[data-contents-i18n]");

  const fail = (message: string | null | undefined): void => {
    toast.error(message ?? labels?.dataset.error ?? "");
  };

  // ── Ajout ────────────────────────────────────────────────────────────────
  root.querySelectorAll<HTMLFormElement>("[data-content-add]").forEach((form) => {
    if (form.dataset.bound === "true") return;
    form.dataset.bound = "true";

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const kind = form.getAttribute("data-content-add") as ContentKind;
      const { error } = await actions.createTripContent({ tripId, kind, sortOrder: 0 });
      if (error) fail(error.message);
      else window.location.reload();
    });
  });

  // ── Suppression ──────────────────────────────────────────────────────────
  root.querySelectorAll<HTMLButtonElement>("[data-content-delete]").forEach((button) => {
    if (button.dataset.bound === "true") return;
    button.dataset.bound = "true";

    button.addEventListener("click", async () => {
      const row = button.closest<HTMLElement>("[data-content-id]");
      const id = row?.dataset.contentId ?? "";
      if (!id) return;
      const kind = (row?.dataset.kind ?? "highlight") as ContentKind;

      const confirmed = await confirmAdminAction({
        title: button.dataset.confirm ?? "",
        message: button.dataset.confirm ?? "",
        confirmLabel: labels?.dataset.confirmLabel ?? "OK",
        cancelLabel: labels?.dataset.cancelLabel ?? "",
      });
      if (!confirmed) return;

      const { error } = await actions.deleteTripContent({ kind, id });
      if (error) fail(error.message);
      else window.location.reload();
    });
  });

  // ── Traduction ───────────────────────────────────────────────────────────
  root.querySelectorAll<HTMLFormElement>("[data-content-tr]").forEach((form) => {
    if (form.dataset.bound === "true") return;
    form.dataset.bound = "true";

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const data = new FormData(form);
      const kind = (form.getAttribute("data-kind") ?? "highlight") as ContentKind;
      const { error } = await actions.upsertTripContentTranslation({
        kind,
        id: form.getAttribute("data-id") ?? "",
        expectedUpdatedAt: String(data.get("expectedUpdatedAt") ?? "") || null,
        locale: (form.getAttribute("data-locale") ?? "en") as Locale,
        title: optional(data.get("title")) ?? undefined,
        description: optional(data.get("description")) ?? undefined,
        text: optional(data.get("text")) ?? undefined,
      });
      if (error) fail(error.message);
      else window.location.reload();
    });
  });
}
