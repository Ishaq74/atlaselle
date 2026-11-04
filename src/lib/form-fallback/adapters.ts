/**
 * Adaptateurs pour les payloads que la coercion `FormData` d'Astro ne sait pas
 * produire (tableau d'objets). L'adaptateur construit l'objet JSON attendu et la
 * requête appelle l'action JSON d'origine (mêmes validations, mêmes permissions).
 * Clé = nom de l'action dans `src/actions/index.ts`.
 */
export type FormAdapter = (data: FormData) => unknown;

const text = (data: FormData, key: string): string | null => {
  const raw = data.get(key);
  if (typeof raw !== "string") return null;
  const value = raw.trim();
  return value === "" ? null : value;
};

const flag = (data: FormData, key: string): boolean => {
  const raw = data.get(key);
  return raw !== null && raw !== "false";
};

export function indexesOf(data: FormData, prefix: string): number[] {
  const found = new Set<number>();
  const re = new RegExp(`^${prefix}\\.(\\d{1,3})\\.`);
  for (const key of data.keys()) {
    const match = re.exec(key);
    if (match) found.add(Number(match[1]));
  }
  return [...found].sort((a, b) => a - b).slice(0, 7);
}

export const FORM_ADAPTERS: Record<string, FormAdapter> = {
  // Reproduit la normalisation du gestionnaire JavaScript : jour fermé ou pause midi
  // ⇒ les champs inutilisés sont envoyés à `null`.
  updateOpeningHours: (data) => ({
    items: indexesOf(data, "items").map((n) => {
      const key = (field: string): string => `items.${n}.${field}`;
      const isClosed = flag(data, key("isClosed"));
      const hasMiddayBreak = flag(data, key("hasMiddayBreak"));
      return {
        id: text(data, key("id")) ?? "",
        isClosed,
        hasMiddayBreak,
        openTime: isClosed || hasMiddayBreak ? null : text(data, key("openTime")),
        closeTime: isClosed || hasMiddayBreak ? null : text(data, key("closeTime")),
        morningOpen: isClosed || !hasMiddayBreak ? null : text(data, key("morningOpen")),
        morningClose: isClosed || !hasMiddayBreak ? null : text(data, key("morningClose")),
        afternoonOpen: isClosed || !hasMiddayBreak ? null : text(data, key("afternoonOpen")),
        afternoonClose: isClosed || !hasMiddayBreak ? null : text(data, key("afternoonClose")),
      };
    }),
  }),
};
