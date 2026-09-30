/**
 * Back-office services : formulaire d'édition d'une prestation.
 *
 * Couvre le cycle de vie complet d'une fiche : contenu et SEO, taxonomie,
 * médias, disponibilités, verrou de并发 édition, historique des révisions.
 *
 * Deux points méritent explication :
 *
 * - le verrou est rafraîchi toutes les 60 s et relâché sur `pagehide`. Sans
 *   ce déverrouillage, fermer l'onglet laisserait la fiche verrouillée par un
 *   éditeur qui n'edite plus ;
 * - les révisions sont rendues par `innerHTML`, donc chaque valeur issue de la
 *   base passe par `escapeHtml` — un titre de révision contenant `<` casserait
 *   le DOM, et une valeur contenant une balise deviendrait du XSS.
 */
import { actions } from "astro:actions";
import { slugify } from "@/core/content/text";
import { getServiceErrorMessage } from "@/modules/services/i18n";
import { confirmAdminAction } from "@/core/admin";

interface ActionLabels {
  confirmDelete: string;
  confirmArchive: string;
  saved: string;
  confirmLabel?: string;
  cancelLabel?: string;
}

/** Échappe une valeur destinée à être injectée en `innerHTML`. */
const escapeHtml = (value: string): string =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

export function initAdminServiceForm(): void {
  for (const root of document.querySelectorAll<HTMLElement>("[data-service-root]")) {
    if (root.dataset.bound === "true") continue;
    root.dataset.bound = "true";

    const form = root.querySelector<HTMLFormElement>("form[data-service-form]");
    if (!form) continue;

    const serviceId = root.dataset.serviceId || null;
    const locale = root.dataset.locale || "fr";
    const labels = JSON.parse(root.dataset.actionLabels || "{}") as ActionLabels;
    const status = root.querySelector<HTMLElement>("[data-status]");

    const ask = (message: string): Promise<boolean> =>
      confirmAdminAction({
        title: message,
        message,
        confirmLabel: labels.confirmLabel ?? "OK",
        cancelLabel: labels.cancelLabel ?? "",
      });

    const errorText = (result: { error?: { code?: string } }): string =>
      result.error ? getServiceErrorMessage(locale, result.error.code) : "";

    const selectedValues = (name: string): string[] =>
      Array.from(form.querySelectorAll<HTMLInputElement>(`input[name="${name}"]:checked`)).map(
        (input) => input.value,
      );

    const value = (data: FormData, key: string): string | null =>
      String(data.get(key) || "") || null;

    const numberOrNull = (data: FormData, key: string): number | null =>
      data.get(key) ? Number(data.get(key)) : null;

    // ── Slug automatique ───────────────────────────────────────────────────
    // Tant que l'utilisateur n'a pas saisi de slug lui-même, il suit le titre.
    // Dès qu'il en saisit un, le champ n'est plus écrasé.
    const slugInput = form.querySelector<HTMLInputElement>('input[name="slug"]');
    const titleInput = form.querySelector<HTMLInputElement>('input[name="title"]');
    let slugManuallyEdited = Boolean(serviceId && slugInput?.value);

    titleInput?.addEventListener("input", () => {
      if (slugManuallyEdited || !slugInput) return;
      slugInput.value = slugify(titleInput.value);
    });
    slugInput?.addEventListener("input", () => {
      slugManuallyEdited = true;
    });
    root.querySelector<HTMLButtonElement>("[data-regenerate-slug]")?.addEventListener("click", () => {
      if (!slugInput || !titleInput) return;
      slugInput.value = slugify(titleInput.value);
      slugManuallyEdited = false;
    });

    // ── Recherche dans les listes de taxonomie ─────────────────────────────
    root.querySelectorAll<HTMLInputElement>("[data-taxonomy-search]").forEach((input) => {
      input.addEventListener("input", () => {
        const target = input.dataset.taxonomySearch || "";
        const query = input.value.trim().toLocaleLowerCase(locale);
        root
          .querySelectorAll<HTMLElement>(`[data-taxonomy-list="${target}"] [data-taxonomy-option]`)
          .forEach((option) => {
            option.hidden = !option.dataset.taxonomyOption
              ?.toLocaleLowerCase(locale)
              .includes(query);
          });
      });
    });

    const readPayload = () => {
      const data = new FormData(form);
      return {
        locale,
        title: String(data.get("title") || ""),
        slug: String(data.get("slug") || ""),
        excerpt: value(data, "excerpt"),
        content: String(data.get("content") || ""),
        coverImageId: value(data, "coverImageId"),
        ogImageId: value(data, "ogImageId"),
        priceMinor: numberOrNull(data, "priceMinor"),
        currency: value(data, "currency"),
        durationMinutes: numberOrNull(data, "durationMinutes"),
        maxParticipants: numberOrNull(data, "maxParticipants"),
        isMobile: form.querySelector<HTMLInputElement>('input[name="isMobile"]')?.checked ?? false,
        isFeatured:
          form.querySelector<HTMLInputElement>('input[name="isFeatured"]')?.checked ?? false,
        categoryIds: selectedValues("categoryIds"),
        tagIds: selectedValues("tagIds"),
        metaTitle: value(data, "metaTitle"),
        metaDescription: value(data, "metaDescription"),
        metaKeywords: value(data, "metaKeywords"),
        canonicalUrl: value(data, "canonicalUrl"),
        ogTitle: value(data, "ogTitle"),
        ogDescription: value(data, "ogDescription"),
        locationLabel: value(data, "locationLabel"),
        locationAddress: value(data, "locationAddress"),
        focusKeyword: value(data, "focusKeyword"),
      };
    };

    // ── Enregistrement ─────────────────────────────────────────────────────
    // `saving` empêche le double envoi : le bouton n'est pas désactivé pendant
    // la requête, deux submits rapides créeraient deux fiches.
    let saving = false;
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (saving) return;
      saving = true;

      const payload = readPayload();
      let result: { error?: { code?: string }; data?: { id?: string } };
      try {
        result = serviceId
          ? await actions.updateService({ ...payload, id: serviceId })
          : await actions.createService({ ...payload, status: "DRAFT", publishedAt: null });
      } catch {
        result = { error: { code: "INTERNAL_SERVER_ERROR" } };
      }
      saving = false;

      if (status) status.textContent = result.error ? errorText(result) : labels.saved;

      if (!result.error && result.data && "id" in result.data && !serviceId) {
        window.location.href = `${root.dataset.baseAdminUrl}/${result.data.id}/edit`;
      }
    });

    // ── Cycle de vie ───────────────────────────────────────────────────────
    const lifecycle = async (action: string): Promise<void> => {
      if (!serviceId) return;
      if (action === "delete" && !(await ask(labels.confirmDelete))) return;
      if (action === "archive" && !(await ask(labels.confirmArchive))) return;

      const result =
        action === "publish"
          ? await actions.publishService({ id: serviceId })
          : action === "unpublish"
            ? await actions.unpublishService({ id: serviceId })
            : action === "archive"
              ? await actions.archiveService({ id: serviceId })
              : action === "restore"
                ? await actions.restoreService({ id: serviceId })
                : action === "duplicate"
                  ? await actions.duplicateService({ id: serviceId })
                  : await actions.deleteService({ id: serviceId });

      if (status) status.textContent = result.error ? errorText(result) : labels.saved;

      if (!result.error && action === "duplicate" && result.data && "id" in result.data) {
        window.location.href = `${root.dataset.baseAdminUrl}/${result.data.id}/edit`;
      } else if (!result.error) {
        window.location.reload();
      }
    };

    root.querySelectorAll<HTMLButtonElement>("[data-lifecycle]").forEach((button) => {
      button.addEventListener("click", () => {
        void lifecycle(button.dataset.lifecycle || "");
      });
    });

    // ── Sélecteurs de média ────────────────────────────────────────────────
    const bindPicker = (pickerId: string, field: string, previewId: string): void => {
      document.getElementById(pickerId)?.addEventListener("media-select", (event) => {
        const detail = (event as CustomEvent).detail as { fileId?: string };
        const hidden = form.querySelector<HTMLInputElement>(`input[name="${field}"]`);
        const preview = document.getElementById(previewId) as HTMLInputElement | null;
        if (hidden) hidden.value = detail.fileId || "";
        if (preview) preview.value = detail.fileId || "";
      });
    };

    bindPicker("service-cover-picker", "coverImageId", "service-cover-preview");
    bindPicker("service-og-picker", "ogImageId", "service-og-preview");

    root.querySelectorAll<HTMLButtonElement>("[data-media-picker-trigger]").forEach((button) => {
      button.addEventListener("click", () => {
        const pickerId =
          button.dataset.mediaPickerTrigger === "cover"
            ? "service-cover-picker"
            : button.dataset.mediaPickerTrigger === "og"
              ? "service-og-picker"
              : "service-gallery-picker";
        document.getElementById(pickerId)?.dispatchEvent(new Event("open"));
      });
    });

    document.getElementById("service-gallery-picker")?.addEventListener("media-select", (event) => {
      if (!serviceId) return;
      const detail = (event as CustomEvent).detail as { fileId?: string; alt?: string };
      if (!detail.fileId) return;
      void actions
        .addServiceMedia({
          serviceId,
          mediaId: detail.fileId,
          kind: "GALLERY",
          altText: detail.alt || detail.fileId,
          caption: null,
          sortOrder: root.querySelectorAll("[data-media-item]").length,
        })
        .then((result) => {
          if (status) status.textContent = result.error ? errorText(result) : labels.saved;
          if (!result.error) window.location.reload();
        });
    });

    // ── Galerie ────────────────────────────────────────────────────────────
    root.querySelectorAll<HTMLElement>("[data-media-item]").forEach((item) => {
      const mediaId = item.dataset.mediaItem || "";

      item.querySelector<HTMLButtonElement>("[data-delete-media]")?.addEventListener("click", async () => {
        if (!serviceId || !(await ask(labels.confirmDelete))) return;
        const result = await actions.removeServiceMedia({ serviceId, mediaId });
        if (status) status.textContent = result.error ? errorText(result) : labels.saved;
        if (!result.error) window.location.reload();
      });

      item.querySelector<HTMLButtonElement>("[data-update-media]")?.addEventListener("click", async () => {
        if (!serviceId) return;
        const result = await actions.updateServiceMedia({
          serviceId,
          mediaId,
          kind: "GALLERY",
          altText: (item.querySelector("[data-alt]") as HTMLInputElement)?.value || "",
          caption: (item.querySelector("[data-caption]") as HTMLInputElement)?.value || null,
          sortOrder: Array.from(root.querySelectorAll<HTMLElement>("[data-media-item]")).indexOf(item),
        });
        if (status) status.textContent = result.error ? errorText(result) : labels.saved;
      });
    });

    // ── Disponibilités ─────────────────────────────────────────────────────
    root.querySelectorAll<HTMLElement>("[data-availability-item]").forEach((item) => {
      item.querySelector<HTMLButtonElement>("[data-update-availability]")?.addEventListener("click", async () => {
        const result = await actions.updateServiceAvailability({
          id: item.dataset.availabilityItem || "",
          serviceId: serviceId || "",
          dayOfWeek: Number((item.querySelector("[data-day]") as HTMLInputElement)?.value),
          startTime: (item.querySelector("[data-start]") as HTMLInputElement)?.value || "",
          endTime: (item.querySelector("[data-end]") as HTMLInputElement)?.value || "",
          timezone: (item.querySelector("[data-timezone]") as HTMLInputElement)?.value || "UTC",
        });
        if (status) status.textContent = result.error ? errorText(result) : labels.saved;
      });

      item.querySelector<HTMLButtonElement>("[data-delete-availability]")?.addEventListener("click", async () => {
        const result = await actions.deleteServiceAvailability({
          id: item.dataset.availabilityItem || "",
          serviceId: serviceId || "",
        });
        if (status) status.textContent = result.error ? errorText(result) : labels.saved;
        if (!result.error) window.location.reload();
      });
    });

    root.querySelector<HTMLButtonElement>("[data-add-availability]")?.addEventListener("click", async () => {
      if (!serviceId) return;
      const result = await actions.createServiceAvailability({
        serviceId,
        dayOfWeek: Number((root.querySelector("[data-new-day]") as HTMLInputElement)?.value),
        startTime: (root.querySelector("[data-new-start]") as HTMLInputElement)?.value || "",
        endTime: (root.querySelector("[data-new-end]") as HTMLInputElement)?.value || "",
        timezone: (root.querySelector("[data-new-timezone]") as HTMLInputElement)?.value || "UTC",
      });
      if (status) status.textContent = result.error ? errorText(result) : labels.saved;
      if (!result.error) window.location.reload();
    });

    // ── Verrou d'édition concurrente ───────────────────────────────────────
    root.querySelectorAll<HTMLButtonElement>("[data-lock]").forEach((button) => {
      button.addEventListener("click", async () => {
        if (!serviceId) return;
        const result =
          button.dataset.lock === "lock"
            ? await actions.lockService({ id: serviceId })
            : await actions.unlockService({ id: serviceId });
        const lockStatus = root.querySelector<HTMLElement>("[data-lock-status]");
        if (!lockStatus) return;
        lockStatus.textContent = result.error
          ? errorText(result)
          : button.dataset.lock === "lock"
            ? (root.dataset.lockLocked ?? "")
            : (root.dataset.lockUnlocked ?? "");
      });
    });

    if (serviceId) {
      const lockStatus = root.querySelector<HTMLElement>("[data-lock-status]");
      const refreshLock = async (): Promise<void> => {
        const result = await actions.lockService({ id: serviceId });
        if (lockStatus) {
          lockStatus.textContent = result.error ? errorText(result) : (root.dataset.lockLocked ?? "");
        }
      };
      void refreshLock();
      const handle = window.setInterval(() => void refreshLock(), 60_000);
      // Relâcher le verrou en quittant la page : sinon la fiche resterait
      // verrouillée par un éditeur qui a simplement fermé l'onglet.
      window.addEventListener(
        "pagehide",
        () => {
          window.clearInterval(handle);
          void actions.unlockService({ id: serviceId });
        },
        { once: true },
      );
    }

    // ── Révisions ──────────────────────────────────────────────────────────
    root.querySelector<HTMLButtonElement>("[data-load-revisions]")?.addEventListener("click", async () => {
      if (!serviceId) return;
      const result = await actions.listServiceRevisions({ id: serviceId });
      const container = root.querySelector<HTMLElement>("[data-revisions]");
      if (!container) return;

      if (result.error) {
        container.textContent = errorText(result);
        return;
      }

      container.innerHTML = (result.data ?? [])
        .map(
          (revision) =>
            `<div class="flex items-center justify-between gap-3 rounded-lg border p-3">` +
            `<div><p class="text-sm font-medium">${escapeHtml(revision.title)}</p>` +
            `<p class="text-xs text-muted-foreground">${escapeHtml(revision.locale)} · ${escapeHtml(revision.status)}</p></div>` +
            `<button type="button" class="rounded-md border px-3 py-1.5 text-sm" data-restore-revision="${escapeHtml(revision.id)}">${escapeHtml(root.dataset.restoreLabel || "")}</button></div>`,
        )
        .join("");

      container.querySelectorAll<HTMLButtonElement>("[data-restore-revision]").forEach((button) => {
        button.addEventListener("click", async () => {
          const restore = await actions.restoreServiceRevision({
            revisionId: button.dataset.restoreRevision || "",
            serviceId,
          });
          if (status) status.textContent = restore.error ? errorText(restore) : labels.saved;
          if (!restore.error) window.location.reload();
        });
      });
    });
  }
}
