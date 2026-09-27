/**
 * Refus de transition d'état — contrat métier partagé par les machines à
 * états du domaine voyage (TODO §8.3, §8.4, §11.3, §12.1, §13).
 *
 * INVARIANT : une transition absente de la table d'une machine à états est un
 * refus métier — le serveur applique son propre contrat — jamais une panne.
 * L'erreur levée par une garde porte donc un code métier stable, pas seulement
 * un message : c'est ce code qui constitue le contrat, la couche d'action en
 * déduit le transport (voir `src/actions/voyage/transition-errors.ts`).
 *
 * MODULE PUR : aucun import d'exécutable (`astro:*`), d'ORM, de base ni d'outil
 * de présentation. Une garde de transition reste donc testable hors de
 * l'exécution d'une action. Le code d'erreur d'action, lui, vit dans la couche
 * d'action — voir `TRANSPORT_BY_CODE`.
 *
 * Les deux gardes restantes du dépôt (`src/lib/blog/constants.ts` et
 * `src/lib/cms/workflow.ts`) lèvent encore une `Error` ordinaire : elles
 * vivent hors du domaine voyage et hors du périmètre d'écriture autorisé.
 */

/** Registre des codes métier de refus de transition. Source unique du type. */
export const TRANSITION_REFUSAL_CODES = ["STATE_TRANSITION_REFUSED"] as const;

export type TransitionRefusalCode = (typeof TRANSITION_REFUSAL_CODES)[number];

/** Code porté par toute garde de transition refusée. */
export const STATE_TRANSITION_REFUSED = "STATE_TRANSITION_REFUSED" satisfies TransitionRefusalCode;

/** Préfixe de code métier en tête de message (convention dépôt, cf. `codedError`). */
const CODE_PREFIX = /^\[[A-Z_]+\] /;

export class TransitionRefusedError extends Error {
  readonly code: TransitionRefusalCode = STATE_TRANSITION_REFUSED;
  readonly entity: string;
  readonly from: string;
  readonly to: string;

  constructor(entity: string, from: string, to: string) {
    super(`[${STATE_TRANSITION_REFUSED}] Transition d'état refusée — ${entity} : « ${from} » → « ${to} ».`);
    this.name = "TransitionRefusedError";
    this.entity = entity;
    this.from = from;
    this.to = to;
  }
}

/** Fabrique unique : une garde appelle `throw transitionRefused(…)`. */
export function transitionRefused(entity: string, from: string, to: string): TransitionRefusedError {
  return new TransitionRefusedError(entity, from, to);
}

export function isTransitionRefusalCode(value: unknown): value is TransitionRefusalCode {
  return typeof value === "string" && (TRANSITION_REFUSAL_CODES as readonly string[]).includes(value);
}

/** Garde de type : reconnaît le refus métier, quel que soit le paquetage qui l'a levé. */
export function isTransitionRefusedError(err: unknown): err is TransitionRefusedError {
  if (err instanceof TransitionRefusedError) return true;
  return isTransitionRefusalCode((err as { code?: unknown } | null | undefined)?.code);
}

/** Message métier sans le préfixe de code : le transport le ré-ajoute une seule fois. */
export function transitionRefusalMessage(err: unknown): string {
  const message = err instanceof Error ? err.message : "Transition d'état refusée.";
  return message.replace(CODE_PREFIX, "");
}
