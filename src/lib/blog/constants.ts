import type { Locale } from "@i18n/config";
import { canTransition, type WorkflowDefinition } from "@/lib/cms/workflow";

export const BLOG_POST_STATUSES = ["DRAFT", "PUBLISHED", "ARCHIVED", "DELETED"] as const;
export type BlogPostStatus = (typeof BLOG_POST_STATUSES)[number];

export const BLOG_POST_WORKFLOW: WorkflowDefinition<BlogPostStatus> = {
  states: BLOG_POST_STATUSES,
  transitions: [
    { from: "DRAFT", to: "PUBLISHED" },
    { from: "DRAFT", to: "ARCHIVED" },
    { from: "DRAFT", to: "DELETED" },
    { from: "PUBLISHED", to: "DRAFT" },
    { from: "PUBLISHED", to: "ARCHIVED" },
    { from: "PUBLISHED", to: "DELETED" },
    { from: "ARCHIVED", to: "DRAFT" },
    { from: "ARCHIVED", to: "DELETED" },
    { from: "DELETED", to: "DRAFT" },
  ],
};

type TransitionMap<S extends string> = { [K in S]: readonly S[] };
function buildTransitionMap<S extends string>(states: readonly S[], transitions: readonly { from: S; to: S }[]): TransitionMap<S> {
  const map = {} as TransitionMap<S>;
  for (const state of states) map[state] = transitions.filter((transition) => transition.from === state).map((transition) => transition.to);
  return map;
}

export const BLOG_POST_TRANSITIONS = Object.freeze(buildTransitionMap(BLOG_POST_STATUSES, BLOG_POST_WORKFLOW.transitions));

export function canTransitionBlogPost(from: BlogPostStatus, to: BlogPostStatus): boolean {
  return canTransition(BLOG_POST_WORKFLOW, from, to);
}

export function assertValidBlogPostTransition(from: BlogPostStatus, to: BlogPostStatus): void {
  if (!canTransitionBlogPost(from, to)) {
    throw new Error(`Invalid blog post status transition: ${from} → ${to}.`);
  }
}

export const BLOG_COMMENT_STATUSES = ["PENDING", "APPROVED", "REJECTED", "SPAM", "TRASH"] as const;
export type BlogCommentStatus = (typeof BLOG_COMMENT_STATUSES)[number];

export const BLOG_REVIEW_STATUSES = ["PENDING", "APPROVED", "REJECTED", "SPAM"] as const;
export type BlogReviewStatus = (typeof BLOG_REVIEW_STATUSES)[number];

export const BLOG_REPORT_REASONS = ["SPAM", "ABUSIVE", "OFF_TOPIC", "HATE_SPEECH", "OTHER"] as const;
export type BlogReportReason = (typeof BLOG_REPORT_REASONS)[number];

export const BLOG_REPORT_STATUSES = ["PENDING", "REVIEWED", "RESOLVED", "REJECTED"] as const;
export type BlogReportStatus = (typeof BLOG_REPORT_STATUSES)[number];

export const BLOG_REACTION_TYPES = ["LIKE", "LOVE", "FIRE", "CLAP", "LAUGH", "SAD"] as const;
export type BlogReactionType = (typeof BLOG_REACTION_TYPES)[number];

export const BLOG_LINK_TYPES = ["RELATED", "PREVIOUS", "NEXT", "REFERENCE"] as const;
export type BlogLinkType = (typeof BLOG_LINK_TYPES)[number];

export const BLOG_OG_LOCALES = {
  fr: "fr_FR",
  en: "en_US",
  ar: "ar_SA",
  es: "es_ES",
} as const satisfies Record<Locale, string>;

export type BlogOgLocale = (typeof BLOG_OG_LOCALES)[Locale];

/**
 * Segment d'URL du blog par locale.
 *
 * Ces segments sont des littéraux figés (et non du contenu traduit) : les
 * garder ici évite d'importer statiquement les 4 dictionnaires blog complets
 * depuis `utils.ts`, ce qui annulait le code-splitting des imports dynamiques
 * de `src/i18n/utils.ts` (avertissement Vite INEFFECTIVE_DYNAMIC_IMPORT).
 *
 * Invariant : ces valeurs doivent rester identiques à `routes.blog` dans
 * `src/i18n/blog/{fr,en,es,ar}.ts` (vérifié par tests/unit/blog-route-segments.test.ts).
 */
export const BLOG_ROUTE_SEGMENTS = {
  fr: "blog",
  en: "blog",
  es: "blog",
  ar: "blog",
} as const satisfies Record<Locale, string>;

/** Segment d'URL des pages auteur du blog par locale (voir invariant testé). */
export const BLOG_AUTHOR_SEGMENTS = {
  fr: "auteur",
  en: "author",
  es: "autor",
  ar: "الكاتب",
} as const satisfies Record<Locale, string>;

export const BLOG_DEFAULTS = {
  postsPerPage: 9,
  commentsPerPage: 20,
  reviewsPerPage: 10,
  excerptLength: 160,
  lockDurationMinutes: 15,
  maxFeaturedPosts: 5,
  maxStickyPosts: 3,
} as const;

export const BLOG_RESERVED_SLUGS = new Set([
  "admin", "api", "auth", "rss", "sitemap", "search", "category", "categories",
  "tag", "tags", "author", "authors", "page", "pages", "new", "edit", "preview",
  "index", "create", "delete", "moderate", "stats",
]);

export const BLOG_SEO_LIMITS = {
  titleMin: 30,
  titleMax: 60,
  descriptionMin: 50,
  descriptionMax: 160,
  contentMin: 300,
  focusKeywordMax: 5,
} as const;
