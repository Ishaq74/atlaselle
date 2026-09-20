import { z } from "zod";

export const TRIP_COMMENT_STATUSES = ["PENDING", "APPROVED", "REJECTED", "SPAM", "TRASH"] as const;
export const TRIP_REVIEW_STATUSES = ["PENDING", "APPROVED", "REJECTED", "SPAM"] as const;
export const TRIP_REPORT_REASONS = ["SPAM", "ABUSIVE", "OFF_TOPIC", "HATE_SPEECH", "OTHER"] as const;
export const TRIP_REPORT_STATUSES = ["PENDING", "REVIEWED", "RESOLVED", "REJECTED"] as const;
export const TRIP_REACTION_TYPES = ["LIKE", "LOVE", "FIRE", "CLAP"] as const;
export const TRIP_COMMENT_MODERATION_ACTIONS = ["APPROVE", "REJECT", "DELETE", "RESTORE", "EDIT"] as const;

export type TripCommentStatus = (typeof TRIP_COMMENT_STATUSES)[number];
export type TripReviewStatus = (typeof TRIP_REVIEW_STATUSES)[number];

export const tripCommentStatusSchema = z.enum(TRIP_COMMENT_STATUSES);
export const tripReviewStatusSchema = z.enum(TRIP_REVIEW_STATUSES);
export const tripReportReasonSchema = z.enum(TRIP_REPORT_REASONS);
export const tripReportStatusSchema = z.enum(TRIP_REPORT_STATUSES);

export const tripCommentFormSchema = z.object({
  tripId: z.string().min(1).max(160),
  parentId: z.uuid().optional(),
  content: z.string().trim().min(1, "Le commentaire est requis.").max(5000),
  guestName: z.string().trim().min(1).max(100).optional(),
  guestEmail: z.email().max(200).optional(),
});

export const tripCommentModerationSchema = z.object({
  commentId: z.uuid(),
  moderationAction: z.enum(TRIP_COMMENT_MODERATION_ACTIONS),
  reason: z.string().trim().max(500).optional(),
  content: z.string().trim().max(5000).optional(),
});

export const tripReviewFormSchema = z.object({
  tripId: z.string().min(1).max(160),
  rating: z.number().int().min(1).max(5),
  title: z.string().trim().max(180).optional(),
  content: z.string().trim().min(1).max(3000),
  isRecommended: z.boolean().optional(),
});

export const tripReviewModerationSchema = z.object({
  reviewId: z.uuid(),
  status: tripReviewStatusSchema,
  reason: z.string().trim().max(500).optional(),
});

export const tripReportFormSchema = z.object({
  tripId: z.string().min(1).max(160).optional(),
  commentId: z.uuid().optional(),
  reviewId: z.uuid().optional(),
  reason: tripReportReasonSchema,
  description: z.string().trim().max(1000).optional(),
}).refine(
  (data) => [data.tripId, data.commentId, data.reviewId].filter(Boolean).length === 1,
  "Un seul élément peut être signalé à la fois.",
);

export const tripReactionFormSchema = z.object({
  tripId: z.string().min(1).max(160),
  reactionType: z.enum(TRIP_REACTION_TYPES),
});

export const tripHelpfulVoteSchema = z.object({
  reviewId: z.uuid(),
  isHelpful: z.boolean(),
});

export const tripModerationQueueFiltersSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(["PENDING", "APPROVED", "REJECTED", "SPAM", "TRASH", "REVIEWED", "RESOLVED"]).optional(),
  tripId: z.string().min(1).max(160).optional(),
});

export type TripCommentFormInput = z.infer<typeof tripCommentFormSchema>;
export type TripReviewFormInput = z.infer<typeof tripReviewFormSchema>;
export type TripReportFormInput = z.infer<typeof tripReportFormSchema>;
