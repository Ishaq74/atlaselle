
> atlaselle@0.0.1 astro C:\Users\Utilisateur\Documents\t3code\atlaselle
> astro "check"

[ASTRO] SITE_URL is not set ÔÇö using http://localhost:4321 fallback. Set SITE_URL for production builds.
[2m17:27:15[22m [34m[@astrojs/node][39m Enabling sessions with filesystem storage
[33m[1m17:27:15[22m [WARN] [router][39m The route "/[lang]/services/[categorySlug]" is defined in both "src/pages/[lang]/services/[categorySlug].astro" and "src/pages/[lang]/services/[slug].astro" using SSR mode. A dynamic SSR route cannot be defined more than once.
[33m[1m17:27:15[22m [WARN] [router][39m A collision will result in a hard error in following versions of Astro.
[2m17:27:15[22m [34m[content][39m Syncing content
[2m17:27:15[22m [34m[content][39m Synced content
[2m17:27:15[22m [34m[types][39m Generated [2m434ms[22m
[2m17:27:15[22m [34m[check][39m Getting diagnostics for Astro files in C:\Users\Utilisateur\Documents\t3code\atlaselle...
[96msrc/actions/blog/bulk.ts[0m:[93m2[0m:[93m10[0m - [93mwarning[0m[90m ts(6133): [0m'and' is declared but its value is never read.

[7m2[0m import { and, desc, eq, inArray } from "drizzle-orm";
[7m [0m [93m         ~~~[0m

[96msrc/actions/blog/notification.ts[0m:[93m34[0m:[93m19[0m - [93mwarning[0m[90m ts(6133): [0m'input' is declared but its value is never read.

[7m34[0m   handler: async (input, context) => {
[7m  [0m [93m                  ~~~~~[0m

[96msrc/actions/services/attributes.ts[0m:[93m1[0m:[93m10[0m - [93mwarning[0m[90m ts(6133): [0m'and' is declared but its value is never read.

[7m1[0m import { and, eq } from "drizzle-orm";
[7m [0m [93m         ~~~[0m

[96msrc/actions/services/engagement.ts[0m:[93m1[0m:[93m22[0m - [93mwarning[0m[90m ts(6133): [0m'desc' is declared but its value is never read.

[7m1[0m import { and, count, desc, eq } from "drizzle-orm";
[7m [0m [93m                     ~~~~[0m

[96msrc/actions/services/notification.ts[0m:[93m68[0m:[93m100[0m - [93mwarning[0m[90m ts(6133): [0m'input' is declared but its value is never read.

[7m68[0m export const markAllServiceNotificationsRead = defineAction({ input: z.object({}), handler: async (input, context) => { const user = await assertServicePermission(context, { service: ["read"] }); const db = getDrizzle(); const rows = await db.select({ id: serviceNotifications.id }).from(serviceNotifications).where(and(eq(serviceNotifications.recipientId, user.id), isNull(serviceNotifications.readAt))); if (rows.length) await db.update(serviceNotifications).set({ readAt: new Date() }).where(inArray(serviceNotifications.id, rows.map((row) => row.id))); return { success: true }; } });
[7m  [0m [93m                                                                                                   ~~~~~[0m

[96msrc/actions/services/views.ts[0m:[93m13[0m:[93m26[0m - [93mwarning[0m[90m ts(6385): [0m'(params?: string | { normalize?: boolean | undefined; pattern?: RegExp | undefined; abort?: boolean | undefined; hostname?: RegExp | undefined; protocol?: RegExp | undefined; error?: string | ... 1 more ... | undefined; message?: string | undefined; } | undefined): ZodString' is deprecated.

[7m13[0m     referrer: z.string().url().optional().nullable(),
[7m  [0m [93m                         ~~~[0m

[96msrc/actions/voyage/applications.ts[0m:[93m227[0m:[93m100[0m - [93mwarning[0m[90m ts(6385): [0m'(params?: string | { pattern?: RegExp | undefined; abort?: boolean | undefined; error?: string | $ZodErrorMap<$ZodIssueInvalidStringFormat> | undefined; message?: string | undefined; } | undefined): ZodString' is deprecated.

[7m227[0m export const applicationWithdrawInput = z.object({ id: z.string().uuid(), email: z.string().trim().email().max(320) });
[7m   [0m [93m                                                                                                   ~~~~~[0m
[96msrc/actions/voyage/applications.ts[0m:[93m227[0m:[93m67[0m - [93mwarning[0m[90m ts(6385): [0m'(params?: string | { version?: "v8" | "v1" | "v2" | "v3" | "v4" | "v5" | "v6" | "v7" | undefined; abort?: boolean | undefined; error?: string | $ZodErrorMap<$ZodIssueInvalidStringFormat> | undefined; message?: string | undefined; } | undefined): ZodString' is deprecated.

[7m227[0m export const applicationWithdrawInput = z.object({ id: z.string().uuid(), email: z.string().trim().email().max(320) });
[7m   [0m [93m                                                                  ~~~~[0m
[96msrc/actions/voyage/applications.ts[0m:[93m164[0m:[93m18[0m - [93mwarning[0m[90m ts(6385): [0m'(params?: string | { version?: "v8" | "v1" | "v2" | "v3" | "v4" | "v5" | "v6" | "v7" | undefined; abort?: boolean | undefined; error?: string | $ZodErrorMap<$ZodIssueInvalidStringFormat> | undefined; message?: string | undefined; } | undefined): ZodString' is deprecated.

[7m164[0m   id: z.string().uuid(),
[7m   [0m [93m                 ~~~~[0m
[96msrc/actions/voyage/applications.ts[0m:[93m28[0m:[93m28[0m - [93mwarning[0m[90m ts(6385): [0m'(params?: string | { pattern?: RegExp | undefined; abort?: boolean | undefined; error?: string | $ZodErrorMap<$ZodIssueInvalidStringFormat> | undefined; message?: string | undefined; } | undefined): ZodString' is deprecated.

[7m28[0m   email: z.string().trim().email().max(320),
[7m  [0m [93m                           ~~~~~[0m

[96msrc/actions/voyage/checkout.ts[0m:[93m61[0m:[93m59[0m - [93mwarning[0m[90m ts(6385): [0m'(params?: string | { version?: "v8" | "v1" | "v2" | "v3" | "v4" | "v5" | "v6" | "v7" | undefined; abort?: boolean | undefined; error?: string | $ZodErrorMap<$ZodIssueInvalidStringFormat> | undefined; message?: string | undefined; } | undefined): ZodString' is deprecated.

[7m61[0m const cancelSchema = z.object({ reservationId: z.string().uuid() });
[7m  [0m [93m                                                          ~~~~[0m
[96msrc/actions/voyage/checkout.ts[0m:[93m17[0m:[93m36[0m - [93mwarning[0m[90m ts(6385): [0m'(params?: string | { pattern?: RegExp | undefined; abort?: boolean | undefined; error?: string | $ZodErrorMap<$ZodIssueInvalidStringFormat> | undefined; message?: string | undefined; } | undefined): ZodString' is deprecated.

[7m17[0m   travelerEmail: z.string().trim().email().max(320),
[7m  [0m [93m                                   ~~~~~[0m
[96msrc/actions/voyage/checkout.ts[0m:[93m16[0m:[93m33[0m - [93mwarning[0m[90m ts(6385): [0m'(params?: string | { version?: "v8" | "v1" | "v2" | "v3" | "v4" | "v5" | "v6" | "v7" | undefined; abort?: boolean | undefined; error?: string | $ZodErrorMap<$ZodIssueInvalidStringFormat> | undefined; message?: string | undefined; } | undefined): ZodString' is deprecated.

[7m16[0m   checkoutSessionId: z.string().uuid(),
[7m  [0m [93m                                ~~~~[0m

[96msrc/actions/voyage/contents.ts[0m:[93m71[0m:[93m35[0m - [93mwarning[0m[90m ts(6385): [0m'(params?: string | { offset?: boolean | undefined; abort?: boolean | undefined; precision?: number | null | undefined; local?: boolean | undefined; error?: string | $ZodErrorMap<$ZodIssueInvalidStringFormat> | undefined; message?: string | undefined; } | undefined): ZodString' is deprecated.

[7m71[0m     expectedUpdatedAt: z.string().datetime({ offset: true }).nullable().optional(),
[7m  [0m [93m                                  ~~~~~~~~[0m

[96msrc/actions/voyage/departures.ts[0m:[93m86[0m:[93m56[0m - [93mwarning[0m[90m ts(6385): [0m'(params?: string | { version?: "v8" | "v1" | "v2" | "v3" | "v4" | "v5" | "v6" | "v7" | undefined; abort?: boolean | undefined; error?: string | $ZodErrorMap<$ZodIssueInvalidStringFormat> | undefined; message?: string | undefined; } | undefined): ZodString' is deprecated.

[7m86[0m const departureStatusInput = z.object({ id: z.string().uuid(), to: z.enum(["open", "limited", "waitlist", "closed", "cancelled"]) });
[7m  [0m [93m                                                       ~~~~[0m
[96msrc/actions/voyage/departures.ts[0m:[93m65[0m:[93m97[0m - [93mwarning[0m[90m ts(6385): [0m'(params?: string | { offset?: boolean | undefined; abort?: boolean | undefined; precision?: number | null | undefined; local?: boolean | undefined; error?: string | $ZodErrorMap<$ZodIssueInvalidStringFormat> | undefined; message?: string | undefined; } | undefined): ZodString' is deprecated.

[7m65[0m   input: departureInput.partial().extend({ id: z.string().uuid(), expectedUpdatedAt: z.string().datetime({ offset: true }).nullable().optional() }),
[7m  [0m [93m                                                                                                ~~~~~~~~[0m
[96msrc/actions/voyage/departures.ts[0m:[93m65[0m:[93m59[0m - [93mwarning[0m[90m ts(6385): [0m'(params?: string | { version?: "v8" | "v1" | "v2" | "v3" | "v4" | "v5" | "v6" | "v7" | undefined; abort?: boolean | undefined; error?: string | $ZodErrorMap<$ZodIssueInvalidStringFormat> | undefined; message?: string | undefined; } | undefined): ZodString' is deprecated.

[7m65[0m   input: departureInput.partial().extend({ id: z.string().uuid(), expectedUpdatedAt: z.string().datetime({ offset: true }).nullable().optional() }),
[7m  [0m [93m                                                          ~~~~[0m

[96msrc/actions/voyage/email.ts[0m:[93m11[0m:[93m36[0m - [93mwarning[0m[90m ts(6385): [0m'(params?: string | { version?: "v8" | "v1" | "v2" | "v3" | "v4" | "v5" | "v6" | "v7" | undefined; abort?: boolean | undefined; error?: string | $ZodErrorMap<$ZodIssueInvalidStringFormat> | undefined; message?: string | undefined; } | undefined): ZodString' is deprecated.

[7m11[0m   input: z.object({ id: z.string().uuid() }),
[7m  [0m [93m                                   ~~~~[0m

[96msrc/actions/voyage/faq.ts[0m:[93m40[0m:[93m35[0m - [93mwarning[0m[90m ts(6385): [0m'(params?: string | { offset?: boolean | undefined; abort?: boolean | undefined; precision?: number | null | undefined; local?: boolean | undefined; error?: string | $ZodErrorMap<$ZodIssueInvalidStringFormat> | undefined; message?: string | undefined; } | undefined): ZodString' is deprecated.

[7m40[0m     expectedUpdatedAt: z.string().datetime({ offset: true }).nullable().optional(),
[7m  [0m [93m                                  ~~~~~~~~[0m

[96msrc/actions/voyage/itinerary.ts[0m:[93m82[0m:[93m35[0m - [93mwarning[0m[90m ts(6385): [0m'(params?: string | { offset?: boolean | undefined; abort?: boolean | undefined; precision?: number | null | undefined; local?: boolean | undefined; error?: string | $ZodErrorMap<$ZodIssueInvalidStringFormat> | undefined; message?: string | undefined; } | undefined): ZodString' is deprecated.

[7m82[0m     expectedUpdatedAt: z.string().datetime({ offset: true }).nullable().optional(),
[7m  [0m [93m                                  ~~~~~~~~[0m
[96msrc/actions/voyage/itinerary.ts[0m:[93m46[0m:[93m35[0m - [93mwarning[0m[90m ts(6385): [0m'(params?: string | { offset?: boolean | undefined; abort?: boolean | undefined; precision?: number | null | undefined; local?: boolean | undefined; error?: string | $ZodErrorMap<$ZodIssueInvalidStringFormat> | undefined; message?: string | undefined; } | undefined): ZodString' is deprecated.

[7m46[0m     expectedUpdatedAt: z.string().datetime({ offset: true }).nullable().optional(),
[7m  [0m [93m                                  ~~~~~~~~[0m

[96msrc/actions/voyage/payments.ts[0m:[93m44[0m:[93m36[0m - [93mwarning[0m[90m ts(6385): [0m'(params?: string | { pattern?: RegExp | undefined; abort?: boolean | undefined; error?: string | $ZodErrorMap<$ZodIssueInvalidStringFormat> | undefined; message?: string | undefined; } | undefined): ZodString' is deprecated.

[7m44[0m   travelerEmail: z.string().trim().email().max(320),
[7m  [0m [93m                                   ~~~~~[0m
[96msrc/actions/voyage/payments.ts[0m:[93m43[0m:[93m29[0m - [93mwarning[0m[90m ts(6385): [0m'(params?: string | { version?: "v8" | "v1" | "v2" | "v3" | "v4" | "v5" | "v6" | "v7" | undefined; abort?: boolean | undefined; error?: string | $ZodErrorMap<$ZodIssueInvalidStringFormat> | undefined; message?: string | undefined; } | undefined): ZodString' is deprecated.

[7m43[0m   reservationId: z.string().uuid(),
[7m  [0m [93m                            ~~~~[0m
[96msrc/actions/voyage/payments.ts[0m:[93m13[0m:[93m29[0m - [93mwarning[0m[90m ts(6385): [0m'(params?: string | { version?: "v8" | "v1" | "v2" | "v3" | "v4" | "v5" | "v6" | "v7" | undefined; abort?: boolean | undefined; error?: string | $ZodErrorMap<$ZodIssueInvalidStringFormat> | undefined; message?: string | undefined; } | undefined): ZodString' is deprecated.

[7m13[0m   reservationId: z.string().uuid(),
[7m  [0m [93m                            ~~~~[0m

[96msrc/actions/voyage/policies.ts[0m:[93m44[0m:[93m36[0m - [93mwarning[0m[90m ts(6385): [0m'(params?: string | { version?: "v8" | "v1" | "v2" | "v3" | "v4" | "v5" | "v6" | "v7" | undefined; abort?: boolean | undefined; error?: string | $ZodErrorMap<$ZodIssueInvalidStringFormat> | undefined; message?: string | undefined; } | undefined): ZodString' is deprecated.

[7m44[0m   input: z.object({ id: z.string().uuid() }),
[7m  [0m [93m                                   ~~~~[0m

[96msrc/actions/voyage/travelers.ts[0m:[93m11[0m:[93m43[0m - [93mwarning[0m[90m ts(6385): [0m'(params?: string | { version?: "v8" | "v1" | "v2" | "v3" | "v4" | "v5" | "v6" | "v7" | undefined; abort?: boolean | undefined; error?: string | $ZodErrorMap<$ZodIssueInvalidStringFormat> | undefined; message?: string | undefined; } | undefined): ZodString' is deprecated.

[7m11[0m const idInput = z.object({ id: z.string().uuid() });
[7m  [0m [93m                                          ~~~~[0m
[96msrc/actions/voyage/travelers.ts[0m:[93m2[0m:[93m14[0m - [93mwarning[0m[90m ts(6133): [0m'inArray' is declared but its value is never read.

[7m2[0m import { eq, inArray } from "drizzle-orm";
[7m [0m [93m             ~~~~~~~[0m

[96msrc/actions/voyage/trips.ts[0m:[93m161[0m:[93m33[0m - [93mwarning[0m[90m ts(6385): [0m'(params?: string | { offset?: boolean | undefined; abort?: boolean | undefined; precision?: number | null | undefined; local?: boolean | undefined; error?: string | $ZodErrorMap<$ZodIssueInvalidStringFormat> | undefined; message?: string | undefined; } | undefined): ZodString' is deprecated.

[7m161[0m   expectedUpdatedAt: z.string().datetime({ offset: true }).nullable().optional(),
[7m   [0m [93m                                ~~~~~~~~[0m
[96msrc/actions/voyage/trips.ts[0m:[93m120[0m:[93m33[0m - [93mwarning[0m[90m ts(6385): [0m'(params?: string | { offset?: boolean | undefined; abort?: boolean | undefined; precision?: number | null | undefined; local?: boolean | undefined; error?: string | $ZodErrorMap<$ZodIssueInvalidStringFormat> | undefined; message?: string | undefined; } | undefined): ZodString' is deprecated.

[7m120[0m   expectedUpdatedAt: z.string().datetime({ offset: true }).nullable().optional(),
[7m   [0m [93m                                ~~~~~~~~[0m

[96msrc/components/blog/AdminPostForm.astro[0m:[93m19[0m:[93m1[0m - [93mwarning[0m[90m ts(6133): [0m'BlogPostFormInput' is declared but its value is never read.

[7m19[0m import type { BlogPostFormInput } from "@/lib/blog/types";
[7m  [0m [93m~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~[0m
[96msrc/components/blog/AdminPostForm.astro[0m:[93m18[0m:[93m61[0m - [93mwarning[0m[90m ts(6196): [0m'BlogPostUpdateInput' is declared but never used.

[7m18[0m import type { BlogEditorTaxonomyOption, BlogPostEditorData, BlogPostUpdateInput } from "@/lib/blog/editor-types";
[7m  [0m [93m                                                            ~~~~~~~~~~~~~~~~~~~[0m
[96msrc/components/blog/AdminPostForm.astro[0m:[93m84[0m:[93m110[0m - [93mwarning[0m[90m ts(6385): [0m'returnValue' is deprecated.

[7m84[0m     window.addEventListener('beforeunload', (event) => { if (!isDirty) return; event.preventDefault(); event.returnValue = ""; });
[7m  [0m [93m                                                                                                             ~~~~~~~~~~~[0m
[96msrc/components/blog/AdminPostForm.astro[0m:[93m75[0m:[93m11[0m - [93mwarning[0m[90m ts(6133): [0m'organizationId' is declared but its value is never read.

[7m75[0m     const organizationId = String(form.querySelector<HTMLInputElement>('input[name="organizationId"]')?.value ?? "").trim() || undefined;
[7m  [0m [93m          ~~~~~~~~~~~~~~[0m
[96msrc/components/blog/AdminPostForm.astro[0m:[93m68[0m:[93m3[0m - [93mwarning[0m[90m ts(6133): [0m'BlogPostUpdateInput' is declared but its value is never read.

[7m68[0m   import type { BlogPostUpdateInput } from "@/lib/blog/editor-types";
[7m  [0m [93m  ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~[0m

[96msrc/components/blog/AdminPostList.astro[0m:[93m86[0m:[93m118[0m - [93mwarning[0m[90m ts(6133): [0m'orgId' is declared but its value is never read.

[7m86[0m   function init() { const dataEl = document.getElementById("admin-post-list-data") as HTMLInputElement | null; const orgId = dataEl?.dataset.organizationId || undefined; const errorText = dataEl?.dataset.tError ?? ""; const bind = <T extends HTMLElement>(selector: string, handler: (element: T) => void) => document.querySelectorAll<T>(selector).forEach((element) => { if (element.dataset.blogBound === "true") return; element.dataset.blogBound = "true"; handler(element); }); const run = async (btn: HTMLButtonElement, operation: (id: string) => Promise<{ error?: { message?: string } }>) => { const id = btn.dataset.postId; if (!id) return; btn.disabled = true; try { const { error } = await operation(id); if (error) toast.error(error.message ?? errorText); else window.location.reload(); } finally { btn.disabled = false; } }; bind<HTMLButtonElement>(".publish-btn", (btn) => btn.addEventListener("click", () => void run(btn, (id) => actions.publishBlogPost({ id })))); bind<HTMLButtonElement>(".unpublish-btn", (btn) => btn.addEventListener("click", () => void run(btn, (id) => actions.unpublishBlogPost({ id })))); bind<HTMLButtonElement>(".archive-btn", (btn) => btn.addEventListener("click", () => void run(btn, (id) => actions.archiveBlogPost({ id })))); bind<HTMLButtonElement>(".restore-btn", (btn) => btn.addEventListener("click", () => void run(btn, (id) => actions.restoreBlogPost({ id })))); bind<HTMLButtonElement>(".duplicate-btn", (btn) => btn.addEventListener("click", () => void run(btn, (id) => actions.duplicateBlogPost({ id })))); bind<HTMLButtonElement>(".delete-btn", (btn) => btn.addEventListener("click", () => { if (!confirm(dataEl?.dataset.tConfirmDelete ?? "")) return; void run(btn, (id) => actions.deleteBlogPost({ id })); })); }
[7m  [0m [93m                                                                                                                     ~~~~~[0m

[96msrc/components/blog/AuthorCard.astro[0m:[93m19[0m:[93m57[0m - [93mwarning[0m[90m ts(6133): [0m'baseUrl' is declared but its value is never read.

[7m19[0m const { locale, blogT, author, publishedAt, categories, baseUrl } = Astro.props;
[7m  [0m [93m                                                        ~~~~~~~[0m

[96msrc/components/blog/NotificationBell.astro[0m:[93m99[0m:[93m13[0m - [93mwarning[0m[90m ts(6133): [0m'root' is declared but its value is never read.

[7m99[0m       const root = document.getElementById('notification-list');
[7m  [0m [93m            ~~~~[0m
[96msrc/components/blog/NotificationBell.astro[0m:[93m91[0m:[93m17[0m - [93mwarning[0m[90m ts(6133): [0m'organizationId' is declared but its value is never read.

[7m91[0m           const organizationId = item.dataset.organizationId || null;
[7m  [0m [93m                ~~~~~~~~~~~~~~[0m

[96msrc/components/blog/cards/PostCardGrid.astro[0m:[93m59[0m:[93m3[0m - [93mwarning[0m[90m ts(6133): [0m'organizationSlug' is declared but its value is never read.

[7m59[0m   organizationSlug = null,
[7m  [0m [93m  ~~~~~~~~~~~~~~~~[0m

[96msrc/components/blog/cards/PostCardHorizontal.astro[0m:[93m58[0m:[93m3[0m - [93mwarning[0m[90m ts(6133): [0m'organizationSlug' is declared but its value is never read.

[7m58[0m   organizationSlug = null,
[7m  [0m [93m  ~~~~~~~~~~~~~~~~[0m

[96msrc/components/blog/sidebars/CategorySidebar.astro[0m:[93m23[0m:[93m48[0m - [93mwarning[0m[90m ts(6133): [0m'baseUrl' is declared but its value is never read.

[7m23[0m const { locale, blogT, categories, activeSlug, baseUrl } = Astro.props;
[7m  [0m [93m                                               ~~~~~~~[0m

[96msrc/components/blog/sidebars/NewsletterSidebar.astro[0m:[93m79[0m:[93m11[0m - [93mwarning[0m[90m ts(6133): [0m'organizationId' is declared but its value is never read.

[7m79[0m     const organizationId = i18nEl?.dataset.org ? String(i18nEl.dataset.org) : null;
[7m  [0m [93m          ~~~~~~~~~~~~~~[0m

[96msrc/components/content/ContentEditor.astro[0m:[93m183[0m:[93m11[0m - [93mwarning[0m[90m ts(6133): [0m'orgId' is declared but its value is never read.

[7m183[0m     const orgId = root.getAttribute('data-org') ?? '';
[7m   [0m [93m          ~~~~~[0m

[96msrc/components/organisms/AdminFormShell.astro[0m:[93m71[0m:[93m19[0m - [93mwarning[0m[90m ts(6385): [0m'returnValue' is deprecated.

[7m71[0m             event.returnValue = "";
[7m  [0m [93m                  ~~~~~~~~~~~[0m

[96msrc/components/services/AdminServiceForm.astro[0m:[93m21[0m:[93m121[0m - [91merror[0m[90m ts(2554): [0mExpected 0-1 arguments, but got 2.

[7m21[0m const [categoryRows, tagRows] = await Promise.all([getServiceCategories(locale, organizationId), getServiceTags(locale, organizationId)]);
[7m  [0m [91m                                                                                                                        ~~~~~~~~~~~~~~[0m
[96msrc/components/services/AdminServiceForm.astro[0m:[93m21[0m:[93m81[0m - [91merror[0m[90m ts(2554): [0mExpected 0-1 arguments, but got 2.

[7m21[0m const [categoryRows, tagRows] = await Promise.all([getServiceCategories(locale, organizationId), getServiceTags(locale, organizationId)]);
[7m  [0m [91m                                                                                ~~~~~~~~~~~~~~[0m
[96msrc/components/services/AdminServiceForm.astro[0m:[93m12[0m:[93m34[0m - [93mwarning[0m[90m ts(6133): [0m'getServiceErrorMessage' is declared but its value is never read.

[7m12[0m import { getServiceTranslations, getServiceErrorMessage } from "@/modules/services/i18n";
[7m  [0m [93m                                 ~~~~~~~~~~~~~~~~~~~~~~[0m

[96msrc/components/services/AdminServiceList.astro[0m:[93m7[0m:[93m34[0m - [93mwarning[0m[90m ts(6133): [0m'getServiceErrorMessage' is declared but its value is never read.

[7m7[0m import { getServiceTranslations, getServiceErrorMessage } from "@/modules/services/i18n";
[7m [0m [93m                                 ~~~~~~~~~~~~~~~~~~~~~~[0m
[96msrc/components/services/AdminServiceList.astro[0m:[93m6[0m:[93m1[0m - [93mwarning[0m[90m ts(6133): [0m'toast' is declared but its value is never read.

[7m6[0m import { toast } from "@atoms/toast";
[7m [0m [93m~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~[0m
[96msrc/components/services/AdminServiceList.astro[0m:[93m65[0m:[93m11[0m - [93mwarning[0m[90m ts(6133): [0m'organizationId' is declared but its value is never read.

[7m65[0m     const organizationId = root.dataset.organizationId || null; const confirmDelete = root.dataset.confirmDelete ?? ""; const confirmArchive = root.dataset.confirmArchive ?? ""; const actionError = root.dataset.actionError ?? ""; const locale = root.dataset.locale ?? "fr";
[7m  [0m [93m          ~~~~~~~~~~~~~~[0m

[96msrc/components/services/ServicesAdminPage.astro[0m:[93m6[0m:[93m34[0m - [93mwarning[0m[90m ts(6133): [0m'getServiceErrorMessage' is declared but its value is never read.

[7m6[0m import { getServiceTranslations, getServiceErrorMessage } from "@/modules/services/i18n";
[7m [0m [93m                                 ~~~~~~~~~~~~~~~~~~~~~~[0m
[96msrc/components/services/ServicesAdminPage.astro[0m:[93m121[0m:[93m11[0m - [93mwarning[0m[90m ts(6133): [0m'organizationId' is declared but its value is never read.

[7m121[0m     const organizationId = root.dataset.organizationId || null;
[7m   [0m [93m          ~~~~~~~~~~~~~~[0m

[96msrc/components/wow/ScrollReveal.astro[0m:[93m110[0m:[93m13[0m - [93mwarning[0m[90m ts(6133): [0m'transforms' is declared but its value is never read.

[7m110[0m       const transforms: Record<string, string> = {
[7m   [0m [93m            ~~~~~~~~~~[0m
[96msrc/components/wow/ScrollReveal.astro[0m:[93m103[0m:[93m13[0m - [93mwarning[0m[90m ts(6133): [0m'direction' is declared but its value is never read.

[7m103[0m       const direction = el.dataset.revealDirection || "up";
[7m   [0m [93m            ~~~~~~~~~[0m

[96msrc/database/loaders/blog-admin-moderation.loader.ts[0m:[93m6[0m:[93m84[0m - [91merror[0m[90m ts(2339): [0mProperty 'organizationId' does not exist on type 'PgTableWithColumns<{ name: "blog_posts"; schema: undefined; columns: { id: PgColumn<{ name: "id"; tableName: "blog_posts"; dataType: "string"; columnType: "PgText"; data: string; driverParam: string; notNull: true; hasDefault: true; ... 6 more ...; generated: undefined; }, {}, {}>; ... 15 more ...; lockedAt: PgColum...'.

[7m6[0m   return organizationId === null ? isNull(blogPosts.organizationId) : eq(blogPosts.organizationId, organizationId);
[7m [0m [91m                                                                                   ~~~~~~~~~~~~~~[0m
[96msrc/database/loaders/blog-admin-moderation.loader.ts[0m:[93m6[0m:[93m53[0m - [91merror[0m[90m ts(2339): [0mProperty 'organizationId' does not exist on type 'PgTableWithColumns<{ name: "blog_posts"; schema: undefined; columns: { id: PgColumn<{ name: "id"; tableName: "blog_posts"; dataType: "string"; columnType: "PgText"; data: string; driverParam: string; notNull: true; hasDefault: true; ... 6 more ...; generated: undefined; }, {}, {}>; ... 15 more ...; lockedAt: PgColum...'.

[7m6[0m   return organizationId === null ? isNull(blogPosts.organizationId) : eq(blogPosts.organizationId, organizationId);
[7m [0m [91m                                                    ~~~~~~~~~~~~~~[0m

[96msrc/database/loaders/blog-admin.loader.ts[0m:[93m53[0m:[93m82[0m - [91merror[0m[90m ts(2339): [0mProperty 'organizationId' does not exist on type 'PgTableWithColumns<{ name: "blog_tags"; schema: undefined; columns: { id: PgColumn<{ name: "id"; tableName: "blog_tags"; dataType: "string"; columnType: "PgText"; data: string; driverParam: string; notNull: true; hasDefault: true; ... 6 more ...; generated: undefined; }, {}, {}>; slug: PgColumn<...>; color: PgColumn...'.

[7m53[0m   return organizationId === null ? isNull(blogTags.organizationId) : eq(blogTags.organizationId, organizationId);
[7m  [0m [91m                                                                                 ~~~~~~~~~~~~~~[0m
[96msrc/database/loaders/blog-admin.loader.ts[0m:[93m53[0m:[93m52[0m - [91merror[0m[90m ts(2339): [0mProperty 'organizationId' does not exist on type 'PgTableWithColumns<{ name: "blog_tags"; schema: undefined; columns: { id: PgColumn<{ name: "id"; tableName: "blog_tags"; dataType: "string"; columnType: "PgText"; data: string; driverParam: string; notNull: true; hasDefault: true; ... 6 more ...; generated: undefined; }, {}, {}>; slug: PgColumn<...>; color: PgColumn...'.

[7m53[0m   return organizationId === null ? isNull(blogTags.organizationId) : eq(blogTags.organizationId, organizationId);
[7m  [0m [91m                                                   ~~~~~~~~~~~~~~[0m
[96msrc/database/loaders/blog-admin.loader.ts[0m:[93m50[0m:[93m94[0m - [91merror[0m[90m ts(2339): [0mProperty 'organizationId' does not exist on type 'PgTableWithColumns<{ name: "blog_categories"; schema: undefined; columns: { id: PgColumn<{ name: "id"; tableName: "blog_categories"; dataType: "string"; columnType: "PgText"; data: string; driverParam: string; notNull: true; ... 7 more ...; generated: undefined; }, {}, {}>; ... 6 more ...; updatedAt: PgColumn<...>; ...'.

[7m50[0m   return organizationId === null ? isNull(blogCategories.organizationId) : eq(blogCategories.organizationId, organizationId);
[7m  [0m [91m                                                                                             ~~~~~~~~~~~~~~[0m
[96msrc/database/loaders/blog-admin.loader.ts[0m:[93m50[0m:[93m58[0m - [91merror[0m[90m ts(2339): [0mProperty 'organizationId' does not exist on type 'PgTableWithColumns<{ name: "blog_categories"; schema: undefined; columns: { id: PgColumn<{ name: "id"; tableName: "blog_categories"; dataType: "string"; columnType: "PgText"; data: string; driverParam: string; notNull: true; ... 7 more ...; generated: undefined; }, {}, {}>; ... 6 more ...; updatedAt: PgColumn<...>; ...'.

[7m50[0m   return organizationId === null ? isNull(blogCategories.organizationId) : eq(blogCategories.organizationId, organizationId);
[7m  [0m [91m                                                         ~~~~~~~~~~~~~~[0m
[96msrc/database/loaders/blog-admin.loader.ts[0m:[93m47[0m:[93m106[0m - [91merror[0m[90m ts(2339): [0mProperty 'organizationId' does not exist on type 'PgTableWithColumns<{ name: "blog_post_translations"; schema: undefined; columns: { id: PgColumn<{ name: "id"; tableName: "blog_post_translations"; dataType: "string"; columnType: "PgText"; data: string; driverParam: string; ... 8 more ...; generated: undefined; }, {}, {}>; ... 14 more ...; updatedAt: PgColumn<...>; ...'.

[7m47[0m   return organizationId === null ? isNull(blogPostTranslations.organizationId) : eq(blogPostTranslations.organizationId, organizationId);
[7m  [0m [91m                                                                                                         ~~~~~~~~~~~~~~[0m
[96msrc/database/loaders/blog-admin.loader.ts[0m:[93m47[0m:[93m64[0m - [91merror[0m[90m ts(2339): [0mProperty 'organizationId' does not exist on type 'PgTableWithColumns<{ name: "blog_post_translations"; schema: undefined; columns: { id: PgColumn<{ name: "id"; tableName: "blog_post_translations"; dataType: "string"; columnType: "PgText"; data: string; driverParam: string; ... 8 more ...; generated: undefined; }, {}, {}>; ... 14 more ...; updatedAt: PgColumn<...>; ...'.

[7m47[0m   return organizationId === null ? isNull(blogPostTranslations.organizationId) : eq(blogPostTranslations.organizationId, organizationId);
[7m  [0m [91m                                                               ~~~~~~~~~~~~~~[0m
[96msrc/database/loaders/blog-admin.loader.ts[0m:[93m44[0m:[93m84[0m - [91merror[0m[90m ts(2339): [0mProperty 'organizationId' does not exist on type 'PgTableWithColumns<{ name: "blog_posts"; schema: undefined; columns: { id: PgColumn<{ name: "id"; tableName: "blog_posts"; dataType: "string"; columnType: "PgText"; data: string; driverParam: string; notNull: true; hasDefault: true; ... 6 more ...; generated: undefined; }, {}, {}>; ... 15 more ...; lockedAt: PgColum...'.

[7m44[0m   return organizationId === null ? isNull(blogPosts.organizationId) : eq(blogPosts.organizationId, organizationId);
[7m  [0m [91m                                                                                   ~~~~~~~~~~~~~~[0m
[96msrc/database/loaders/blog-admin.loader.ts[0m:[93m44[0m:[93m53[0m - [91merror[0m[90m ts(2339): [0mProperty 'organizationId' does not exist on type 'PgTableWithColumns<{ name: "blog_posts"; schema: undefined; columns: { id: PgColumn<{ name: "id"; tableName: "blog_posts"; dataType: "string"; columnType: "PgText"; data: string; driverParam: string; notNull: true; hasDefault: true; ... 6 more ...; generated: undefined; }, {}, {}>; ... 15 more ...; lockedAt: PgColum...'.

[7m44[0m   return organizationId === null ? isNull(blogPosts.organizationId) : eq(blogPosts.organizationId, organizationId);
[7m  [0m [91m                                                    ~~~~~~~~~~~~~~[0m

[96msrc/database/loaders/blog.loader.ts[0m:[93m1396[0m:[93m34[0m - [91merror[0m[90m ts(2339): [0mProperty 'organizationId' does not exist on type 'PgTableWithColumns<{ name: "blog_notifications"; schema: undefined; columns: { id: PgColumn<{ name: "id"; tableName: "blog_notifications"; dataType: "string"; columnType: "PgText"; data: string; driverParam: string; notNull: true; ... 7 more ...; generated: undefined; }, {}, {}>; ... 8 more ...; createdAt: PgColumn<...'.

[7m1396[0m           : eq(blogNotifications.organizationId, organizationId),
[7m    [0m [91m                                 ~~~~~~~~~~~~~~[0m
[96msrc/database/loaders/blog.loader.ts[0m:[93m1395[0m:[93m38[0m - [91merror[0m[90m ts(2339): [0mProperty 'organizationId' does not exist on type 'PgTableWithColumns<{ name: "blog_notifications"; schema: undefined; columns: { id: PgColumn<{ name: "id"; tableName: "blog_notifications"; dataType: "string"; columnType: "PgText"; data: string; driverParam: string; notNull: true; ... 7 more ...; generated: undefined; }, {}, {}>; ... 8 more ...; createdAt: PgColumn<...'.

[7m1395[0m           ? isNull(blogNotifications.organizationId)
[7m    [0m [91m                                     ~~~~~~~~~~~~~~[0m
[96msrc/database/loaders/blog.loader.ts[0m:[93m1358[0m:[93m36[0m - [91merror[0m[90m ts(2339): [0mProperty 'organizationId' does not exist on type 'PgTableWithColumns<{ name: "blog_notifications"; schema: undefined; columns: { id: PgColumn<{ name: "id"; tableName: "blog_notifications"; dataType: "string"; columnType: "PgText"; data: string; driverParam: string; notNull: true; ... 7 more ...; generated: undefined; }, {}, {}>; ... 8 more ...; createdAt: PgColumn<...'.

[7m1358[0m             : eq(blogNotifications.organizationId, opts.organizationId!)
[7m    [0m [91m                                   ~~~~~~~~~~~~~~[0m
[96msrc/database/loaders/blog.loader.ts[0m:[93m1357[0m:[93m40[0m - [91merror[0m[90m ts(2339): [0mProperty 'organizationId' does not exist on type 'PgTableWithColumns<{ name: "blog_notifications"; schema: undefined; columns: { id: PgColumn<{ name: "id"; tableName: "blog_notifications"; dataType: "string"; columnType: "PgText"; data: string; driverParam: string; notNull: true; ... 7 more ...; generated: undefined; }, {}, {}>; ... 8 more ...; createdAt: PgColumn<...'.

[7m1357[0m             ? isNull(blogNotifications.organizationId)
[7m    [0m [91m                                       ~~~~~~~~~~~~~~[0m
[96msrc/database/loaders/blog.loader.ts[0m:[93m51[0m:[93m16[0m - [91merror[0m[90m ts(2339): [0mProperty 'organizationId' does not exist on type 'PgTableWithColumns<{ name: "blog_posts"; schema: undefined; columns: { id: PgColumn<{ name: "id"; tableName: "blog_posts"; dataType: "string"; columnType: "PgText"; data: string; driverParam: string; notNull: true; hasDefault: true; ... 6 more ...; generated: undefined; }, {}, {}>; ... 15 more ...; lockedAt: PgColum...'.
  Property 'organizationId' does not exist on type 'PgTableWithColumns<{ name: "blog_posts"; schema: undefined; columns: { id: PgColumn<{ name: "id"; tableName: "blog_posts"; dataType: "string"; columnType: "PgText"; data: string; driverParam: string; notNull: true; hasDefault: true; ... 6 more ...; generated: undefined; }, {}, {}>; ... 15 more ...; lockedAt: PgColum...'.

[7m51[0m     : eq(table.organizationId, organizationId);
[7m  [0m [91m               ~~~~~~~~~~~~~~[0m
[96msrc/database/loaders/blog.loader.ts[0m:[93m50[0m:[93m20[0m - [91merror[0m[90m ts(2339): [0mProperty 'organizationId' does not exist on type 'PgTableWithColumns<{ name: "blog_posts"; schema: undefined; columns: { id: PgColumn<{ name: "id"; tableName: "blog_posts"; dataType: "string"; columnType: "PgText"; data: string; driverParam: string; notNull: true; hasDefault: true; ... 6 more ...; generated: undefined; }, {}, {}>; ... 15 more ...; lockedAt: PgColum...'.
  Property 'organizationId' does not exist on type 'PgTableWithColumns<{ name: "blog_posts"; schema: undefined; columns: { id: PgColumn<{ name: "id"; tableName: "blog_posts"; dataType: "string"; columnType: "PgText"; data: string; driverParam: string; notNull: true; hasDefault: true; ... 6 more ...; generated: undefined; }, {}, {}>; ... 15 more ...; lockedAt: PgColum...'.

[7m50[0m     ? isNull(table.organizationId)
[7m  [0m [91m                   ~~~~~~~~~~~~~~[0m

[96msrc/database/loaders/media.loader.ts[0m:[93m40[0m:[93m21[0m - [91merror[0m[90m ts(2339): [0mProperty 'organizationId' does not exist on type 'PgTableWithColumns<{ name: "media_files"; schema: undefined; columns: { id: PgColumn<{ name: "id"; tableName: "media_files"; dataType: "string"; columnType: "PgText"; data: string; driverParam: string; notNull: true; hasDefault: true; ... 6 more ...; generated: undefined; }, {}, {}>; ... 8 more ...; updatedAt: PgCol...'.

[7m40[0m     : eq(mediaFiles.organizationId, organizationId);
[7m  [0m [91m                    ~~~~~~~~~~~~~~[0m
[96msrc/database/loaders/media.loader.ts[0m:[93m39[0m:[93m25[0m - [91merror[0m[90m ts(2339): [0mProperty 'organizationId' does not exist on type 'PgTableWithColumns<{ name: "media_files"; schema: undefined; columns: { id: PgColumn<{ name: "id"; tableName: "media_files"; dataType: "string"; columnType: "PgText"; data: string; driverParam: string; notNull: true; hasDefault: true; ... 6 more ...; generated: undefined; }, {}, {}>; ... 8 more ...; updatedAt: PgCol...'.

[7m39[0m     ? isNull(mediaFiles.organizationId)
[7m  [0m [91m                        ~~~~~~~~~~~~~~[0m
[96msrc/database/loaders/media.loader.ts[0m:[93m34[0m:[93m23[0m - [91merror[0m[90m ts(2339): [0mProperty 'organizationId' does not exist on type 'PgTableWithColumns<{ name: "media_folders"; schema: undefined; columns: { id: PgColumn<{ name: "id"; tableName: "media_folders"; dataType: "string"; columnType: "PgText"; data: string; driverParam: string; notNull: true; ... 7 more ...; generated: undefined; }, {}, {}>; ... 4 more ...; updatedAt: PgColumn<...>; }; d...'.

[7m34[0m     : eq(mediaFolders.organizationId, organizationId);
[7m  [0m [91m                      ~~~~~~~~~~~~~~[0m
[96msrc/database/loaders/media.loader.ts[0m:[93m33[0m:[93m27[0m - [91merror[0m[90m ts(2339): [0mProperty 'organizationId' does not exist on type 'PgTableWithColumns<{ name: "media_folders"; schema: undefined; columns: { id: PgColumn<{ name: "id"; tableName: "media_folders"; dataType: "string"; columnType: "PgText"; data: string; driverParam: string; notNull: true; ... 7 more ...; generated: undefined; }, {}, {}>; ... 4 more ...; updatedAt: PgColumn<...>; }; d...'.

[7m33[0m     ? isNull(mediaFolders.organizationId)
[7m  [0m [91m                          ~~~~~~~~~~~~~~[0m

[96msrc/database/schemas/blog.schema.ts[0m:[93m520[0m:[93m57[0m - [93mwarning[0m[90m ts(6133): [0m'one' is declared but its value is never read.

[7m520[0m export const blogTagsRelations = relations(blogTags, ({ one, many }) => ({
[7m   [0m [93m                                                        ~~~[0m

[96msrc/database/schemas/policies.schema.ts[0m:[93m5[0m:[93m3[0m - [93mwarning[0m[90m ts(6133): [0m'varchar' is declared but its value is never read.

[7m5[0m   varchar,
[7m [0m [93m  ~~~~~~~[0m

[96msrc/database/schemas/services.schema.ts[0m:[93m1[0m:[93m10[0m - [93mwarning[0m[90m ts(6133): [0m'relations' is declared but its value is never read.

[7m1[0m import { relations, sql } from "drizzle-orm";
[7m [0m [93m         ~~~~~~~~~[0m

[96msrc/layouts/BaseLayout.astro[0m:[93m135[0m:[93m24[0m - [93mwarning[0m[90m astro(4000): [0mThis script will be treated as if it has the `is:inline` directive because it contains an attribute. Therefore, features that require processing (e.g. using TypeScript or npm packages in the script) are unavailable.

See docs for more details: https://docs.astro.build/en/guides/client-side-scripts/#script-processing.

Add the `is:inline` directive explicitly to silence this hint.

[7m135[0m     {jsonLd && <script type="application/ld+json" set:html={safeJsonLd(jsonLd)} />}
[7m   [0m [93m                       ~~~~[0m

[96msrc/lib/query-filters.ts[0m:[93m14[0m:[93m46[0m - [93mwarning[0m[90m ts(6385): [0m'ZodTypeAny' is deprecated.

[7m14[0m export function parseListFilters<T extends z.ZodTypeAny>(schema: T, raw: unknown, fallbackRaw: unknown = {}): z.infer<T> {
[7m  [0m [93m                                             ~~~~~~~~~~[0m

[96msrc/lib/blog/constants.ts[0m:[93m2[0m:[93m10[0m - [93mwarning[0m[90m ts(6133): [0m'assertTransition' is declared but its value is never read.

[7m2[0m import { assertTransition, canTransition, type WorkflowDefinition } from "@/lib/cms/workflow";
[7m [0m [93m         ~~~~~~~~~~~~~~~~[0m

[96msrc/lib/blog/validation.ts[0m:[93m62[0m:[93m62[0m - [93mwarning[0m[90m ts(6385): [0m'ZodIssueCode' is deprecated.

[7m62[0m   if (data.publishedAt !== undefined) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["publishedAt"], message: "La date de publication doit ├¬tre modifi├®e via une action de lifecycle explicite." });
[7m  [0m [93m                                                             ~~~~~~~~~~~~[0m
[96msrc/lib/blog/validation.ts[0m:[93m61[0m:[93m57[0m - [93mwarning[0m[90m ts(6385): [0m'ZodIssueCode' is deprecated.

[7m61[0m   if (data.status !== undefined) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["status"], message: "Le statut doit ├¬tre modifi├® via une action de lifecycle explicite." });
[7m  [0m [93m                                                        ~~~~~~~~~~~~[0m

[96msrc/lib/newsletter/blog-newsletter-service.ts[0m:[93m361[0m:[93m39[0m - [91merror[0m[90m ts(2339): [0mProperty 'organizationId' does not exist on type 'PgTableWithColumns<{ name: "blog_subscribers"; schema: undefined; columns: { id: PgColumn<{ name: "id"; tableName: "blog_subscribers"; dataType: "string"; columnType: "PgText"; data: string; driverParam: string; notNull: true; ... 7 more ...; generated: undefined; }, {}, {}>; ... 13 more ...; updatedAt: PgColumn<......'.

[7m361[0m       organizationId: blogSubscribers.organizationId,
[7m   [0m [91m                                      ~~~~~~~~~~~~~~[0m
[96msrc/lib/newsletter/blog-newsletter-service.ts[0m:[93m294[0m:[93m39[0m - [91merror[0m[90m ts(2339): [0mProperty 'organizationId' does not exist on type 'PgTableWithColumns<{ name: "blog_subscribers"; schema: undefined; columns: { id: PgColumn<{ name: "id"; tableName: "blog_subscribers"; dataType: "string"; columnType: "PgText"; data: string; driverParam: string; notNull: true; ... 7 more ...; generated: undefined; }, {}, {}>; ... 13 more ...; updatedAt: PgColumn<......'.

[7m294[0m       organizationId: blogSubscribers.organizationId,
[7m   [0m [91m                                      ~~~~~~~~~~~~~~[0m
[96msrc/lib/newsletter/blog-newsletter-service.ts[0m:[93m173[0m:[93m8[0m - [91merror[0m[90m ts(2769): [0mNo overload matches this call.
  Overload 1 of 2, '(value: { locale: "fr" | "en" | "es" | "ar" | SQL<unknown> | Placeholder<string, any>; email: string | SQL<unknown> | Placeholder<string, any>; id?: string | SQL<...> | Placeholder<...> | undefined; ... 11 more ...; unsubscribedAt?: Date | ... 3 more ... | undefined; }): PgInsertBase<...>', gave the following error.
    Object literal may only specify known properties, and 'organizationId' does not exist in type '{ locale: "fr" | "en" | "es" | "ar" | SQL<unknown> | Placeholder<string, any>; email: string | SQL<unknown> | Placeholder<string, any>; id?: string | SQL<unknown> | Placeholder<...> | undefined; ... 11 more ...; unsubscribedAt?: Date | ... 3 more ... | undefined; }'.
  Overload 2 of 2, '(values: { locale: "fr" | "en" | "es" | "ar" | SQL<unknown> | Placeholder<string, any>; email: string | SQL<unknown> | Placeholder<string, any>; id?: string | SQL<...> | Placeholder<...> | undefined; ... 11 more ...; unsubscribedAt?: Date | ... 3 more ... | undefined; }[]): PgInsertBase<...>', gave the following error.
    Object literal may only specify known properties, and 'email' does not exist in type '{ locale: "fr" | "en" | "es" | "ar" | SQL<unknown> | Placeholder<string, any>; email: string | SQL<unknown> | Placeholder<string, any>; id?: string | SQL<unknown> | Placeholder<...> | undefined; ... 11 more ...; unsubscribedAt?: Date | ... 3 more ... | undefined; }[]'.

[7m173[0m       .values({
[7m   [0m [91m       ~~~~~~[0m
[96msrc/lib/newsletter/blog-newsletter-service.ts[0m:[93m141[0m:[93m32[0m - [91merror[0m[90m ts(2339): [0mProperty 'organizationId' does not exist on type 'PgTableWithColumns<{ name: "blog_subscribers"; schema: undefined; columns: { id: PgColumn<{ name: "id"; tableName: "blog_subscribers"; dataType: "string"; columnType: "PgText"; data: string; driverParam: string; notNull: true; ... 7 more ...; generated: undefined; }, {}, {}>; ... 13 more ...; updatedAt: PgColumn<......'.

[7m141[0m       : isNull(blogSubscribers.organizationId);
[7m   [0m [91m                               ~~~~~~~~~~~~~~[0m
[96msrc/lib/newsletter/blog-newsletter-service.ts[0m:[93m140[0m:[93m28[0m - [91merror[0m[90m ts(2339): [0mProperty 'organizationId' does not exist on type 'PgTableWithColumns<{ name: "blog_subscribers"; schema: undefined; columns: { id: PgColumn<{ name: "id"; tableName: "blog_subscribers"; dataType: "string"; columnType: "PgText"; data: string; driverParam: string; notNull: true; ... 7 more ...; generated: undefined; }, {}, {}>; ... 13 more ...; updatedAt: PgColumn<......'.

[7m140[0m       ? eq(blogSubscribers.organizationId, input.organizationId)
[7m   [0m [91m                           ~~~~~~~~~~~~~~[0m

[96msrc/modules/services/admin/loader.ts[0m:[93m59[0m:[93m12[0m - [91merror[0m[90m ts(2741): [0mProperty 'organizationId' is missing in type '{ id: string; providerId: string; slug: string; status: "DRAFT" | "PUBLISHED" | "ARCHIVED" | "DELETED"; coverImageId: string | null; priceMinor: number | null; currency: string | null; ... 13 more ...; lockedAt: Date | null; }' but required in type '{ id: string; organizationId: string | null; providerId: string; slug: string; status: "DRAFT" | "PUBLISHED" | "ARCHIVED" | "DELETED"; coverImageId: string | null; priceMinor: number | null; ... 11 more ...; updatedAt: Date; }'.

[7m59[0m   return { service: row.service, translation: row.translation ? { locale: row.translation.locale, title: row.translation.title, slug: row.translation.slug, excerpt: row.translation.excerpt, content: row.translation.content, locationLabel: row.translation.locationLabel, locationAddress: row.translation.locationAddress, metaTitle: row.translation.metaTitle, metaDescription: row.translation.metaDescription, metaKeywords: row.translation.metaKeywords, canonicalUrl: row.translation.canonicalUrl, ogTitle: row.translation.ogTitle, ogDescription: row.translation.ogDescription, ogImageId: row.translation.ogImageId } : null, provider: row.provider, coverMedia: null, categories: categories.map((item) => ({ id: item.id, slug: item.slug, name: item.name ?? null })), tags: tags.map((item) => ({ id: item.id, slug: item.slug, name: item.name ?? null })), media, availability, seo: seo[0] ?? null, availableLocales: locales.map((item) => item.locale), revisions, lock: lockRows[0] && lockRows[0].expiresAt > new Date() ? lockRows[0] : null };
[7m  [0m [91m           ~~~~~~~[0m
[96msrc/modules/services/admin/loader.ts[0m:[93m41[0m:[93m86[0m - [91merror[0m[90m ts(2741): [0mProperty 'organizationId' is missing in type '{ id: string; providerId: string; slug: string; status: "DRAFT" | "PUBLISHED" | "ARCHIVED" | "DELETED"; coverImageId: string | null; priceMinor: number | null; currency: string | null; ... 13 more ...; lockedAt: Date | null; }' but required in type '{ id: string; organizationId: string | null; providerId: string; slug: string; status: "DRAFT" | "PUBLISHED" | "ARCHIVED" | "DELETED"; coverImageId: string | null; priceMinor: number | null; ... 11 more ...; updatedAt: Date; }'.

[7m41[0m   const items = rows.map(({ service, translation, provider }): ServiceListItem => ({ service, translation: translation ? { locale: translation.locale, title: translation.title, slug: translation.slug, excerpt: translation.excerpt, content: translation.content, locationLabel: translation.locationLabel, locationAddress: translation.locationAddress, metaTitle: translation.metaTitle, metaDescription: translation.metaDescription, metaKeywords: translation.metaKeywords, canonicalUrl: translation.canonicalUrl, ogTitle: translation.ogTitle, ogDescription: translation.ogDescription, ogImageId: translation.ogImageId } : null, provider, categories: categoriesByService.get(service.id) ?? [], coverMedia: coverByService.get(service.id) ?? null }));
[7m  [0m [91m                                                                                     ~~~~~~~[0m
[96msrc/modules/services/admin/loader.ts[0m:[93m34[0m:[93m24[0m - [93mwarning[0m[90m ts(6133): [0m'tagRows' is declared but its value is never read.

[7m34[0m   const [categoryRows, tagRows, mediaRows] = await Promise.all([
[7m  [0m [93m                       ~~~~~~~[0m

[96msrc/modules/services/components/single/ServiceDetail.astro[0m:[93m66[0m:[93m11[0m - [93mwarning[0m[90m ts(6133): [0m'organizationId' is declared but its value is never read.

[7m66[0m     const organizationId = root.dataset.organizationId || null;
[7m  [0m [93m          ~~~~~~~~~~~~~~[0m

[96msrc/modules/services/components/single/ServiceEngagement.astro[0m:[93m52[0m:[93m53[0m - [93mwarning[0m[90m ts(6133): [0m'organizationId' is declared but its value is never read.

[7m52[0m     const serviceId = root.dataset.serviceId; const organizationId = root.dataset.organizationId || null; const locale = root.dataset.locale ?? "fr"; if (!serviceId) continue;
[7m  [0m [93m                                                    ~~~~~~~~~~~~~~[0m

[96msrc/modules/services/loaders/index.ts[0m:[93m73[0m:[93m9[0m - [91merror[0m[90m ts(2322): [0mType '{ service: { id: string; providerId: string; slug: string; status: "DRAFT" | "PUBLISHED" | "ARCHIVED" | "DELETED"; coverImageId: string | null; priceMinor: number | null; currency: string | null; ... 13 more ...; lockedAt: Date | null; }; translation: { ...; } | null; provider: { ...; } | null; categories: { ...; }[...' is not assignable to type 'ServiceListItem[]'.
  Type '{ service: { id: string; providerId: string; slug: string; status: "DRAFT" | "PUBLISHED" | "ARCHIVED" | "DELETED"; coverImageId: string | null; priceMinor: number | null; currency: string | null; ... 13 more ...; lockedAt: Date | null; }; translation: { ...; } | null; provider: { ...; } | null; categories: { ...; }[...' is not assignable to type 'ServiceListItem'.
    Types of property 'service' are incompatible.
      Property 'organizationId' is missing in type '{ id: string; providerId: string; slug: string; status: "DRAFT" | "PUBLISHED" | "ARCHIVED" | "DELETED"; coverImageId: string | null; priceMinor: number | null; currency: string | null; ... 13 more ...; lockedAt: Date | null; }' but required in type '{ id: string; organizationId: string | null; providerId: string; slug: string; status: "DRAFT" | "PUBLISHED" | "ARCHIVED" | "DELETED"; coverImageId: string | null; priceMinor: number | null; ... 11 more ...; updatedAt: Date; }'.

[7m73[0m   const items: ServiceListItem[] = rows.map(({ service, translation, provider }) => ({ service, translation: translation ? { locale: translation.locale, title: translation.title, slug: translation.slug, excerpt: translation.excerpt, content: translation.content, locationLabel: translation.locationLabel, locationAddress: translation.locationAddress, metaTitle: translation.metaTitle, metaDescription: translation.metaDescription, metaKeywords: translation.metaKeywords, canonicalUrl: translation.canonicalUrl, ogTitle: translation.ogTitle, ogDescription: translation.ogDescription, ogImageId: translation.ogImageId } : null, provider, categories: categories.get(service.id) ?? [], coverMedia: coverMedia.get(service.id) ?? null }));
[7m  [0m [91m        ~~~~~[0m
[96msrc/modules/services/loaders/index.ts[0m:[93m35[0m:[93m5[0m - [91merror[0m[90m ts(2741): [0mProperty 'organizationId' is missing in type '{ id: string; providerId: string; slug: string; status: "DRAFT" | "PUBLISHED" | "ARCHIVED" | "DELETED"; coverImageId: string | null; priceMinor: number | null; currency: string | null; ... 13 more ...; lockedAt: Date | null; }' but required in type '{ id: string; organizationId: string | null; providerId: string; slug: string; status: "DRAFT" | "PUBLISHED" | "ARCHIVED" | "DELETED"; coverImageId: string | null; priceMinor: number | null; ... 11 more ...; updatedAt: Date; }'.

[7m35[0m     service: row.service,
[7m  [0m [91m    ~~~~~~~[0m

[96msrc/modules/services/permissions/index.ts[0m:[93m78[0m:[93m17[0m - [93mwarning[0m[90m ts(80006): [0mThis may be converted to an async function.

[7m78[0m export function serviceRateLimit(_context: unknown, userId: string, scope: string) {
[7m  [0m [93m                ~~~~~~~~~~~~~~~~[0m

[96msrc/modules/services/validation/index.ts[0m:[93m106[0m:[93m25[0m - [93mwarning[0m[90m ts(6385): [0m'(params?: string | { version?: "v8" | "v1" | "v2" | "v3" | "v4" | "v5" | "v6" | "v7" | undefined; abort?: boolean | undefined; error?: string | $ZodErrorMap<$ZodIssueInvalidStringFormat> | undefined; message?: string | undefined; } | undefined): ZodString' is deprecated.

[7m106[0m   serviceId: z.string().uuid(), dayOfWeek: z.coerce.number().int().min(0).max(6), startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/), endTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/), timezone: z.string().trim().min(1).max(64), maxParticipants: z.coerce.number().int().positive().max(1_000_000).optional().nullable(),
[7m   [0m [93m                        ~~~~[0m
[96msrc/modules/services/validation/index.ts[0m:[93m101[0m:[93m275[0m - [93mwarning[0m[90m ts(6385): [0m'(params?: string | { version?: "v8" | "v1" | "v2" | "v3" | "v4" | "v5" | "v6" | "v7" | undefined; abort?: boolean | undefined; error?: string | $ZodErrorMap<$ZodIssueInvalidStringFormat> | undefined; message?: string | undefined; } | undefined): ZodString' is deprecated.

[7m101[0m   page: z.coerce.number().int().positive().max(10_000).default(1), limit: z.coerce.number().int().min(1).max(100).default(20), search: z.string().trim().max(120).optional(), status: serviceStatusSchema.optional(), categoryId: z.string().uuid().optional(), tagId: z.string().uuid().optional(), providerId: z.string().trim().min(1).max(200).optional(), featured: queryBooleanSchema, mobile: queryBooleanSchema, locale: localeSchema.optional(), sortBy: z.enum(["createdAt", "updatedAt", "publishedAt", "title", "priceMinor", "ratingAverage100", "viewCount"]).default("updatedAt"), sortOrder: z.enum(["asc", "desc"]).default("desc"),
[7m   [0m [93m                                                                                                                                                                                                                                                                                  ~~~~[0m
[96msrc/modules/services/validation/index.ts[0m:[93m101[0m:[93m238[0m - [93mwarning[0m[90m ts(6385): [0m'(params?: string | { version?: "v8" | "v1" | "v2" | "v3" | "v4" | "v5" | "v6" | "v7" | undefined; abort?: boolean | undefined; error?: string | $ZodErrorMap<$ZodIssueInvalidStringFormat> | undefined; message?: string | undefined; } | undefined): ZodString' is deprecated.

[7m101[0m   page: z.coerce.number().int().positive().max(10_000).default(1), limit: z.coerce.number().int().min(1).max(100).default(20), search: z.string().trim().max(120).optional(), status: serviceStatusSchema.optional(), categoryId: z.string().uuid().optional(), tagId: z.string().uuid().optional(), providerId: z.string().trim().min(1).max(200).optional(), featured: queryBooleanSchema, mobile: queryBooleanSchema, locale: localeSchema.optional(), sortBy: z.enum(["createdAt", "updatedAt", "publishedAt", "title", "priceMinor", "ratingAverage100", "viewCount"]).default("updatedAt"), sortOrder: z.enum(["asc", "desc"]).default("desc"),
[7m   [0m [93m                                                                                                                                                                                                                                             ~~~~[0m
[96msrc/modules/services/validation/index.ts[0m:[93m96[0m:[93m275[0m - [93mwarning[0m[90m ts(6385): [0m'(params?: string | { version?: "v8" | "v1" | "v2" | "v3" | "v4" | "v5" | "v6" | "v7" | undefined; abort?: boolean | undefined; error?: string | $ZodErrorMap<$ZodIssueInvalidStringFormat> | undefined; message?: string | undefined; } | undefined): ZodString' is deprecated.

[7m96[0m   page: z.coerce.number().int().positive().max(10_000).default(1), limit: z.coerce.number().int().min(1).max(100).default(20), search: z.string().trim().max(120).optional(), status: serviceStatusSchema.optional(), categoryId: z.string().uuid().optional(), tagId: z.string().uuid().optional(), authorId: z.string().trim().min(1).max(200).optional(), providerId: z.string().trim().min(1).max(200).optional(), featured: queryBooleanSchema, mobile: queryBooleanSchema, locale: localeSchema.optional(), sortBy: z.enum(["createdAt", "updatedAt", "publishedAt", "title", "priceMinor", "ratingAverage100", "viewCount"]).default("updatedAt"), sortOrder: z.enum(["asc", "desc"]).default("desc"),
[7m  [0m [93m                                                                                                                                                                                                                                                                                  ~~~~[0m
[96msrc/modules/services/validation/index.ts[0m:[93m96[0m:[93m238[0m - [93mwarning[0m[90m ts(6385): [0m'(params?: string | { version?: "v8" | "v1" | "v2" | "v3" | "v4" | "v5" | "v6" | "v7" | undefined; abort?: boolean | undefined; error?: string | $ZodErrorMap<$ZodIssueInvalidStringFormat> | undefined; message?: string | undefined; } | undefined): ZodString' is deprecated.

[7m96[0m   page: z.coerce.number().int().positive().max(10_000).default(1), limit: z.coerce.number().int().min(1).max(100).default(20), search: z.string().trim().max(120).optional(), status: serviceStatusSchema.optional(), categoryId: z.string().uuid().optional(), tagId: z.string().uuid().optional(), authorId: z.string().trim().min(1).max(200).optional(), providerId: z.string().trim().min(1).max(200).optional(), featured: queryBooleanSchema, mobile: queryBooleanSchema, locale: localeSchema.optional(), sortBy: z.enum(["createdAt", "updatedAt", "publishedAt", "title", "priceMinor", "ratingAverage100", "viewCount"]).default("updatedAt"), sortOrder: z.enum(["asc", "desc"]).default("desc"),
[7m  [0m [93m                                                                                                                                                                                                                                             ~~~~[0m
[96msrc/modules/services/validation/index.ts[0m:[93m91[0m:[93m65[0m - [93mwarning[0m[90m ts(6385): [0m'(params?: string | { version?: "v8" | "v1" | "v2" | "v3" | "v4" | "v5" | "v6" | "v7" | undefined; abort?: boolean | undefined; error?: string | $ZodErrorMap<$ZodIssueInvalidStringFormat> | undefined; message?: string | undefined; } | undefined): ZodString' is deprecated.

[7m91[0m   commentId: z.string().uuid().optional(), reviewId: z.string().uuid().optional(),
[7m  [0m [93m                                                                ~~~~[0m
[96msrc/modules/services/validation/index.ts[0m:[93m91[0m:[93m25[0m - [93mwarning[0m[90m ts(6385): [0m'(params?: string | { version?: "v8" | "v1" | "v2" | "v3" | "v4" | "v5" | "v6" | "v7" | undefined; abort?: boolean | undefined; error?: string | $ZodErrorMap<$ZodIssueInvalidStringFormat> | undefined; message?: string | undefined; } | undefined): ZodString' is deprecated.

[7m91[0m   commentId: z.string().uuid().optional(), reviewId: z.string().uuid().optional(),
[7m  [0m [93m                        ~~~~[0m
[96msrc/modules/services/validation/index.ts[0m:[93m90[0m:[93m25[0m - [93mwarning[0m[90m ts(6385): [0m'(params?: string | { version?: "v8" | "v1" | "v2" | "v3" | "v4" | "v5" | "v6" | "v7" | undefined; abort?: boolean | undefined; error?: string | $ZodErrorMap<$ZodIssueInvalidStringFormat> | undefined; message?: string | undefined; } | undefined): ZodString' is deprecated.

[7m90[0m   serviceId: z.string().uuid(),
[7m  [0m [93m                        ~~~~[0m
[96msrc/modules/services/validation/index.ts[0m:[93m83[0m:[93m18[0m - [93mwarning[0m[90m ts(6385): [0m'(params?: string | { version?: "v8" | "v1" | "v2" | "v3" | "v4" | "v5" | "v6" | "v7" | undefined; abort?: boolean | undefined; error?: string | $ZodErrorMap<$ZodIssueInvalidStringFormat> | undefined; message?: string | undefined; } | undefined): ZodString' is deprecated.

[7m83[0m   id: z.string().uuid(),
[7m  [0m [93m                 ~~~~[0m
[96msrc/modules/services/validation/index.ts[0m:[93m77[0m:[93m28[0m - [93mwarning[0m[90m ts(6385): [0m'(params?: string | { normalize?: boolean | undefined; pattern?: RegExp | undefined; abort?: boolean | undefined; hostname?: RegExp | undefined; protocol?: RegExp | undefined; error?: string | ... 1 more ... | undefined; message?: string | undefined; } | undefined): ZodString' is deprecated.

[7m77[0m   canonicalUrl: z.string().url().optional().nullable(),
[7m  [0m [93m                           ~~~[0m
[96msrc/modules/services/validation/index.ts[0m:[93m73[0m:[93m30[0m - [93mwarning[0m[90m ts(6385): [0m'(params?: string | { version?: "v8" | "v1" | "v2" | "v3" | "v4" | "v5" | "v6" | "v7" | undefined; abort?: boolean | undefined; error?: string | $ZodErrorMap<$ZodIssueInvalidStringFormat> | undefined; message?: string | undefined; } | undefined): ZodString' is deprecated.

[7m73[0m   tagIds: z.array(z.string().uuid()).max(100).optional(),
[7m  [0m [93m                             ~~~~[0m
[96msrc/modules/services/validation/index.ts[0m:[93m72[0m:[93m35[0m - [93mwarning[0m[90m ts(6385): [0m'(params?: string | { version?: "v8" | "v1" | "v2" | "v3" | "v4" | "v5" | "v6" | "v7" | undefined; abort?: boolean | undefined; error?: string | $ZodErrorMap<$ZodIssueInvalidStringFormat> | undefined; message?: string | undefined; } | undefined): ZodString' is deprecated.

[7m72[0m   categoryIds: z.array(z.string().uuid()).max(100).optional(),
[7m  [0m [93m                                  ~~~~[0m
[96msrc/modules/services/validation/index.ts[0m:[93m65[0m:[93m25[0m - [93mwarning[0m[90m ts(6385): [0m'(params?: string | { version?: "v8" | "v1" | "v2" | "v3" | "v4" | "v5" | "v6" | "v7" | undefined; abort?: boolean | undefined; error?: string | $ZodErrorMap<$ZodIssueInvalidStringFormat> | undefined; message?: string | undefined; } | undefined): ZodString' is deprecated.

[7m65[0m   ogImageId: z.string().uuid().optional().nullable(),
[7m  [0m [93m                        ~~~~[0m
[96msrc/modules/services/validation/index.ts[0m:[93m64[0m:[93m28[0m - [93mwarning[0m[90m ts(6385): [0m'(params?: string | { version?: "v8" | "v1" | "v2" | "v3" | "v4" | "v5" | "v6" | "v7" | undefined; abort?: boolean | undefined; error?: string | $ZodErrorMap<$ZodIssueInvalidStringFormat> | undefined; message?: string | undefined; } | undefined): ZodString' is deprecated.

[7m64[0m   coverImageId: z.string().uuid().optional().nullable(),
[7m  [0m [93m                           ~~~~[0m
[96msrc/modules/services/validation/index.ts[0m:[93m52[0m:[93m30[0m - [93mwarning[0m[90m ts(6385): [0m'(params?: string | { version?: "v8" | "v1" | "v2" | "v3" | "v4" | "v5" | "v6" | "v7" | undefined; abort?: boolean | undefined; error?: string | $ZodErrorMap<$ZodIssueInvalidStringFormat> | undefined; message?: string | undefined; } | undefined): ZodString' is deprecated.

[7m52[0m   tagIds: z.array(z.string().uuid()).max(100).default([]),
[7m  [0m [93m                             ~~~~[0m
[96msrc/modules/services/validation/index.ts[0m:[93m51[0m:[93m35[0m - [93mwarning[0m[90m ts(6385): [0m'(params?: string | { version?: "v8" | "v1" | "v2" | "v3" | "v4" | "v5" | "v6" | "v7" | undefined; abort?: boolean | undefined; error?: string | $ZodErrorMap<$ZodIssueInvalidStringFormat> | undefined; message?: string | undefined; } | undefined): ZodString' is deprecated.

[7m51[0m   categoryIds: z.array(z.string().uuid()).max(100).default([]),
[7m  [0m [93m                                  ~~~~[0m
[96msrc/modules/services/validation/index.ts[0m:[93m38[0m:[93m28[0m - [93mwarning[0m[90m ts(6385): [0m'(params?: string | { normalize?: boolean | undefined; pattern?: RegExp | undefined; abort?: boolean | undefined; hostname?: RegExp | undefined; protocol?: RegExp | undefined; error?: string | ... 1 more ... | undefined; message?: string | undefined; } | undefined): ZodString' is deprecated.

[7m38[0m   canonicalUrl: z.string().url().optional().nullable(),
[7m  [0m [93m                           ~~~[0m
[96msrc/modules/services/validation/index.ts[0m:[93m34[0m:[93m30[0m - [93mwarning[0m[90m ts(6385): [0m'(params?: string | { version?: "v8" | "v1" | "v2" | "v3" | "v4" | "v5" | "v6" | "v7" | undefined; abort?: boolean | undefined; error?: string | $ZodErrorMap<$ZodIssueInvalidStringFormat> | undefined; message?: string | undefined; } | undefined): ZodString' is deprecated.

[7m34[0m   tagIds: z.array(z.string().uuid()).max(100),
[7m  [0m [93m                             ~~~~[0m
[96msrc/modules/services/validation/index.ts[0m:[93m33[0m:[93m35[0m - [93mwarning[0m[90m ts(6385): [0m'(params?: string | { version?: "v8" | "v1" | "v2" | "v3" | "v4" | "v5" | "v6" | "v7" | undefined; abort?: boolean | undefined; error?: string | $ZodErrorMap<$ZodIssueInvalidStringFormat> | undefined; message?: string | undefined; } | undefined): ZodString' is deprecated.

[7m33[0m   categoryIds: z.array(z.string().uuid()).max(100),
[7m  [0m [93m                                  ~~~~[0m
[96msrc/modules/services/validation/index.ts[0m:[93m26[0m:[93m25[0m - [93mwarning[0m[90m ts(6385): [0m'(params?: string | { version?: "v8" | "v1" | "v2" | "v3" | "v4" | "v5" | "v6" | "v7" | undefined; abort?: boolean | undefined; error?: string | $ZodErrorMap<$ZodIssueInvalidStringFormat> | undefined; message?: string | undefined; } | undefined): ZodString' is deprecated.

[7m26[0m   ogImageId: z.string().uuid().optional().nullable(),
[7m  [0m [93m                        ~~~~[0m
[96msrc/modules/services/validation/index.ts[0m:[93m25[0m:[93m28[0m - [93mwarning[0m[90m ts(6385): [0m'(params?: string | { version?: "v8" | "v1" | "v2" | "v3" | "v4" | "v5" | "v6" | "v7" | undefined; abort?: boolean | undefined; error?: string | $ZodErrorMap<$ZodIssueInvalidStringFormat> | undefined; message?: string | undefined; } | undefined): ZodString' is deprecated.

[7m25[0m   coverImageId: z.string().uuid().optional().nullable(),
[7m  [0m [93m                           ~~~~[0m

[96msrc/pages/sitemap-cms.xml.ts[0m:[93m36[0m:[93m59[0m - [91merror[0m[90m ts(2554): [0mExpected 0-1 arguments, but got 2.

[7m36[0m       const tags = await getServiceTags(locale as Locale, null); for (const tag of tags) urls.push(urlEntry(baseUrl, `/${locale}/services/tags/${tag.translation?.slug ?? tag.tag.slug}`));
[7m  [0m [91m                                                          ~~~~[0m
[96msrc/pages/sitemap-cms.xml.ts[0m:[93m35[0m:[93m71[0m - [91merror[0m[90m ts(2554): [0mExpected 0-1 arguments, but got 2.

[7m35[0m       const categories = await getServiceCategories(locale as Locale, null); for (const category of categories) urls.push(urlEntry(baseUrl, `/${locale}/services/${category.translation?.slug ?? category.category.slug}`));
[7m  [0m [91m                                                                      ~~~~[0m

[96msrc/pages/[lang]/admin/blog/[id]/edit.astro[0m:[93m34[0m:[93m42[0m - [91merror[0m[90m ts(2339): [0mProperty 'organizationId' does not exist on type '{ id: string; authorId: string; slug: string; status: "DRAFT" | "PUBLISHED" | "ARCHIVED" | "DELETED"; featuredImageId: string | null; viewCount: number; isFeatured: boolean; isSticky: boolean; ... 8 more ...; lockedAt: Date | null; }'.

[7m34[0m if (!postAdminData || postAdminData.post.organizationId !== null) {
[7m  [0m [91m                                         ~~~~~~~~~~~~~~[0m

[96msrc/pages/[lang]/admin/services/index.astro[0m:[93m41[0m:[93m727[0m - [91merror[0m[90m ts(2322): [0mType '{ categories: { category: { id: string; parentId: string | null; slug: string; icon: string | null; color: string | null; sortOrder: number; createdAt: Date; updatedAt: Date; }; translation: { ...; } | null; }[]; tags: { ...; }[]; }' is not assignable to type '{ categories: { category: { id: string; organizationId: string | null; parentId: string | null; slug: string; }; translation: { name: string; slug: string; } | null; }[]; tags: { tag: { id: string; organizationId: string | null; slug: string; }; translation: { ...; } | null; }[]; }'.
  Types of property 'categories' are incompatible.
    Type '{ category: { id: string; parentId: string | null; slug: string; icon: string | null; color: string | null; sortOrder: number; createdAt: Date; updatedAt: Date; }; translation: { ...; } | null; }[]' is not assignable to type '{ category: { id: string; organizationId: string | null; parentId: string | null; slug: string; }; translation: { name: string; slug: string; } | null; }[]'.
      Type '{ category: { id: string; parentId: string | null; slug: string; icon: string | null; color: string | null; sortOrder: number; createdAt: Date; updatedAt: Date; }; translation: { ...; } | null; }' is not assignable to type '{ category: { id: string; organizationId: string | null; parentId: string | null; slug: string; }; translation: { name: string; slug: string; } | null; }'.
        Types of property 'category' are incompatible.
          Property 'organizationId' is missing in type '{ id: string; parentId: string | null; slug: string; icon: string | null; color: string | null; sortOrder: number; createdAt: Date; updatedAt: Date; }' but required in type '{ id: string; organizationId: string | null; parentId: string | null; slug: string; }'.

[7m41[0m <BaseLayout title={t.admin.title} description={t.meta.description}><AuthLayout title={t.admin.title}><AdminSidebar slot="sidebar" t={authT} locale={locale} activeItem="services" /><main class="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8"><ServicesAdminPage locale={locale} title={t.admin.title} items={data.items} meta={{ page: data.page, totalPages: data.totalPages }} stats={stats} filters={filterInput} baseAdminUrl={`/${locale}/admin/services`} canCreate={canCreate} canUpdate={canUpdate} canPublish={canPublish} canDelete={canDelete} canModerate={canModerate} canManageTaxonomy={canManageTaxonomy} categoryOptions={categoryOptions} tagOptions={tagOptions} providerOptions={providerOptions} localeOptions={LOCALES} taxonomy={taxonomy} moderation={moderation} /></main></AuthLayout></BaseLayout>
[7m  [0m [91m                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      ~~~~~~~~[0m

[96msrc/pages/[lang]/admin/services/new.astro[0m:[93m9[0m:[93m1[0m - [93mwarning[0m[90m ts(6133): [0m'Locale' is declared but its value is never read.

[7m9[0m import type { Locale } from "@i18n/config";
[7m [0m [93m~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~[0m

[96msrc/pages/[lang]/admin/services/[id]/edit.astro[0m:[93m11[0m:[93m1[0m - [93mwarning[0m[90m ts(6133): [0m'Locale' is declared but its value is never read.

[7m11[0m import type { Locale } from "@i18n/config";
[7m  [0m [93m~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~[0m

[96msrc/pages/[lang]/services/[categorySlug].astro[0m:[93m13[0m:[93m55[0m - [91merror[0m[90m ts(2554): [0mExpected 0-1 arguments, but got 2.

[7m13[0m const categories = await getServiceCategories(locale, null);
[7m  [0m [91m                                                      ~~~~[0m
[96msrc/pages/[lang]/services/[categorySlug].astro[0m:[93m6[0m:[93m1[0m - [93mwarning[0m[90m ts(6133): [0m'buildServiceUrl' is declared but its value is never read.

[7m6[0m import { buildServiceUrl } from "@/modules/services/utils";
[7m [0m [93m~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~[0m

[96msrc/pages/[lang]/services/[slug].astro[0m:[93m23[0m:[93m7[0m - [93mwarning[0m[90m ts(6133): [0m'jsonLd' is declared but its value is never read.

[7m23[0m const jsonLd = buildServiceJsonLd({
[7m  [0m [93m      ~~~~~~[0m
[96msrc/pages/[lang]/services/[slug].astro[0m:[93m35[0m:[93m11[0m - [93mwarning[0m[90m astro(4000): [0mThis script will be treated as if it has the `is:inline` directive because it contains an attribute. Therefore, features that require processing (e.g. using TypeScript or npm packages in the script) are unavailable.

See docs for more details: https://docs.astro.build/en/guides/client-side-scripts/#script-processing.

Add the `is:inline` directive explicitly to silence this hint.

[7m35[0m   <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
[7m  [0m [93m          ~~~~[0m

[96msrc/pages/[lang]/services/index.astro[0m:[93m15[0m:[93m32[0m - [91merror[0m[90m ts(2554): [0mExpected 0-1 arguments, but got 2.

[7m15[0m   getServiceCategories(locale, null),
[7m  [0m [91m                               ~~~~[0m

[96msrc/pages/[lang]/services/[categorySlug]/[slug].astro[0m:[93m13[0m:[93m57[0m - [91merror[0m[90m ts(2554): [0mExpected 1-3 arguments, but got 4.

[7m13[0m const item = await getServiceBySlug(slug, locale, null, categorySlug);
[7m  [0m [91m                                                        ~~~~~~~~~~~~[0m
[96msrc/pages/[lang]/services/[categorySlug]/[slug].astro[0m:[93m20[0m:[93m7[0m - [93mwarning[0m[90m ts(6133): [0m'jsonLd' is declared but its value is never read.

[7m20[0m const jsonLd = buildServiceJsonLd({ name: title, description, slug: new URL(canonicalUrl, Astro.url.origin).href, priceMinor: item.service.priceMinor, currency: item.service.currency, ratingAverage100: item.service.ratingAverage100, ratingCount: item.service.ratingCount });
[7m  [0m [93m      ~~~~~~[0m
[96msrc/pages/[lang]/services/[categorySlug]/[slug].astro[0m:[93m24[0m:[93m11[0m - [93mwarning[0m[90m astro(4000): [0mThis script will be treated as if it has the `is:inline` directive because it contains an attribute. Therefore, features that require processing (e.g. using TypeScript or npm packages in the script) are unavailable.

See docs for more details: https://docs.astro.build/en/guides/client-side-scripts/#script-processing.

Add the `is:inline` directive explicitly to silence this hint.

[7m24[0m   <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
[7m  [0m [93m          ~~~~[0m

[96msrc/pages/[lang]/services/tags/[tagSlug].astro[0m:[93m12[0m:[93m43[0m - [91merror[0m[90m ts(2554): [0mExpected 0-1 arguments, but got 2.

[7m12[0m const tags = await getServiceTags(locale, null);
[7m  [0m [91m                                          ~~~~[0m

[96mtests/e2e/blog.spec.ts[0m:[93m247[0m:[93m44[0m - [91merror[0m[90m ts(2769): [0mNo overload matches this call.
  Overload 1 of 2, '(value: { slug: string | SQL<unknown> | Placeholder<string, any>; id?: string | SQL<unknown> | Placeholder<string, any> | undefined; createdAt?: Date | SQL<...> | Placeholder<...> | undefined; ... 4 more ...; color?: string | ... 3 more ... | undefined; }): PgInsertBase<...>', gave the following error.
    Argument of type '{ id: `${string}-${string}-${string}-${string}-${string}`; organizationId: null; slug: string; }[]' is not assignable to parameter of type '{ slug: string | SQL<unknown> | Placeholder<string, any>; id?: string | SQL<unknown> | Placeholder<string, any> | undefined; createdAt?: Date | SQL<...> | Placeholder<...> | undefined; ... 4 more ...; color?: string | ... 3 more ... | undefined; }'.
      Property 'slug' is missing in type '{ id: `${string}-${string}-${string}-${string}-${string}`; organizationId: null; slug: string; }[]' but required in type '{ slug: string | SQL<unknown> | Placeholder<string, any>; id?: string | SQL<unknown> | Placeholder<string, any> | undefined; createdAt?: Date | SQL<...> | Placeholder<...> | undefined; ... 4 more ...; color?: string | ... 3 more ... | undefined; }'.
  Overload 2 of 2, '(values: { slug: string | SQL<unknown> | Placeholder<string, any>; id?: string | SQL<unknown> | Placeholder<string, any> | undefined; createdAt?: Date | SQL<...> | Placeholder<...> | undefined; ... 4 more ...; color?: string | ... 3 more ... | undefined; }[]): PgInsertBase<...>', gave the following error.
    Object literal may only specify known properties, and 'organizationId' does not exist in type '{ slug: string | SQL<unknown> | Placeholder<string, any>; id?: string | SQL<unknown> | Placeholder<string, any> | undefined; createdAt?: Date | SQL<...> | Placeholder<...> | undefined; ... 4 more ...; color?: string | ... 3 more ... | undefined; }'.

[7m247[0m     await db.insert(schema.blogCategories).values([
[7m   [0m [91m                                           ~~~~~~[0m
[96mtests/e2e/blog.spec.ts[0m:[93m220[0m:[93m39[0m - [91merror[0m[90m ts(2769): [0mNo overload matches this call.
  Overload 1 of 2, '(value: { slug: string | SQL<unknown> | Placeholder<string, any>; authorId: string | SQL<unknown> | Placeholder<string, any>; id?: string | SQL<unknown> | Placeholder<string, any> | undefined; ... 13 more ...; seoScore?: number | ... 3 more ... | undefined; }): PgInsertBase<...>', gave the following error.
    Argument of type '{ id: `${string}-${string}-${string}-${string}-${string}`; organizationId: null; authorId: string; slug: string; status: string; commentStatus: string; allowReviews: boolean; publishedAt: Date; updatedBy: string; }[]' is not assignable to parameter of type '{ slug: string | SQL<unknown> | Placeholder<string, any>; authorId: string | SQL<unknown> | Placeholder<string, any>; id?: string | SQL<unknown> | Placeholder<string, any> | undefined; ... 13 more ...; seoScore?: number | ... 3 more ... | undefined; }'.
      Type '{ id: `${string}-${string}-${string}-${string}-${string}`; organizationId: null; authorId: string; slug: string; status: string; commentStatus: string; allowReviews: boolean; publishedAt: Date; updatedBy: string; }[]' is missing the following properties from type '{ slug: string | SQL<unknown> | Placeholder<string, any>; authorId: string | SQL<unknown> | Placeholder<string, any>; id?: string | SQL<unknown> | Placeholder<string, any> | undefined; ... 13 more ...; seoScore?: number | ... 3 more ... | undefined; }': slug, authorId
  Overload 2 of 2, '(values: { slug: string | SQL<unknown> | Placeholder<string, any>; authorId: string | SQL<unknown> | Placeholder<string, any>; id?: string | SQL<unknown> | Placeholder<string, any> | undefined; ... 13 more ...; seoScore?: number | ... 3 more ... | undefined; }[]): PgInsertBase<...>', gave the following error.
    Object literal may only specify known properties, and 'organizationId' does not exist in type '{ slug: string | SQL<unknown> | Placeholder<string, any>; authorId: string | SQL<unknown> | Placeholder<string, any>; id?: string | SQL<unknown> | Placeholder<string, any> | undefined; ... 13 more ...; seoScore?: number | ... 3 more ... | undefined; }'.

[7m220[0m     await db.insert(schema.blogPosts).values([
[7m   [0m [91m                                      ~~~~~~[0m

[96mtests/e2e/services-lifecycle.spec.ts[0m:[93m38[0m:[93m36[0m - [91merror[0m[90m ts(2769): [0mNo overload matches this call.
  Overload 1 of 2, '(value: { slug: string | SQL<unknown> | Placeholder<string, any>; providerId: string | SQL<unknown> | Placeholder<string, any>; isMobile?: boolean | SQL<unknown> | Placeholder<...> | undefined; ... 17 more ...; ratingCount?: number | ... 2 more ... | undefined; }): PgInsertBase<...>', gave the following error.
    Object literal may only specify known properties, and 'organizationId' does not exist in type '{ slug: string | SQL<unknown> | Placeholder<string, any>; providerId: string | SQL<unknown> | Placeholder<string, any>; isMobile?: boolean | SQL<unknown> | Placeholder<...> | undefined; ... 17 more ...; ratingCount?: number | ... 2 more ... | undefined; }'.
  Overload 2 of 2, '(values: { slug: string | SQL<unknown> | Placeholder<string, any>; providerId: string | SQL<unknown> | Placeholder<string, any>; isMobile?: boolean | SQL<unknown> | Placeholder<...> | undefined; ... 17 more ...; ratingCount?: number | ... 2 more ... | undefined; }[]): PgInsertBase<...>', gave the following error.
    Object literal may only specify known properties, and 'id' does not exist in type '{ slug: string | SQL<unknown> | Placeholder<string, any>; providerId: string | SQL<unknown> | Placeholder<string, any>; isMobile?: boolean | SQL<unknown> | Placeholder<...> | undefined; ... 17 more ...; ratingCount?: number | ... 2 more ... | undefined; }[]'.

[7m38[0m   await db.insert(schema.services).values({ id: serviceId, organizationId: null, providerId: seedUser.id, slug, status: "DRAFT", publishedAt: null, updatedBy: seedUser.id });
[7m  [0m [91m                                   ~~~~~~[0m

[96mtests/e2e/services.spec.ts[0m:[93m52[0m:[93m47[0m - [91merror[0m[90m ts(2769): [0mNo overload matches this call.
  Overload 1 of 2, '(value: { slug: string | SQL<unknown> | Placeholder<string, any>; id?: string | SQL<unknown> | Placeholder<string, any> | undefined; createdAt?: Date | SQL<...> | Placeholder<...> | undefined; ... 4 more ...; color?: string | ... 3 more ... | undefined; }): PgInsertBase<...>', gave the following error.
    Argument of type '{ id: `${string}-${string}-${string}-${string}-${string}`; organizationId: null; slug: string; }[]' is not assignable to parameter of type '{ slug: string | SQL<unknown> | Placeholder<string, any>; id?: string | SQL<unknown> | Placeholder<string, any> | undefined; createdAt?: Date | SQL<...> | Placeholder<...> | undefined; ... 4 more ...; color?: string | ... 3 more ... | undefined; }'.
      Property 'slug' is missing in type '{ id: `${string}-${string}-${string}-${string}-${string}`; organizationId: null; slug: string; }[]' but required in type '{ slug: string | SQL<unknown> | Placeholder<string, any>; id?: string | SQL<unknown> | Placeholder<string, any> | undefined; createdAt?: Date | SQL<...> | Placeholder<...> | undefined; ... 4 more ...; color?: string | ... 3 more ... | undefined; }'.
  Overload 2 of 2, '(values: { slug: string | SQL<unknown> | Placeholder<string, any>; id?: string | SQL<unknown> | Placeholder<string, any> | undefined; createdAt?: Date | SQL<...> | Placeholder<...> | undefined; ... 4 more ...; color?: string | ... 3 more ... | undefined; }[]): PgInsertBase<...>', gave the following error.
    Object literal may only specify known properties, and 'organizationId' does not exist in type '{ slug: string | SQL<unknown> | Placeholder<string, any>; id?: string | SQL<unknown> | Placeholder<string, any> | undefined; createdAt?: Date | SQL<...> | Placeholder<...> | undefined; ... 4 more ...; color?: string | ... 3 more ... | undefined; }'.

[7m52[0m     await db.insert(schema.serviceCategories).values([{ id: globalCategoryId, organizationId: null, slug: globalCategorySlug }]);
[7m  [0m [91m                                              ~~~~~~[0m
[96mtests/e2e/services.spec.ts[0m:[93m42[0m:[93m45[0m - [91merror[0m[90m ts(2769): [0mNo overload matches this call.
  Overload 1 of 2, '(value: { slug: string | SQL<unknown> | Placeholder<string, any>; providerId: string | SQL<unknown> | Placeholder<string, any>; isMobile?: boolean | SQL<unknown> | Placeholder<...> | undefined; ... 17 more ...; ratingCount?: number | ... 2 more ... | undefined; }): PgInsertBase<...>', gave the following error.
    Argument of type '({ id: `${string}-${string}-${string}-${string}-${string}`; organizationId: null; providerId: string; slug: string; status: string; publishedAt: Date; updatedBy: string; priceMinor: number; currency: string; durationMinutes: number; maxParticipants: number; } | { ...; })[]' is not assignable to parameter of type '{ slug: string | SQL<unknown> | Placeholder<string, any>; providerId: string | SQL<unknown> | Placeholder<string, any>; isMobile?: boolean | SQL<unknown> | Placeholder<...> | undefined; ... 17 more ...; ratingCount?: number | ... 2 more ... | undefined; }'.
      Type '({ id: `${string}-${string}-${string}-${string}-${string}`; organizationId: null; providerId: string; slug: string; status: string; publishedAt: Date; updatedBy: string; priceMinor: number; currency: string; durationMinutes: number; maxParticipants: number; } | { ...; })[]' is missing the following properties from type '{ slug: string | SQL<unknown> | Placeholder<string, any>; providerId: string | SQL<unknown> | Placeholder<string, any>; isMobile?: boolean | SQL<unknown> | Placeholder<...> | undefined; ... 17 more ...; ratingCount?: number | ... 2 more ... | undefined; }': slug, providerId

[7m42[0m     await db.insert(schema.services).values([
[7m  [0m [91m                                            ~[0m
[7m43[0m       { id: globalServiceId, organizationId: null, providerId: seedUser.id, slug: globalServiceSlug, status: 'PUBLISHED', publishedAt, updatedBy: seedUser.id, priceMinor: 2500, currency: 'EUR', durationMinutes: 60, maxParticipants: 4 },
[7m  [0m [91m~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~[0m
[7m44[0m       { id: draftServiceId, organizationId: null, providerId: seedUser.id, slug: draftServiceSlug, status: 'DRAFT', publishedAt: null, updatedBy: seedUser.id, priceMinor: 3500, currency: 'EUR', durationMinutes: 75, maxParticipants: 3 },
[7m  [0m [91m~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~[0m
[7m45[0m     ]);
[7m  [0m [91m~~~~~[0m

[96mtests/integration/blog-actions.test.ts[0m:[93m64[0m:[93m35[0m - [91merror[0m[90m ts(2339): [0mProperty 'organizationId' does not exist on type 'PgTableWithColumns<{ name: "blog_posts"; schema: undefined; columns: { id: PgColumn<{ name: "id"; tableName: "blog_posts"; dataType: "string"; columnType: "PgText"; data: string; driverParam: string; notNull: true; hasDefault: true; ... 6 more ...; generated: undefined; }, {}, {}>; ... 15 more ...; lockedAt: PgColum...'.

[7m64[0m       .where(and(isNull(blogPosts.organizationId), eq(blogPostTranslations.locale, 'fr')))
[7m  [0m [91m                                  ~~~~~~~~~~~~~~[0m

[96mtests/integration/voyage-loaders2.test.ts[0m:[93m411[0m:[93m55[0m - [91merror[0m[90m ts(2554): [0mExpected 1-2 arguments, but got 3.

[7m411[0m     const adm = await getServiceAdminData(null, 'fr', { status: 'bogus', page: 'abc' } as never);
[7m   [0m [91m                                                      ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~[0m

[96mtests/unit/query-filters.test.ts[0m:[93m41[0m:[93m46[0m - [93mwarning[0m[90m ts(6385): [0m'(params?: string | { version?: "v8" | "v1" | "v2" | "v3" | "v4" | "v5" | "v6" | "v7" | undefined; abort?: boolean | undefined; error?: string | $ZodErrorMap<$ZodIssueInvalidStringFormat> | undefined; message?: string | undefined; } | undefined): ZodString' is deprecated.

[7m41[0m     const strict = z.object({ id: z.string().uuid() });
[7m  [0m [93m                                             ~~~~[0m

Result (1070 files): 
- 46 errors
- 0 warnings
- 93 hints

ÔÇëELIFECYCLEÔÇë Command failed with exit code 1.
