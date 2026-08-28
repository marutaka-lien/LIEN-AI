import { describe, expect, it } from "vitest";

import type { RmsReviewCsvRow } from "../rms-review-csv";
import { toReviewUpsertInput } from "../rms-review-mapper";
import { RmsReviewParseError } from "../rms-review-errors";

function buildRow(overrides: Partial<RmsReviewCsvRow> = {}): RmsReviewCsvRow {
  return {
    reviewType: "商品レビュー",
    productName: "テスト商品",
    sourceUrl: "https://review.rakuten.co.jp/item/1/review-1/",
    rating: "5",
    postedAt: "2026/08/10 09:46:52",
    title: "とても良い",
    body: "満足しています",
    flag: "",
    orderNumber: "333267-20260722-0000000001",
    unhandledFlag: "",
    ...overrides,
  };
}

describe("toReviewUpsertInput / parseJstDateTime", () => {
  it("ゼロ埋めされた投稿時間を解釈できる", () => {
    const result = toReviewUpsertInput(buildRow({ postedAt: "2026/08/10 09:46:52" }));
    expect(result.reviewedAt.toISOString()).toBe("2026-08-10T00:46:52.000Z");
  });

  it("時が1桁(ゼロ埋めなし)の投稿時間も解釈できる(RMS実CSVで確認済みの表記ゆれ)", () => {
    const result = toReviewUpsertInput(buildRow({ postedAt: "2026/08/10 9:46:52" }));
    expect(result.reviewedAt.toISOString()).toBe("2026-08-10T00:46:52.000Z");
  });

  it("月・日が1桁の投稿時間も解釈できる", () => {
    const result = toReviewUpsertInput(buildRow({ postedAt: "2026/8/5 9:03:07" }));
    expect(result.reviewedAt.toISOString()).toBe("2026-08-05T00:03:07.000Z");
  });

  it("投稿時間の形式が不正な場合はRmsReviewParseErrorを投げる", () => {
    expect(() => toReviewUpsertInput(buildRow({ postedAt: "不正な日時" }))).toThrow(
      RmsReviewParseError
    );
  });

  it("未知のレビュータイプの場合はRmsReviewParseErrorを投げる", () => {
    expect(() => toReviewUpsertInput(buildRow({ reviewType: "不明タイプ" }))).toThrow(
      RmsReviewParseError
    );
  });
});
