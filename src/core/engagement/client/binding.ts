/**
 * Branchement partagé des barres de réactions.
 *
 * Les trois domaines (blog, voyages, services) ont la MÊME mécanique : au clic
 * sur une réaction, appeler l'action du domaine, puis refléter le nouvel état.
 * Seule l'action diffère. Cette logique lived ici, une fois, plutôt que
 * réécrite — et réécrite avec ses bugs — dans chaque barre.
 *
 * L'état est porté par `aria-pressed` : le style actif de l'atome est un
 * variant Tailwind `aria-pressed:*`, donc le rendu suit l'attribut sans
 * aucune classe à basculer. Un client qui oublie de mettre à jour une classe
 * ne peut plus rendre un état visuel faux.
 */

/** Type de réaction exposée par les atomes. */
export const ENGAGEMENT_REACTIONS = ["LIKE", "LOVE", "FIRE", "CLAP"] as const;
export type EngagementReaction = (typeof ENGAGEMENT_REACTIONS)[number];

export function isEngagementReaction(value: string | null | undefined): value is EngagementReaction {
  return typeof value === "string" && (ENGAGEMENT_REACTIONS as readonly string[]).includes(value);
}

/**
 * Erreur d'action telle que renvoyée par `astro:actions`.
 *
 * `code` est le code métier que le domaine traduit dans sa propre langue
 * (`errorCodes` d'Astro) ; `message` est le message technique déjà localisé par
 * le serveur. Les deux sont passés au handler : chaque domaine choisit.
 */
export interface EngagementActionError {
  code?: string;
  message?: string;
}

export interface EngagementReactionOptions {
  /** Action du domaine : reçoit la réaction et resolves une fois le serveur à jour. */
  toggle: (reaction: EngagementReaction) => Promise<{ error?: EngagementActionError }>;
  /** Libellé d'erreur, lu sur le conteneur. */
  errorText: string;
  /** Libellé de confirmation, lu sur le conteneur. */
  updatedText: string;
  /** Signale une erreur. Injecté pour éviter une dépendance au toast ici. */
  onError: (error: EngagementActionError | undefined, fallback: string) => void;
  /** Signale la réussite. */
  onSuccess: (message: string) => void;
  /** Sélecteur des boutons, relatif au conteneur. */
  buttonSelector?: string;
}
/**
 * Raccorde les boutons de réaction d'un conteneur.
 *
 * @param root conteneur portant l'attribut de scope et les libellés
 *             (`data-t-error`, `data-t-updated`).
 */
export function bindEngagementReactions(
  root: HTMLElement,
  options: EngagementReactionOptions,
): void {
  // Garde : sur un échange de vue Astro, le DOM est remplacé mais le module
  // peut être réinitialisé. Sans cette garde, chaque clic déclencherait
  // autant d'appels que de passages sur la page.
  if (root.dataset.engagementBound === "true") return;
  root.dataset.engagementBound = "true";

  const selector = options.buttonSelector ?? "[data-engagement-reaction]";
  const errorText = root.dataset.tError ?? options.errorText;
  const updatedText = root.dataset.tUpdated ?? options.updatedText;

  for (const button of root.querySelectorAll<HTMLButtonElement>(selector)) {
    button.addEventListener("click", async () => {
      const reaction = button.getAttribute("data-engagement-reaction");
      if (!isEngagementReaction(reaction)) return;

      button.disabled = true;
      const { error } = await options.toggle(reaction);
      button.disabled = false;

      if (error) {
        options.onError(error, errorText);
        return;
      }

      // Une seule réaction active à la fois : cliquer une réaction active la
      // désactive. On repart donc du nouvel état, et non d'un toggle aveugle.
      const isActive = button.getAttribute("aria-pressed") !== "true";

      for (const other of root.querySelectorAll<HTMLButtonElement>(selector)) {
        const otherReaction = other.getAttribute("data-engagement-reaction");
        const wasActive = other.getAttribute("aria-pressed") === "true";
        const otherActive = otherReaction === reaction && isActive;

        other.setAttribute("aria-pressed", String(otherActive));

        // Le compteur vit dans un <bdi> encapsulé : réécrire le parent
        // effacerait la mise en forme numérique.
        const counter = other.querySelector("bdi");
        if (counter && otherActive !== wasActive) {
          const current = Number.parseInt(counter.textContent ?? "0", 10) || 0;
          const next = otherActive ? current + 1 : Math.max(0, current - 1);
          counter.textContent = String(next);
          // L'aria-label annonce le total : il doit suivre, sinon un lecteur
          // d'écran entend un chiffre périmé. Le gabarit vient de l'atome,
          // seul le compteur change.
          const template = other.dataset.engagementReactionLabel;
          if (template) {
            other.setAttribute("aria-label", template.replace("{count}", String(next)));
          }
        }
      }

      options.onSuccess(updatedText);
    });
  }
}

/**
 * Raccorde le bouton favori.
 *
 * Le libellé vit dans un `<span data-engagement-favorite-label>` : réécrire le
 * `textContent` du bouton supprimerait son icône.
 */
export function bindEngagementFavorite(
  root: HTMLElement,
  options: {
    toggle: () => Promise<{ error?: EngagementActionError }>;
    errorText: string;
    onError: (error: EngagementActionError | undefined, fallback: string) => void;
    onSuccess: () => void;
  },
): void {
  const button = root.querySelector<HTMLButtonElement>("[data-engagement-favorite]");
  if (!button || button.dataset.favoriteBound === "true") return;
  button.dataset.favoriteBound = "true";

  button.addEventListener("click", async () => {
    button.disabled = true;
    const { error } = await options.toggle();
    button.disabled = false;

    if (error) {
      options.onError(error, options.errorText);
      return;
    }

    const active = button.getAttribute("aria-pressed") !== "true";
    button.setAttribute("aria-pressed", String(active));

    const label = button.querySelector("[data-engagement-favorite-label]");
    if (label) {
      label.textContent = active
        ? (button.dataset.unfavoriteLabel ?? "")
        : (button.dataset.favoriteLabel ?? "");
    }

    options.onSuccess();
  });
}
