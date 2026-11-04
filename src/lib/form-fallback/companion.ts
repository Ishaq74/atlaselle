export const FORM_COMPANION = Symbol.for("atlaselle.formCompanion");

export function getFormCompanion(action: unknown): unknown {
  if (action === null || (typeof action !== "function" && typeof action !== "object")) return undefined;
  return (action as Record<symbol, unknown>)[FORM_COMPANION];
}
