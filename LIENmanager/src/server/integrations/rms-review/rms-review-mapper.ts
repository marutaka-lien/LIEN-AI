import type { ReviewUpsertInput } from "@/types/review";
import type { RmsReviewCsvRow } from "./rms-review-csv";
import { RmsReviewParseError } from "./rms-review-errors";

const REVIEW_TYPE_MAP: Record<string, string> = {
  商品レビュー: "product",
  ショップレビュー: "shop",
};

const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

// CSVの投稿時間は "YYYY/MM/DD HH:MM:SS" 形式のJST時刻(タイムゾーン情報なし)。
// JSTとして解釈し、UTC基準のDateへ変換する。月・日・時・分・秒はゼロ埋めされない
// 場合がある(2026-08-25実CSVで確認: 0〜9時が"9:46:52"のように1桁になる)ため、
// 各要素は1〜2桁を許容する。
function parseJstDateTime(value: string): Date {
  const match = value.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2}) (\d{1,2}):(\d{1,2}):(\d{1,2})$/);
  if (!match) {
    throw new RmsReviewParseError(`投稿時間の形式が不正です: ${value}`);
  }

  const [year, month, day, hour, minute, second] = match.slice(1).map(Number);
  const utcMs = Date.UTC(year, month - 1, day, hour, minute, second) - JST_OFFSET_MS;
  return new Date(utcMs);
}

// レビュー詳細URL(sourceUrl)を重複検知キーとする(CSV上でレビューを一意に
// 特定できる列がこれのみのため。2026-08-06実CSVで確認済み)。
export function toReviewUpsertInput(row: RmsReviewCsvRow): ReviewUpsertInput {
  const reviewType = REVIEW_TYPE_MAP[row.reviewType];
  if (!reviewType) {
    throw new RmsReviewParseError(`未知のレビュータイプです: ${row.reviewType}`);
  }

  if (!row.sourceUrl) {
    throw new RmsReviewParseError("レビュー詳細URLが空です(重複検知キーのため必須)");
  }

  const rating = Number(row.rating);
  if (!Number.isInteger(rating)) {
    throw new RmsReviewParseError(`評価が数値ではありません: ${row.rating}`);
  }

  return {
    channel: "rakuten",
    reviewType,
    sourceUrl: row.sourceUrl,
    productName: row.productName || null,
    title: row.title || null,
    body: row.body,
    rating,
    orderNumber: row.orderNumber || null,
    reviewedAt: parseJstDateTime(row.postedAt),
    rawPayload: JSON.stringify(row),
  };
}
