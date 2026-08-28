import { describe, expect, it, vi } from "vitest";

import type { RmsReviewFetchResult, RmsReviewService } from "@/server/integrations/rms-review/rms-review-service";
import type { ReviewRetentionResult } from "@/server/review/review-retention";
import type { ReviewUpsertInput } from "@/types/review";

import { createRmsReviewSyncOrchestrator, type ReviewRepositoryPort } from "../orchestrator";

function buildReviewInput(overrides: Partial<ReviewUpsertInput> = {}): ReviewUpsertInput {
  return {
    channel: "rakuten",
    reviewType: "product",
    sourceUrl: "https://review.rakuten.co.jp/item/1/review-1/",
    productName: "テスト商品",
    title: "良い",
    body: "満足",
    rating: 5,
    orderNumber: null,
    reviewedAt: new Date("2026-08-01T08:49:26.000Z"),
    rawPayload: "{}",
    ...overrides,
  };
}

function buildFetchResult(overrides: Partial<RmsReviewFetchResult> = {}): RmsReviewFetchResult {
  return {
    reviews: [],
    totalRows: 0,
    errors: [],
    ...overrides,
  };
}

function buildFakeJobRepository() {
  let jobSeq = 0;
  let stepSeq = 0;

  const jobs = new Map<string, Record<string, unknown>>();
  const steps = new Map<string, Record<string, unknown>>();

  return {
    jobs,
    steps,
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
    async createStep(data: Record<string, unknown>) {
      const id = `step-${++stepSeq}`;
      const step = { id, ...data };
      steps.set(id, step);
      return step;
    },
    async updateStep(id: string, data: Record<string, unknown>) {
      const step = steps.get(id) ?? {};
      const updated = { ...step, ...data };
      steps.set(id, updated);
      return updated;
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

function buildFakeReviewRepository(
  overrides: { upsert?: ReturnType<typeof vi.fn> } = {}
): ReviewRepositoryPort {
  return {
    upsertByChannelAndSourceUrl: overrides.upsert ?? vi.fn(async () => ({})),
  } as unknown as ReviewRepositoryPort;
}

function buildFakeRmsReviewService(overrides: Partial<RmsReviewService> = {}): RmsReviewService {
  return {
    fetchReviews: vi.fn(async () => buildFetchResult()),
    ...overrides,
  };
}

function buildFakeArchiveOldReviews(
  impl: () => Promise<ReviewRetentionResult> = async () => ({ prunedCount: 0, archivedCount: 0 })
) {
  return vi.fn(impl);
}

describe("RmsReviewSyncOrchestrator.executeJob", () => {
  it("レビューが0件の場合はjobを即成功として終了する", async () => {
    const jobRepository = buildFakeJobRepository();
    const orchestrator = createRmsReviewSyncOrchestrator({
      jobRepository,
      reviewRepository: buildFakeReviewRepository(),
      rmsReviewService: buildFakeRmsReviewService(),
      archiveOldReviews: buildFakeArchiveOldReviews(),
    });

    const job = await jobRepository.createJob({ moduleKey: "rms_review_sync", status: "running" });
    await orchestrator.executeJob(job.id);

    expect(jobRepository.jobs.get(job.id)?.status).toBe("success");
    expect(jobRepository.jobs.get(job.id)?.totalCount).toBe(0);
  });

  it("取得したレビューをすべてupsertし、成功件数を記録する", async () => {
    const jobRepository = buildFakeJobRepository();
    const upsert = vi.fn(async () => ({}));
    const reviews = [buildReviewInput(), buildReviewInput({ sourceUrl: "https://review.rakuten.co.jp/item/1/review-2/" })];

    const orchestrator = createRmsReviewSyncOrchestrator({
      jobRepository,
      reviewRepository: buildFakeReviewRepository({ upsert }),
      rmsReviewService: buildFakeRmsReviewService({
        fetchReviews: vi.fn(async () => buildFetchResult({ reviews, totalRows: 2 })),
      }),
      archiveOldReviews: buildFakeArchiveOldReviews(),
    });

    const job = await jobRepository.createJob({ moduleKey: "rms_review_sync", status: "running" });
    await orchestrator.executeJob(job.id);

    expect(upsert).toHaveBeenCalledTimes(2);
    expect(jobRepository.jobs.get(job.id)?.status).toBe("success");
    expect(jobRepository.jobs.get(job.id)?.successCount).toBe(2);
    expect(jobRepository.jobs.get(job.id)?.totalCount).toBe(2);
  });

  it("CSVパースエラーがあった行はfailureCountに反映されjobがfailedになる", async () => {
    const jobRepository = buildFakeJobRepository();
    const orchestrator = createRmsReviewSyncOrchestrator({
      jobRepository,
      reviewRepository: buildFakeReviewRepository(),
      rmsReviewService: buildFakeRmsReviewService({
        fetchReviews: vi.fn(async () =>
          buildFetchResult({
            reviews: [buildReviewInput()],
            totalRows: 2,
            errors: [{ sourceUrl: null, reason: "評価が数値ではありません" }],
          })
        ),
      }),
      archiveOldReviews: buildFakeArchiveOldReviews(),
    });

    const job = await jobRepository.createJob({ moduleKey: "rms_review_sync", status: "running" });
    await orchestrator.executeJob(job.id);

    expect(jobRepository.jobs.get(job.id)?.status).toBe("failed");
    expect(jobRepository.jobs.get(job.id)?.failureCount).toBe(1);
    expect(jobRepository.jobs.get(job.id)?.successCount).toBe(1);

    const parseStep = [...jobRepository.steps.values()].find((step) => step.stepKey === "csv_parse");
    expect(parseStep?.status).toBe("failed");
  });

  it("upsertが例外を投げた行は失敗として記録され、残りの処理は続行される", async () => {
    const jobRepository = buildFakeJobRepository();
    const upsert = vi
      .fn()
      .mockRejectedValueOnce(new Error("DB error"))
      .mockResolvedValueOnce({});
    const reviews = [
      buildReviewInput({ sourceUrl: "https://review.rakuten.co.jp/item/1/review-1/" }),
      buildReviewInput({ sourceUrl: "https://review.rakuten.co.jp/item/1/review-2/" }),
    ];

    const orchestrator = createRmsReviewSyncOrchestrator({
      jobRepository,
      reviewRepository: buildFakeReviewRepository({ upsert }),
      rmsReviewService: buildFakeRmsReviewService({
        fetchReviews: vi.fn(async () => buildFetchResult({ reviews, totalRows: 2 })),
      }),
      archiveOldReviews: buildFakeArchiveOldReviews(),
    });

    const job = await jobRepository.createJob({ moduleKey: "rms_review_sync", status: "running" });
    await orchestrator.executeJob(job.id);

    expect(upsert).toHaveBeenCalledTimes(2);
    expect(jobRepository.jobs.get(job.id)?.status).toBe("failed");
    expect(jobRepository.jobs.get(job.id)?.successCount).toBe(1);
    expect(jobRepository.jobs.get(job.id)?.failureCount).toBe(1);
  });

  it("CSV取得自体が失敗した場合はjobとdownloadStepをfailedにする", async () => {
    const jobRepository = buildFakeJobRepository();
    const orchestrator = createRmsReviewSyncOrchestrator({
      jobRepository,
      reviewRepository: buildFakeReviewRepository(),
      rmsReviewService: buildFakeRmsReviewService({
        fetchReviews: vi.fn(async () => {
          throw new Error("ダウンロード失敗");
        }),
      }),
      archiveOldReviews: buildFakeArchiveOldReviews(),
    });

    const job = await jobRepository.createJob({ moduleKey: "rms_review_sync", status: "running" });
    await orchestrator.executeJob(job.id);

    expect(jobRepository.jobs.get(job.id)?.status).toBe("failed");
    const downloadStep = [...jobRepository.steps.values()].find(
      (step) => step.stepKey === "csv_download"
    );
    expect(downloadStep?.status).toBe("failed");

    const parseStep = [...jobRepository.steps.values()].find((step) => step.stepKey === "csv_parse");
    expect(parseStep).toBeUndefined();
  });

  it("保持期間切れレビューをアーカイブするステップを実行し、成功として記録する", async () => {
    const jobRepository = buildFakeJobRepository();
    const archiveOldReviews = buildFakeArchiveOldReviews(async () => ({
      prunedCount: 3,
      archivedCount: 2,
    }));

    const orchestrator = createRmsReviewSyncOrchestrator({
      jobRepository,
      reviewRepository: buildFakeReviewRepository(),
      rmsReviewService: buildFakeRmsReviewService(),
      archiveOldReviews,
    });

    const job = await jobRepository.createJob({ moduleKey: "rms_review_sync", status: "running" });
    await orchestrator.executeJob(job.id);

    expect(archiveOldReviews).toHaveBeenCalledTimes(1);
    const archiveStep = [...jobRepository.steps.values()].find(
      (step) => step.stepKey === "archive_prune"
    );
    expect(archiveStep?.status).toBe("success");
    expect(jobRepository.jobs.get(job.id)?.status).toBe("success");
  });

  it("アーカイブが失敗してもレビュー取り込み自体の成功扱いには影響しない", async () => {
    const jobRepository = buildFakeJobRepository();
    const archiveOldReviews = buildFakeArchiveOldReviews(async () => {
      throw new Error("disk full");
    });

    const orchestrator = createRmsReviewSyncOrchestrator({
      jobRepository,
      reviewRepository: buildFakeReviewRepository(),
      rmsReviewService: buildFakeRmsReviewService(),
      archiveOldReviews,
    });

    const job = await jobRepository.createJob({ moduleKey: "rms_review_sync", status: "running" });
    await orchestrator.executeJob(job.id);

    const archiveStep = [...jobRepository.steps.values()].find(
      (step) => step.stepKey === "archive_prune"
    );
    expect(archiveStep?.status).toBe("failed");
    expect(archiveStep?.errorMessage).toBe("disk full");
    // レビュー自体は0件取得・0件失敗のため、job全体はsuccessのまま
    // (アーカイブ失敗はjobの成否判定に含めない仕様)。
    expect(jobRepository.jobs.get(job.id)?.status).toBe("success");
  });
});

describe("RmsReviewSyncOrchestrator.run", () => {
  it("Jobを作成してjobIdを即座に返す(完了を待たない)", async () => {
    const jobRepository = buildFakeJobRepository();

    const orchestrator = createRmsReviewSyncOrchestrator({
      jobRepository,
      reviewRepository: buildFakeReviewRepository(),
      rmsReviewService: buildFakeRmsReviewService(),
      archiveOldReviews: buildFakeArchiveOldReviews(),
    });

    const jobId = await orchestrator.run();

    expect(jobId).toBeTruthy();
    expect(jobRepository.jobs.get(jobId)).toBeDefined();
  });
});
