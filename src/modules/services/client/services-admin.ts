/**
 * Back-office services : taxonomie (catégories, tags) et modération.
 *
 * Chaque mutation recharge la page : les listes sont rendues côté serveur. Les
 * erreurs sont affichées dans un statut global (`data-service-admin-status`)
 * pour les actions de modération, et en ligne du formulaire pour la création
 * d'un terme de taxonomie.
 */
import { actions } from "astro:actions";
import type { Locale } from "@i18n/config";
import { getServiceErrorMessage } from "@/modules/services/i18n";
import { confirmAdminAction } from "@/core/admin";

type ModerationStatus = "APPROVED" | "REJECTED" | "SPAM";

export function initServicesAdminPage(): void {
  for (const root of document.querySelectorAll<HTMLElement>("[data-services-admin-workspace]")) {
    if (root.dataset.bound === "true") continue;
    root.dataset.bound = "true";

    const locale = (root.dataset.locale ?? "fr") as Locale;
    const confirmTaxonomyDelete = root.dataset.confirmTaxonomyDelete ?? "";
    const status = root.querySelector<HTMLElement>("[data-service-admin-status]");

    const refresh = (): void => {
      window.location.reload();
    };

    const showError = (error: { code?: string } | undefined): void => {
      if (status) status.textContent = getServiceErrorMessage(locale, error?.code);
    };

    const confirmDelete = (message: string): Promise<boolean> =>
      confirmAdminAction({
        title: message,
        message,
        confirmLabel: root.dataset.confirmLabel || "OK",
        cancelLabel: root.dataset.cancelLabel || "",
      });

    /** Lie un formulaire de création, avec son message d'erreur en ligne. */
    const bindCreate = (
      selector: string,
      run: (form: HTMLFormElement, data: FormData) => Promise<{ error?: { code?: string } }>,
      statusSelector: string,
    ): void => {
      const form = root.querySelector<HTMLFormElement>(selector);
      if (!form) return;
      form.addEventListener("submit", async (event) => {
        event.preventDefault();
        const data = new FormData(form);
        const { error } = await run(form, data);
        const inline = form.querySelector<HTMLElement>(statusSelector);
        if (inline) {
          inline.textContent = error ? getServiceErrorMessage(locale, error.code) : "";
        }
        if (!error) refresh();
      });
    };

    const bindUpdate = (
      selector: string,
      run: (form: HTMLFormElement, data: FormData) => Promise<{ error?: { code?: string } }>,
    ): void => {
      root.querySelectorAll<HTMLFormElement>(selector).forEach((form) => {
        form.addEventListener("submit", async (event) => {
          event.preventDefault();
          const data = new FormData(form);
          const { error } = await run(form, data);
          if (error) showError(error);
          else refresh();
        });
      });
    };

    const bindDelete = (selector: string, run: (id: string) => Promise<{ error?: { code?: string } }>): void => {
      root.querySelectorAll<HTMLButtonElement>(selector).forEach((button) => {
        button.addEventListener("click", async () => {
          const form = button.closest<HTMLFormElement>("form");
          const id = form?.dataset.id;
          if (!form || !id) return;
          if (!(await confirmDelete(confirmTaxonomyDelete))) return;
          const { error } = await run(id);
          if (error) showError(error);
          else refresh();
        });
      });
    };

    // ── Catégories ──────────────────────────────────────────────────────────
    bindCreate(
      "[data-service-category-create]",
      (_form, data) =>
        actions.createServiceCategory({
          locale,
          name: String(data.get("name")),
          slug: String(data.get("slug")),
          parentId: String(data.get("parentId") || "") || null,
          sortOrder: 0,
        }),
      "[data-category-status]",
    );

    bindUpdate("[data-service-category-update]", (form, data) =>
      actions.updateServiceCategory({
        id: form.dataset.id!,
        locale,
        name: String(data.get("name")),
        slug: String(data.get("slug")),
        parentId: String(data.get("parentId") || "") || null,
        sortOrder: 0,
      }),
    );

    bindDelete("[data-category-delete]", (id) => actions.deleteServiceCategory({ id }));

    // ── Tags ────────────────────────────────────────────────────────────────
    bindCreate(
      "[data-service-tag-create]",
      (_form, data) =>
        actions.createServiceTag({
          locale,
          name: String(data.get("name")),
          slug: String(data.get("slug")),
        }),
      "[data-tag-status]",
    );

    bindUpdate("[data-service-tag-update]", (form, data) =>
      actions.updateServiceTag({
        id: form.dataset.id!,
        locale,
        name: String(data.get("name")),
        slug: String(data.get("slug") || ""),
      }),
    );

    bindDelete("[data-tag-delete]", (id) => actions.deleteServiceTag({ id }));

    // ── Modération ──────────────────────────────────────────────────────────
    root.querySelectorAll<HTMLButtonElement>("[data-moderate-review]").forEach((button) => {
      button.addEventListener("click", async () => {
        const { error } = await actions.moderateServiceReview({
          id: button.dataset.id!,
          serviceId: button.dataset.serviceId!,
          status: button.dataset.moderateReview as ModerationStatus,
        });
        if (error) showError(error);
        else refresh();
      });
    });

    root.querySelectorAll<HTMLButtonElement>("[data-moderate-comment]").forEach((button) => {
      button.addEventListener("click", async () => {
        const { error } = await actions.moderateServiceComment({
          id: button.dataset.id!,
          serviceId: button.dataset.serviceId!,
          status: button.dataset.moderateComment as ModerationStatus | "TRASH",
        });
        if (error) showError(error);
        else refresh();
      });
    });

    root.querySelectorAll<HTMLButtonElement>("[data-resolve-report]").forEach((button) => {
      button.addEventListener("click", async () => {
        const { error } = await actions.resolveServiceReport({
          id: button.dataset.id!,
          serviceId: button.dataset.serviceId!,
          status: button.dataset.resolveReport as "REVIEWED" | "RESOLVED" | "REJECTED",
        });
        if (error) showError(error);
        else refresh();
      });
    });
  }
}
