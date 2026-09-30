/**
 * Cloche de notifications du blog.
 *
 * Cliquer une notification la marque comme lue ; « tout marquer » recharge la
 * page, car le compteur du header et la liste sont rendus côté serveur.
 */
import { actions } from "astro:actions";

function initNotificationBell(): void {
  for (const item of document.querySelectorAll<HTMLAnchorElement>(".notification-item")) {
    if (item.dataset.bound === "true") continue;
    item.dataset.bound = "true";

    item.addEventListener("click", () => {
      const id = item.dataset.notificationId;
      if (id) void actions.markBlogNotificationRead({ id });
    });
  }

  const markAll = document.getElementById("notification-mark-all");
  if (!markAll || markAll.dataset.bound === "true") return;
  markAll.dataset.bound = "true";

  markAll.addEventListener("click", async (event) => {
    event.preventDefault();
    await actions.markAllBlogNotificationsRead({});
    window.location.reload();
  });
}

export { initNotificationBell };
