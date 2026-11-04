export const FORM_ACTION_PARAM = "_action";

/**
 * Valeur de l'attribut `action` d'un formulaire servi sans JavaScript :
 * la page courante (chemin + requête conservés) avec `?_action=<nom>`.
 * Le POST natif est traité par `handleFormFallback` (middleware).
 */
export function formAction(name: string, url: URL): string {
  const params = new URLSearchParams(url.search);
  params.set(FORM_ACTION_PARAM, name);
  return `${url.pathname}?${params.toString()}`;
}
