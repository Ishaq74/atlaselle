/**
 * Enregistrement d'une vue de prestation.
 *
 * La vue n'est comptée qu'une fois par affichage, et seulement lorsque la
 * fiche entre réellement dans le viewport : compter au chargement gonflerait
 * les statistiques avec des pages jamais lues. `IntersectionObserver` n'existe
 * pas sur tous les navigateurs ni dans tous les environnements de test — sans
 * lui, on retombe sur un comptage au chargement.
 */
import { actions } from "astro:actions";

function initServiceDetail(): void {
  for (const root of document.querySelectorAll<HTMLElement>("[data-service-detail]")) {
    if (root.dataset.bound === "true") continue;
    root.dataset.bound = "true";

    const serviceId = root.dataset.serviceId;
    if (!serviceId) continue;

    let recorded = false;
    const recordView = async (): Promise<void> => {
      if (recorded) return;
      recorded = true;
      try {
        await actions.recordServiceView({
          serviceId,
          referrer: document.referrer || null,
        });
      } catch {
        // Un échec d'enregistrement ne doit pas figer la tentative : la fiche
        // reste consultable, seule la statistique est perdue.
        recorded = false;
      }
    };

    if ("IntersectionObserver" in window) {
      const observer = new IntersectionObserver(
        (entries) => {
          if (entries.some((entry) => entry.isIntersecting)) {
            void recordView();
            observer.disconnect();
          }
        },
        { threshold: 0.01 },
      );
      observer.observe(root);
    } else {
      void recordView();
    }
  }
}

export { initServiceDetail };
