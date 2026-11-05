/**
 * `defineAction` du projet : identique à celui d'Astro, avec en plus
 *  - une action « jumelle » `accept: "form"` qui sert les soumissions natives (sans JavaScript) ;
 *  - le signalement des exceptions INATTENDUES au suivi d'erreurs (Sentry, si `SENTRY_DSN`).
 *
 * L'action JSON reste inchangée (clients `actions.x(obj)`, tests qui appellent
 * `.handler`). La jumelle partage la même entrée zod et le même handler ; la
 * coercion `FormData` → objet est celle d'Astro. Elle n'est utilisée que par
 * `handleFormFallback` (middleware).
 */
import { defineAction as astroDefineAction } from "astro:actions";
import { captureError } from "@/lib/monitoring";
import { FORM_COMPANION } from "./companion";

type ActionDefinition = Parameters<typeof astroDefineAction>[0];
type ActionHandler = (input: unknown, context: unknown) => unknown;

/**
 * Astro transforme toute exception d'un handler en `INTERNAL_SERVER_ERROR` générique avant que le
 * middleware puisse la voir : c'est ici, à la source, qu'on la signale. Les refus attendus (droits,
 * validation, codes métier) sont ignorés par `captureError`. L'erreur est relancée INCHANGÉE.
 */
function withErrorReporting(handler: ActionHandler): ActionHandler {
  return async (input, context) => {
    try {
      return await handler(input, context);
    } catch (error) {
      const ctx = context as { url?: URL; locals?: { requestId?: string | null; user?: { id?: string } | null } } | null;
      captureError(error, {
        requestId: ctx?.locals?.requestId ?? null,
        userId: ctx?.locals?.user?.id ?? null,
        path: ctx?.url?.pathname ?? null,
        tags: { source: "action" },
      });
      throw error;
    }
  };
}

export const defineAction = ((definition: ActionDefinition) => {
  const reporting = {
    ...definition,
    handler: withErrorReporting((definition as { handler: ActionHandler }).handler),
  } as ActionDefinition;
  const action = astroDefineAction(reporting);
  if ((definition as { accept?: string }).accept === "form") return action;
  const companion = astroDefineAction({ ...reporting, accept: "form" } as ActionDefinition);
  return Object.assign(action, { [FORM_COMPANION]: companion });
}) as typeof astroDefineAction;
