/**
 * Garde "modifications non enregistrées" de l'admin.
 *
 * Un seul état, un seul écouteur `beforeunload` pour tout le back-office :
 * `AdminFormShell` et les écrans qui gèrent leurs propres formulaires
 * (site, navigation, thème, sections, légal, policies) passent par ici.
 *
 * Deux modes de suivi :
 * - `formSelector` : chaque `<form method="post">` (ou `data-admin-form`) est
 *   suivi via ses événements `input` / `change` / `submit` / `reset`.
 * - `[data-dirty-scope]` : pour les écrans pilotés par `astro:actions` (pas de
 *   `<form>`), toute saisie dans le périmètre marque la page comme sale ; un clic
 *   sur un bouton du périmètre (= intention d'action : sauvegarde, suppression,
 *   réordonnancement) la repositionne comme propre.
 */

const DEFAULT_FORM_SELECTOR = "form[data-admin-form], form[method='post']";

interface DirtyState {
  dirty: boolean;
  submitted: boolean;
}

const trackedForms = new WeakMap<HTMLFormElement, DirtyState>();
const liveForms = new Set<HTMLFormElement>();
const scopes = new WeakMap<HTMLElement, DirtyState>();
const liveScopes = new Set<HTMLElement>();
let beforeUnloadBound = false;

function bindForm(form: HTMLFormElement): void {
  if (trackedForms.has(form)) return;
  trackedForms.set(form, { dirty: false, submitted: false });
  liveForms.add(form);

  const markDirty = () => {
    const state = trackedForms.get(form);
    if (!state) return;
    // Un submit raté laisse la page vivante : on réarme le suivi pour que la
    // saisie suivante protège à nouveau la navigation.
    state.submitted = false;
    state.dirty = true;
  };

  form.addEventListener("input", markDirty);
  form.addEventListener("change", markDirty);
  form.addEventListener("submit", () => {
    const state = trackedForms.get(form);
    if (!state) return;
    state.submitted = true;
    state.dirty = false;
  });
  form.addEventListener("reset", () => {
    const state = trackedForms.get(form);
    if (state) state.dirty = false;
  });
}

function bindScope(scope: HTMLElement): void {
  if (scopes.has(scope)) return;
  scopes.set(scope, { dirty: false, submitted: false });
  liveScopes.add(scope);

  scope.addEventListener("input", () => {
    const state = scopes.get(scope);
    if (state) state.dirty = true;
  });
  scope.addEventListener("change", () => {
    const state = scopes.get(scope);
    if (state) state.dirty = true;
  });
  // Toute action volontaire dans le périmètre (sauvegarde, suppression,
  // réordonnancement) replace la page dans un état propre.
  scope.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    if (!target.closest("button, [data-dirty-commit]")) return;
    const state = scopes.get(scope);
    if (!state) return;
    state.dirty = false;
    state.submitted = true;
  });
}

function pruneDisconnected(): void {
  for (const form of liveForms) {
    if (!form.isConnected) liveForms.delete(form);
  }
  for (const scope of liveScopes) {
    if (!scope.isConnected) liveScopes.delete(scope);
  }
}

function isDirty(): boolean {
  for (const form of liveForms) {
    const state = trackedForms.get(form);
    if (state?.dirty && !state.submitted && form.isConnected) return true;
  }
  for (const scope of liveScopes) {
    const state = scopes.get(scope);
    if (state?.dirty && !state.submitted && scope.isConnected) return true;
  }
  return false;
}

export interface AdminDirtyGuardOptions {
  /** Sélecteur des formulaires suivis dans le document. */
  formSelector?: string;
  /** Racine de recherche (défaut : `document`). */
  root?: ParentNode;
}

/**
 * Enregistre les formulaires et périmètres sales de l'écran courant.
 * Idempotent : à rappeler après chaque navigation (`astro:after-swap`).
 */
export function registerAdminDirtyGuard(options: AdminDirtyGuardOptions = {}): void {
  const root = options.root ?? document;
  const formSelector = options.formSelector ?? DEFAULT_FORM_SELECTOR;

  pruneDisconnected();
  root.querySelectorAll<HTMLFormElement>(formSelector).forEach(bindForm);
  root.querySelectorAll<HTMLElement>("[data-dirty-scope]").forEach(bindScope);

  if (beforeUnloadBound) return;
  beforeUnloadBound = true;
  window.addEventListener("beforeunload", (event) => {
    if (!isDirty()) return;
    event.preventDefault();
  });
}
