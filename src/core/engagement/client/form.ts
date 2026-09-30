/**
 * Soumission partagée des formulaires d'engagement.
 *
 * Les six formulaires (avis + commentaires, trois domaines) font la même
 * chose : empêcher la soumission native, lire le `FormData`, appeler l'action
 * du domaine, puis afficher le résultat et vider le formulaire. Seuls le
 * payload et l'action diffèrent.
 *
 * Le retour passe par le toast : les atomes de formulaire exposent leurs
 * libellés via `data-t-error` / `data-t-submitted` sur le `<form>` et ne
 * rendent aucun élément de statut.
 */

export interface EngagementFormOptions<Payload> {
  /** Sélecteur CSS du formulaire, dans la portée du document. */
  selector: string;
  /** Transforme le `FormData` en payload de l'action. */
  buildPayload: (data: FormData) => Payload;
  /** Action du domaine. */
  submit: (payload: Payload) => Promise<{ error?: { code?: string; message?: string } }>;
  /** Traduit une erreur. `code` est le code métier du domaine. */
  onError: (error: { code?: string; message?: string } | undefined, fallback: string) => void;
  /** Message de succès, sinon la valeur `data-t-submitted` du formulaire. */
  onSuccess: (message: string) => void;
  /** Libellé d'erreur par défaut, sinon `data-t-error` du formulaire. */
  defaultError?: string;
}

export function bindEngagementForm<Payload>(options: EngagementFormOptions<Payload>): void {
  for (const form of document.querySelectorAll<HTMLFormElement>(options.selector)) {
    if (form.dataset.engagementBound === "true") continue;
    form.dataset.engagementBound = "true";

    const fallbackError = form.dataset.tError ?? options.defaultError ?? "";

    form.addEventListener("submit", async (event) => {
      // Sans cela le navigateur ferait un GET vers l'URL courante : le texte du
      // commentaire ou de l'avis partirait dans la chaîne de requête, donc dans
      // l'historique, l'en-tête Referer et les journaux du serveur.
      event.preventDefault();

      const submit = form.querySelector<HTMLButtonElement>('button[type="submit"]');
      if (submit) submit.disabled = true;

      const payload = options.buildPayload(new FormData(form));
      const { error } = await options.submit(payload);

      if (submit) submit.disabled = false;

      if (error) {
        options.onError(error, fallbackError);
        return;
      }

      options.onSuccess(form.dataset.tSubmitted ?? "");
      form.reset();
    });
  }
}
