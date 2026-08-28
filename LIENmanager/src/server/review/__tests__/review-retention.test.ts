import { describe, expect, it, vi } from "vitest";

import type { Review } from "@/generated/prisma/client";

import { archiveAndPruneOldReviews } from "../review-retention";
import type { ReviewArchiverPort, ReviewRetentionPort } from "../review-retention";

function buildReview(overrides: Partial<Review> = {}): Review {
  return {
    id: "review-1",
    channel: "rakuten",
    reviewType: "product",
    sourceUrl: "https://review.rakuten.co.jp/item/1/review-1/",
    productName: "テスト商品",
    title: "とても良い",
    body: "満足しています",
    rating: 5,
    orderNumber: "333267-20260722-0000000001",
    reviewedAt: new Date("2026-01-01T00:00:00Z"),
    rawPayload: "{}",
    replyStatus: "unreplied",
    replyText: null,
    replyGeneratedAt: null,
    repliedAt: null,
    replyError: null,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-01T00:00:00Z"),
    ...overrides,
  };
}

function buildFakeReviewRepository(reviews: Review[]): ReviewRetentionPort & {
  deletedIds: string[][];
} {
  const deletedIds: string[][] = [];
  return {
    deletedIds,
    async findOlderThan() {
      return reviews;
    },
    async deleteMany(ids: string[]) {
      deletedIds.push(ids);
      return { count: ids.length };
    },
  };
}

function buildFakeArchiver(initialKeys: Set<string> = new Set()): ReviewArchiverPort & {
  appended: Review[][];
} {
  const appended: Review[][] = [];
  return {
    appended,
    async loadArchivedKeys() {
      return initialKeys;
    },
    async appendReviewsToArchive(_path: string, reviews: Review[]) {
      appended.push(reviews);
    },
  };
}

describe("archiveAndPruneOldReviews", () => {
  it("対象レビューが0件の場合は何もしない", async () => {
    const reviewRepository = buildFakeReviewRepository([]);
    const archiver = buildFakeArchiver();

    const result = await archiveAndPruneOldReviews({
      reviewRepository,
      archiver,
      archiveFilePath: "fake.jsonl",
      retentionMonths: 6,
    });

    expect(result).toEqual({ prunedCount: 0, archivedCount: 0 });
    expect(archiver.appended).toHaveLength(0);
    expect(reviewRepository.deletedIds).toHaveLength(0);
  });

  it("保持期間を過ぎたレビューをアーカイブへ書き込み、DBから削除する", async () => {
    const review = buildReview();
    const reviewRepository = buildFakeReviewRepository([review]);
    const archiver = buildFakeArchiver();

    const result = await archiveAndPruneOldReviews({
      reviewRepository,
      archiver,
      archiveFilePath: "fake.jsonl",
      retentionMonths: 6,
    });

    expect(result).toEqual({ prunedCount: 1, archivedCount: 1 });
    expect(archiver.appended[0]).toEqual([review]);
    expect(reviewRepository.deletedIds[0]).toEqual(["review-1"]);
  });

  it("既にアーカイブ済みのレビューは再度書き込まず、DBからは削除する(重複防止)", async () => {
    const review = buildReview();
    const reviewRepository = buildFakeReviewRepository([review]);
    const archiver = buildFakeArchiver(
      new Set(["rakuten|https://review.rakuten.co.jp/item/1/review-1/"])
    );

    const result = await archiveAndPruneOldReviews({
      reviewRepository,
      archiver,
      archiveFilePath: "fake.jsonl",
      retentionMonths: 6,
    });

    expect(result).toEqual({ prunedCount: 1, archivedCount: 0 });
    expect(archiver.appended[0]).toEqual([]);
    expect(reviewRepository.deletedIds[0]).toEqual(["review-1"]);
  });

  it("アーカイブ書き込みが失敗した場合はDBから削除しない(データ消失防止)", async () => {
    const review = buildReview();
    const reviewRepository = buildFakeReviewRepository([review]);
    const archiver = buildFakeArchiver();
    archiver.appendReviewsToArchive = vi.fn(async () => {
      throw new Error("disk full");
    });

    await expect(
      archiveAndPruneOldReviews({
        reviewRepository,
        archiver,
        archiveFilePath: "fake.jsonl",
        retentionMonths: 6,
      })
    ).rejects.toThrow("disk full");

    expect(reviewRepository.deletedIds).toHaveLength(0);
  });

  it("retentionMonthsに応じてカットオフ日時を計算する(境界値)", async () => {
    const now = () => new Date("2026-08-06T00:00:00Z");
    let capturedCutoff: Date | undefined;
    const reviewRepository: ReviewRetentionPort = {
      async findOlderThan(cutoff) {
        capturedCutoff = cutoff;
        return [];
      },
      async deleteMany() {
        return { count: 0 };
      },
    };

    await archiveAndPruneOldReviews({
      reviewRepository,
      archiver: buildFakeArchiver(),
      archiveFilePath: "fake.jsonl",
      retentionMonths: 6,
      now,
    });

    expect(capturedCutoff?.toISOString()).toBe("2026-02-06T00:00:00.000Z");
  });
});
