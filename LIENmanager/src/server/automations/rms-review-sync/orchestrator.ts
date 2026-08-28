import { automationJobRepository } from "@/server/automation/automation-job.repository";
import { createDefaultRmsReviewService } from "@/server/integrations/rms-review/rms-review-service";
import { createReviewRetentionRunner, type ReviewRetentionResult } from "@/server/review/review-retention";
import { reviewRepository } from "@/server/review/review.repository";
import type { createAutomationJobRepository } from "@/server/automation/automation-job.repository";
import type { RmsReviewService } from "@/server/integrations/rms-review/rms-review-service";
import type { ReviewUpsertInput } from "@/types/review";

import { RMS_REVIEW_SYNC_MODULE_KEY, STEP_KEY } from "./automation-module";

// 「CSVダウンロード → パース → Review upsert → 保持期間切れレビューのアーカイブ」
// という全体の処理順序を管理する。rms-clickpost/orchestrator.tsと同じDIパターンだが、
// レビュー同期は注文単位のループを持たないため、AutomationJobItemは作成しない
// (Job全体+ジョブレベルのAutomationStep4件のみ)。停止(stop)も今回はサポートしない
// (数秒〜数十秒で完了する短時間処理のため、途中停止の必要性が薄い)。

type JobRepository = ReturnType<typeof createAutomationJobRepository>;

export interface ReviewRepositoryPort {
  upsertByChannelAndSourceUrl(input: ReviewUpsertInput): Promise<unknown>;
}

export interface RmsReviewSyncOrchestratorDeps {
  jobRepository: JobRepository;
  reviewRepository: ReviewRepositoryPort;
  rmsReviewService: RmsReviewService;
  // 保持期間(既定6ヶ月)を過ぎたレビューをアーカイブファイルへ移動し、DBから削除する。
  archiveOldReviews: () => Promise<ReviewRetentionResult>;
  now?: () => Date;
}

export interface RmsReviewSyncOrchestrator {
  // AutomationJobを作成し、処理をバックグラウンドで開始する。作成したjobIdを即座に返す
  // (HTTPリクエストをブロックしない。進捗はjobIdを使ってポーリングで確認する)。
  run(): Promise<string>;

  // 既存のJobIdに対して処理を最後まで実行し、完了を待つ。テスト用に公開している。
  executeJob(jobId: string): Promise<void>;
}

export function createRmsReviewSyncOrchestrator(
  deps: RmsReviewSyncOrchestratorDeps
): RmsReviewSyncOrchestrator {
  const { jobRepository, reviewRepository, rmsReviewService, archiveOldReviews, now = () => new Date() } =
    deps;

  async function run(): Promise<string> {
    const job = await jobRepository.createJob({
      moduleKey: RMS_REVIEW_SYNC_MODULE_KEY,
      status: "running",
      startedAt: now(),
    });

    // 実行はバックグラウンドで進める。想定外の例外はここでJobをfailedにして握りつぶす
    // (executeJob内の個別try/catchで処理しきれなかった致命的なエラーのみここに来る)。
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
    const downloadStep = await jobRepository.createStep({
      jobId,
      stepKey: STEP_KEY.CSV_DOWNLOAD,
      status: "running",
      startedAt: now(),
    });

    let fetchResult: Awaited<ReturnType<RmsReviewService["fetchReviews"]>>;
    try {
      fetchResult = await rmsReviewService.fetchReviews();
    } catch (error) {
      await jobRepository.updateStep(downloadStep.id, {
        status: "failed",
        finishedAt: now(),
        errorMessage: error instanceof Error ? error.message : "unknown error",
      });
      await jobRepository.updateJob(jobId, {
        status: "failed",
        finishedAt: now(),
        currentLabel: "レビューCSVの取得に失敗しました",
      });
      return;
    }
    await jobRepository.updateStep(downloadStep.id, { status: "success", finishedAt: now() });

    await jobRepository.createStep({
      jobId,
      stepKey: STEP_KEY.CSV_PARSE,
      status: fetchResult.errors.length === 0 ? "success" : "failed",
      startedAt: now(),
      finishedAt: now(),
      errorMessage:
        fetchResult.errors.length > 0
          ? `${fetchResult.errors.length}/${fetchResult.totalRows}件の行を解析できませんでした`
          : null,
    });

    await jobRepository.updateJob(jobId, { totalCount: fetchResult.totalRows });

    const upsertStep = await jobRepository.createStep({
      jobId,
      stepKey: STEP_KEY.UPSERT,
      status: "running",
      startedAt: now(),
    });

    let successCount = 0;
    let upsertFailureCount = 0;

    for (const [index, review] of fetchResult.reviews.entries()) {
      try {
        await reviewRepository.upsertByChannelAndSourceUrl(review);
        successCount += 1;
      } catch (error) {
        upsertFailureCount += 1;
        console.error(
          "[rms-review-sync] レビューのupsertに失敗しました:",
          error instanceof Error ? error.message : "unknown error"
        );
      }

      await jobRepository.updateJob(jobId, {
        successCount,
        failureCount: fetchResult.errors.length + upsertFailureCount,
        progressPercentage: Math.round(((index + 1) / Math.max(fetchResult.reviews.length, 1)) * 100),
      });
    }

    await jobRepository.updateStep(upsertStep.id, {
      status: upsertFailureCount > 0 ? "failed" : "success",
      finishedAt: now(),
    });

    // 保持期間切れレビューのアーカイブは付随処理のため、失敗してもレビュー取り込み
    // 自体の成否(totalFailureCount)には影響させない。ステップ単独の成否のみ記録する。
    const archiveStep = await jobRepository.createStep({
      jobId,
      stepKey: STEP_KEY.ARCHIVE_PRUNE,
      status: "running",
      startedAt: now(),
    });
    try {
      await archiveOldReviews();
      await jobRepository.updateStep(archiveStep.id, { status: "success", finishedAt: now() });
    } catch (error) {
      await jobRepository.updateStep(archiveStep.id, {
        status: "failed",
        finishedAt: now(),
        errorMessage: error instanceof Error ? error.message : "unknown error",
      });
    }

    const totalFailureCount = fetchResult.errors.length + upsertFailureCount;

    await jobRepository.updateJob(jobId, {
      status: totalFailureCount > 0 ? "failed" : "success",
      currentLabel: null,
      finishedAt: now(),
      progressPercentage: 100,
    });
  }

  return { run, executeJob };
}

// アプリ実運用向けのデフォルトファクトリ(実際のRmsReviewService/Repositoryを使用する)。
export function createDefaultRmsReviewSyncOrchestrator(): RmsReviewSyncOrchestrator {
  return createRmsReviewSyncOrchestrator({
    jobRepository: automationJobRepository,
    reviewRepository,
    rmsReviewService: createDefaultRmsReviewService(),
    archiveOldReviews: createReviewRetentionRunner(),
  });
}
