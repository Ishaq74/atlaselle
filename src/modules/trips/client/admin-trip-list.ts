/**
 * Back-office voyage : liste des voyages.
 *
 * Deux comportements : les filtres de la liste se soumettent automatiquement
 * (pas de bouton à cliquer) et le formulaire de création redirige vers la
 * fiche du voyage créé.
 */
import { actions } from "astro:actions";
import { toast } from "@atoms/toast";

export function initAdminTripList(): void {
  // Filtres : `requestSubmit` et non un submit manuel, pour que la validation
  // native du formulaire s'applique.
  document
    .querySelectorAll<HTMLSelectElement>("form[data-admin-filters] select[data-autosubmit]")
    .forEach((select) => {
      if (select.dataset.bound === "true") return;
      select.dataset.bound = "true";
      select.addEventListener("change", () => select.form?.requestSubmit());
    });

  const form = document.querySelector<HTMLFormElement>("[data-trip-create]");
  if (!form || form.dataset.bound === "true") return;
  form.dataset.bound = "true";

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const message = form.querySelector<HTMLElement>("[data-form-message]");

    const { data: result, error } = await actions.createTrip({
      countryCode: String(data.get("countryCode") ?? "FR").toUpperCase(),
      durationDays: Number(data.get("durationDays")),
      durationNights: Number(data.get("durationNights")),
      groupMin: Number(data.get("groupMin")),
      groupMax: Number(data.get("groupMax")),
    });

    if (error || !result) {
      const text = error?.message ?? "Error";
      if (message) message.textContent = text;
      toast.error(text);
      return;
    }

    window.location.href = `${window.location.pathname}/${result.id}`;
  });
}
