# Atlaselle

[EN](./README.md) | [FR](./README.fr.md) | [**AR**](./README.ar.md) | [ES](./README.es.md)

تطبيق ويب SSR متكامل — مصادقة، منظمات، CMS، وسائط، SMTP وi18n عبر 4 لغات.

_يتم إنشاء هذا الملف تلقائيًا لتوفير سياق شامل للمساعدة بالذكاء الاصطناعي._

## جدول المحتويات

- [نظرة عامة](#نظرة-عامة)
- [البدء](#البدء)
- [نظام التصميم](#نظام-التصميم)
- [قاعدة البيانات](#قاعدة-البيانات)
- [المصادقة](#المصادقة)
- [المحتوى ونظام إدارة المحتوى](#المحتوى-ونظام-إدارة-المحتوى)
- [الوسائط](#الوسائط)
- [البريد والإشعارات](#البريد-والإشعارات)
- [التدويل](#التدويل)
- [التكامل المستمر والجودة](#التكامل-المستمر-والجودة)

## نظرة عامة

تطبيق ويب SSR متعدد اللغات مع مصادقة كاملة وإدارة المنظمات ونظام إدارة المحتوى والوسائط وسجل التدقيق.

- ⚡ **Astro 7.3.1** (SSR, `@astrojs/node`) — عرض من جانب الخادم، Tailwind CSS 4، TypeScript
- 🔐 **better-auth** — بريد إلكتروني/كلمة مرور، تحقق من البريد، منظمات، أدوار، انتحال هوية المسؤول
- 🗄️ **Drizzle ORM** + **PostgreSQL 16** — ترحيلات آمنة من حيث النوع، محملات، بحث نصي كامل
- 🎨 **Starwind** — 48 مكون واجهة مستخدم Astro سهل الوصول
- 🌍 **i18n** — fr، en، es، ar (RTL) مع مسارات محلية
- 📋 **CMS** — صفحات، أقسام JSON مكتوبة، تنقل، جدولة، نسخ، استيراد/تصدير
- 📁 **الوسائط** — رفع، معالجة Sharp، تنظيم المجلدات
- 📧 **SMTP** — Brevo / Resend / Nodemailer + قائمة انتظار الرسائل الميتة
- 🛡️ **الأمان** — سجل تدقيق، تحديد معدل الطلبات، تطهير المدخلات
- ✅ **الاختبارات** — 167 Vitest + 9 E2E × 3 متصفحات

### المجموعة التقنية

| التقنية | الدور |
|:--|:--|
| **Astro 7.3.1** (`@astrojs/node`) | إطار عمل SSR |
| **better-auth** | المصادقة والمنظمات |
| **Drizzle ORM** + **PostgreSQL 16** | قاعدة البيانات |
| **Tailwind CSS 4** + **Starwind** | نظام التصميم (48 مكوناً) |
| **Vitest** + **Playwright** | الاختبارات |
| **GitHub Actions** | CI/CD |

> Default locale: `en` (source: `src/i18n/config.ts`).

## البدء

### المتطلبات الأساسية

- **Node.js** >= 22.12.0
- **pnpm** >= 10
- **PostgreSQL** >= 16

### التثبيت

```bash
pnpm install
cp .env.example .env
pnpm db:migrate
pnpm dev
```

### متغيرات البيئة

| Variable | Description |
|:---------|:------------|
| `DB_ENV` | Active DB environment (LOCAL | PROD | TEST) |
| `DATABASE_URL_LOCAL` | PostgreSQL connection URL — local environment |
| `DATABASE_URL_PROD` | PostgreSQL connection URL — production environment |
| `DATABASE_URL_TEST` | PostgreSQL connection URL — test suite |
| `BETTER_AUTH_SECRET` | Auth secret key (min. 32 random chars) |
| `BETTER_AUTH_URL` | Public URL of the application (used by better-auth) |
| `SITE_URL` | Canonical URL used by Astro / sitemap |
| `SMTP_PROVIDER` | Email provider: BREVO | RESEND | NODEMAILER |
| `SMTP_FROM_EMAIL` | Sender email address |
| `SMTP_FROM_NAME` | Sender display name |
| `SMTP_HOST` | SMTP server hostname (Nodemailer only) |
| `SMTP_PORT` | SMTP server port, e.g. 587 (Nodemailer only) |
| `SMTP_SECURE` | Enable TLS/SSL — true | false (Nodemailer only) |

### مستعارات TypeScript

- `@/*` → `src/*`
- `@styles/*` → `src/styles/*`
- `@layouts/*` → `src/layouts/*`
- `@components/*` → `src/components/*`
- `@atoms/*` → `src/components/atoms/*`
- `@molecules/*` → `src/components/molecules/*`
- `@organisms/*` → `src/components/organisms/*`
- `@wow/*` → `src/components/wow/*`
- `@assets/*` → `src/assets/*`
- `@starwind/*` → `src/lib/starwind/*`
- `@i18n/*` → `src/i18n/*`
- `@pages/*` → `src/components/pages/*`
- `@lib/*` → `src/lib/*`
- `@database/*` → `src/database/*`
- `@smtp/*` → `src/smtp/*`
- `@media/*` → `src/media/*`

## نظام التصميم

### الملفات

```
src/components/
atoms/
  accordion/
  alert/
  alert-dialog/
  aspect-ratio/
  avatar/
  badge/
  breadcrumb/
  button/
  button-group/
  card/
  carousel/
  checkbox/
  collapsible/
  container/
  dialog/
  dropdown/
  dropzone/
  icon-picker/
  image/
  input/
  input-group/
  input-otp/
  item/
  kbd/
  label/
  media-picker/
  native-select/
  pagination/
  popover/
  progress/
  prose/
  radio-group/
  select/
  separator/
  sheet/
  sidebar/
  skeleton/
  slider/
  spinner/
  switch/
  table/
  tabs/
  textarea/
  theme-toggle/
  toast/
  toggle/
  tooltip/
  video/
blog/
  AdminModerationQueue.astro
  AdminPostForm.astro
  AdminPostList.astro
  AdminTaxonomyManager.astro
  ArticleProgressBar.astro
  AuthorCard.astro
  BlogAdminPage.astro
  cards/
  CategoryFilterBar.astro
  CommentForm.astro
  comments/
  CommentSection.astro
  CommentThreadItem.astro
  grids/
  NotificationBell.astro
  PostCard.astro
  PostContent.astro
  PostGridToggle.astro
  ReactionBar.astro
  ReviewForm.astro
  ReviewSection.astro
  ShareBar.astro
  sidebars/
  TagCloud.astro
content/
  ContentEditor.astro
  RichContent.astro
molecules/
  AdminPagination/
  AdminResourceStats.astro
  DataView/
organisms/
  AdminFormShell.astro
  AdminResourceList.astro
  AdminResourceShell.astro
  AdminSidebar/
  AuthLayout/
  AuthSidebar/
  Category/
  CookieConsent/
  Footer/
  Header/
  Testimonials/
pages/
  AboutPage/
  admin/
  AtlaselleHome.astro
  auth/
  blog/
  cms/
  CmsPage.astro
  ContactPage/
  HomePage/
  LegalPage.astro
  org/
  TripPage.astro
services/
  AdminServiceForm.astro
  AdminServiceList.astro
  ServicesAdminPage.astro
wow/
  AsyncButton.astro
  FallingParticles.astro
  HorizontalScrollCarousel/
  HoverBlurCards.astro
  LogoCloud.astro
  MarqueeContent.astro
  MouseRepelParticles.astro
  RisingParticles.astro
  ScrollReveal.astro
src/styles/
global.css
src/assets/
images/
  avatars/
  brand/
```

### المكونات

- **atoms/** — 48 components
- **molecules/** — 3 components
- **organisms/** — 11 components
- **pages/** — 12 components
- **wow/** — 9 components

### الأنماط والرموز

`global.css` — 86 CSS custom properties

```css
--animate-accordion-down: accordion-down 0.2s ease-out;
--animate-accordion-up: accordion-up 0.2s ease-out;
--color-background: var(--background);
--color-foreground: var(--foreground);
--color-card: var(--card);
--color-card-foreground: var(--card-foreground);
/* ... 80 more */
```

### الاختبارات

- `tests/unit/sanitize.test.ts`
- `tests/unit/section-content-xss.test.ts`
- `tests/unit/section-schemas.test.ts`
- `tests/unit/sections-sanitize.test.ts`
- `tests/unit/seo.test.ts`
- `tests/unit/theme-tokens.test.ts`

## قاعدة البيانات

### الملفات

```
src/database/
cache.ts
commands/
  db.check.ts
  db.clean-media.ts
  db.cleanup-audit.ts
  db.compare.ts
  db.generate.ts
  db.infra.ts
  db.migrate.ts
  db.reset.ts
  db.seed-media.ts
  db.seed.ts
  db.sync.ts
  _migration-sql.ts
  _utils.ts
data/
  00-media.data.ts
  00b-media-files.data.ts
  01-users.data.ts
  01b-user-accounts.data.ts
  03-site-settings.data.ts
  04-social-links.data.ts
  05-contact-info.data.ts
  06-opening-hours.data.ts
  07-navigation.data.ts
  07b-navigation-items.data.ts
  08-theme.data.ts
  09-legal-pages.data.ts
  09b-legal-sections.data.ts
  10-consent-settings.data.ts
  11-blog-categories.data.ts
  11b-blog-category-translations.data.ts
  12-blog-tags.data.ts
  12b-blog-tag-translations.data.ts
  13-blog-posts.data.ts
  13b-blog-post-translations.data.ts
  14-blog-post-categories.data.ts
  14b-blog-post-tags.data.ts
  15-blog-post-seo.data.ts
  15b-blog-post-revisions.data.ts
  16-blog-comments.data.ts
  16b-blog-comment-moderations.data.ts
  17-blog-reviews.data.ts
  17b-blog-review-helpful.data.ts
  18-blog-reactions.data.ts
  18b-blog-favorites.data.ts
  19-blog-reports.data.ts
  20-blog-post-links.data.ts
  20b-blog-post-locks.data.ts
  21-blog-notifications.data.ts
  22-blog-subscribers.data.ts
  23-blog-post-galleries.data.ts
  23b-blog-post-gallery-media.data.ts
  24-services.data.ts
  24b-service-translations.data.ts
  25-service-categories.data.ts
  25b-service-category-translations.data.ts
  26-service-tags.data.ts
  26b-service-tag-translations.data.ts
  27-service-category-links.data.ts
  27b-service-tag-links.data.ts
  28-service-media.data.ts
  29-service-availability.data.ts
  30-service-revisions.data.ts
  31-service-locks.data.ts
  32-service-seo.data.ts
  33-service-favorites.data.ts
  34-service-reviews.data.ts
  34b-service-review-helpful.data.ts
  35-service-comments.data.ts
  36-service-reports.data.ts
  37-service-view-stats.data.ts
  38-service-reactions.data.ts
  39-service-notifications.data.ts
  40-service-attribute-definitions.data.ts
  40b-service-attribute-values.data.ts
  41-trips.data.ts
  42-trip-translations.data.ts
  43-departures.data.ts
  44-itinerary.data.ts
  44b-itinerary-translations.data.ts
  45-faq.data.ts
  45b-faq-translations.data.ts
  45c-trip-faqs.data.ts
  46-trip-highlights.data.ts
  46b-trip-highlight-translations.data.ts
  46c-trip-inclusions.data.ts
  46d-trip-inclusion-translations.data.ts
  46e-trip-exclusions.data.ts
  46f-trip-exclusion-translations.data.ts
  47-policy-documents.data.ts
  47b-policy-versions.data.ts
  manifest.ts
drizzle.ts
env.ts
infra/
  00-functions.sql
  01-triggers.sql
  02-indexes.sql
  03-constraints.sql
loaders/
  blog-admin-editor.loader.ts
  blog-admin-moderation.loader.ts
  blog-admin.loader.ts
  blog.loader.ts
  consent.loader.ts
  media.loader.ts
  navigation.loader.ts
  page.loader.ts
  search.loader.ts
  site.loader.ts
migrations/
  0000_tranquil_toad.sql
  meta/
    0000_snapshot.json
    _journal.json
schemas/
  applications.schema.ts
  audit-log.schema.ts
  auth.schema.ts
  blog.schema.ts
  consent.schema.ts
  departures.schema.ts
  email-voyage.schema.ts
  itinerary.schema.ts
  media.schema.ts
  navigation.schema.ts
  outbox.schema.ts
  page-version.schema.ts
  page.schema.ts
  payments.schema.ts
  policies.schema.ts
  reservations.schema.ts
  services-engagement.schema.ts
  services.schema.ts
  site.schema.ts
  travelers.schema.ts
  trips.schema.ts
schemas.ts
```

### المخططات والجداول

**auth.schema.ts**
- `user`: `id`, `name`, `email`, `emailVerified`, `image`, `createdAt`, `updatedAt`, `username`, `displayUsername`, `bio`, `website`, `twitter`, `linkedin`, `role`, `banned`, `banReason`, `banExpires` _(sessions: many, accounts: many)_
- `session`: `id`, `expiresAt`, `token`, `createdAt`, `updatedAt`, `ipAddress`, `userAgent`, `userId`, `impersonatedBy` _(user: one)_
- `account`: `id`, `issuer`, `accountId`, `providerId`, `userId`, `accessToken`, `refreshToken`, `idToken`, `accessTokenExpiresAt`, `refreshTokenExpiresAt`, `scope`, `password`, `createdAt`, `updatedAt` _(user: one)_
- `verification`: `id`, `identifier`, `value`, `expiresAt`, `createdAt`, `updatedAt`

**audit-log.schema.ts**
- `audit_log`: `id`, `userId`, `action`, `resource`, `resourceId`, `metadata`, `ipAddress`, `userAgent`, `createdAt`

**site.schema.ts**
- `site_settings`: `id`, `locale`, `siteName`, `siteDescription`, `siteSlogan`, `metaTitle`, `metaDescription`, `logoLight`, `logoDark`, `favicon`, `ogImage`, `headerCtaText`, `headerCtaUrl`, `headerSecondaryText`, `headerSecondaryUrl`, `headerSticky`, `footerCopyrightText`, `footerCopyrightUrl`, `footerSocialHeading`, `footerNavPrimaryHeading`, `footerNavSecondaryHeading`, `footerLegalHeading`, `createdAt`, `updatedAt`
- `social_links`: `id`, `platform`, `url`, `icon`, `label`, `sortOrder`, `isActive`, `createdAt`, `updatedAt`
- `contact_info`: `id`, `email`, `phone`, `address`, `city`, `postalCode`, `country`, `mapUrl`, `latitude`, `longitude`, `createdAt`, `updatedAt`
- `opening_hours`: `id`, `dayOfWeek`, `openTime`, `closeTime`, `hasMiddayBreak`, `morningOpen`, `morningClose`, `afternoonOpen`, `afternoonClose`, `isClosed`, `createdAt`, `updatedAt`
- `theme_settings`: `id`, `name`, `isActive`, `lightTokens`, `darkTokens`, `primaryColor`, `secondaryColor`, `accentColor`, `backgroundColor`, `foregroundColor`, `mutedColor`, `mutedForegroundColor`, `fontHeading`, `fontBody`, `borderRadius`, `createdAt`, `updatedAt`

**navigation.schema.ts**
- `navigation_menus`: `id`, `name`, `description`, `isVisible`, `displayLabel`, `showHeading`, `createdAt`, `updatedAt`
- `navigation_items`: `id`, `menuId`, `parentId`, `locale`, `label`, `url`, `icon`, `showIcon`, `sortOrder`, `isActive`, `openInNewTab`, `createdAt`, `updatedAt`

**page.schema.ts**
- `pages`: `id`, `locale`, `slug`, `title`, `metaTitle`, `metaDescription`, `ogImage`, `canonical`, `robots`, `template`, `isPublished`, `publishedAt`, `scheduledAt`, `scheduledUnpublishAt`, `sortOrder`, `deletedAt`, `updatedBy`, `lockedBy`, `lockedAt`, `createdAt`, `updatedAt` _(sections: many)_
- `page_sections`: `id`, `pageId`, `type`, `content`, `sortOrder`, `isVisible`, `createdAt`, `updatedAt`, `updatedBy` _(page: one)_

**page-version.schema.ts**
- `page_versions`: `id`, `pageId`, `versionNumber`, `snapshot`, `createdBy`, `note`, `createdAt` _(page: one, author: one)_

**media.schema.ts**
- `media_folders`: `id`, `name`, `parentId`, `sortOrder`, `createdAt`, `updatedAt` _(parent: one, children: many, files: many)_
- `media_files`: `id`, `folderId`, `filename`, `url`, `mimeType`, `size`, `width`, `height`, `createdAt`, `updatedAt` _(folder: one, alts: many)_
- `media_file_alts`: `id`, `fileId`, `locale`, `alt`, `title` _(file: one)_

**consent.schema.ts**
- `consent_settings`: `id`, `locale`, `title`, `description`, `acceptAll`, `rejectAll`, `customize`, `savePreferences`, `necessaryLabel`, `necessaryDescription`, `analyticsLabel`, `analyticsDescription`, `marketingLabel`, `marketingDescription`, `privacyPolicyLabel`, `privacyPolicyUrl`, `isActive`, `createdAt`, `updatedAt`

**blog.schema.ts**
- `blog_posts`: `id`, `authorId`, `slug`, `status`, `featuredImageId`, `viewCount`, `isFeatured`, `isSticky`, `commentStatus`, `allowReviews`, `seoScore`, `publishedAt`, `createdAt`, `updatedAt`, `updatedBy`, `lockedBy`, `lockedAt` _(author: one, updatedByUser: one, lockedByUser: one, featuredImage: one, translations: many, categories: many, tags: many, comments: many, revisions: many, galleries: many, reviews: many, favorites: many, reactions: many, seo: many, viewStats: many, links: many, linkedTo: many, locks: one)_
- `blog_post_translations`: `id`, `postId`, `locale`, `title`, `slug`, `content`, `excerpt`, `metaTitle`, `metaDescription`, `metaKeywords`, `canonicalUrl`, `ogTitle`, `ogDescription`, `ogImageId`, `createdAt`, `updatedAt` _(post: one, ogImage: one)_
- `blog_categories`: `id`, `parentId`, `slug`, `icon`, `color`, `sortOrder`, `createdAt`, `updatedAt` _(parent: one, children: many, translations: many, posts: many)_
- `blog_category_translations`: `id`, `categoryId`, `locale`, `name`, `slug`, `description`, `metaTitle`, `metaDescription`, `createdAt`, `updatedAt` _(category: one)_
- `blog_tags`: `id`, `slug`, `color`, `createdAt`, `updatedAt` _(translations: many, posts: many)_
- `blog_tag_translations`: `id`, `tagId`, `locale`, `name`, `slug`, `createdAt`, `updatedAt` _(tag: one)_
- `blog_post_categories`: `postId`, `categoryId` _(post: one, category: one)_
- `blog_post_tags`: `postId`, `tagId` _(post: one, tag: one)_
- `blog_comments`: `id`, `postId`, `authorId`, `parentId`, `guestName`, `guestEmail`, `content`, `status`, `karma`, `ipAddress`, `userAgent`, `isEdited`, `createdAt`, `updatedAt` _(post: one, author: one, parent: one, replies: many, moderations: many)_
- `blog_comment_moderations`: `id`, `commentId`, `moderatorId`, `action`, `reason`, `previousValues`, `createdAt` _(comment: one, moderator: one)_
- `blog_post_revisions`: `id`, `postId`, `authorId`, `locale`, `title`, `slug`, `content`, `excerpt`, `status`, `revisionNote`, `createdAt` _(post: one, author: one)_
- `blog_post_galleries`: `id`, `postId`, `title`, `description`, `sortOrder`, `createdAt`, `updatedAt` _(post: one, media: many)_
- `blog_post_gallery_media`: `galleryId`, `mediaId`, `altText`, `caption`, `sortOrder` _(gallery: one, file: one)_
- `blog_post_reviews`: `id`, `postId`, `authorId`, `rating`, `title`, `content`, `status`, `isRecommended`, `helpfulCount`, `ipAddress`, `createdAt`, `updatedAt` _(post: one, author: one, helpfulVotes: many)_
- `blog_post_review_helpful`: `reviewId`, `userId`, `isHelpful`, `createdAt` _(review: one, user: one)_
- `blog_reports`: `id`, `postId`, `commentId`, `reviewId`, `reporterId`, `reason`, `description`, `status`, `resolvedBy`, `resolvedAt`, `createdAt` _(post: one, comment: one, review: one, reporter: one, resolver: one)_
- `blog_post_favorites`: `postId`, `userId`, `createdAt` _(post: one, user: one)_
- `blog_post_reactions`: `postId`, `userId`, `reactionType`, `createdAt`, `updatedAt` _(post: one, user: one)_
- `blog_post_seo`: `id`, `postId`, `locale`, `focusKeyword`, `focusKeywordScore`, `readabilityScore`, `metaRobots`, `metaOgType`, `metaOgLocale`, `metaTwitterCard`, `schemaMarkup`, `createdAt`, `updatedAt` _(post: one)_
- `blog_post_view_stats`: `id`, `postId`, `viewedAt`, `date`, `hour`, `referrer`, `country`, `deviceType`, `sessionId` _(post: one)_
- `blog_notifications`: `id`, `userId`, `type`, `postId`, `commentId`, `reviewId`, `fromUserId`, `isRead`, `metadata`, `createdAt` _(user: one, post: one, comment: one, review: one, fromUser: one)_
- `blog_post_locks`: `id`, `postId`, `userId`, `sessionId`, `lockedAt`, `expiresAt` _(post: one, user: one)_
- `blog_post_links`: `id`, `sourcePostId`, `targetPostId`, `linkType`, `sortOrder`, `createdAt` _(sourcePost: one, targetPost: one)_
- `blog_subscribers`: `id`, `email`, `locale`, `token`, `tokenUsedAt`, `confirmationTokenHash`, `confirmationTokenExpiresAt`, `confirmationTokenUsedAt`, `unsubscribeTokenHash`, `unsubscribeTokenUsedAt`, `status`, `confirmedAt`, `unsubscribedAt`, `createdAt`, `updatedAt`

**services.schema.ts**
- `services`: `id`, `providerId`, `slug`, `status`, `coverImageId`, `priceMinor`, `currency`, `durationMinutes`, `maxParticipants`, `isMobile`, `isFeatured`, `viewCount`, `ratingAverage100`, `ratingCount`, `seoScore`, `publishedAt`, `createdAt`, `updatedAt`, `updatedBy`, `lockedBy`, `lockedAt`
- `service_translations`: `id`, `serviceId`, `locale`, `title`, `slug`, `excerpt`, `content`, `locationLabel`, `locationAddress`, `metaTitle`, `metaDescription`, `metaKeywords`, `canonicalUrl`, `ogTitle`, `ogDescription`, `ogImageId`, `searchVector`, `createdAt`, `updatedAt`
- `service_categories`: `id`, `parentId`, `slug`, `icon`, `color`, `sortOrder`, `createdAt`, `updatedAt`
- `service_category_translations`: `id`, `categoryId`, `locale`, `name`, `slug`, `description`, `metaTitle`, `metaDescription`, `createdAt`, `updatedAt`
- `service_tags`: `id`, `slug`, `color`, `createdAt`, `updatedAt`
- `service_tag_translations`: `id`, `tagId`, `locale`, `name`, `slug`, `createdAt`, `updatedAt`
- `service_category_links`: `serviceId`, `categoryId`
- `service_tag_links`: `serviceId`, `tagId`
- `service_media`: `serviceId`, `mediaId`, `kind`, `altText`, `caption`, `sortOrder`
- `service_availability`: `id`, `serviceId`, `dayOfWeek`, `startTime`, `endTime`, `timezone`, `maxParticipants`, `createdAt`
- `service_revisions`: `id`
- `service_locks`: `id`
- `service_seo`: `id`
- `service_favorites`: `serviceId`
- `service_comments`: `id`
- `service_reviews`: `id`
- `service_reports`: `id`
- `service_view_stats`: `id`

**services-engagement.schema.ts**
- `service_reactions`: `serviceId`
- `service_notifications`: `id`
- `service_attribute_definitions`: `id`
- `service_attribute_values`: `serviceId`
- `service_review_helpful`: `reviewId`, `userId`, `isHelpful`, `createdAt`

**trips.schema.ts**
- `trips`: `id`, `status`, `countryCode`, `defaultCurrency`, `heroMediaId`, `durationDays`, `durationNights`, `groupMin`, `groupMax`, `difficulty`, `difficultyLevel`, `arrivalAirport`, `departureAirport`, `accommodationStyle`, `requireAccount`, `publishedAt`, `archivedAt`, `createdAt`, `updatedAt` _(translations: many, highlights: many, inclusions: many, exclusions: many, tripFaqs: many, revisions: many)_
- `trip_translations`: `id`, `tripId`, `locale`, `slug`, `title`, `shortTitle`, `summary`, `overview`, `highlights`, `experience`, `fitness`, `preparation`, `lodging`, `food`, `faithConsiderations`, `metaTitle`, `metaDescription`, `localeVisible`, `createdAt`, `updatedAt` _(trip: one)_
- `trip_highlights`: `id`, `tripId`, `mediaId`, `iconKey`, `sortOrder`, `createdAt`
- `trip_highlight_translations`: `id`, `highlightId`, `locale`, `title`, `description`, `updatedAt`
- `trip_inclusions`: `id`, `tripId`, `sortOrder`
- `trip_inclusion_translations`: `id`, `inclusionId`, `locale`, `text`, `updatedAt`
- `trip_exclusions`: `id`, `tripId`, `sortOrder`
- `trip_exclusion_translations`: `id`, `exclusionId`, `locale`, `text`, `updatedAt`
- `faqs`: `id`, `sortOrder`, `createdAt`, `updatedAt`
- `faq_translations`: `id`, `faqId`, `locale`, `question`, `answer`, `updatedAt`
- `trip_faqs`: `tripId`, `faqId`, `sortOrder`
- `trip_revisions`: `id`, `tripId`, `snapshot`, `createdBy`, `createdAt`

**itinerary.schema.ts**
- `itinerary_days`: `id`, `tripId`, `dayNumber`, `location`, `route`, `activityLevel`, `distanceKm`, `activityDurationMin`, `minAltitudeM`, `maxAltitudeM`, `createdAt`, `updatedAt` _(translations: many, trip: one)_
- `itinerary_day_translations`: `id`, `dayId`, `locale`, `title`, `morning`, `afternoon`, `evening`, `meals`, `accommodation`, `transfer`, `notes`, `updatedAt`

**departures.schema.ts**
- `departures`: `id`, `tripId`, `startDate`, `endDate`, `status`, `capacityMin`, `capacityMax`, `priceAmount`, `currency`, `depositType`, `depositAmount`, `depositPercent`, `singleSupplementType`, `singleSupplementAmount`, `taxType`, `taxAmount`, `feeType`, `feeAmount`, `discountType`, `discountAmount`, `pricingRules`, `balanceDueDate`, `bookingDeadline`, `arrivalAirport`, `departureAirport`, `createdAt`, `updatedAt` _(holds: many, trip: one)_
- `seat_holds`: `id`, `departureId`, `applicationId`, `quantity`, `status`, `expiresAt`, `createdAt`, `releasedAt`

**travelers.schema.ts**
- `travelers`: `id`, `userId`, `email`, `phone`, `legalName`, `preferredName`, `dateOfBirth`, `locale`, `timezone`, `emailVerifiedAt`, `createdAt`, `updatedAt`
- `traveler_internal_notes`: `id`, `travelerId`, `adminUserId`, `note`, `createdAt`

**applications.schema.ts**
- `applications`: `id`, `travelerId`, `tripId`, `departureId`, `status`, `roomPreference`, `dietaryRequirements`, `accessibilityNeeds`, `activityAcknowledgement`, `motivation`, `expectations`, `consent`, `submittedAt`, `createdAt`, `updatedAt` _(decisions: many, events: many, traveler: one, trip: one, departure: one)_
- `application_decisions`: `id`, `applicationId`, `decision`, `adminUserId`, `internalNote`, `createdAt`
- `application_events`: `id`, `applicationId`, `event`, `actorId`, `createdAt`
- `application_internal_notes`: `id`, `applicationId`, `adminUserId`, `note`, `createdAt`

**reservations.schema.ts**
- `reservations`: `id`, `reservationNumber`, `travelerId`, `tripId`, `departureId`, `applicationId`, `status`, `currency`, `baseAmount`, `singleSupplementAmount`, `discountAmount`, `taxAmount`, `feeAmount`, `totalAmount`, `amountPaid`, `amountDue`, `balanceDueDate`, `agreementVersionId`, `acceptedAt`, `confirmedAt`, `cancelledAt`, `completedAt`, `createdAt`, `updatedAt` _(snapshots: many, traveler: one, departure: one)_
- `reservation_price_snapshots`: `id`, `reservationId`, `snapshot`, `createdAt`
- `reservation_internal_notes`: `id`, `reservationId`, `adminUserId`, `note`, `createdAt`

**payments.schema.ts**
- `payments`: `id`, `reservationId`, `provider`, `providerPaymentId`, `type`, `status`, `amount`, `currency`, `idempotencyKey`, `metadata`, `createdAt`, `paidAt`, `failedAt` _(reservation: one)_
- `checkout_sessions`: `id`, `applicationId`, `departureId`, `reservationId`, `providerSessionId`, `status`, `expiresAt`, `createdAt`, `updatedAt`

**policies.schema.ts**
- `policy_documents`: `id`, `type`, `locale`, `createdAt`, `updatedAt` _(versions: many)_
- `policy_versions`: `id`, `documentId`, `version`, `title`, `content`, `published`, `reviewedBy`, `reviewedAt`, `publishedAt`, `createdAt`

**outbox.schema.ts**
- `outbox_events`: `id`, `eventType`, `aggregateType`, `aggregateId`, `payload`, `status`, `attempts`, `availableAt`, `processedAt`, `createdAt`

**email-voyage.schema.ts**
- `email_templates`: `id`, `key`, `locale`, `version`, `subject`, `html`, `textBody`, `active`, `createdAt`, `updatedAt`
- `email_deliveries`: `id`, `templateKey`, `templateVersion`, `locale`, `toEmail`, `travelerId`, `reservationId`, `status`, `attempts`, `lastError`, `scheduledAt`, `sentAt`, `createdAt`, `updatedAt` _(events: many)_
- `email_events`: `id`, `deliveryId`, `event`, `createdAt`

### الترحيلات

- `0000_tranquil_toad.sql`

### الأوامر

| Command |
|---------|
| `pnpm db:check` |
| `pnpm db:compare` |
| `pnpm db:generate` |
| `pnpm db:infra` |
| `pnpm db:migrate` |
| `pnpm db:reset` |
| `pnpm db:seed` |
| `pnpm db:seed-media` |
| `pnpm db:sync` |
| `pnpm db:cleanup-audit` |

### الاختبارات

- `tests/integration/admin-voyage-loaders.test.ts`
- `tests/integration/db-health.test.ts`
- `tests/integration/voyage-loaders2.test.ts`
- `tests/unit/cache.test.ts`
- `tests/unit/cli-utils.test.ts`
- `tests/unit/cms-schemas.test.ts`
- `tests/unit/cms-seeds.test.ts`
- `tests/unit/db-env.test.ts`
- `tests/unit/loaders.test.ts`
- `tests/unit/navigation-loader.test.ts`
- `tests/unit/schema-validation.test.ts`
- `tests/unit/search-fts.test.ts`
- `tests/unit/site-loader.test.ts`
- `tests/unit/voyage/loaders-edge.test.ts`

## المصادقة

### الملفات

```
src/lib/ (auth)
  audit.ts
  auth-client.ts
  auth-data.ts
  auth-guards.ts
  auth.ts
  permissions.ts
  rate-limit.ts
  sanitize.ts
src/actions/
  admin/
  blog/
  index.ts
  services/
  voyage/
src/middleware.ts
```

### تدفقات المصادقة

- التسجيل (اسم المستخدم + البريد + كلمة المرور)
- تسجيل الدخول بالبريد الإلكتروني
- التحقق من البريد الإلكتروني
- إعادة تعيين كلمة المرور
- حذف الحساب (RGPD)
- انتحال هوية المسؤول

### الأدوار والمنظمات

- **user** — وصول قياسي
- **admin** — وصول كامل + انتحال الهوية
- المنظمات: الإنشاء، الدعوات، الأعضاء، الأدوار المخصصة

### الأمان والتدقيق

- سجل تدقيق تلقائي على جميع الإجراءات الحساسة
- تحديد معدل الطلبات في الذاكرة
- تطهير المدخلات
- حراسة المسارات المحمية
- `middleware.ts` يضخ جلسة المصادقة في كل طلب

### الاختبارات

- `tests/e2e/auth.spec.ts`
- `tests/integration/audit.test.ts`
- `tests/integration/auth-advanced.test.ts`
- `tests/integration/auth-flow.test.ts`
- `tests/integration/auth.test.ts`
- `tests/integration/middleware.test.ts`
- `tests/unit/audit-fallback.test.ts`
- `tests/unit/auth-guards.test.ts`
- `tests/unit/cms-audit.test.ts`
- `tests/unit/extract-ip.test.ts`
- `tests/unit/mask-utils.test.ts`
- `tests/unit/middleware-timeout.test.ts`
- `tests/unit/permissions.test.ts`
- `tests/unit/production-hardening.test.ts`
- `tests/unit/rate-limit.test.ts`
- `tests/unit/voyage/auth-guards.test.ts`
- `tests/unit/voyage/middleware.test.ts`

## المحتوى ونظام إدارة المحتوى

### الملفات

```
src/core/
admin/
  confirmation.ts
  filter-contract.ts
  index.ts
  resource-contract.ts
attributes/
  index.ts
audit/
  index.ts
cache/
  index.ts
capabilities/
  index.ts
content/
  index.ts
  text.ts
engagement/
  index.ts
index.ts
localization/
  index.ts
  module-labels.ts
locks/
  index.ts
media/
  index.ts
moderation/
  index.ts
modules/
  bootstrap.ts
  index.ts
  module-contract.ts
  module-registry.ts
notifications/
  index.ts
presentation/
  index.ts
revision/
  index.ts
search/
  contract.ts
  index.ts
  postgres.ts
  registry.ts
seo/
  index.ts
taxonomy/
  index.ts
workflow/
  index.ts
src/modules/
applications/
  admin/
    resource.ts
  components/
    AdminApplicationDetail.astro
    AdminApplicationList.astro
  domain/
    application-service.ts
    application-transitions.ts
  loaders/
    admin-applications.loader.ts
  module.ts
  repositories/
    application.repository.ts
availability/
  domain/
    availability-service.ts
    availability.ts
blog/
  actions/
    index.ts
  admin/
    index.ts
    resource.ts
  capabilities.ts
  components/
    cards/
      index.ts
    lists/
      index.ts
    single/
      index.ts
    ui/
      index.ts
  domain/
    index.ts
  i18n/
    index.ts
  index.ts
  loaders/
    index.ts
  module.ts
  permissions/
    index.ts
  schema/
    index.ts
  search/
    index.ts
  seo/
    index.ts
  utils/
    index.ts
  validation/
    index.ts
departures/
  domain/
    departure-transitions.ts
  loaders/
    departure.loader.ts
  module.ts
  repositories/
    departure.repository.ts
email-voyage/
  admin/
    resource.ts
  components/
    AdminEmailList.astro
  domain/
    reminders.ts
    voyage-email-worker.ts
    voyage-email.ts
  loaders/
    admin-email.loader.ts
  module.ts
itinerary/
  components/
    AdminItinerarySection.astro
  loaders/
    admin-itinerary.loader.ts
outbox/
  domain/
    outbox-worker.ts
    outbox.ts
    retention.ts
  loaders/
    admin-outbox.loader.ts
payments/
  admin/
    resource.ts
  components/
    AdminPaymentList.astro
  domain/
    checkout-service.ts
    payment-service.ts
    payment-transitions.ts
    providers.ts
    refund-service.ts
  loaders/
    admin-payments.loader.ts
  module.ts
  repositories/
    payment.repository.ts
policies/
  admin/
    resource.ts
  components/
    AdminPolicyList.astro
  loaders/
    admin-policies.loader.ts
  module.ts
pricing/
  domain/
    pricing-service.ts
    pricing.ts
reservations/
  admin/
    resource.ts
  components/
    AdminReservationDetail.astro
    AdminReservationList.astro
  domain/
    cancellation-policy.ts
    reservation-service.ts
    reservation-transitions.ts
  loaders/
    admin-reservations.loader.ts
    booking.loader.ts
  module.ts
  repositories/
    reservation.repository.ts
services/
  actions/
    index.ts
  admin/
    index.ts
    loader.ts
    resource.ts
  capabilities.ts
  components/
    cards/
      index.ts
      ServiceCard.astro
    lists/
      index.ts
      ServiceGrid.astro
      ServicesListingPage.astro
    single/
      index.ts
      ServiceDetail.astro
      ServiceEngagement.astro
    ui/
      index.ts
      ServiceLocaleSwitcher.astro
      ServiceMeta.astro
  domain/
    index.ts
  i18n/
    engagement.ts
    form.ts
    index.ts
    notifications.ts
    sort.ts
  index.ts
  loaders/
    index.ts
  module.ts
  permissions/
    index.ts
  schema/
    index.ts
  search/
    index.ts
  seo/
    index.ts
  utils/
    index.ts
    urls.ts
  validation/
    index.ts
  workflow.ts
travelers/
  admin/
    resource.ts
  components/
    AdminTravelerList.astro
  domain/
    traveler-email.ts
    travelers-service.ts
  loaders/
    admin-travelers.loader.ts
  module.ts
  repositories/
    traveler.repository.ts
trips/
  admin/
    resource.ts
  components/
    AdminContentsSection.astro
    AdminFaqSection.astro
    AdminTripForm.astro
    AdminTripList.astro
    TripCard.astro
  domain/
    trip-transitions.ts
  loaders/
    admin-contents.loader.ts
    admin-health.loader.ts
    admin-trips.loader.ts
    trip.loader.ts
  module.ts
  repositories/
    trip.repository.ts
src/pages/
404.astro
500.astro
api/
  analytics.ts
  audit-export.ts
  auth/
    [...all].ts
  blog/
    newsletter/
  contact.ts
  content-export.ts
  content-import.ts
  cron/
    publish.ts
    voyage.ts
  export-data.ts
  health.ts
  media.ts
  payments/
    mock-callback.ts
    webhook.ts
  preview.ts
  search.ts
  upload.ts
index.astro
robots.txt.ts
rss.xml.ts
sitemap-cms.xml.ts
[lang]/
  a-propos.astro
  admin/
    applications/
    audit.astro
    blog/
    emails/
    index.astro
    media.astro
    navigation.astro
    pages.astro
    payments/
    policies/
    reservations/
    roles.astro
    services/
    site.astro
    stats.astro
    theme.astro
    travelers/
    trips/
    users.astro
  apply/
    [trip].astro
  auth/
    [slug].astro
  blog/
    index.astro
    [...slug].astro
  booking-confirmed.astro
  checkout/
    [session].astro
  contact.astro
  faq.astro
  index.astro
  services/
    index.astro
    tags/
    [categorySlug]/
    [slug].astro
  terms.astro
  trips/
    index.astro
    [slug].astro
  [slug].astro
src/layouts/
BaseLayout.astro
```

يعتمد Atlaselle CMS على قدرات مشتركة في المنصة وCMS وعلى وحدات مجال مستقلة. ويغطي المحتوى متعدد اللغات والوسائط المشتركة والتصنيف وSEO والبحث وسير النشر والإصدارات والأقفال وحدود التفاعل والإشراف والإشعارات والتدقيق والتخزين المؤقت ونموذج موارد الإدارة القابل لإعادة الاستخدام. المدونة هي أول وحدة تحريرية مكتملة، والخدمات هي الوحدة الثانية للتحقق. تبقى المجالات المعاملاتية مثل الحجز والتسجيل والمخزون والمدفوعات والطلبات نوى منفصلة.

### الاختبارات

- `tests/e2e/admin-pages.spec.ts`
- `tests/e2e/blog.spec.ts`
- `tests/e2e/cms-admin.spec.ts`
- `tests/e2e/services-lifecycle.spec.ts`
- `tests/e2e/services.spec.ts`
- `tests/integration/blog-actions.test.ts`
- `tests/integration/blog-internal-link.test.ts`
- `tests/integration/cms-admin.test.ts`
- `tests/integration/consent-cms.test.ts`
- `tests/integration/contact-api.test.ts`
- `tests/integration/legal-cms.test.ts`
- `tests/integration/navigation-cycle.test.ts`
- `tests/integration/voyage-services.test.ts`
- `tests/unit/admin-consent.test.ts`
- `tests/unit/admin-contact.test.ts`
- `tests/unit/admin-helpers.test.ts`
- `tests/unit/admin-hours.test.ts`
- `tests/unit/admin-menus.test.ts`
- `tests/unit/admin-navigation-items.test.ts`
- `tests/unit/admin-pages-theme.test.ts`
- `tests/unit/admin-pages.test.ts`
- `tests/unit/admin-sections.test.ts`
- `tests/unit/admin-site-social-contact-hours.test.ts`
- `tests/unit/admin-site.test.ts`
- `tests/unit/admin-social.test.ts`
- `tests/unit/admin-theme.test.ts`
- `tests/unit/admin-versions.test.ts`
- `tests/unit/blog-engagement-actions.test.ts`
- `tests/unit/blog-gallery.test.ts`
- `tests/unit/blog-helpers.test.ts`
- `tests/unit/blog-lifecycle.test.ts`
- `tests/unit/blog-link.test.ts`
- `tests/unit/blog-loader.test.ts`
- `tests/unit/blog-newsletter-routes.test.ts`
- `tests/unit/blog-newsletter-service.test.ts`
- `tests/unit/blog-post-actions.test.ts`
- `tests/unit/blog-profile.test.ts`
- `tests/unit/blog-public-visibility.test.ts`
- `tests/unit/blog-subscription.test.ts`
- `tests/unit/blog-taxonomy-actions.test.ts`
- `tests/unit/blog-validation.test.ts`
- `tests/unit/contact-api.test.ts`
- `tests/unit/content-import-schema.test.ts`
- `tests/unit/content-locking.test.ts`
- `tests/unit/database/services-data-invariants.test.ts`
- `tests/unit/database/services-data-shape.test.ts`
- `tests/unit/export-data.test.ts`
- `tests/unit/media-loader.test.ts`
- `tests/unit/navigation-menus.test.ts`
- `tests/unit/navigation-tree.test.ts`
- `tests/unit/services-contract.test.ts`
- `tests/unit/services-validation.test.ts`
- `tests/unit/services-workflow-restore.test.ts`

## الوسائط

### الملفات

```
src/media/
delete.ts
list.ts
types.ts
upload.ts
public/
favicon.ico
favicon.svg
uploads/
  images/
```

### الرفع والمعالجة

- رفع آمن مع التحقق من نوع MIME والحجم
- معالجة الصور باستخدام **sharp**
- التخزين في `public/uploads/`
- حذف وقائمة الملفات المرفوعة

### الأوامر

| Command |
|---------|
| `pnpm db:seed-media` |

### الاختبارات

- `tests/unit/admin-media.test.ts`
- `tests/unit/media-list.test.ts`
- `tests/unit/upload-api.test.ts`
- `tests/unit/upload.test.ts`

## البريد والإشعارات

### الملفات

```
src/smtp/
commands/
  logs.rotate.ts
  smtp.check.ts
  _utils.ts
env.ts
providers/
  brevo.ts
  nodemailer.ts
  resend.ts
send.ts
templates/
  blog-newsletter.ts
  contact-form.ts
  delete-account.ts
  i18n.ts
  layout.ts
  reset-password.ts
  verify-email.ts
  voyage.ts
types.ts
logs/ ← email dead-letter queue (JSONL, one file per day)
```

### مزودو الخدمة

- **Brevo** (`SMTP_PROVIDER=BREVO`)
- **Resend** (`SMTP_PROVIDER=RESEND`)
- **Nodemailer** (`SMTP_PROVIDER=NODEMAILER`)

يتم تحديد المزود عبر متغير البيئة `SMTP_PROVIDER`.

### القوالب

قوالب بريد إلكتروني متعددة اللغات لـ: التحقق من البريد، إعادة تعيين كلمة المرور، دعوات المنظمات.

### الأوامر

| Command |
|---------|
| `pnpm smtp:check` |
| `pnpm logs:rotate` |

### الاختبارات

- `tests/unit/contact-form-template.test.ts`
- `tests/unit/send-email.test.ts`
- `tests/unit/smtp-env.test.ts`
- `tests/unit/smtp-providers.test.ts`
- `tests/unit/voyage/smtp-dead-letter.test.ts`

## التدويل

### الملفات

```
src/i18n/
ar/
  about.ts
  auth.ts
  common.ts
  contact.ts
  home.ts
blog/
  ar.ts
  en.ts
  es.ts
  fr.ts
config.ts
en/
  about.ts
  auth.ts
  common.ts
  contact.ts
  home.ts
es/
  about.ts
  auth.ts
  common.ts
  contact.ts
  home.ts
fr/
  about.ts
  auth.ts
  common.ts
  contact.ts
  home.ts
routes.ts
utils.ts
```

### اللغات المدعومة

| Locale | Language | Direction |
|--------|----------|-----------|
| `fr` | Français (default) | LTR |
| `en` | English | LTR |
| `es` | Español | LTR |
| `ar` | العربية | RTL |

### التوجيه

جميع المسارات مسبوقة بالإعداد المحلي: `/fr/`، `/en/`، `/es/`، `/ar/`. الإعداد المحلي الافتراضي هو `fr`.

### الاختبارات

- `tests/unit/cms-i18n.test.ts`
- `tests/unit/i18n-key-completeness.test.ts`
- `tests/unit/i18n-routes.test.ts`
- `tests/unit/i18n-switch.test.ts`
- `tests/unit/i18n-translations.test.ts`
- `tests/unit/i18n-urls.test.ts`
- `tests/unit/i18n-utils.test.ts`

## التكامل المستمر والجودة

### الملفات

```
tests/
  a11y/
  e2e/
  helpers/
  integration/
  unit/
.github/
agents/
  akil.agent.md
  anne.agent.md
  AtomicFullStackEngineer.agent.md
  AtomicUIDesigner.agent.md
  designer.agent.md
  DevOpsExpert.agent.md
  elias.agent.md
  faqir.md
  fatima.agent.md
  hawa.agent.md
  ishaq.agent.md
  leila.agent.md
  liwei.agent.md
  maya.agent.md
  moonzam.agent.md
  orchestrator.agent.md
  ourssoum.agent.md
  planner.agent.md
  soren.agent.md
  vladimir.agent.md
  yusra.agent.md
dependabot.yml
skills/
  accessibility/
    references/
      A11Y-PATTERNS.md
      WCAG.md
    SKILL.md
  astro/
    SKILL.md
  best-practices/
    SKILL.md
  drizzle/
    metadata.json
    references/
      advanced-schemas.md
      performance.md
      query-patterns.md
      vs-prisma.md
    SKILL.md
  emailAndPassword/
    SKILL.md
  frontend-design/
    LICENSE.txt
    SKILL.md
  nodejs-backend-patterns/
    references/
      advanced-patterns.md
    SKILL.md
  nodejs-best-practices/
    SKILL.md
  organization/
    SKILL.md
  playwright-best-practices/
    advanced/
      authentication-flows.md
      authentication.md
      clock-mocking.md
      mobile-testing.md
      multi-context.md
      multi-user.md
      network-advanced.md
      third-party.md
    architecture/
      pom-vs-fixtures.md
      test-architecture.md
      when-to-mock.md
    browser-apis/
      browser-apis.md
      iframes.md
      service-workers.md
      websockets.md
    core/
      annotations.md
      assertions-waiting.md
      configuration.md
      fixtures-hooks.md
      global-setup.md
      locators.md
      page-object-model.md
      projects-dependencies.md
      test-data.md
      test-suite-structure.md
      test-tags.md
    debugging/
      console-errors.md
      debugging.md
      error-testing.md
      flaky-tests.md
    frameworks/
      angular.md
      nextjs.md
      react.md
      vue.md
    infrastructure-ci-cd/
      ci-cd.md
      docker.md
      github-actions.md
      gitlab.md
      other-providers.md
      parallel-sharding.md
      performance.md
      reporting.md
      test-coverage.md
    LICENSE.md
    README.md
    SKILL.md
    testing-patterns/
      accessibility.md
      api-testing.md
      browser-extensions.md
      canvas-webgl.md
      component-testing.md
      drag-drop.md
      electron.md
      file-operations.md
      file-upload-download.md
      forms-validation.md
      graphql-testing.md
      i18n.md
      performance-testing.md
      security-testing.md
      visual-regression.md
  seo/
    SKILL.md
  shadcn/
    agents/
      openai.yml
    assets/
      shadcn-small.png
      shadcn.png
    cli.md
    customization.md
    evals/
      evals.json
    mcp.md
    rules/
      base-vs-radix.md
      composition.md
      forms.md
      icons.md
      styling.md
    SKILL.md
  tailwind-css-patterns/
    references/
      accessibility.md
      animations.md
      component-patterns.md
      configuration.md
      layout-patterns.md
      performance.md
      reference.md
      responsive-design.md
    SKILL.md
  tailwind-v4-shadcn/
    references/
      advanced-usage.md
      common-gotchas.md
      dark-mode.md
      migration-guide.md
      plugins-reference.md
    SKILL.md
    templates/
      components.json
      index.css
      theme-provider.tsx
      tsconfig.app.json
      utils.ts
      vite.config.ts
  twoFactor/
    SKILL.md
  typescript-advanced-types/
    SKILL.md
  vitest/
    GENERATION.md
    references/
      advanced-environments.md
      advanced-projects.md
      advanced-type-testing.md
      advanced-vi.md
      core-cli.md
      core-config.md
      core-describe.md
      core-expect.md
      core-hooks.md
      core-test-api.md
      features-concurrency.md
      features-context.md
      features-coverage.md
      features-filtering.md
      features-mocking.md
      features-snapshots.md
    SKILL.md
workflows/
  ci.yml
  codeql.yml
```

### خط الأنابيب

خط أنابيب GitHub Actions على كل push/PR نحو `main`:

1. **Lint & Type Check**
2. **Unit & Integration** — Vitest
3. **E2E** — Playwright
4. **Accessibility & Performance** — Pa11y + Lighthouse CI
5. **Build**

### إمكانية الوصول والأداء

- **Pa11y** — توافق WCAG AAA
- **Lighthouse CI** — الأداء وإمكانية الوصول والأفضليات و SEO

### الأوامر

| Command |
|---------|
| `pnpm lint` |
| `pnpm lint:fix` |
| `pnpm check` |
| `pnpm test` |
| `pnpm test:watch` |
| `pnpm test:report` |
| `pnpm test:e2e` |
| `pnpm test:e2e:ui` |
| `pnpm test:e2e:report` |
| `pnpm qa:report` |
| `pnpm a11y:setup` |
| `pnpm a11y:teardown` |
| `pnpm a11y:pa11y` |
| `pnpm a11y:lighthouse` |
| `pnpm a11y:lighthouse:authed` |
| `pnpm a11y:lighthouse:rename` |
| `pnpm a11y:lighthouse:report` |
| `pnpm a11y:lighthouse:report:contrast` |
| `pnpm a11y:report` |
| `pnpm a11y` |
| `pnpm a11y:pa11y-only` |
| `pnpm a11y:lighthouse-only` |
| `pnpm qa` |
| `pnpm qa:offline` |

