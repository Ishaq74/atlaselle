import { and, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { parseListFilters } from "@/lib/query-filters";
import { getDrizzle } from "@database/drizzle";
import { cached } from "@database/cache";
import { user } from "@database/schemas/auth.schema";
import { trips } from "@database/schemas/trips.schema";
import { tripComments, tripReports, tripReviews } from "@database/schemas/trips.schema";

export const tripModerationFiltersSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  tab: z.enum(["comments", "reviews", "reports"]).default("comments"),
  status: z.string().max(20).optional(),
  tripId: z.string().min(1).max(160).optional(),
});

export type TripModerationFilters = z.infer<typeof tripModerationFiltersSchema>;

export interface TripModerationCommentRow {
  id: string;
  tripId: string;
  tripTitle: string | null;
  content: string;
  status: string;
  authorName: string | null;
  guestName: string | null;
  createdAt: Date;
}

export interface TripModerationReviewRow {
  id: string;
  tripId: string;
  tripTitle: string | null;
  rating: number;
  title: string | null;
  content: string;
  status: string;
  authorName: string | null;
  createdAt: Date;
}

export interface TripModerationReportRow {
  id: string;
  tripId: string | null;
  commentId: string | null;
  reviewId: string | null;
  reason: string;
  description: string | null;
  status: string;
  reporterName: string | null;
  createdAt: Date;
}

async function tripTitleMap(ids: string[]): Promise<Map<string, string>> {
  if (ids.length === 0) return new Map();
  const db = getDrizzle();
  const { tripTranslations } = await import("@database/schemas/trips.schema");
  const { inArray } = await import("drizzle-orm");
  const rows = await db.select({ tripId: tripTranslations.tripId, title: tripTranslations.title }).from(tripTranslations).where(inArray(tripTranslations.tripId, ids));
  const map = new Map<string, string>();
  for (const row of rows) {
    if (!map.has(row.tripId)) map.set(row.tripId, row.title);
  }
  return map;
}

export async function loadTripModerationQueue(raw: Record<string, string | undefined>): Promise<{
  tab: "comments" | "reviews" | "reports";
  comments: { rows: TripModerationCommentRow[]; total: number };
  reviews: { rows: TripModerationReviewRow[]; total: number };
  reports: { rows: TripModerationReportRow[]; total: number };
  meta: { page: number; pageSize: number };
}> {
  const filters = parseListFilters(tripModerationFiltersSchema, {
    page: raw.page,
    pageSize: raw.pageSize,
    tab: raw.tab,
    status: raw.status || undefined,
    tripId: raw.tripId || undefined,
  });
  const db = getDrizzle();
  const offset = (filters.page - 1) * filters.pageSize;

  const commentConditions = [];
  if (filters.tripId) commentConditions.push(eq(tripComments.tripId, filters.tripId));
  if (filters.tab === "comments" && filters.status) commentConditions.push(eq(tripComments.status, filters.status as "PENDING" | "APPROVED" | "REJECTED" | "SPAM" | "TRASH"));
  const commentWhere = commentConditions.length > 0 ? and(...commentConditions) : undefined;
  const reviewConditions = [];
  if (filters.tripId) reviewConditions.push(eq(tripReviews.tripId, filters.tripId));
  if (filters.tab === "reviews" && filters.status) reviewConditions.push(eq(tripReviews.status, filters.status as "PENDING" | "APPROVED" | "REJECTED" | "SPAM"));
  const reviewWhere = reviewConditions.length > 0 ? and(...reviewConditions) : undefined;
  const reportConditions = [];
  if (filters.tripId) {
    reportConditions.push(
      sql`${tripReports.tripId} = ${filters.tripId} OR ${tripComments.tripId} = ${filters.tripId} OR ${tripReviews.tripId} = ${filters.tripId}`,
    );
  }
  if (filters.tab === "reports" && filters.status) reportConditions.push(eq(tripReports.status, filters.status as "PENDING" | "REVIEWED" | "RESOLVED" | "REJECTED"));
  const reportWhere = reportConditions.length > 0 ? and(...reportConditions) : undefined;

  const [[commentTotal], [reviewTotal], [reportTotal]] = await Promise.all([
    db.select({ n: sql<number>`count(*)::int` }).from(tripComments).where(commentWhere),
    db.select({ n: sql<number>`count(*)::int` }).from(tripReviews).where(reviewWhere),
    db.select({ n: sql<number>`count(*)::int` }).from(tripReports).where(reportWhere),
  ]);

  const commentRows =
    filters.tab === "comments"
      ? await db
          .select({ comment: tripComments, author: { name: user.name } })
          .from(tripComments)
          .leftJoin(user, eq(user.id, tripComments.authorId))
          .where(commentWhere)
          .orderBy(desc(tripComments.createdAt))
          .limit(filters.pageSize)
          .offset(offset)
      : [];
  const reviewRows =
    filters.tab === "reviews"
      ? await db
          .select({ review: tripReviews, author: { name: user.name } })
          .from(tripReviews)
          .leftJoin(user, eq(user.id, tripReviews.authorId))
          .where(reviewWhere)
          .orderBy(desc(tripReviews.createdAt))
          .limit(filters.pageSize)
          .offset(offset)
      : [];
  const reportRows =
    filters.tab === "reports"
      ? await db
          .select({ report: tripReports, reporter: { name: user.name } })
          .from(tripReports)
          .leftJoin(user, eq(user.id, tripReports.reporterId))
          .where(reportWhere)
          .orderBy(desc(tripReports.createdAt))
          .limit(filters.pageSize)
          .offset(offset)
      : [];

  const tripIds = [
    ...commentRows.map((r) => r.comment.tripId),
    ...reviewRows.map((r) => r.review.tripId),
    ...reportRows.map((r) => r.report.tripId).filter((id): id is string => !!id),
  ];
  const titles = await tripTitleMap([...new Set(tripIds)]);
  void trips;

  return {
    tab: filters.tab,
    comments: {
      rows: commentRows.map((r) => ({
        id: r.comment.id,
        tripId: r.comment.tripId,
        tripTitle: titles.get(r.comment.tripId) ?? null,
        content: r.comment.content,
        status: r.comment.status,
        authorName: r.author?.name ?? null,
        guestName: r.comment.guestName,
        createdAt: r.comment.createdAt,
      })),
      total: commentTotal?.n ?? 0,
    },
    reviews: {
      rows: reviewRows.map((r) => ({
        id: r.review.id,
        tripId: r.review.tripId,
        tripTitle: titles.get(r.review.tripId) ?? null,
        rating: r.review.rating,
        title: r.review.title,
        content: r.review.content,
        status: r.review.status,
        authorName: r.author?.name ?? null,
        createdAt: r.review.createdAt,
      })),
      total: reviewTotal?.n ?? 0,
    },
    reports: {
      rows: reportRows.map((r) => ({
        id: r.report.id,
        tripId: r.report.tripId,
        commentId: r.report.commentId,
        reviewId: r.report.reviewId,
        reason: r.report.reason,
        description: r.report.description,
        status: r.report.status,
        reporterName: r.reporter?.name ?? null,
        createdAt: r.report.createdAt,
      })),
      total: reportTotal?.n ?? 0,
    },
    meta: { page: filters.page, pageSize: filters.pageSize },
  };
}

export const loadTripModerationCounts = cached(() => "voyage:moderation:counts", async () => {
  const db = getDrizzle();
  const [[pendingComments], [pendingReviews], [pendingReports]] = await Promise.all([
    db.select({ n: sql<number>`count(*)::int` }).from(tripComments).where(eq(tripComments.status, "PENDING")),
    db.select({ n: sql<number>`count(*)::int` }).from(tripReviews).where(eq(tripReviews.status, "PENDING")),
    db.select({ n: sql<number>`count(*)::int` }).from(tripReports).where(eq(tripReports.status, "PENDING")),
  ]);
  return {
    pendingComments: pendingComments?.n ?? 0,
    pendingReviews: pendingReviews?.n ?? 0,
    pendingReports: pendingReports?.n ?? 0,
  };
});
