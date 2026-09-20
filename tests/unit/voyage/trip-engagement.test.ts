import { describe, expect, it } from "vitest";
import {
  tripCommentFormSchema,
  tripCommentModerationSchema,
  tripReportFormSchema,
  tripReviewFormSchema,
  tripReviewModerationSchema,
} from "@/modules/trips/validation";
import {
  TRIP_COMMENT_WORKFLOW,
  TRIP_REPORT_WORKFLOW,
  TRIP_REVIEW_WORKFLOW,
  canTransitionEngagement,
} from "@/modules/trips/domain/trip-engagement-workflow";
import { averageFrom100 } from "@/modules/trips/domain/trip-engagement";
import { getTripEngagementTranslations } from "@/modules/trips/i18n/engagement";
import { seedManifest } from "@/database/data/manifest";
import tripCommentsSeed from "@/database/data/48-trip-comments.data";
import tripReviewsSeed from "@/database/data/49-trip-reviews.data";
import tripReportsSeed from "@/database/data/50-trip-reports.data";

const TRIP_ID = "trip-algeria";
const UUID_ID = "123e4567-e89b-12d3-a456-426614174000";

describe("trip engagement validation", () => {
  it("comment accepte contenu + parent optionnel", () => {
    const parsed = tripCommentFormSchema.parse({ tripId: TRIP_ID, content: "Super voyage !" });
    expect(parsed.tripId).toBe(TRIP_ID);
  });
  it("comment rejette contenu vide et trop long", () => {
    expect(() => tripCommentFormSchema.parse({ tripId: TRIP_ID, content: " " })).toThrow();
    expect(() => tripCommentFormSchema.parse({ tripId: TRIP_ID, content: "x".repeat(5001) })).toThrow();
  });
  it("review exige note 1-5 et contenu", () => {
    expect(() => tripReviewFormSchema.parse({ tripId: TRIP_ID, rating: 0, content: "x" })).toThrow();
    expect(() => tripReviewFormSchema.parse({ tripId: TRIP_ID, rating: 6, content: "x" })).toThrow();
    const ok = tripReviewFormSchema.parse({ tripId: TRIP_ID, rating: 5, content: "Parfait" });
    expect(ok.rating).toBe(5);
  });
  it("moderation comment accepte les 5 actions", () => {
    for (const action of ["APPROVE", "REJECT", "DELETE", "RESTORE", "EDIT"] as const) {
      expect(() => tripCommentModerationSchema.parse({ commentId: UUID_ID, moderationAction: action })).not.toThrow();
    }
  });
  it("moderation review accepte PENDING/APPROVED/REJECTED/SPAM", () => {
    for (const status of ["PENDING", "APPROVED", "REJECTED", "SPAM"] as const) {
      expect(() => tripReviewModerationSchema.parse({ reviewId: UUID_ID, status })).not.toThrow();
    }
    expect(() => tripReviewModerationSchema.parse({ reviewId: UUID_ID, status: "TRASH" })).toThrow();
  });
  it("report single-target strict", () => {
    expect(() => tripReportFormSchema.parse({ reason: "SPAM" })).toThrow();
    expect(() => tripReportFormSchema.parse({ tripId: TRIP_ID, commentId: UUID_ID, reason: "SPAM" })).toThrow();
    expect(() => tripReportFormSchema.parse({ tripId: TRIP_ID, reason: "SPAM" })).not.toThrow();
    expect(() => tripReportFormSchema.parse({ commentId: UUID_ID, reason: "OTHER" })).not.toThrow();
    expect(() => tripReportFormSchema.parse({ reviewId: UUID_ID, reason: "OFF_TOPIC" })).not.toThrow();
  });
});

describe("trip engagement workflow", () => {
  it("comment PENDING vers APPROVED/REJECTED/SPAM/TRASH", () => {
    expect(canTransitionEngagement(TRIP_COMMENT_WORKFLOW, "PENDING", "APPROVED")).toBe(true);
    expect(canTransitionEngagement(TRIP_COMMENT_WORKFLOW, "PENDING", "TRASH")).toBe(true);
    expect(canTransitionEngagement(TRIP_COMMENT_WORKFLOW, "TRASH", "PENDING")).toBe(true);
    expect(canTransitionEngagement(TRIP_COMMENT_WORKFLOW, "TRASH", "APPROVED")).toBe(false);
  });
  it("review PENDING vers APPROVED/REJECTED/SPAM, jamais TRASH", () => {
    expect(canTransitionEngagement(TRIP_REVIEW_WORKFLOW, "PENDING", "APPROVED")).toBe(true);
    expect(canTransitionEngagement(TRIP_REVIEW_WORKFLOW, "PENDING", "TRASH")).toBe(false);
  });
  it("report PENDING vers REVIEWED/RESOLVED/REJECTED", () => {
    expect(canTransitionEngagement(TRIP_REPORT_WORKFLOW, "PENDING", "RESOLVED")).toBe(true);
    expect(canTransitionEngagement(TRIP_REPORT_WORKFLOW, "RESOLVED", "PENDING")).toBe(false);
  });
  it("averageFrom100 arrondi à 1 décimale", () => {
    expect(averageFrom100(450)).toBe(4.5);
    expect(averageFrom100(0)).toBe(0);
  });
});

describe("trip engagement i18n 4 locales", () => {
  it("fr/en/es/ar couvrent les clés critiques", () => {
    for (const locale of ["fr", "en", "es", "ar"] as const) {
      const t = getTripEngagementTranslations(locale);
      expect(t.reviewTitle.length).toBeGreaterThan(0);
      expect(t.commentTitle.length).toBeGreaterThan(0);
      expect(t.pendingModeration.length).toBeGreaterThan(0);
      expect(t.report.length).toBeGreaterThan(0);
    }
  });
});

describe("trip engagement seeds invariants", () => {
  it("manifest déclare 48→54", () => {
    const files = seedManifest.map((e) => e.dataFile);
    for (const f of ["48-trip-comments.data.ts", "48b-trip-comment-moderations.data.ts", "49-trip-reviews.data.ts", "49b-trip-review-helpful.data.ts", "50-trip-reports.data.ts", "51-trip-favorites.data.ts", "52-trip-view-stats.data.ts", "53-trip-reactions.data.ts", "54-trip-notifications.data.ts"]) {
      expect(files).toContain(f);
    }
  });
  it("comments statuts couvrent PENDING/APPROVED", () => {
    const statuses = new Set((tripCommentsSeed as { status: string }[]).map((c) => c.status));
    expect(statuses.has("APPROVED")).toBe(true);
    expect(statuses.has("PENDING")).toBe(true);
  });
  it("reviews notes 1-5 et statuts PENDING/APPROVED", () => {
    for (const r of tripReviewsSeed as { rating: number; status: string }[]) {
      expect(r.rating).toBeGreaterThanOrEqual(1);
      expect(r.rating).toBeLessThanOrEqual(5);
      expect(["PENDING", "APPROVED", "REJECTED", "SPAM"]).toContain(r.status);
    }
  });
  it("reports single-target", () => {
    for (const r of tripReportsSeed as { tripId: string | null; commentId: string | null; reviewId: string | null }[]) {
      const count = Number(!!r.tripId) + Number(!!r.commentId) + Number(!!r.reviewId);
      expect(count).toBe(1);
    }
  });
  it("reviews uniques par (tripId, authorId)", () => {
    const seen = new Set<string>();
    for (const r of tripReviewsSeed as { tripId: string; authorId: string }[]) {
      const key = `${r.tripId}::${r.authorId}`;
      expect(seen.has(key)).toBe(false);
      seen.add(key);
    }
  });
});
