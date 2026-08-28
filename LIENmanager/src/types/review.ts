// レビューの共通型。src/types/order.tsと同じ構成方針。

export type ReviewReplyStatus = "unreplied" | "draft" | "posted" | "failed";

export interface ReviewDTO {
  id: string;
  channel: string;
  reviewType: string; // "product" | "shop"
  sourceUrl: string;
  productName: string | null;
  title: string | null;
  body: string;
  rating: number;
  orderNumber: string | null;
  reviewedAt: string;
  createdAt: string;
  updatedAt: string;
  replyStatus: ReviewReplyStatus;
  replyText: string | null;
  replyGeneratedAt: string | null;
  repliedAt: string | null;
  replyError: string | null;
}

// 返信の下書き保存・生成結果の反映用。updateReplyへそのまま渡す。
export interface ReviewReplyUpdateInput {
  replyStatus: ReviewReplyStatus;
  replyText?: string | null;
  replyGeneratedAt?: Date | null;
  repliedAt?: Date | null;
  replyError?: string | null;
}

// 外部連携のMapperが生成する、DB同期用の入力。
// channel + sourceUrl が一意キー。rawPayloadには変換元のCSV行をJSON文字列で保持する。
export interface ReviewUpsertInput {
  channel: string;
  reviewType: string;
  sourceUrl: string;
  productName?: string | null;
  title?: string | null;
  body: string;
  rating: number;
  orderNumber?: string | null;
  reviewedAt: Date;
  rawPayload: string;
}
