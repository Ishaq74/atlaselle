import { getDrizzle } from "@database/drizzle";
import { tripNotifications } from "@database/schemas/trips.schema";
import type { Locale } from "@i18n/config";

export type TripNotificationType =
  | "NEW_COMMENT"
  | "REPLY_TO_COMMENT"
  | "NEW_REVIEW"
  | "REVIEW_APPROVED"
  | "REVIEW_REJECTED"
  | "TRIP_PUBLISHED"
  | "TRIP_MENTION";

export interface CreateTripNotificationInput {
  recipientId: string;
  actorId?: string | null;
  tripId: string;
  commentId?: string | null;
  reviewId?: string | null;
  type: TripNotificationType;
  title: string;
  message: string;
  locale?: Locale;
}

export async function createTripNotification(input: CreateTripNotificationInput): Promise<string | null> {
  if (!input.recipientId.trim() || !input.tripId.trim()) return null;
  if (input.actorId && input.actorId === input.recipientId) return null;
  const [row] = await getDrizzle()
    .insert(tripNotifications)
    .values({
      recipientId: input.recipientId,
      actorId: input.actorId ?? null,
      tripId: input.tripId,
      commentId: input.commentId ?? null,
      reviewId: input.reviewId ?? null,
      type: input.type,
      title: input.title,
      message: input.message,
    })
    .returning({ id: tripNotifications.id });
  return row?.id ?? null;
}
