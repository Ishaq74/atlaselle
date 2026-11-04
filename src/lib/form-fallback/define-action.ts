/**
 * `defineAction` du projet : identique à celui d'Astro, avec en plus une action
 * « jumelle » `accept: "form"` qui sert les soumissions natives (sans JavaScript).
 *
 * L'action JSON reste inchangée (clients `actions.x(obj)`, tests qui appellent
 * `.handler`). La jumelle partage la même entrée zod et le même handler ; la
 * coercion `FormData` → objet est celle d'Astro. Elle n'est utilisée que par
 * `handleFormFallback` (middleware).
 */
import { defineAction as astroDefineAction } from "astro:actions";
import { FORM_COMPANION } from "./companion";

type ActionDefinition = Parameters<typeof astroDefineAction>[0];

export const defineAction = ((definition: ActionDefinition) => {
  const action = astroDefineAction(definition);
  if ((definition as { accept?: string }).accept === "form") return action;
  const companion = astroDefineAction({ ...definition, accept: "form" } as ActionDefinition);
  return Object.assign(action, { [FORM_COMPANION]: companion });
}) as typeof astroDefineAction;
