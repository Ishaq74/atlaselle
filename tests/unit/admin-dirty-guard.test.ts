import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Le garde-fou « modifications non enregistrées » est le seul propriétaire de
 * `beforeunload` de tout le back-office : un second écouteur fait appeared
 * deux fois l'invite au navigateur au moment de quitter la page. Ces tests
 * tournent sur un DOM minimal (pas de dépendance jsdom) parce que le module ne
 * touche qu'à trois surface de l'API : `querySelectorAll`, `addEventListener`
 * et `isConnected`.
 */

type Handler = (event: unknown) => void;

class FakeElement {
  isConnected = true;
  private readonly listeners = new Map<string, Set<Handler>>();

  addEventListener(type: string, handler: Handler): void {
    const set = this.listeners.get(type) ?? new Set<Handler>();
    set.add(handler);
    this.listeners.set(type, set);
  }

  /** Nombre d'écouteurs enregistrés — sert à prouver l'idempotence. */
  listenerCount(type: string): number {
    return this.listeners.get(type)?.size ?? 0;
  }

  emit(type: string, event: unknown = {}): void {
    for (const handler of this.listeners.get(type) ?? []) handler(event);
  }
}

/** Cible un `closest('button, [data-dirty-commit]')` comme le ferait le DOM. */
class FakeButton extends FakeElement {
  constructor(private readonly matchesCommit: boolean) {
    super();
  }

  closest(selector: string): FakeElement | null {
    return selector.includes('button') && this.matchesCommit ? this : null;
  }
}

class FakeRoot {
  constructor(private readonly bySelector: Map<string, FakeElement[]>) {}

  querySelectorAll<T extends FakeElement>(selector: string): T[] {
    return (this.bySelector.get(selector) ?? []) as T[];
  }
}

function setup(selectors: Record<string, FakeElement[]>) {
  const root = new FakeRoot(new Map(Object.entries(selectors)));
  const windowListeners = new Map<string, Set<Handler>>();

  vi.stubGlobal('document', {
    querySelectorAll: (selector: string) => root.querySelectorAll(selector),
  });
  // Le module teste `target instanceof Element` pour savoir si le clic vient
  // d'un bouton du périmètre ; sans DOM, on expose notre propre classe.
  vi.stubGlobal('Element', FakeElement);
  vi.stubGlobal('window', {
    addEventListener: (type: string, handler: Handler) => {
      const set = windowListeners.get(type) ?? new Set<Handler>();
      set.add(handler);
      windowListeners.set(type, set);
    },
  });

  return {
    /** Simule une navigation : renvoie true si l'invite a été déclenchée. */
    leave(): boolean {
      let prevented = false;
      for (const handler of windowListeners.get('beforeunload') ?? []) {
        handler({ preventDefault: () => { prevented = true; } });
      }
      return prevented;
    },
    beforeUnloadListeners: () => windowListeners.get('beforeunload')?.size ?? 0,
  };
}

const DEFAULT_FORM = "form[data-admin-form], form[method='post']";

describe('registerAdminDirtyGuard', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('warns on unload only once the form has actually been edited', async () => {
    const form = new FakeElement();
    const env = setup({ [DEFAULT_FORM]: [form] });

    const { registerAdminDirtyGuard: register } = await import('@/core/admin/dirty-guard');
    register();

    expect(env.leave(), 'a pristine form must not warn').toBe(false);

    form.emit('input');
    expect(env.leave(), 'an edited form must warn').toBe(true);
  });

  it('re-arms after a submit and after a reset', async () => {
    const form = new FakeElement();
    const env = setup({ [DEFAULT_FORM]: [form] });

    const { registerAdminDirtyGuard: register } = await import('@/core/admin/dirty-guard');
    register();

    form.emit('change');
    form.emit('submit');
    expect(env.leave(), 'a submitted form must not warn').toBe(false);

    // Un submit raté laisse la page vivante : la saisie suivante doit réarmer.
    form.emit('input');
    expect(env.leave()).toBe(true);

    form.emit('reset');
    expect(env.leave(), 'a reset form must not warn').toBe(false);
  });

  it('tracks forms given through a custom selector', async () => {
    const custom = new FakeElement();
    const env = setup({ 'form[data-custom]': [custom] });

    const { registerAdminDirtyGuard: register } = await import('@/core/admin/dirty-guard');
    register({ formSelector: 'form[data-custom]' });

    custom.emit('input');
    expect(env.leave()).toBe(true);
  });

  it('does not bind beforeunload twice when registered again', async () => {
    const form = new FakeElement();
    const env = setup({ [DEFAULT_FORM]: [form] });

    const { registerAdminDirtyGuard: register } = await import('@/core/admin/dirty-guard');
    register();
    register();
    register({ formSelector: DEFAULT_FORM });

    expect(env.beforeUnloadListeners(), 'one owner, one listener').toBe(1);
    form.emit('input');
    expect(form.listenerCount('input'), 'the form must not be bound twice').toBe(1);
    expect(env.leave()).toBe(true);
  });

  it('tracks dirty scopes for screens without any form', async () => {
    const scope = new FakeElement();
    const env = setup({ '[data-dirty-scope]': [scope] });

    const { registerAdminDirtyGuard: register } = await import('@/core/admin/dirty-guard');
    register();

    expect(env.leave(), 'an untouched scope must not warn').toBe(false);

    scope.emit('input');
    expect(env.leave(), 'typing in the scope must warn').toBe(true);

    // Un clic sur un bouton du périmètre = intention d'action : la page repasse
    // propre (le cas des écrans pilotés par astro:actions, sans <form>).
    const button = new FakeButton(true);
    (scope as unknown as { emit: (type: string, event: unknown) => void }).emit('click', { target: button });
    expect(env.leave(), 'an action click must clear the warning').toBe(false);
  });

  it('ignores a form detached from the document', async () => {
    const form = new FakeElement();
    const env = setup({ [DEFAULT_FORM]: [form] });

    const { registerAdminDirtyGuard: register } = await import('@/core/admin/dirty-guard');
    register();
    form.emit('input');

    form.isConnected = false;
    expect(env.leave(), 'a detached form must not warn').toBe(false);
  });
});
