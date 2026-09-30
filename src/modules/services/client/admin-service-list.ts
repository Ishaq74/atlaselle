/**
 * Back-office services : actions de ligne sur la liste des prestations.
 *
 * `delete` et `archive` demandent une confirmation ; le bouton est désactivé
 * pendant l'appel pour empêcher le double clic, et réactivé si l'action échoue
 * ou si elle lève — sans quoi la ligne resterait bloquée après une erreur
 * réseau.
 */
import { actions } from "astro:actions";
import { toast } from "@atoms/toast";
import { getServiceErrorMessage } from "@/modules/services/i18n";
import { confirmAdminAction } from "@/core/admin";

/** Action de ligne et appel correspondant. `null` si l'action est inconnue. */
function runServiceAction(
  id: string,
  action: string,
): Promise<{ error?: { code?: string } } | null> {
  switch (action) {
    case "publish":
      return actions.publishService({ id });
    case "unpublish":
      return actions.unpublishService({ id });
    case "archive":
      return actions.archiveService({ id });
    case "restore":
      return actions.restoreService({ id });
    case "delete":
      return actions.deleteService({ id });
    case "duplicate":
      return actions.duplicateService({ id });
    default:
      return Promise.resolve(null);
  }
}

export function initAdminServiceList(): void {
  for (const root of document.querySelectorAll<HTMLElement>("[data-service-admin-root]")) {
    if (root.dataset.bound === "true") continue;
    root.dataset.bound = "true";

    const confirmDelete = root.dataset.confirmDelete ?? "";
    const confirmArchive = root.dataset.confirmArchive ?? "";
    const actionError = root.dataset.actionError ?? "";
    const locale = root.dataset.locale ?? "fr";

    const ask = (message: string): Promise<boolean> =>
      confirmAdminAction({
        title: message,
        message,
        confirmLabel: root.dataset.confirmLabel || "OK",
        cancelLabel: root.dataset.cancelLabel || "",
      });

    root.querySelectorAll<HTMLButtonElement>(".service-row-action").forEach((button) => {
      button.addEventListener("click", async () => {
        const action = button.dataset.action ?? "";
        const id = button.dataset.id;
        if (!id) return;

        const destructive = action === "delete" || action === "archive";
        if (destructive) {
          const confirmed = await ask(action === "delete" ? confirmDelete : confirmArchive);
          if (!confirmed) return;
        }

        button.disabled = true;
        try {
          const result = await runServiceAction(id, action);
          if (result?.error) {
            toast.error(getServiceErrorMessage(locale, result.error.code));
            button.disabled = false;
            return;
          }
          window.location.reload();
        } catch {
          button.disabled = false;
          toast.error(actionError);
        }
      });
    });
  }
}
