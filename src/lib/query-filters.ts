import { z } from "astro/zod";

/**
 * Filtres de liste lus depuis l'URL (query params) : une valeur invalide
 * retombe silencieusement sur les défauts au lieu de jeter (jamais de 500
 * sur une navigation admin avec un filtre malformé).
 *
 * `fallbackRaw` : valeurs à conserver dans le repli (ex. locale imposée par
 * l'appelant quand le schéma l'exige). Par défaut `{}` (schémas 100 % optionnels).
 *
 * Les actions de mutation gardent `.parse` strict (erreurs typées) ; seuls
 * les loaders de LISTES (lecture, filtres URL) utilisent ce parse indulgent.
 */
export function parseListFilters<T extends z.ZodTypeAny>(schema: T, raw: unknown, fallbackRaw: unknown = {}): z.infer<T> {
  const parsed = schema.safeParse(raw);
  if (parsed.success) return parsed.data;
  const fallback = schema.safeParse(fallbackRaw);
  if (fallback.success) return fallback.data;
  return schema.parse(fallbackRaw);
}
