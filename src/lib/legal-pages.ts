import { inArray } from "drizzle-orm";
import { getDrizzle } from "@database/drizzle";
import { pages } from "@database/schemas";
import type { Locale } from "@i18n/config";

// IDs fixes des pages légales seedées (src/database/data/09-legal-pages.data.ts).
const LEGAL_PAGE_IDS: Record<"terms" | "insurance", Record<Locale, string>> = {
  terms: {
    fr: "785db5e4-f3e3-43cd-b5ad-e26c1aa24600",
    en: "db88be5b-6aaf-4f65-9859-ffa34999bfaf",
    es: "a7eaf8f6-94f9-4128-9fb1-e412a8fe74ae",
    ar: "2aca68a3-b34e-49b9-9665-95e3c871d4af",
  },
  insurance: {
    fr: "cde2a2af-719a-4a5f-8532-cfcfbd354693",
    en: "78fbccb0-e17b-4ec7-ab89-45388e3ed184",
    es: "9e555f9d-d084-4d04-8ddc-ce292ed954e5",
    ar: "1c3f8ce8-306e-480e-bf2b-b6d0e17e586c",
  },
};

// Dernier recours si la page CMS a été supprimée : slugs du seed.
const FALLBACK_SLUGS: Record<"terms" | "insurance", Record<Locale, string>> = {
  terms: { fr: "conditions-reservation", en: "booking-terms", es: "condiciones-reserva", ar: "booking-terms" },
  insurance: { fr: "assurance-voyage", en: "travel-insurance", es: "seguro-de-viaje", ar: "travel-insurance" },
};

export interface LegalLinks {
  /** URL localisée de la page « conditions de réservation ». */
  terms: string;
  /** URL localisée de la page « assurance voyage ». */
  insurance: string;
}

/**
 * Liens localisés vers les pages légales du tunnel de réservation.
 * Lit les slugs courants en DB (renommage admin pris en compte) ; retombe sur
 * les slugs seed si la page est absente ou si la DB est indisponible — un lien
 * légal ne doit jamais casser la page de réservation.
 */
export async function resolveLegalLinks(locale: Locale): Promise<LegalLinks> {
  const slugs = { terms: FALLBACK_SLUGS.terms[locale], insurance: FALLBACK_SLUGS.insurance[locale] };
  try {
    const db = getDrizzle();
    const ids = { terms: LEGAL_PAGE_IDS.terms[locale], insurance: LEGAL_PAGE_IDS.insurance[locale] };
    const rows = await db
      .select({ id: pages.id, slug: pages.slug })
      .from(pages)
      .where(inArray(pages.id, [ids.terms, ids.insurance]));
    for (const row of rows) {
      if (row.id === ids.terms) slugs.terms = row.slug;
      if (row.id === ids.insurance) slugs.insurance = row.slug;
    }
  } catch (err) {
    console.error("[legal-pages] DB indisponible, fallback sur les slugs seed :", err);
  }
  return { terms: `/${locale}/${slugs.terms}`, insurance: `/${locale}/${slugs.insurance}` };
}
