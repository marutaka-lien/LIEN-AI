import { automationJobRepository } from "@/server/automation/automation-job.repository";
import {
  createDefaultReviewReplyGenerator,
  type ReviewReplyGenerator,
} from "@/server/integrations/ai/review-reply-generator";
import {
  createDefaultRmsReviewReplyService,
  type RmsReviewReplyService,
} from "@/server/integrations/rms-review/rms-review-reply-service";
import { reviewRepository } from "@/server/review/review.repository";
import type { createAutomationJobRepository } from "@/server/automation/automation-job.repository";
import type { Review } from "@/generated/prisma/client";
import type { ReviewReplyUpdateInput } from "@/types/review";

import { RMS_REVIEW_REPLY_MODULE_KEY } from "./automation-module";

// 「未返信レビュー取得 → AI生成 → (RMS_REVIEW_REPLY_EXECUTE=trueの場合のみ)RMS投稿」
// という全体の処理順序を管理する。rms-clickpost/orchestrator.tsと同じper-itemループ+
// stop対応のパターンを踏襲するが、AutomationJobItemは使わない(automation-module.ts
// のコメント参照)。処理結果は都度Review.replyStatus/replyErrorへ反映する。

const REVIEW_REPLY_BATCH_LIMIT = 50;

type JobRepository = ReturnType<typeof createAutomationJobRepository>;

export interface ReviewRepositoryPort {
  findUnreplied(limit: number): Promise<Review[]>;
  updateReply(id: string, input: ReviewReplyUpdateInput): Promise<Review>;
}

export interface RmsReviewReplyOrchestratorDeps {
  jobRepository: JobRepository;
  reviewRepository: ReviewRepositoryPort;
  replyGenerator: ReviewReplyGenerator;
  replyPoster: RmsReviewReplyService;
  // trueの場合のみ、AI生成に続けて実際にRMSへ投稿する。falseの場合は下書き生成のみで
  // 止める(.env.exampleのRMS_REVIEW_REPLY_EXECUTE、デフォルトfalse)。
  executeReplyPost: boolean;
  now?: () => Date;
}

export interface RmsReviewReplyOrchestrator {
  // AutomationJobを作成し、処理をバックグラウンドで開始する。作成したjobIdを即座に返す。
  run(): Promise<string>;

  // 既存のJobIdに対して処理を最後まで実行し、完了を待つ。テスト用に公開している。
  executeJob(jobId: string): Promise<void>;
}

export function createRmsReviewReplyOrchestrator(
  deps: RmsReviewReplyOrchestratorDeps
): RmsReviewReplyOrchestrator {
  const {
    jobRepository,
    reviewRepository,
    replyGenerator,
    replyPoster,
    executeReplyPost,
    now = () => new Date(),
  } = deps;

  async function run(): Promise<string> {
    const job = await jobRepository.createJob({
      moduleKey: RMS_REVIEW_REPLY_MODULE_KEY,
      status: "running",
      startedAt: now(),
    });

    executeJob(job.id).catch(async (error) => {
      await jobRepository.updateJob(job.id, {
        status: "failed",
        finishedAt: now(),
        currentLabel: error instanceof Error ? error.message : "unknown error",
      });
    });

    return job.id;
  }

  async function executeJob(jobId: string): Promise<void> {
    const reviews = await reviewRepository.findUnreplied(REVIEW_REPLY_BATCH_LIMIT);
    await jobRepository.updateJob(jobId, { totalCount: reviews.length });

    if (reviews.length === 0) {
      await jobRepository.updateJob(jobId, {
        status: "success",
        progressPercentage: 100,
        currentLabel: null,
        finishedAt: now(),
      });
      return;
    }

    let successCount = 0;
    let failureCount = 0;

    for (const [index, review] of reviews.entries()) {
      if (await jobRepository.isStopRequested(jobId)) {
        await jobRepository.updateJob(jobId, {
          status: "stopped",
          currentLabel: null,
          finishedAt: now(),
        });
        return;
      }

      await jobRepository.updateJob(jobId, {
        currentLabel: `${review.productName ?? review.reviewType}のレビューに返信中...`,
      });

      try {
        await processReview(review);
        successCount += 1;
      } catch {
        // 失敗理由はprocessReview内でReview.replyErrorへ記録済み。
        // ここでは件数のみカウントし、次のレビューへ進む(部分失敗を許容する)。
        failureCount += 1;
      }

      await jobRepository.updateJob(jobId, {
        successCount,
        failureCount,
        progressPercentage: Math.round(((index + 1) / reviews.length) * 100),
      });
    }

    await jobRepository.updateJob(jobId, {
      status: failureCount > 0 ? "failed" : "success",
      currentLabel: null,
      finishedAt: now(),
    });
  }

  async function processReview(review: Review): Promise<void> {
    let replyText: string;
    try {
      replyText = await replyGenerator.generateReplyText({
        reviewType: review.reviewType,
        rating: review.rating,
        title: review.title,
        productName: review.productName,
        body: review.body,
      });
    } catch (error) {
      await reviewRepository.updateReply(review.id, {
        replyStatus: "failed",
        replyError: error instanceof Error ? error.message : "unknown error",
      });
      throw error;
    }

    await reviewRepository.updateReply(review.id, {
      replyStatus: "draft",
      replyText,
      replyGeneratedAt: now(),
      replyError: null,
    });

    if (!executeReplyPost) return;

    try {
      await replyPoster.postReply(review.sourceUrl, replyText, { execute: true });
    } catch (error) {
      await reviewRepository.updateReply(review.id, {
        replyStatus: "failed",
        replyError: error instanceof Error ? error.message : "unknown error",
      });
      throw error;
    }

    await reviewRepository.updateReply(review.id, {
      replyStatus: "posted",
      repliedAt: now(),
      replyError: null,
    });
  }

  return { run, executeJob };
}

// アプリ実運用向けのデフォルトファクトリ。
export function createDefaultRmsReviewReplyOrchestrator(): RmsReviewReplyOrchestrator {
  return createRmsReviewReplyOrchestrator({
    jobRepository: automationJobRepository,
    reviewRepository,
    replyGenerator: createDefaultReviewReplyGenerator(),
    replyPoster: createDefaultRmsReviewReplyService(),
    executeReplyPost: process.env.RMS_REVIEW_REPLY_EXECUTE === "true",
  });
}
