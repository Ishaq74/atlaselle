import type { Locale } from "@i18n/config";

export function buildServiceUrl(locale: Locale, slug: string, categorySlug?: string | null): string {
  const base = `/${locale}/services`;
  return categorySlug ? `${base}/${categorySlug}/${slug}` : `${base}/${slug}`;
}

export function buildServiceCategoryUrl(locale: Locale, slug: string): string {
  const base = `/${locale}/services`;
  return `${base}/${slug}`;
}
