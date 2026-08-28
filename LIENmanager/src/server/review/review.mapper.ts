import type { Review } from "@/generated/prisma/client";
import type { ReviewDTO, ReviewReplyStatus } from "@/types/review";

export function toReviewDTO(review: Review): ReviewDTO {
  return {
    id: review.id,
    channel: review.channel,
    reviewType: review.reviewType,
    sourceUrl: review.sourceUrl,
    productName: review.productName,
    title: review.title,
    body: review.body,
    rating: review.rating,
    orderNumber: review.orderNumber,
    reviewedAt: review.reviewedAt.toISOString(),
    createdAt: review.createdAt.toISOString(),
    updatedAt: review.updatedAt.toISOString(),
    replyStatus: review.replyStatus as ReviewReplyStatus,
    replyText: review.replyText,
    replyGeneratedAt: review.replyGeneratedAt?.toISOString() ?? null,
    repliedAt: review.repliedAt?.toISOString() ?? null,
    replyError: review.replyError,
  };
}
