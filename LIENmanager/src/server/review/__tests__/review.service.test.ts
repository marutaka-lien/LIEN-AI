import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import type { PrismaClient } from "@/generated/prisma/client";
import { createTestPrismaClient } from "@/server/test-utils/create-test-prisma-client";
import type { ReviewReplyGenerator } from "@/server/integrations/ai/review-reply-generator";
import type { RmsReviewReplyService } from "@/server/integrations/rms-review/rms-review-reply-service";
import type { ReviewUpsertInput } from "@/types/review";

import { createReviewRepository } from "../review.repository";
import { createReviewService } from "../review.service";

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

// review.service.tsのpostReplyは、RMS_REVIEW_REPLY_EXECUTE環境変数が"true"でない限り
// 実際のRMS投稿を一切行わない(誤って公開返信を投稿してしまう事故を防ぐための安全装置)。
// この安全装置が確実に機能することをここで固定する。
describe("reviewService.postReply / generateReply", () => {
  let prisma: PrismaClient;
  let repository: ReturnType<typeof createReviewRepository>;
  const originalExecuteFlag = process.env.RMS_REVIEW_REPLY_EXECUTE;

  beforeAll(async () => {
    prisma = await createTestPrismaClient();
    repository = createReviewRepository(prisma);
  });

  afterEach(() => {
    process.env.RMS_REVIEW_REPLY_EXECUTE = originalExecuteFlag;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("RMS_REVIEW_REPLY_EXECUTEが未設定の場合、投稿処理を呼ばずにエラーを返す", async () => {
    delete process.env.RMS_REVIEW_REPLY_EXECUTE;

    const review = await repository.upsertByChannelAndSourceUrl(
      buildInput({ sourceUrl: "https://review.rakuten.co.jp/item/1/gate-unset/" })
    );
    await repository.updateReply(review.id, { replyStatus: "draft", replyText: "ご購入ありがとうございます。" });

    const postReply = vi.fn<RmsReviewReplyService["postReply"]>();
    const service = createReviewService({
      reviewRepository: repository,
      replyPoster: { postReply },
    });

    await expect(service.postReply(review.id)).rejects.toThrow(/無効化/);
    expect(postReply).not.toHaveBeenCalled();

    const unchanged = await repository.findById(review.id);
    expect(unchanged?.replyStatus).toBe("draft");
  });

  it("RMS_REVIEW_REPLY_EXECUTE=falseの場合も投稿処理を呼ばない", async () => {
    process.env.RMS_REVIEW_REPLY_EXECUTE = "false";

    const review = await repository.upsertByChannelAndSourceUrl(
      buildInput({ sourceUrl: "https://review.rakuten.co.jp/item/1/gate-false/" })
    );
    await repository.updateReply(review.id, { replyStatus: "draft", replyText: "ご購入ありがとうございます。" });

    const postReply = vi.fn<RmsReviewReplyService["postReply"]>();
    const service = createReviewService({
      reviewRepository: repository,
      replyPoster: { postReply },
    });

    await expect(service.postReply(review.id)).rejects.toThrow(/無効化/);
    expect(postReply).not.toHaveBeenCalled();
  });

  it("RMS_REVIEW_REPLY_EXECUTE=trueの場合のみ実際に投稿処理を呼び、posted状態になる", async () => {
    process.env.RMS_REVIEW_REPLY_EXECUTE = "true";

    const review = await repository.upsertByChannelAndSourceUrl(
      buildInput({ sourceUrl: "https://review.rakuten.co.jp/item/1/gate-true/" })
    );
    await repository.updateReply(review.id, { replyStatus: "draft", replyText: "ご購入ありがとうございます。" });

    const postReply = vi.fn(async () => ({ posted: true }));
    const service = createReviewService({
      reviewRepository: repository,
      replyPoster: { postReply },
    });

    const updated = await service.postReply(review.id);

    expect(postReply).toHaveBeenCalledTimes(1);
    expect(updated?.replyStatus).toBe("posted");
  });

  it("generateReplyはAI生成結果を下書きとして保存する", async () => {
    const review = await repository.upsertByChannelAndSourceUrl(
      buildInput({ sourceUrl: "https://review.rakuten.co.jp/item/1/generate-target/" })
    );

    const generateReplyText = vi.fn(async () => "この度はご購入いただきありがとうございます。");
    const replyGenerator: ReviewReplyGenerator = { generateReplyText };
    const service = createReviewService({ reviewRepository: repository, replyGenerator });

    const updated = await service.generateReply(review.id);

    expect(generateReplyText).toHaveBeenCalledTimes(1);
    expect(updated?.replyStatus).toBe("draft");
    expect(updated?.replyText).toBe("この度はご購入いただきありがとうございます。");
  });

  it("generateReplyが失敗した場合はfailed状態とエラー内容を保存し、エラーを再送出する", async () => {
    const review = await repository.upsertByChannelAndSourceUrl(
      buildInput({ sourceUrl: "https://review.rakuten.co.jp/item/1/generate-fail/" })
    );

    const replyGenerator: ReviewReplyGenerator = {
      generateReplyText: vi.fn(async () => {
        throw new Error("AI API呼び出しに失敗しました");
      }),
    };
    const service = createReviewService({ reviewRepository: repository, replyGenerator });

    await expect(service.generateReply(review.id)).rejects.toThrow("AI API呼び出しに失敗しました");

    const unchanged = await repository.findById(review.id);
    expect(unchanged?.replyStatus).toBe("failed");
    expect(unchanged?.replyError).toBe("AI API呼び出しに失敗しました");
  });
});

// 巡回エージェント(ANTHROPIC_API_KEYを設定せず、Claude Codeセッションが定期的にDBを
// 読み書きして下書きを作る方式。2026-08-25採用)が使う経路の固定テスト。
// AI生成(generateReply)を一切経由せずに「未返信レビューを読む→下書きを保存する」が
// 完結できることを確認する。
describe("reviewService.listUnreplied / saveReplyDraft(巡回エージェント経路)", () => {
  let prisma: PrismaClient;
  let repository: ReturnType<typeof createReviewRepository>;

  beforeAll(async () => {
    prisma = await createTestPrismaClient();
    repository = createReviewRepository(prisma);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("listUnrepliedは未返信レビューを本文付き・古い順で返す", async () => {
    await repository.upsertByChannelAndSourceUrl(
      buildInput({
        sourceUrl: "https://review.rakuten.co.jp/item/1/patrol-new/",
        body: "新しい方のレビュー本文",
        reviewedAt: new Date("2026-08-10T00:00:00.000Z"),
      })
    );
    await repository.upsertByChannelAndSourceUrl(
      buildInput({
        sourceUrl: "https://review.rakuten.co.jp/item/1/patrol-old/",
        body: "古い方のレビュー本文",
        reviewedAt: new Date("2026-08-01T00:00:00.000Z"),
      })
    );
    const alreadyPosted = await repository.upsertByChannelAndSourceUrl(
      buildInput({ sourceUrl: "https://review.rakuten.co.jp/item/1/patrol-posted/" })
    );
    await repository.updateReply(alreadyPosted.id, { replyStatus: "posted", replyText: "対応済み" });

    const service = createReviewService({ reviewRepository: repository });
    const unreplied = await service.listUnreplied();

    expect(unreplied.map((r) => r.sourceUrl)).toEqual([
      "https://review.rakuten.co.jp/item/1/patrol-old/",
      "https://review.rakuten.co.jp/item/1/patrol-new/",
    ]);
    expect(unreplied[0].body).toBe("古い方のレビュー本文");
    expect(unreplied.every((r) => r.replyStatus === "unreplied")).toBe(true);
  });

  it("saveReplyDraftはgenerateReplyを経由せずに単独で下書きを保存できる", async () => {
    const review = await repository.upsertByChannelAndSourceUrl(
      buildInput({ sourceUrl: "https://review.rakuten.co.jp/item/1/patrol-direct-draft/" })
    );

    const service = createReviewService({ reviewRepository: repository });
    const updated = await service.saveReplyDraft(review.id, "巡回エージェントが作成した下書きです。");

    expect(updated?.replyStatus).toBe("draft");
    expect(updated?.replyText).toBe("巡回エージェントが作成した下書きです。");
  });
});
