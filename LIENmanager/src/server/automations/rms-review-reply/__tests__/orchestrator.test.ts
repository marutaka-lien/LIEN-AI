import { describe, expect, it, vi } from "vitest";

import type { Review } from "@/generated/prisma/client";
import type { ReviewReplyGenerator } from "@/server/integrations/ai/review-reply-generator";
import type { RmsReviewReplyService } from "@/server/integrations/rms-review/rms-review-reply-service";

import { createRmsReviewReplyOrchestrator } from "../orchestrator";
import type { ReviewRepositoryPort } from "../orchestrator";

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
    reviewedAt: new Date("2026-08-01T00:00:00Z"),
    rawPayload: "{}",
    replyStatus: "unreplied",
    replyText: null,
    replyGeneratedAt: null,
    repliedAt: null,
    replyError: null,
    createdAt: new Date("2026-08-01T00:00:00Z"),
    updatedAt: new Date("2026-08-01T00:00:00Z"),
    ...overrides,
  };
}

function buildFakeJobRepository() {
  let jobSeq = 0;
  const jobs = new Map<string, Record<string, unknown>>();

  return {
    jobs,
    async createJob(data: Record<string, unknown>) {
      const id = `job-${++jobSeq}`;
      const job = { id, stopRequested: false, ...data };
      jobs.set(id, job);
      return job;
    },
    async updateJob(id: string, data: Record<string, unknown>) {
      const job = jobs.get(id) ?? {};
      const updated = { ...job, ...data };
      jobs.set(id, updated);
      return updated;
    },
    async isStopRequested(id: string) {
      return Boolean(jobs.get(id)?.stopRequested);
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

function buildFakeReviewRepository(reviews: Review[]): ReviewRepositoryPort & {
  updated: Map<string, Record<string, unknown>>;
} {
  const updated = new Map<string, Record<string, unknown>>();
  return {
    updated,
    async findUnreplied() {
      return reviews;
    },
    async updateReply(id, input) {
      const merged = { ...(updated.get(id) ?? {}), ...input };
      updated.set(id, merged);
      const review = reviews.find((r) => r.id === id);
      return { ...(review ?? buildReview({ id })), ...merged } as Review;
    },
  };
}

function buildFakeReplyGenerator(overrides: Partial<ReviewReplyGenerator> = {}): ReviewReplyGenerator {
  return {
    generateReplyText: vi.fn(async () => "ご購入ありがとうございます。"),
    ...overrides,
  };
}

function buildFakeReplyPoster(overrides: Partial<RmsReviewReplyService> = {}): RmsReviewReplyService {
  return {
    postReply: vi.fn(async () => ({ posted: true })),
    ...overrides,
  };
}

describe("RmsReviewReplyOrchestrator.executeJob", () => {
  it("未返信レビューが0件の場合はjobを即成功として終了する", async () => {
    const jobRepository = buildFakeJobRepository();
    const orchestrator = createRmsReviewReplyOrchestrator({
      jobRepository,
      reviewRepository: buildFakeReviewRepository([]),
      replyGenerator: buildFakeReplyGenerator(),
      replyPoster: buildFakeReplyPoster(),
      executeReplyPost: false,
    });

    const job = await jobRepository.createJob({ moduleKey: "rms_review_reply", status: "running" });
    await orchestrator.executeJob(job.id);

    expect(jobRepository.jobs.get(job.id)?.status).toBe("success");
    expect(jobRepository.jobs.get(job.id)?.totalCount).toBe(0);
  });

  it("executeReplyPost:falseの場合はAI生成のみ行い、RMSへは投稿しない(下書き)", async () => {
    const jobRepository = buildFakeJobRepository();
    const reviewRepository = buildFakeReviewRepository([buildReview()]);
    const postReply = vi.fn(async () => ({ posted: true }));

    const orchestrator = createRmsReviewReplyOrchestrator({
      jobRepository,
      reviewRepository,
      replyGenerator: buildFakeReplyGenerator(),
      replyPoster: buildFakeReplyPoster({ postReply }),
      executeReplyPost: false,
    });

    const job = await jobRepository.createJob({ moduleKey: "rms_review_reply", status: "running" });
    await orchestrator.executeJob(job.id);

    expect(postReply).not.toHaveBeenCalled();
    expect(reviewRepository.updated.get("review-1")?.replyStatus).toBe("draft");
    expect(jobRepository.jobs.get(job.id)?.status).toBe("success");
    expect(jobRepository.jobs.get(job.id)?.successCount).toBe(1);
  });

  it("executeReplyPost:trueの場合はAI生成後にRMSへ投稿し、posted状態にする", async () => {
    const jobRepository = buildFakeJobRepository();
    const reviewRepository = buildFakeReviewRepository([buildReview()]);
    const postReply = vi.fn(async () => ({ posted: true }));

    const orchestrator = createRmsReviewReplyOrchestrator({
      jobRepository,
      reviewRepository,
      replyGenerator: buildFakeReplyGenerator(),
      replyPoster: buildFakeReplyPoster({ postReply }),
      executeReplyPost: true,
    });

    const job = await jobRepository.createJob({ moduleKey: "rms_review_reply", status: "running" });
    await orchestrator.executeJob(job.id);

    expect(postReply).toHaveBeenCalledWith(
      "https://review.rakuten.co.jp/item/1/review-1/",
      "ご購入ありがとうございます。",
      { execute: true }
    );
    expect(reviewRepository.updated.get("review-1")?.replyStatus).toBe("posted");
    expect(jobRepository.jobs.get(job.id)?.status).toBe("success");
  });

  it("AI生成が失敗した場合はfailed状態を記録し、投稿は行わない", async () => {
    const jobRepository = buildFakeJobRepository();
    const reviewRepository = buildFakeReviewRepository([buildReview()]);
    const postReply = vi.fn(async () => ({ posted: true }));

    const orchestrator = createRmsReviewReplyOrchestrator({
      jobRepository,
      reviewRepository,
      replyGenerator: buildFakeReplyGenerator({
        generateReplyText: vi.fn(async () => {
          throw new Error("AI連携の設定が不足しています");
        }),
      }),
      replyPoster: buildFakeReplyPoster({ postReply }),
      executeReplyPost: true,
    });

    const job = await jobRepository.createJob({ moduleKey: "rms_review_reply", status: "running" });
    await orchestrator.executeJob(job.id);

    expect(postReply).not.toHaveBeenCalled();
    expect(reviewRepository.updated.get("review-1")?.replyStatus).toBe("failed");
    expect(reviewRepository.updated.get("review-1")?.replyError).toBe("AI連携の設定が不足しています");
    expect(jobRepository.jobs.get(job.id)?.status).toBe("failed");
    expect(jobRepository.jobs.get(job.id)?.failureCount).toBe(1);
  });

  it("RMS投稿が失敗した場合、下書きは残しつつfailed状態を記録する", async () => {
    const jobRepository = buildFakeJobRepository();
    const reviewRepository = buildFakeReviewRepository([buildReview()]);

    const orchestrator = createRmsReviewReplyOrchestrator({
      jobRepository,
      reviewRepository,
      replyGenerator: buildFakeReplyGenerator(),
      replyPoster: buildFakeReplyPoster({
        postReply: vi.fn(async () => {
          throw new Error("返信フォームが見つかりませんでした");
        }),
      }),
      executeReplyPost: true,
    });

    const job = await jobRepository.createJob({ moduleKey: "rms_review_reply", status: "running" });
    await orchestrator.executeJob(job.id);

    expect(reviewRepository.updated.get("review-1")?.replyStatus).toBe("failed");
    expect(reviewRepository.updated.get("review-1")?.replyText).toBe("ご購入ありがとうございます。");
    expect(jobRepository.jobs.get(job.id)?.status).toBe("failed");
  });

  it("stopRequestedがtrueの場合は途中でjobをstoppedにして処理を中断する", async () => {
    const jobRepository = buildFakeJobRepository();
    const reviews = [
      buildReview({ id: "review-1" }),
      buildReview({ id: "review-2", sourceUrl: "https://review.rakuten.co.jp/item/1/review-2/" }),
    ];
    const reviewRepository = buildFakeReviewRepository(reviews);
    const generateReplyText = vi.fn(async () => "ご購入ありがとうございます。");

    const orchestrator = createRmsReviewReplyOrchestrator({
      jobRepository,
      reviewRepository,
      replyGenerator: buildFakeReplyGenerator({ generateReplyText }),
      replyPoster: buildFakeReplyPoster(),
      executeReplyPost: false,
    });

    const job = await jobRepository.createJob({
      moduleKey: "rms_review_reply",
      status: "running",
      stopRequested: true,
    });
    await orchestrator.executeJob(job.id);

    expect(jobRepository.jobs.get(job.id)?.status).toBe("stopped");
    expect(generateReplyText).not.toHaveBeenCalled();
  });
});

describe("RmsReviewReplyOrchestrator.run", () => {
  it("Jobを作成してjobIdを即座に返す(完了を待たない)", async () => {
    const jobRepository = buildFakeJobRepository();
    const orchestrator = createRmsReviewReplyOrchestrator({
      jobRepository,
      reviewRepository: buildFakeReviewRepository([]),
      replyGenerator: buildFakeReplyGenerator(),
      replyPoster: buildFakeReplyPoster(),
      executeReplyPost: false,
    });

    const jobId = await orchestrator.run();

    expect(jobId).toBeTruthy();
    expect(jobRepository.jobs.get(jobId)).toBeDefined();
  });
});
