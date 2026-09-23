import { randomUUID } from 'node:crypto';
import { test, expect } from '@playwright/test';
import { adminRequest, callAction } from '../helpers/actions';

/**
 * E2E — EXHAUSTIVE guard matrix over every server action.
 *
 * GUARDED actions (admin/role): an anonymous caller must NEVER succeed
 * (2xx). Acceptable rejections: 401 (no session), 403 (role), 400 (input
 * validated before the guard — still a rejection).
 *
 * PUBLIC actions (guest engagement): must never 500 and must validate input.
 *
 * Every action exported from src/actions/index.ts is named exactly once.
 */

const ID = () => randomUUID();

// ─── GUARDED: single-id style payloads ───────────────────────────────────────
// Each entry: [actionName, payload]. Anonymous → must be rejected (<2xx).
const GUARDED: Array<[string, Record<string, unknown>]> = [
  // admin/consent, contact, hours
  ['updateConsentSettings', {}],
  ['updateContactInfo', {}],
  ['updateOpeningHours', {}],
  // admin/media
  ['createMediaFolder', { name: 'x' }],
  ['updateMediaFolder', { id: ID(), name: 'x' }],
  ['deleteMediaFolder', { id: ID() }],
  ['renameMediaFile', { id: ID(), filename: 'x.jpg' }],
  ['moveMediaFile', { id: ID(), folderId: ID() }],
  ['deleteMediaFile', { id: ID() }],
  ['upsertMediaFileAlt', { fileId: ID(), locale: 'fr', alt: 'x' }],
  ['deleteMediaFileAlt', { fileId: ID(), locale: 'fr' }],
  // admin/menus + navigation
  ['createNavigationMenu', { name: 'x' }],
  ['updateNavigationMenu', { id: ID() }],
  ['deleteNavigationMenu', { id: ID() }],
  ['createNavigationItem', { menuId: ID(), label: 'x' }],
  ['updateNavigationItem', { id: ID() }],
  ['deleteNavigationItem', { id: ID() }],
  ['reorderNavigationItems', { items: [] }],
  // admin/pages
  ['createPage', { locale: 'fr', slug: 'x', title: 'x' }],
  ['updatePage', { id: ID() }],
  ['deletePage', { id: ID() }],
  ['publishPage', { id: ID() }],
  ['schedulePage', { id: ID(), publishAt: new Date().toISOString() }],
  ['unschedulePage', { id: ID() }],
  ['scheduleUnpublishPage', { id: ID(), unpublishAt: new Date().toISOString() }],
  ['unscheduleUnpublishPage', { id: ID() }],
  ['restoreFromTrash', { id: ID() }],
  ['permanentlyDeletePage', { id: ID() }],
  ['bulkPublishPages', { ids: [ID()] }],
  ['bulkArchivePages', { ids: [ID()] }],
  ['bulkRestorePages', { ids: [ID()] }],
  ['bulkDeletePages', { ids: [ID()] }],
  ['clonePage', { id: ID() }],
  ['lockPage', { id: ID() }],
  ['unlockPage', { id: ID() }],
  // admin/sections
  ['createSection', { pageId: ID(), type: 'hero' }],
  ['updateSection', { id: ID() }],
  ['deleteSection', { id: ID() }],
  ['reorderSections', { pageId: ID(), orderedIds: [] }],
  // admin/site, social, theme, versions
  ['upsertSiteSettings', { siteName: 'x' }],
  ['updateSiteSettings', { siteName: 'x' }],
  ['createSocialLink', { platform: 'x', url: 'https://x.com' }],
  ['updateSocialLink', { id: ID() }],
  ['deleteSocialLink', { id: ID() }],
  ['reorderSocialLinks', { ids: [] }],
  ['createTheme', { name: 'x' }],
  ['updateTheme', { id: ID() }],
  ['deleteTheme', { id: ID() }],
  ['createPageVersion', { pageId: ID() }],
  ['listPageVersions', { pageId: ID() }],
  ['restorePageVersion', { versionId: ID() }],
  // blog admin
  ['createBlogPost', { title: 'x' }],
  ['updateBlogPost', { id: ID() }],
  ['deleteBlogPost', { id: ID() }],
  ['publishBlogPost', { id: ID() }],
  ['unpublishBlogPost', { id: ID() }],
  ['archiveBlogPost', { id: ID() }],
  ['restoreBlogPost', { id: ID() }],
  ['duplicateBlogPost', { id: ID() }],
  ['lockBlogPost', { id: ID() }],
  ['unlockBlogPost', { id: ID() }],
  ['listBlogPostRevisions', { id: ID() }],
  ['restoreBlogPostRevision', { id: ID() }],
  ['checkBlogPostLinks', { id: ID() }],
  ['bulkBlogPostLifecycle', { ids: [ID()], action: 'publish' }],
  ['createBlogCategory', { slug: 'x' }],
  ['updateBlogCategory', { id: ID() }],
  ['deleteBlogCategory', { id: ID() }],
  ['createBlogTag', { slug: 'x' }],
  ['updateBlogTag', { id: ID() }],
  ['deleteBlogTag', { id: ID() }],
  ['moderateBlogComment', { commentId: ID(), moderationAction: 'APPROVE' }],
  ['moderateBlogReview', { reviewId: ID(), status: 'APPROVED' }],
  ['updateBlogReport', { id: ID(), status: 'RESOLVED' }],
  ['getBlogModerationQueue', {}],
  ['markBlogNotificationRead', { id: ID() }],
  ['markAllBlogNotificationsRead', {}],
  ['createBlogLink', { sourcePostId: ID(), targetPostId: ID(), linkType: 'related' }],
  ['updateBlogLink', { id: ID() }],
  ['deleteBlogLink', { id: ID() }],
  ['createBlogGallery', { postId: ID() }],
  ['updateBlogGallery', { id: ID() }],
  ['deleteBlogGallery', { id: ID() }],
  ['addGalleryMedia', { galleryId: ID(), mediaId: ID() }],
  ['removeGalleryMedia', { galleryId: ID(), mediaId: ID() }],
  // services admin
  ['createService', { slug: 'x' }],
  ['updateService', { id: ID() }],
  ['publishService', { id: ID() }],
  ['unpublishService', { id: ID() }],
  ['archiveService', { id: ID() }],
  ['restoreService', { id: ID() }],
  ['deleteService', { id: ID() }],
  ['duplicateService', { id: ID() }],
  ['lockService', { id: ID() }],
  ['unlockService', { id: ID() }],
  ['listServiceRevisions', { id: ID() }],
  ['restoreServiceRevision', { id: ID() }],
  ['createServiceCategory', { slug: 'x' }],
  ['updateServiceCategory', { id: ID() }],
  ['deleteServiceCategory', { id: ID() }],
  ['createServiceTag', { slug: 'x' }],
  ['updateServiceTag', { id: ID() }],
  ['deleteServiceTag', { id: ID() }],
  ['createServiceAvailability', { serviceId: ID() }],
  ['updateServiceAvailability', { id: ID() }],
  ['deleteServiceAvailability', { id: ID() }],
  ['createServiceAttributeDefinition', { key: 'x' }],
  ['setServiceAttributeValue', { serviceId: ID(), attributeId: ID(), value: 'x' }],
  ['addServiceMedia', { serviceId: ID(), mediaId: ID() }],
  ['updateServiceMedia', { id: ID() }],
  ['removeServiceMedia', { id: ID() }],
  ['moderateServiceComment', { commentId: ID(), moderationAction: 'APPROVE' }],
  ['moderateServiceReview', { reviewId: ID(), status: 'APPROVED' }],
  ['resolveServiceReport', { id: ID() }],
  ['listServiceNotifications', {}],
  ['markServiceNotificationRead', { id: ID() }],
  ['markAllServiceNotificationsRead', {}],
  // voyage admin
  ['createTrip', { countryCode: 'FR', durationDays: 3, durationNights: 2, groupMin: 2, groupMax: 8 }],
  ['updateTrip', { id: ID() }],
  ['upsertTripTranslation', { tripId: ID(), locale: 'fr', title: 'x' }],
  ['submitTripForReview', { id: ID() }],
  ['approveTrip', { id: ID() }],
  ['publishTrip', { id: ID() }],
  ['unpublishTrip', { id: ID() }],
  ['archiveTrip', { id: ID() }],
  ['restoreTrip', { id: ID() }],
  ['restoreTripRevision', { id: ID() }],
  ['createDeparture', { tripId: ID(), startDate: '2027-01-01', endDate: '2027-01-05', capacityMin: 2, capacityMax: 8, priceAmount: 1000 }],
  ['updateDeparture', { id: ID() }],
  ['setDepartureStatus', { id: ID(), status: 'open' }],
  ['reviewApplication', { id: ID(), decision: 'approve' }],
  ['withdrawApplication', { id: ID(), email: 'x@test.com' }],
  ['cancelReservation', { reservationId: ID() }],
  ['refundPayment', { paymentId: ID() }],
  ['payBalance', { reservationId: ID() }],
  ['retryEmailDelivery', { id: ID() }],
  ['requeueOutboxEvent', { id: ID() }],
  ['createPolicyVersion', { content: 'x' }],
  ['publishPolicyVersion', { id: ID() }],
  ['exportTravelerData', { travelerId: ID() }],
  ['anonymizeTraveler', { travelerId: ID() }],
  ['createItineraryDay', { tripId: ID(), dayNumber: 1 }],
  ['updateItineraryDay', { id: ID() }],
  ['deleteItineraryDay', { id: ID() }],
  ['upsertItineraryDayTranslation', { itineraryDayId: ID(), locale: 'fr', title: 'x' }],
  ['createTripContent', { tripId: ID(), type: 'faq' }],
  ['deleteTripContent', { id: ID() }],
  ['upsertTripContentTranslation', { contentId: ID(), locale: 'fr', content: 'x' }],
  ['createFaq', { question: 'q', answer: 'a' }],
  ['upsertFaqTranslation', { faqId: ID(), locale: 'fr', question: 'q', answer: 'a' }],
  ['deleteFaq', { id: ID() }],
  ['linkFaqToTrip', { faqId: ID(), tripId: ID() }],
  ['unlinkFaqFromTrip', { faqId: ID(), tripId: ID() }],
  ['moderateTripComment', { commentId: ID(), moderationAction: 'APPROVE' }],
  ['moderateTripReview', { reviewId: ID(), status: 'APPROVED' }],
  ['resolveTripReport', { id: ID() }],
  ['updateTripEngagementSettings', { tripId: ID() }],
];

test.describe('GUARD matrix — every guarded action rejects anonymous callers', () => {
  for (const [action, payload] of GUARDED) {
    test(`${action} — anonymous rejected`, async ({ request }) => {
      const result = await callAction(request, action, payload);
      expect(
        result.ok,
        `${action} must NOT succeed anonymously (got ${result.status})`,
      ).toBe(false);
      expect(result.status, `${action} returned ${result.status}`).toBeGreaterThanOrEqual(400);
      expect(result.status, `${action} must not 500 anonymously`).toBeLessThan(500);
    });
  }
});

// ─── PUBLIC: guest engagement actions must validate input, never 500 ────────
const PUBLIC_VALIDATION: Array<[string, Record<string, unknown>, string]> = [
  ['createBlogComment', { postId: ID() }, 'missing content'],
  ['createBlogReview', { postId: ID(), rating: 99, content: 'x' }, 'rating out of range'],
  ['createBlogReport', { postId: ID(), commentId: ID(), reason: 'SPAM' }, 'two targets'],
  ['toggleBlogReaction', { postId: ID(), reactionType: 'WRONG' }, 'invalid reaction'],
  ['subscribeBlogNewsletter', { email: 'bad' }, 'invalid email'],
  ['createTripComment', { tripId: ID() }, 'missing content'],
  ['createTripReview', { tripId: ID(), rating: 0, content: 'x' }, 'rating out of range'],
  ['createTripReport', { reason: 'WRONG' }, 'invalid reason'],
  ['toggleTripReaction', { tripId: ID(), reactionType: 'WRONG' }, 'invalid reaction'],
  ['createServiceReview', { serviceId: ID(), rating: -1, content: 'x' }, 'rating out of range'],
  ['createServiceComment', { serviceId: ID() }, 'missing content'],
  ['createServiceReport', { serviceId: ID(), reason: 'WRONG' }, 'invalid reason'],
  ['toggleServiceReaction', { serviceId: ID(), reactionType: 'WRONG' }, 'invalid reaction'],
  ['updateUserProfile', { website: 'not-a-url' }, 'invalid URL'],
  ['submitApplication', { tripId: 'x' }, 'incomplete application'],
];

test.describe('PUBLIC matrix — guest actions validate input and never 500', () => {
  for (const [action, payload, label] of PUBLIC_VALIDATION) {
    test(`${action} — rejects ${label}`, async ({ request }) => {
      const result = await callAction(request, action, payload);
      expect(result.status, `${action} must not 500 on bad input`).toBeLessThan(500);
      expect([400, 401, 403, 404, 422, 429], `${action} (${result.status})`).toContain(result.status);
    });
  }
});

// ─── Authenticated non-admin surfaces (a signed-in regular user) ─────────────
test.describe('Authenticated user engagement — never 500', () => {
  const USER_ACTIONS: Array<[string, Record<string, unknown>]> = [
    ['toggleBlogFavorite', { postId: ID() }],
    ['recordBlogPostView', { postId: ID() }],
    ['recordServiceView', { serviceId: ID() }],
    ['recordTripView', { tripId: ID() }],
    ['markAllBlogNotificationsRead', {}],
    ['markAllServiceNotificationsRead', {}],
    ['resolveBlogInternalLink', { slug: 'x' }],
    ['resolveServiceInternalLink', { slug: 'x' }],
  ];

  for (const [action, payload] of USER_ACTIONS) {
    test(`${action} — authenticated call never 500s`, async ({ browser }) => {
      const req = await adminRequest(browser);
      const result = await callAction(req, action, payload);
      expect(result.status, `${action} 500s`).toBeLessThan(500);
    });
  }
});
