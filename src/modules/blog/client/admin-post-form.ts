/**
 * Back-office blog : formulaire d'édition d'un article.
 *
 * Réunit le contenu et le SEO, les médias (image à la une, OG, galeries), le
 * cycle de vie, les révisions et la gestion des liens internes.
 *
 * Deux subtilités conservées telles quelles du script d'origine :
 *
 * - le garde `beforeunload` n'est PAS ici : il appartient à `AdminFormShell`,
 *   qui centralise l'état de salissure. Ce module ne garde que l'état dont il a
 *   besoin, pour la confirmation de changement de locale ;
 * - le verrou est rafraîchi toutes les 60 s et relâché sur `pagehide`, sans quoi
 *   fermer l'onglet laisserait l'article verrouillé.
 */
import { actions } from "astro:actions";
import { toast } from "@atoms/toast";
import type { BlogPostFormInput } from "@/lib/blog/types";
import { confirmAdminAction } from "@/core/admin";

/** Slug ASCII, dérivé du titre. Copie locale de la règle serveur. */
const slugify = (value: string): string =>
  value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 200);

/** Résultat d'action : seul `error.message` est consommé ici. */
interface ActionResult {
  error?: { message?: string };
}

type PostOperation = (id: string) => Promise<ActionResult>;

export function initAdminPostForm(): void {
  const form = document.getElementById("blog-post-form") as HTMLFormElement | null;
  if (!form || form.dataset.bound === "1") return;
  form.dataset.bound = "1";

  const mode = form.dataset.mode as "create" | "edit";
  const postId = form.querySelector<HTMLInputElement>('input[name="id"]')?.value;
  const errorText = form.dataset.tError ?? "";
  const localeFromForm = (): string => form.dataset.locale ?? "fr";

  const ask = (message: string): Promise<boolean> =>
    confirmAdminAction({
      title: message,
      message,
      confirmLabel: form.dataset.confirmLabel || "OK",
      cancelLabel: form.dataset.cancelLabel || "",
    });

  const toastError = (message: string | null | undefined): void => {
    toast.error(message ?? errorText);
  };

  // ── État de salissure ────────────────────────────────────────────────────
  let isDirty = false;
  let manualSlug = mode === "edit";
  const markDirty = (): void => {
    isDirty = true;
  };

  form.addEventListener("input", markDirty);
  form.addEventListener("change", markDirty);

  // Changer de locale abandonnerait les modifications : on demande confirmation.
  document.querySelectorAll<HTMLAnchorElement>("[data-locale-link]").forEach((link) => {
    link.addEventListener("click", async (event) => {
      if (!isDirty) return;
      event.preventDefault();
      if (await ask(form.dataset.tConfirmLeave ?? "")) window.location.href = link.href;
    });
  });

  // ── Slug automatique ────────────────────────────────────────────────────
  const titleInput = form.querySelector<HTMLInputElement>("#post-title");
  const slugInput = form.querySelector<HTMLInputElement>("#post-slug");

  slugInput?.addEventListener("input", () => {
    manualSlug = true;
    markDirty();
  });
  titleInput?.addEventListener("input", () => {
    if (!manualSlug && slugInput) slugInput.value = slugify(titleInput.value);
  });

  // ── Sélecteurs de média ──────────────────────────────────────────────────
  const wireMedia = (pickerId: string, inputId: string): void => {
    const picker = document.getElementById(pickerId);
    const input = document.getElementById(inputId) as HTMLInputElement | null;
    picker?.addEventListener("media-select", (event) => {
      const detail = (event as CustomEvent).detail ?? {};
      if (input) input.value = String(detail.fileId ?? "");
      markDirty();
    });
  };

  wireMedia("blog-featured-picker", "featured-image-id");
  wireMedia("blog-og-picker", "og-image-id");

  // ── Verrou d'édition concurrente ─────────────────────────────────────────
  let lockTimer: number | undefined;

  const refreshLock = async (): Promise<void> => {
    if (mode !== "edit" || !postId) return;
    const { error } = await actions.lockBlogPost({ id: postId });
    if (error) toastError(error.message);
  };

  const releaseLock = async (): Promise<void> => {
    if (mode !== "edit" || !postId) return;
    window.clearInterval(lockTimer);
    await actions.unlockBlogPost({ id: postId });
  };

  if (mode === "edit" && postId) {
    void refreshLock();
    lockTimer = window.setInterval(() => void refreshLock(), 60_000);
    window.addEventListener("pagehide", () => void releaseLock(), { once: true });
  }

  // ── Enregistrement ──────────────────────────────────────────────────────
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const trim = (key: string): string | undefined =>
      String(data.get(key) ?? "").trim() || undefined;
    const focusKeyword = String(data.get("focusKeyword") ?? "").trim();

    const common: Omit<BlogPostFormInput, "status"> = {
      locale: String(data.get("locale") ?? localeFromForm()) as BlogPostFormInput["locale"],
      title: String(data.get("title") ?? ""),
      slug: String(data.get("slug") ?? ""),
      content: String(data.get("content") ?? ""),
      excerpt: trim("excerpt"),
      metaTitle: trim("metaTitle"),
      metaDescription: trim("metaDescription"),
      metaKeywords: trim("metaKeywords"),
      canonicalUrl: trim("canonicalUrl"),
      ogTitle: trim("ogTitle"),
      ogDescription: trim("ogDescription"),
      categoryIds: data.getAll("categoryIds").map(String),
      tagIds: data.getAll("tagIds").map(String),
      featuredImageId: trim("featuredImageId"),
      ogImageId: trim("ogImageId"),
      isFeatured: data.get("isFeatured") === "on",
      isSticky: data.get("isSticky") === "on",
      commentStatus: String(data.get("commentStatus") ?? "OPEN") as BlogPostFormInput["commentStatus"],
      allowReviews: data.get("allowReviews") === "on",
      seo: focusKeyword ? { focusKeyword } : undefined,
    };

    let result: { error?: { message?: string }; data?: unknown };
    try {
      result =
        mode === "edit"
          ? await actions.updateBlogPost({ ...common, id: String(data.get("id") ?? "") })
          : await actions.createBlogPost({ ...common, status: "DRAFT" });
    } catch {
      result = { error: { message: errorText } };
    }

    if (result.error) {
      toastError(result.error.message);
      return;
    }

    isDirty = false;
    toast.success(mode === "edit" ? (form.dataset.tUpdated ?? "") : (form.dataset.tCreated ?? ""));

    const id = (result.data as { id?: string } | undefined)?.id;
    if (id && mode === "create") window.location.href = `${form.dataset.baseAdminUrl}/${id}/edit`;
  });

  // ── Cycle de vie ────────────────────────────────────────────────────────
  const invokeLifecycle = async (operation: PostOperation): Promise<void> => {
    if (!postId) return;
    const { error } = await operation(postId);
    if (error) toastError(error.message);
    else window.location.reload();
  };

  const onLifecycle = (selector: string, operation: PostOperation): void => {
    document.querySelector<HTMLButtonElement>(selector)?.addEventListener("click", () => {
      void invokeLifecycle(operation);
    });
  };

  onLifecycle(".lifecycle-publish", (id) => actions.publishBlogPost({ id }));
  onLifecycle(".lifecycle-unpublish", (id) => actions.unpublishBlogPost({ id }));
  onLifecycle(".lifecycle-restore", (id) => actions.restoreBlogPost({ id }));
  onLifecycle(".lifecycle-duplicate", (id) => actions.duplicateBlogPost({ id }));

  document
    .querySelector<HTMLButtonElement>(".lifecycle-archive")
    ?.addEventListener("click", async () => {
      if (await ask(form.dataset.confirmArchive ?? "")) {
        void invokeLifecycle((id) => actions.archiveBlogPost({ id }));
      }
    });

  document
    .querySelector<HTMLButtonElement>(".lifecycle-delete")
    ?.addEventListener("click", async () => {
      if (await ask(form.dataset.tConfirmDelete ?? errorText)) {
        void invokeLifecycle((id) => actions.deleteBlogPost({ id }));
      }
    });

  // ── Révisions ────────────────────────────────────────────────────────────
  document.querySelectorAll<HTMLButtonElement>(".revision-restore").forEach((button) => {
    button.addEventListener("click", () => {
      const revisionId = button.dataset.revisionId;
      if (!postId || !revisionId) return;
      void actions.restoreBlogPostRevision({ postId, revisionId }).then(({ error }) => {
        if (error) toastError(error.message);
        else window.location.reload();
      });
    });
  });

  // ── Galeries ────────────────────────────────────────────────────────────
  const galleryPicker = document.getElementById("blog-gallery-picker");
  // La galerie ciblée est mémorisée au clic sur le déclencheur : le sélecteur
  // ne renvoie qu'un média, et l'action a besoin de savoir dans quelle
  // galerie l'ajouter.
  let activeGalleryId: string | null = null;

  galleryPicker?.addEventListener("media-select", (event) => {
    const detail = (event as CustomEvent).detail ?? {};
    if (!activeGalleryId || !postId || !detail.fileId) return;
    void actions
      .addGalleryMedia({
        galleryId: activeGalleryId,
        mediaId: String(detail.fileId),
        altText: String(detail.alt ?? detail.filename ?? "media"),
      })
      .then(({ error }) => {
        if (error) toastError(error.message);
        else window.location.reload();
      });
  });

  document.querySelectorAll<HTMLButtonElement>("[data-gallery-picker-trigger]").forEach((button) => {
    button.addEventListener("click", () => {
      activeGalleryId = button.dataset.galleryId ?? null;
      galleryPicker?.dispatchEvent(new Event("open"));
    });
  });

  document.getElementById("gallery-add-btn")?.addEventListener("click", () => {
    if (!postId) {
      toastError(null);
      return;
    }
    void actions.createBlogGallery({ postId }).then(({ error }) => {
      if (error) toastError(error.message);
      else window.location.reload();
    });
  });

  document.querySelectorAll<HTMLButtonElement>(".gallery-delete-btn").forEach((button) => {
    button.addEventListener("click", () => {
      const id = button.dataset.galleryId;
      if (!id) return;
      void actions.deleteBlogGallery({ id }).then(({ error }) => {
        if (error) toastError(error.message);
        else window.location.reload();
      });
    });
  });

  document.querySelectorAll<HTMLButtonElement>("[data-gallery-save]").forEach((button) => {
    button.addEventListener("click", () => {
      const wrapper = button.closest<HTMLElement>("[data-gallery-id]");
      const id = wrapper?.dataset.galleryId;
      if (!id) return;
      const title = wrapper?.querySelector<HTMLInputElement>("[data-gallery-title]")?.value;
      void actions.updateBlogGallery({ id, title }).then(({ error }) => {
        if (error) toastError(error.message);
        else window.location.reload();
      });
    });
  });

  document.querySelectorAll<HTMLButtonElement>("[data-gallery-remove]").forEach((button) => {
    button.addEventListener("click", () => {
      const galleryId = button.dataset.galleryId;
      const mediaId = button.dataset.mediaId;
      if (!galleryId || !mediaId) return;
      void actions.removeGalleryMedia({ galleryId, mediaId }).then(({ error }) => {
        if (error) toastError(error.message);
        else window.location.reload();
      });
    });
  });

  // ── Liens internes ──────────────────────────────────────────────────────
  const reportEl = document.getElementById("link-check-report");
  const linkDialog = document.getElementById("blog-link-dialog") as HTMLDialogElement | null;
  const linkSearch = document.getElementById("blog-link-search") as HTMLInputElement | null;
  const linkResults = document.getElementById("blog-link-results");
  const linkType = document.getElementById("blog-link-type") as HTMLSelectElement | null;
  const linkOrder = document.getElementById("blog-link-order") as HTMLInputElement | null;
  let selectedTargetId: string | null = null;

  interface LinkReport {
    deadExplicit?: Array<{ linkType: string; targetPostId: string }>;
    deadInline?: Array<{ text: string; reason: string }>;
  }

  /**
   * Rend un rapport de liens morts.
   *
   * Les textes sont posés via `textContent` / `createElement`, jamais par
   * concaténation de HTML : une cible de lien est une donnée saisie par un
   * éditeur, et l'injecter en HTML ouvrirait une faille.
   */
  const renderLinkReport = (report: LinkReport): void => {
    if (!reportEl) return;
    reportEl.replaceChildren();
    const messages = [
      ...(report.deadExplicit ?? []).map((link) => `${link.linkType}: ${link.targetPostId}`),
      ...(report.deadInline ?? []).map((link) => `${link.text}: ${link.reason}`),
    ];
    messages.forEach((text) => {
      const item = document.createElement("p");
      item.className = "text-sm text-muted-foreground";
      item.textContent = text;
      reportEl.appendChild(item);
    });
  };

  document.getElementById("link-check-btn")?.addEventListener("click", () => {
    if (!postId) return;
    void actions
      .checkBlogPostLinks({ postId, locale: localeFromForm() })
      .then(({ data, error }) => {
        if (error) toastError(error.message);
        else renderLinkReport(data ?? {});
      });
  });

  const renderLinkResults = (
    results: Array<{ id?: string; label?: string; href?: string }>,
  ): void => {
    if (!linkResults) return;
    linkResults.replaceChildren();

    if (!results.length) {
      const empty = document.createElement("p");
      empty.className = "text-sm text-muted-foreground";
      empty.textContent = form.dataset.tLinkNoResult ?? "";
      linkResults.appendChild(empty);
      return;
    }

    results.forEach((item) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "block w-full rounded-lg border px-3 py-2 text-start hover:bg-muted";
      button.textContent = item.label ?? item.href ?? item.id ?? "";
      button.addEventListener("click", () => {
        selectedTargetId = item.id ?? null;
        linkResults.querySelectorAll("button").forEach((node) =>
          node.classList.remove("ring-2", "ring-primary"),
        );
        button.classList.add("ring-2", "ring-primary");
      });
      linkResults.appendChild(button);
    });
  };

  // Anti-rebond : une frappe ne doit pas déclencher une requête par caractère.
  let searchTimer: number | undefined;
  linkSearch?.addEventListener("input", () => {
    window.clearTimeout(searchTimer);
    searchTimer = window.setTimeout(async () => {
      const query = linkSearch.value.trim();
      if (!query) {
        renderLinkResults([]);
        return;
      }
      const { data } = await actions.resolveBlogInternalLink({
        target: query,
        mode: "search",
        query,
        locale: localeFromForm(),
      });
      renderLinkResults((data?.results ?? []) as Array<{ id?: string; label?: string; href?: string }>);
    }, 200);
  });

  document.getElementById("link-add-btn")?.addEventListener("click", () => {
    if (!postId) {
      toastError(null);
      return;
    }
    selectedTargetId = null;
    linkResults?.replaceChildren();
    if (linkSearch) linkSearch.value = "";
    linkDialog?.showModal();
  });

  document.getElementById("blog-link-cancel")?.addEventListener("click", () => linkDialog?.close());

  document.getElementById("blog-link-save")?.addEventListener("click", () => {
    if (!postId || !selectedTargetId) return;
    // Un article ne peut pas pointer vers lui-même.
    if (selectedTargetId === postId) {
      toast.error(form.dataset.tLinkNoResult ?? "");
      return;
    }
    void actions
      .createBlogLink({
        sourcePostId: postId,
        targetPostId: selectedTargetId,
        linkType: (linkType?.value ?? "RELATED") as
          | "RELATED"
          | "PREVIOUS"
          | "NEXT"
          | "REFERENCE",
        sortOrder: Number(linkOrder?.value ?? 0),
      })
      .then(({ error }) => {
        if (error) toastError(error.message);
        else window.location.reload();
      });
  });

  document.querySelectorAll<HTMLButtonElement>(".link-delete-btn").forEach((button) => {
    button.addEventListener("click", () => {
      const id = button.dataset.linkId;
      if (!id) return;
      void actions.deleteBlogLink({ id }).then(({ error }) => {
        if (error) toastError(error.message);
        else window.location.reload();
      });
    });
  });

  document.querySelectorAll<HTMLSelectElement>("[data-link-type]").forEach((select) => {
    select.addEventListener("change", () => {
      const id = select.dataset.linkType;
      if (!id) return;
      void actions.updateBlogLink({
        id,
        linkType: select.value as "RELATED" | "PREVIOUS" | "NEXT" | "REFERENCE",
      });
    });
  });
}
