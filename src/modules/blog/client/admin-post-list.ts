/**
 * Back-office blog : actions de ligne sur la liste des articles.
 *
 * `archive` et `delete` demandent une confirmation. Le bouton est désactivé
 * pendant l'appel et réactivé dans un `finally` : sans cela, un échec réseau
 * laisserait la ligne définitivement inerte.
 */
import { actions } from "astro:actions";
import { toast } from "@atoms/toast";
import { confirmAdminAction } from "@/core/admin";

type PostOperation = (id: string) => Promise<{ error?: { message?: string } }>;

export function initAdminPostList(): void {
  const dataEl = document.getElementById("admin-post-list-data") as HTMLInputElement | null;
  const errorText = dataEl?.dataset.tError ?? "";

  const ask = (message: string): Promise<boolean> =>
    confirmAdminAction({
      title: message,
      message,
      confirmLabel: dataEl?.dataset.confirmLabel || "OK",
      cancelLabel: dataEl?.dataset.cancelLabel || "",
    });

  /** Lie un handler à chaque élément, une seule fois. */
  const bind = <T extends HTMLElement>(
    selector: string,
    handler: (element: T) => void,
  ): void => {
    document.querySelectorAll<T>(selector).forEach((element) => {
      if (element.dataset.blogBound === "true") return;
      element.dataset.blogBound = "true";
      handler(element);
    });
  };

  const run = async (button: HTMLButtonElement, operation: PostOperation): Promise<void> => {
    const id = button.dataset.postId;
    if (!id) return;
    button.disabled = true;
    try {
      const { error } = await operation(id);
      if (error) toast.error(error.message ?? errorText);
      else window.location.reload();
    } finally {
      button.disabled = false;
    }
  };

  bind<HTMLButtonElement>(".publish-btn", (btn) =>
    btn.addEventListener("click", () => void run(btn, (id) => actions.publishBlogPost({ id }))),
  );

  bind<HTMLButtonElement>(".unpublish-btn", (btn) =>
    btn.addEventListener("click", () => void run(btn, (id) => actions.unpublishBlogPost({ id }))),
  );

  bind<HTMLButtonElement>(".archive-btn", (btn) =>
    btn.addEventListener("click", async () => {
      if (await ask(dataEl?.dataset.confirmArchive ?? "")) {
        void run(btn, (id) => actions.archiveBlogPost({ id }));
      }
    }),
  );

  bind<HTMLButtonElement>(".restore-btn", (btn) =>
    btn.addEventListener("click", () => void run(btn, (id) => actions.restoreBlogPost({ id }))),
  );

  bind<HTMLButtonElement>(".duplicate-btn", (btn) =>
    btn.addEventListener("click", () => void run(btn, (id) => actions.duplicateBlogPost({ id }))),
  );

  bind<HTMLButtonElement>(".delete-btn", (btn) =>
    btn.addEventListener("click", async () => {
      if (!(await ask(dataEl?.dataset.tConfirmDelete ?? ""))) return;
      void run(btn, (id) => actions.deleteBlogPost({ id }));
    }),
  );
}
