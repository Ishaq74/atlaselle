import type { Locale } from "@i18n/config";

/**
 * Résout une valeur localisée parmi les variantes d'une même ressource.
 *
 * Ordre : locale demandée → EN (langue de repli du dépôt) → FR → première
 * valeur disponible. L'auteur ne doit jamais avoir à dupliquer une même
 * chaîne quatre fois, mais on ne doit pas non plus afficher de texte vide si
 * une locale n'est pas encore traduite.
 */
export function resolveLocalized(
  values: { locale: Locale; value: string }[],
  locale: Locale,
): string | null {
  const pick = (target: Locale) => values.find((v) => v.locale === target)?.value;
  return pick(locale) ?? pick("en") ?? pick("fr") ?? values[0]?.value ?? null;
}
