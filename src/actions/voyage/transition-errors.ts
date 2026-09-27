import { ActionError } from "astro:actions";
import { toActionError } from "@/lib/voyage-errors";
import {
  isTransitionRefusalCode,
  isTransitionRefusedError,
  transitionRefusalMessage,
  type TransitionRefusalCode,
} from "@/modules/state-machines/domain/transition-refusal";

/**
 * COUCHE ACTION — contrat de transport des refus de machine à états.
 *
 * Le registre vit dans le domaine (`TRANSITION_REFUSAL_CODES`,
 * `src/modules/state-machines/domain/transition-refusal.ts`) : une garde de
 * transition ne doit importer ni exécutable ni outil de présentation. Le code
 * d'erreur d'action, lui, vit ici : Astro n'accepte qu'un code HTTP dans une
 * `ActionError`, et ce transport est une décision de la couche d'action.
 *
 * COHÉRENCE ET VÉRIFICATION À LA COMPILATION : le type `TransportCode` de
 * `Record<TransitionRefusalCode, TransportCode>` est dérivé du registre, donc
 * `TRANSPORT_BY_CODE` est vérifié exhaustif dans les deux sens — un code
 * ajouté au registre sans transport, ou un transport sans code, ne compile
 * pas. Aucune valeur inventée ne peut passer.
 *
 * CHOIX DU TRANSPORT — `BAD_REQUEST`, justifié par le code réel du dépôt :
 *  · `CONFLICT` est la réponse du verrouillage concurrent et optimiste :
 *    `assertTripLockOwner` (« Ce voyage est verrouillé par un autre éditeur »)
 *    et `assertFresh` (« votre version est obsolète ») dans
 *    `src/actions/voyage/_helpers.ts`, le verrou de page dans
 *    `src/actions/admin/pages.ts`. Un refus de machine à états n'est pas une
 *    course : l'état de départ est stable, la requête est invalide à part
 *    entière. Lui donner `CONFLICT` maquillerait une erreur de saisie en
 *    conflit de concurrence.
 *  · Le code de traitement d'entité non représentable n'existe pas dans ce
 *    projet : ni dans le vocabulaire `TransportCode` de `@/lib/voyage-errors`,
 *    ni dans aucune action (aucun `422` / `UNPROCESSABLE*` dans `src/`).
 *  · Le précédent existe déjà dans le dépôt pour un refus d'état : une page
 *    qui n'est pas dans la corbeille répond `BAD_REQUEST`
 *    (`permanentlyDeletePage`, `src/actions/admin/pages.ts`).
 */
type TransportCode =
  | "BAD_REQUEST"
  | "CONFLICT"
  | "GONE"
  | "NOT_FOUND"
  | "FORBIDDEN"
  | "UNAUTHORIZED"
  | "INTERNAL_SERVER_ERROR"
  | "TOO_MANY_REQUESTS";

const TRANSPORT_BY_CODE: Record<TransitionRefusalCode, TransportCode> = {
  STATE_TRANSITION_REFUSED: "BAD_REQUEST",
};

/**
 * Traduit une erreur de service en `ActionError` typée.
 * Les `ActionError` passent telles quelles ; un refus de transition emprunte
 * sa table de transport ; tout le reste délègue au mapping voyage existant
 * (`@/lib/voyage-errors`), dont le comportement est inchangé.
 */
export function toVoyageActionError(err: unknown): ActionError {
  if (err instanceof ActionError) return err;
  const code = (err as { code?: unknown } | null | undefined)?.code;
  if (isTransitionRefusalCode(code)) {
    return new ActionError({
      code: TRANSPORT_BY_CODE[code],
      message: `[${code}] ${transitionRefusalMessage(err)}`,
    });
  }
  return toActionError(err);
}

/**
 * Exécute une garde de transition : un refus métier devient une erreur d'action
 * typée (statut client + code stable) ; toute autre erreur remonte intacte, pour
 * ne jamais masquer une panne derrière un refus métier.
 */
export function assertStateTransition(guard: () => void): void {
  try {
    guard();
  } catch (err) {
    if (isTransitionRefusedError(err)) throw toVoyageActionError(err);
    throw err;
  }
}
