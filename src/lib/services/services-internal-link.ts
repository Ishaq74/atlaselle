import { and, eq, ilike } from "drizzle-orm";
import type { Locale } from "@i18n/config";
import { getDrizzle } from "@database/drizzle";
import { serviceCategoryLinks, serviceCategories, serviceTranslations, services } from "@database/schemas";
import { getServiceBySlug } from "@/modules/services/loaders";
import { buildServiceUrl } from "@/modules/services/utils";
import type { InternalLinkResolver } from "@/lib/content/internal-link-resolver";

interface Context { locale: string; limit?: number }

export const serviceInternalLinkResolver: InternalLinkResolver = {
  name: "services",
  async resolve(target: string, ctx: Context) {
    const locale = ctx.locale as Locale;
    const service = await getServiceBySlug(target, locale, null);
    if (!service?.translation) return { href: "#", title: null, exists: false };
    return { href: buildServiceUrl(locale, service.translation.slug, service.categories[0]?.slug ?? null), title: service.translation.title, exists: true };
  },
  async listValidTargets(ctx: Context) {
    const rows = await getDrizzle().select({ slug: serviceTranslations.slug }).from(serviceTranslations).innerJoin(services, eq(services.id, serviceTranslations.serviceId)).where(and(eq(serviceTranslations.locale, ctx.locale as Locale), eq(services.status, "PUBLISHED")));
    return new Set(rows.map((row) => row.slug));
  },
  async search(query: string, ctx: Context) {
    const rows = await getDrizzle().select({ id: services.id, slug: serviceTranslations.slug, title: serviceTranslations.title, categorySlug: serviceCategories.slug }).from(serviceTranslations).innerJoin(services, eq(services.id, serviceTranslations.serviceId)).leftJoin(serviceCategoryLinks, eq(serviceCategoryLinks.serviceId, services.id)).leftJoin(serviceCategories, eq(serviceCategories.id, serviceCategoryLinks.categoryId)).where(and(eq(serviceTranslations.locale, ctx.locale as Locale), eq(services.status, "PUBLISHED"), ilike(serviceTranslations.title, `%${query}%`))).limit(Math.min(20, Math.max(1, ctx.limit ?? 10)));
    return rows.map((row) => ({ id: row.id, label: row.title, href: buildServiceUrl(ctx.locale as Locale, row.slug, row.categorySlug ?? null) }));
  },
};
