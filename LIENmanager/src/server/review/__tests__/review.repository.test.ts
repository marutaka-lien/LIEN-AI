import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { PrismaClient } from "@/generated/prisma/client";
import { createTestPrismaClient } from "@/server/test-utils/create-test-prisma-client";
import type { ReviewUpsertInput } from "@/types/review";

import { createReviewRepository } from "../review.repository";

function buildInput(overrides: Partial<ReviewUpsertInput> = {}): ReviewUpsertInput {
  return {
    channel: "rakuten",
    reviewType: "product",
    sourceUrl: "https://review.rakuten.co.jp/item/1/review-1/",
    productName: "テスト商品",
    title: "とても良い",
    body: "満足しています",
    rating: 5,
    orderNumber: "333267-20260722-0000000001",
    reviewedAt: new Date("2026-08-01T08:49:26.000Z"),
    rawPayload: "{}",
    ...overrides,
  };
}

describe("reviewRepository.upsertByChannelAndSourceUrl", () => {
  let prisma: PrismaClient;
  let repository: ReturnType<typeof createReviewRepository>;

  beforeAll(async () => {
    prisma = await createTestPrismaClient();
    repository = createReviewRepository(prisma);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("新規レビューはcreateされる", async () => {
    const saved = await repository.upsertByChannelAndSourceUrl(buildInput());

    expect(saved.sourceUrl).toBe("https://review.rakuten.co.jp/item/1/review-1/");
    expect(saved.rating).toBe(5);

    const count = await prisma.review.count({
      where: { channel: "rakuten", sourceUrl: "https://review.rakuten.co.jp/item/1/review-1/" },
    });
    expect(count).toBe(1);
  });

  it("既存レビューは同一キーでupdateされる(本文が変わっても行は増えない)", async () => {
    const sourceUrl = "https://review.rakuten.co.jp/item/1/review-2/";

    await repository.upsertByChannelAndSourceUrl(buildInput({ sourceUrl, body: "旧本文" }));
    const updated = await repository.upsertByChannelAndSourceUrl(
      buildInput({ sourceUrl, body: "新本文" })
    );

    expect(updated.body).toBe("新本文");

    const count = await prisma.review.count({ where: { channel: "rakuten", sourceUrl } });
    expect(count).toBe(1);
  });

  it("同じレビューを複数回同期しても重複登録されない", async () => {
    const input = buildInput({ sourceUrl: "https://review.rakuten.co.jp/item/1/review-3/" });

    await repository.upsertByChannelAndSourceUrl(input);
    await repository.upsertByChannelAndSourceUrl(input);
    await repository.upsertByChannelAndSourceUrl(input);

    const count = await prisma.review.count({
      where: { channel: "rakuten", sourceUrl: input.sourceUrl },
    });
    expect(count).toBe(1);
  });
});

describe("reviewRepository.findMany", () => {
  let prisma: PrismaClient;
  let repository: ReturnType<typeof createReviewRepository>;

  beforeAll(async () => {
    prisma = await createTestPrismaClient();
    repository = createReviewRepository(prisma);

    await repository.upsertByChannelAndSourceUrl(
      buildInput({
        sourceUrl: "https://review.rakuten.co.jp/item/1/product-old/",
        reviewType: "product",
        rating: 3,
        reviewedAt: new Date(Date.now() - 100 * 24 * 60 * 60 * 1000),
      })
    );
    await repository.upsertByChannelAndSourceUrl(
      buildInput({
        sourceUrl: "https://review.rakuten.co.jp/shop/1/shop-recent/",
        reviewType: "shop",
        rating: 1,
        reviewedAt: new Date(),
      })
    );
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("reviewTypeで絞り込める", async () => {
    const reviews = await repository.findMany(10, { reviewType: "shop" });
    expect(reviews).toHaveLength(1);
    expect(reviews[0].reviewType).toBe("shop");
  });

  it("ratingで絞り込める", async () => {
    const reviews = await repository.findMany(10, { rating: 1 });
    expect(reviews).toHaveLength(1);
    expect(reviews[0].rating).toBe(1);
  });

  it("sinceDaysで絞り込める(古いレビューは除外される)", async () => {
    const reviews = await repository.findMany(10, { sinceDays: 7 });
    expect(reviews).toHaveLength(1);
    expect(reviews[0].sourceUrl).toBe("https://review.rakuten.co.jp/shop/1/shop-recent/");
  });
});

describe("reviewRepository.findUnreplied / updateReply", () => {
  let prisma: PrismaClient;
  let repository: ReturnType<typeof createReviewRepository>;

  beforeAll(async () => {
    prisma = await createTestPrismaClient();
    repository = createReviewRepository(prisma);

    await repository.upsertByChannelAndSourceUrl(
      buildInput({
        sourceUrl: "https://review.rakuten.co.jp/item/1/unreplied-old/",
        reviewedAt: new Date("2026-08-01T00:00:00.000Z"),
      })
    );
    await repository.upsertByChannelAndSourceUrl(
      buildInput({
        sourceUrl: "https://review.rakuten.co.jp/item/1/unreplied-new/",
        reviewedAt: new Date("2026-08-05T00:00:00.000Z"),
      })
    );
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("未返信のレビューのみを、投稿日時が古い順に取得する", async () => {
    const target = await repository.upsertByChannelAndSourceUrl(
      buildInput({ sourceUrl: "https://review.rakuten.co.jp/item/1/already-posted/" })
    );
    await repository.updateReply(target.id, { replyStatus: "posted", replyText: "ご購入ありがとうございます" });

    const unreplied = await repository.findUnreplied(10);

    expect(unreplied.every((review) => review.replyStatus === "unreplied")).toBe(true);
    expect(unreplied.map((review) => review.sourceUrl)).toEqual([
      "https://review.rakuten.co.jp/item/1/unreplied-old/",
      "https://review.rakuten.co.jp/item/1/unreplied-new/",
    ]);
  });

  it("updateReplyでAI生成結果を保存できる", async () => {
    const target = await repository.upsertByChannelAndSourceUrl(
      buildInput({ sourceUrl: "https://review.rakuten.co.jp/item/1/draft-target/" })
    );

    const updated = await repository.updateReply(target.id, {
      replyStatus: "draft",
      replyText: "この度はご購入ありがとうございます。",
      replyGeneratedAt: new Date("2026-08-06T09:00:00.000Z"),
    });

    expect(updated.replyStatus).toBe("draft");
    expect(updated.replyText).toBe("この度はご購入ありがとうございます。");
    expect(updated.replyGeneratedAt).not.toBeNull();
  });

  it("updateReplyで投稿失敗時のエラーを保存できる", async () => {
    const target = await repository.upsertByChannelAndSourceUrl(
      buildInput({ sourceUrl: "https://review.rakuten.co.jp/item/1/failed-target/" })
    );

    const updated = await repository.updateReply(target.id, {
      replyStatus: "failed",
      replyError: "投稿ボタンが見つかりませんでした",
    });

    expect(updated.replyStatus).toBe("failed");
    expect(updated.replyError).toBe("投稿ボタンが見つかりませんでした");
  });
});
