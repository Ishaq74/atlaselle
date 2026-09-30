import { randomUUID } from 'node:crypto';
import { test, expect } from '@playwright/test';
import { SEED_EMAIL } from './global-setup';

/**
 * Accessibility contract of the mandatory star-rating control.
 *
 * `src/components/atoms/star-rating/StarRating.astro` renders, next to a required
 * radio group, a feedback region that is in the document from the first paint
 * and stays empty while the group is valid (`role="alert"`, `id="${name}-error"`,
 * StarRating.astro:125-130). A failed submission is the only thing that writes
 * into it (StarRating.astro:140-157), so that text is the *entire* announcement a
 * screen reader makes for a rating the visitor was not allowed to leave empty.
 * It therefore has to be the sentence the page language carries, never the bare
 * value on the scale: `const errorMessage = invalidText ?? "0/5"`
 * (StarRating.astro:39) is the fallback that takes over the moment a locale stops
 * providing `errors.ratingRequired` — announced as the bare string `0/5`, which
 * tells a screen-reader user nothing about what to do.
 *
 * The expected messages below are literals, and they are deliberately NOT
 * imported from `src/i18n/**`: importing the value under test would make the
 * assertion pass by construction — a key deleted from a locale file would compare
 * `undefined` to `undefined` and the test would stay green on the exact defect it
 * exists to catch. The rendered page is the only source read here, so a key
 * removed from any of the four languages turns the region back into the numeric
 * fallback and this test fails on that language.
 *
 * The four locales are walked because `errors.ratingRequired` exists in all four
 * (`src/i18n/{fr,en,es,ar}/blog.ts`), and a message present in one language and
 * missing in another is a per-language defect: a single pair of languages would
 * not prove the component resolves the *current* language.
 */

const LOCALES = ['fr', 'en', 'es', 'ar'] as const;
type SiteLocale = (typeof LOCALES)[number];

/** `errors.ratingRequired`, per locale, as the four blog translation files render it. */
const RATING_REQUIRED_TEXT: Record<SiteLocale, string> = {
  fr: 'La note est requise.',
  en: 'Rating is required.',
  es: 'La valoración es obligatoria.',
  ar: 'التقييم مطلوب.',
};

/**
 * `ReviewForm` renders `StarRating` with `name="rating"`, and the component
 * derives its region id from that name — `errorId` is the name suffixed with
 * `-error` (StarRating.astro:38). `ReviewSection` also uses `StarRating`, but only
 * in its read-only mode, which renders no region at all — so `#rating-error`
 * resolves to exactly one element on a blog post page.
 */
const RATING_ERROR_REGION = '#rating-error';

/** Every decimal digit of every script, not only ASCII: Arabic-Indic included. */
const ANY_DIGIT = /\p{Nd}/u;

/** A whole message made of nothing but a value on the scale: `0`, `0/5`, `3 / 5`. */
const BARE_NUMERIC_VALUE = /^\s*\p{Nd}+(?:\s*\/\s*\p{Nd}+)?\s*$/u;

interface SeededPost {
  /** Run-scoped suffix, so two runs can never collide on the unique slugs below. */
  unique: string;
  postId: string;
  /** `blog_posts.slug` — globally unique, unlike the per-locale translation slugs. */
  postSlug: string;
  slugByLocale: Record<SiteLocale, string>;
}

let seeded: SeededPost | null = null;
let db: Awaited<ReturnType<typeof import('../../src/database/drizzle').getDrizzle>> | null = null;
let schema: typeof import('../../src/database/drizzle').schema | null = null;
let eqOp: typeof import('drizzle-orm').eq;

function buildPostUrl(locale: SiteLocale, slug: string) {
  return `/${locale}/blog/${slug}`;
}

/**
 * Close the RGPD banner before touching the form.
 *
 * The banner is a `fixed bottom-0` overlay with a `z-9999` stacking context, so
 * left open it sits on top of the lower half of the page and swallows the clicks
 * on the rating and the submit button. Its labels come from the `consent_settings`
 * table and are translated, so the click is keyed on the component's own id
 * (`#cc-reject-all`) instead of on a text matcher that would only resolve in one
 * of the four languages walked below.
 *
 * The dismissal is asserted, not assumed: the banner only appears when no choice
 * is stored in localStorage, so it shows on the first navigation of the run and
 * stays hidden on the next three. A banner still covering the viewport at the end
 * of this helper fails the test on the spot instead of surfacing later as an
 * unexplainable "element intercepts pointer events" on an unrelated locator.
 */
async function dismissCookieBanner(page: import('@playwright/test').Page) {
  const banner = page.locator('#cookie-consent');
  // `#cookie-consent` ships with the `hidden` class and its script removes it on
  // DOMContentLoaded, which `waitUntil: 'networkidle'` has already passed: the
  // state read here is final, so no wait and no race.
  if (!(await banner.isVisible())) return;
  const reject = page.locator('#cc-reject-all');
  // Le bandeau attache son écouteur au chargement : un clic posé avant que le
  // script soit prêt ne fait rien, et le bandeau continue de couvrir la page.
  // On réessaie tant qu'il est là, plutôt que de laisser l'échec surfaces plus
  // loin sur un « element intercepts pointer events » sans rapport.
  await expect(async () => {
    await reject.click({ timeout: 2_000 });
    await expect(banner).toBeHidden({ timeout: 2_000 });
  }).toPass({ timeout: 15_000 });
  await expect(banner, 'the cookie banner must not cover the review form').toBeHidden();
}

test.describe('Star rating — required-field error announcement', () => {
  test.beforeAll(async () => {
    const unique = randomUUID().slice(0, 8);
    const postId = randomUUID();
    const postSlug = `e2e-rating-a11y-post-${unique}`;

    const drizzleMod = await import('../../src/database/drizzle');
    const orm = await import('drizzle-orm');

    db = drizzleMod.getDrizzle();
    schema = drizzleMod.schema;
    eqOp = orm.eq;

    const [seedUser] = await db
      .select({ id: schema.user.id })
      .from(schema.user)
      .where(eqOp(schema.user.email, SEED_EMAIL))
      .limit(1);

    if (!seedUser) {
      throw new Error(`Seed user not found for ${SEED_EMAIL}: the review form needs an author to hang the post on`);
    }

    // One minute in the past, not `new Date()`: public visibility is decided by
    // the database clock (`lte(publishedAt, now())`, public-visibility.ts:10) and
    // a host running behind it would serve a 404 for a post the test just seeded.
    const publishedAt = new Date(Date.now() - 60_000);

    await db.insert(schema.blogPosts).values({
      id: postId,
      authorId: seedUser.id,
      slug: postSlug,
      status: 'PUBLISHED',
      commentStatus: 'OPEN',
      allowReviews: true,
      publishedAt,
      updatedBy: seedUser.id,
    });

    // One translation per walked locale: `getBlogPostBySlug` joins on
    // `blog_post_translations.locale` (blog.loader.ts:207-221), so a page in a
    // language the post has no translation for answers 404 and would prove
    // nothing about the message.
    const slugByLocale = Object.fromEntries(
      LOCALES.map((locale): [SiteLocale, string] => [locale, `${postSlug}-${locale}`]),
    ) as Record<SiteLocale, string>;

    await db.insert(schema.blogPostTranslations).values(
      LOCALES.map((locale) => ({
        postId,
        locale,
        title: `E2E rating announcement ${unique} (${locale})`,
        slug: slugByLocale[locale],
        content: `<p>E2E rating announcement content ${unique} (${locale})</p>`,
        excerpt: `E2E rating announcement excerpt ${unique} (${locale})`,
      })),
    );

    seeded = { unique, postId, postSlug, slugByLocale };
  });

  test.afterAll(async () => {
    // The four translation rows cascade from the post row
    // (`postId … onDelete: "cascade"`, blog.schema.ts), and the post carries no
    // category and no tag, so deleting it removes the whole fixture.
    if (!seeded || !db || !schema) return;
    await db.delete(schema.blogPosts).where(eqOp(schema.blogPosts.id, seeded.postId));
  });

  test('the rating error region announces the translated message in every page language and never a bare numeric value', async ({ page }) => {
    // Four languages, four SSR renders and four form walks, on the single preview
    // server shared by the three projects (playwright.config.ts, `workers: 1`).
    test.setTimeout(120_000);

    for (const locale of LOCALES) {
      const url = buildPostUrl(locale, seeded!.slugByLocale[locale]);

      const response = await page.goto(url, { waitUntil: 'networkidle' });
      expect(response?.status(), `${url} must serve the seeded post in ${locale}`).toBe(200);
      await dismissCookieBanner(page);

      // The review form lives in the "write review" panel of `#reviews-section`.
      // The trigger is opened explicitly rather than relying on the server-side
      // default (`defaultTab = hasReviews ? "list" : "write"`, ReviewSection.astro:27):
      // a post that already carried a review would otherwise leave the panel
      // `hidden` and the form unreachable. Scoped to `#reviews-section` because the
      // comment section renders a `value="write"` tab of its own.
      const section = page.locator('#reviews-section');
      await section.locator('[data-tabs-trigger][data-value="write"]').click();
      await expect(section.locator('[data-tabs-content][data-value="write"]')).toHaveAttribute(
        'data-state',
        'active',
      );

      const form = page.locator('#review-form');
      await form.scrollIntoViewIfNeeded();
      await expect(form).toBeVisible();

      // Everything but the rating is filled: leaving exactly one mandatory control
      // empty is what makes the next click the failure path under test, instead of
      // an accident of which field the browser happens to reject first.
      await form.locator('[name="title"]').fill(`E2E rating announcement ${seeded!.unique}`);
      await form.locator('[name="content"]').fill(`E2E rating announcement body ${seeded!.unique}`);
      await expect(form.locator('input[name="rating"]:checked')).toHaveCount(0);

      await form.locator('button[type="submit"]').click();

      const region = page.locator(RATING_ERROR_REGION);
      await expect(region, `${locale}: the rating error region must be a live region`).toHaveAttribute(
        'role',
        'alert',
      );
      await expect(
        region,
        `${locale}: the rating error region must announce errors.ratingRequired, not the numeric fallback`,
      ).toHaveText(RATING_REQUIRED_TEXT[locale]);

      const announced = (await region.textContent()) ?? '';
      expect(
        announced.trim().length,
        `${locale}: the rating error region must not be empty after a rejected submission`,
      ).toBeGreaterThan(0);
      expect(
        announced,
        `${locale}: the announced rating error must be a sentence, not the bare value on the scale`,
      ).not.toMatch(BARE_NUMERIC_VALUE);
      expect(
        announced,
        `${locale}: the announced rating error must carry no numeric value (StarRating falls back to "0/5" without a translation)`,
      ).not.toMatch(ANY_DIGIT);
    }
  });
});
