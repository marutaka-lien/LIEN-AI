import { describe, expect, it, vi } from "vitest";

import type { PublicReplyCheckResult } from "@/server/integrations/rms-review/rms-review-public-reply-checker";
import {
  applyReconciliationUpdates,
  buildReconciliationReport,
  type ReconciliationRow,
} from "../review-reply-reconciliation";

function buildResult(overrides: Partial<PublicReplyCheckResult> = {}): PublicReplyCheckResult {
  return {
    judgement: "not_replied",
    repliedAt: null,
    repliedDateText: null,
    replyBodyLength: null,
    ...overrides,
  };
}

describe("buildReconciliationReport", () => {
  it("判定結果を件数ごとに集計する", async () => {
    const reviews = [
      { id: "r1", sourceUrl: "https://review.rakuten.co.jp/item/1/a/", reviewType: "product" },
      { id: "r2", sourceUrl: "https://review.rakuten.co.jp/item/1/b/", reviewType: "product" },
      { id: "r3", sourceUrl: "https://review.rakuten.co.jp/item/1/c/", reviewType: "shop" },
    ];
    const resultsByUrl: Record<string, PublicReplyCheckResult> = {
      "https://review.rakuten.co.jp/item/1/a/": buildResult({
        judgement: "replied",
        repliedAt: new Date("2026-08-19T15:00:00.000Z"),
        repliedDateText: "2026/08/20",
      }),
      "https://review.rakuten.co.jp/item/1/b/": buildResult({ judgement: "not_replied" }),
      "https://review.rakuten.co.jp/item/1/c/": buildResult({
        judgement: "undetermined",
        reason: "ページ遷移に失敗しました",
      }),
    };

    const summary = await buildReconciliationReport(reviews, async (sourceUrl) => resultsByUrl[sourceUrl]);

    expect(summary.totalUnreplied).toBe(3);
    expect(summary.repliedCount).toBe(1);
    expect(summary.notRepliedCount).toBe(1);
    expect(summary.undeterminedCount).toBe(1);
    expect(summary.rows.map((row) => row.judgement)).toEqual(["replied", "not_replied", "undetermined"]);
  });

  it("delayMsを指定すると各判定の間にスリープする", async () => {
    vi.useFakeTimers();
    try {
      const reviews = [
        { id: "r1", sourceUrl: "https://review.rakuten.co.jp/item/1/a/", reviewType: "product" },
        { id: "r2", sourceUrl: "https://review.rakuten.co.jp/item/1/b/", reviewType: "product" },
      ];
      const checkOne = vi.fn(async () => buildResult());

      const promise = buildReconciliationReport(reviews, checkOne, { delayMs: 300 });
      await vi.advanceTimersByTimeAsync(300);
      await vi.advanceTimersByTimeAsync(300);
      const summary = await promise;

      expect(summary.totalUnreplied).toBe(2);
      expect(checkOne).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("applyReconciliationUpdates", () => {
  function buildRows(): ReconciliationRow[] {
    return [
      {
        id: "r1",
        sourceUrl: "https://review.rakuten.co.jp/item/1/a/",
        reviewType: "product",
        judgement: "replied",
        repliedAt: new Date("2026-08-19T15:00:00.000Z"),
        repliedDateText: "2026/08/20",
      },
      {
        id: "r2",
        sourceUrl: "https://review.rakuten.co.jp/item/1/b/",
        reviewType: "product",
        judgement: "not_replied",
        repliedAt: null,
        repliedDateText: null,
      },
    ];
  }

  it("apply未指定(既定false)の場合はDBへ一切書き込まない(dry-run)", async () => {
    const updateReply = vi.fn();
    const repository = { updateReply } as unknown as Parameters<typeof applyReconciliationUpdates>[1];

    const result = await applyReconciliationUpdates(buildRows(), repository);

    expect(result).toEqual({ dryRun: true, wouldUpdateCount: 1, updatedCount: 0 });
    expect(updateReply).not.toHaveBeenCalled();
  });

  it("apply:trueでも環境変数REVIEW_RECONCILIATION_APPLY_EXECUTEがtrueでなければ例外を投げ、書き込まない", async () => {
    const original = process.env.REVIEW_RECONCILIATION_APPLY_EXECUTE;
    delete process.env.REVIEW_RECONCILIATION_APPLY_EXECUTE;
    try {
      const updateReply = vi.fn();
      const repository = { updateReply } as unknown as Parameters<typeof applyReconciliationUpdates>[1];

      await expect(applyReconciliationUpdates(buildRows(), repository, { apply: true })).rejects.toThrow(
        /REVIEW_RECONCILIATION_APPLY_EXECUTE/
      );
      expect(updateReply).not.toHaveBeenCalled();
    } finally {
      if (original === undefined) delete process.env.REVIEW_RECONCILIATION_APPLY_EXECUTE;
      else process.env.REVIEW_RECONCILIATION_APPLY_EXECUTE = original;
    }
  });

  it("apply:trueかつ環境変数がtrueの場合のみ、judgement===repliedの行だけ更新する", async () => {
    const original = process.env.REVIEW_RECONCILIATION_APPLY_EXECUTE;
    process.env.REVIEW_RECONCILIATION_APPLY_EXECUTE = "true";
    try {
      const updateReply = vi.fn(async () => ({}));
      const repository = { updateReply } as unknown as Parameters<typeof applyReconciliationUpdates>[1];

      const result = await applyReconciliationUpdates(buildRows(), repository, { apply: true });

      expect(result).toEqual({ dryRun: false, wouldUpdateCount: 1, updatedCount: 1 });
      expect(updateReply).toHaveBeenCalledTimes(1);
      expect(updateReply).toHaveBeenCalledWith("r1", {
        replyStatus: "posted",
        repliedAt: new Date("2026-08-19T15:00:00.000Z"),
      });
    } finally {
      if (original === undefined) delete process.env.REVIEW_RECONCILIATION_APPLY_EXECUTE;
      else process.env.REVIEW_RECONCILIATION_APPLY_EXECUTE = original;
    }
  });
});
