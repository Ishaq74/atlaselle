export interface AdminConfirmationOptions { title: string; message: string; confirmLabel: string; cancelLabel: string; }
export interface AdminPromptOptions {
  title: string;
  message?: string;
  /** Libellé du champ saisi (rendu en `label for`, donc annoncé aux lecteurs d'écran). */
  inputLabel: string;
  confirmLabel: string;
  cancelLabel: string;
  defaultValue?: string;
  placeholder?: string;
  maxlength?: number;
}

const DIALOG_CLASS = "fixed inset-0 m-auto w-[min(32rem,calc(100vw-2rem))] rounded-xl border bg-background p-0 text-foreground shadow-2xl backdrop:bg-black/50";
const INPUT_CLASS = "border-input dark:bg-input/30 text-foreground w-full rounded-md border bg-transparent px-3 py-2 text-sm shadow-xs focus-visible:border-outline focus-visible:ring-outline/50 focus-visible:ring-3";

let activeDialog: HTMLDialogElement | null = null;
/** Ferme le dialogue ouvert avec sa valeur par défaut (annulation). */
let dismissActiveDialog: (() => void) | null = null;

function closeActiveDialog(): void {
  const dismiss = dismissActiveDialog;
  dismissActiveDialog = null;
  activeDialog = null;
  dismiss?.();
}

export function confirmAdminAction(options: AdminConfirmationOptions): Promise<boolean> {
  closeActiveDialog();
  const dialog = document.createElement("dialog"); dialog.className = DIALOG_CLASS; dialog.setAttribute("aria-labelledby", "atlaselle-admin-confirm-title"); dialog.setAttribute("aria-describedby", "atlaselle-admin-confirm-message");
  dialog.innerHTML = `<div class="space-y-5 p-6"><div class="space-y-2"><h2 id="atlaselle-admin-confirm-title" class="text-lg font-semibold"></h2><p id="atlaselle-admin-confirm-message" class="text-sm text-muted-foreground"></p></div><div class="flex flex-wrap justify-end gap-2"><button type="button" data-admin-confirm-cancel class="rounded-md border px-4 py-2 text-sm"></button><button type="button" data-admin-confirm-submit class="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground"></button></div></div>`;
  const title = dialog.querySelector<HTMLElement>("#atlaselle-admin-confirm-title"); const message = dialog.querySelector<HTMLElement>("#atlaselle-admin-confirm-message"); const cancel = dialog.querySelector<HTMLButtonElement>("[data-admin-confirm-cancel]"); const submit = dialog.querySelector<HTMLButtonElement>("[data-admin-confirm-submit]"); if (!title || !message || !cancel || !submit) return Promise.resolve(false);
  title.textContent = options.title; message.textContent = options.message; cancel.textContent = options.cancelLabel; submit.textContent = options.confirmLabel; document.body.append(dialog); activeDialog = dialog;
  return new Promise((resolve) => { let settled = false; const finish = (value: boolean) => { if (settled) return; settled = true; if (activeDialog === dialog) { activeDialog = null; dismissActiveDialog = null; } dialog.close(); dialog.remove(); resolve(value); }; dismissActiveDialog = () => finish(false); cancel.addEventListener("click", () => finish(false)); submit.addEventListener("click", () => finish(true)); dialog.addEventListener("cancel", (event) => { event.preventDefault(); finish(false); }, { once: true }); dialog.addEventListener("close", () => finish(false), { once: true }); dialog.showModal(); submit.focus(); });
}

/**
 * Remplace `window.prompt` : même langage visuel que `confirmAdminAction`,
 * saisie annoncée par un `label` et valeurs fournies par l'appelant (donc
 * traduits). Résout `null` si l'utilisateur annule.
 */
export function promptAdminAction(options: AdminPromptOptions): Promise<string | null> {
  closeActiveDialog();
  const inputId = "atlaselle-admin-prompt-input";
  const dialog = document.createElement("dialog"); dialog.className = DIALOG_CLASS; dialog.setAttribute("aria-labelledby", "atlaselle-admin-prompt-title");
  const describedBy = options.message ? " aria-describedby=\"atlaselle-admin-prompt-message\"" : "";
  const messageBlock = options.message ? `<p id="atlaselle-admin-prompt-message" class="text-sm text-muted-foreground"></p>` : "";
  dialog.innerHTML = `<div class="space-y-5 p-6"${describedBy}><div class="space-y-2"><h2 id="atlaselle-admin-prompt-title" class="text-lg font-semibold"></h2>${messageBlock}</div><div class="space-y-1.5"><label for="${inputId}" data-admin-prompt-label class="text-sm font-medium"></label><input id="${inputId}" data-admin-prompt-input type="text" class="${INPUT_CLASS}" /></div><div class="flex flex-wrap justify-end gap-2"><button type="button" data-admin-prompt-cancel class="rounded-md border px-4 py-2 text-sm"></button><button type="button" data-admin-prompt-submit class="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground"></button></div></div>`;
  const title = dialog.querySelector<HTMLElement>("#atlaselle-admin-prompt-title"); const message = dialog.querySelector<HTMLElement>("#atlaselle-admin-prompt-message"); const label = dialog.querySelector<HTMLElement>("[data-admin-prompt-label]"); const input = dialog.querySelector<HTMLInputElement>("[data-admin-prompt-input]"); const cancel = dialog.querySelector<HTMLButtonElement>("[data-admin-prompt-cancel]"); const submit = dialog.querySelector<HTMLButtonElement>("[data-admin-prompt-submit]"); if (!title || !label || !input || !cancel || !submit) return Promise.resolve(null);
  title.textContent = options.title; if (message) message.textContent = options.message ?? ""; label.textContent = options.inputLabel; cancel.textContent = options.cancelLabel; submit.textContent = options.confirmLabel;
  input.value = options.defaultValue ?? ""; if (options.placeholder) input.placeholder = options.placeholder; if (options.maxlength) input.maxLength = options.maxlength;
  document.body.append(dialog); activeDialog = dialog;
  return new Promise((resolve) => { let settled = false; const finish = (value: string | null) => { if (settled) return; settled = true; if (activeDialog === dialog) { activeDialog = null; dismissActiveDialog = null; } dialog.close(); dialog.remove(); resolve(value); }; dismissActiveDialog = () => finish(null); cancel.addEventListener("click", () => finish(null)); submit.addEventListener("click", () => finish(input.value.trim() || null)); input.addEventListener("keydown", (event) => { if (event.key === "Enter") { event.preventDefault(); finish(input.value.trim() || null); } }); dialog.addEventListener("cancel", (event) => { event.preventDefault(); finish(null); }, { once: true }); dialog.addEventListener("close", () => finish(null), { once: true }); dialog.showModal(); input.focus(); input.select(); });
}
