import type { Locale } from "@i18n/config";
import type { AdminDict } from "./fr";
import ar from "./ar";
import en from "./en";
import es from "./es";
import fr from "./fr";

const dictionaries: Record<Locale, AdminDict> = { fr, en, es, ar };

export type { AdminDict };
export { default as fr } from "./fr";

/** Locale-aware admin dictionary. Falls back to English for unknown locales. */
export function getAdminDict(locale: Locale): AdminDict {
  return dictionaries[locale] ?? dictionaries.en;
}

/** Human-readable status label with a safe fallback to the raw enum value. */
export function adminStatusLabel(dict: AdminDict, status: string): string {
  const statuses = dict.statuses as Record<string, string>;
  return statuses[status] ?? statuses[status.toLowerCase()] ?? status;
}
