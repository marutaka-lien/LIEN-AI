"use client";

import { useEffect, useRef, useState } from "react";
import { RefreshCw, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import type { UseReviewListFilters } from "@/features/reviews/hooks/useReviewList";
import { useReviewReplyJob } from "@/features/reviews/hooks/useReviewReplyJob";
import { useReviewSyncJob } from "@/features/reviews/hooks/useReviewSyncJob";
import type { JobStatus } from "@/types/automation";
import { ReviewListTable } from "./review-list-table";

const SETTLED_TOASTS: Partial<Record<JobStatus, () => void>> = {
  success: () => toast.success("レビューを同期しました"),
  failed: () => toast.error("レビューの同期に失敗しました(一部取り込めなかった行がある可能性があります)"),
};

const REPLY_SETTLED_TOASTS: Partial<Record<JobStatus, () => void>> = {
  success: () => toast.success("未返信レビューへの返信処理が完了しました"),
  failed: () => toast.error("一部のレビューで返信処理に失敗しました(内容をご確認ください)"),
};

const REVIEW_TYPE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "product", label: "商品レビュー" },
  { value: "shop", label: "ショップレビュー" },
];

const RATING_OPTIONS = [5, 4, 3, 2, 1];

const SINCE_DAYS_OPTIONS: Array<{ value: number; label: string }> = [
  { value: 7, label: "直近7日" },
  { value: 30, label: "直近30日" },
  { value: 90, label: "直近90日" },
];

const selectClassName =
  "h-8 rounded-lg border border-border bg-background px-2 text-sm text-foreground";

export function ReviewsWorkspace() {
  const { job, error, isStarting, isPolling, run } = useReviewSyncJob();
  const notifiedStatusRef = useRef<JobStatus | null>(null);
  const [filters, setFilters] = useState<UseReviewListFilters>({});

  const {
    job: replyJob,
    error: replyError,
    isStarting: isReplyStarting,
    isPolling: isReplyPolling,
    run: runReply,
  } = useReviewReplyJob();
  const notifiedReplyStatusRef = useRef<JobStatus | null>(null);

  // ジョブが完了(success/failed/stopped)するたびにfinishedAtが更新されるため、
  // これをそのままrefreshKeyとして使う。setState-in-effectを避けるため、別途
  // refreshKey用のstateやそれを更新するeffectは持たない(値はレンダーの都度導出する)。
  const refreshKey = `${job?.finishedAt ?? ""}|${replyJob?.finishedAt ?? ""}`;

  useEffect(() => {
    if (!job) return;
    const notify = SETTLED_TOASTS[job.status];
    if (notify && notifiedStatusRef.current !== job.status) {
      notifiedStatusRef.current = job.status;
      notify();
    }
  }, [job]);

  useEffect(() => {
    if (error) {
      toast.error("同期状態の取得に失敗しました");
    }
  }, [error]);

  useEffect(() => {
    if (!replyJob) return;
    const notify = REPLY_SETTLED_TOASTS[replyJob.status];
    if (notify && notifiedReplyStatusRef.current !== replyJob.status) {
      notifiedReplyStatusRef.current = replyJob.status;
      notify();
    }
  }, [replyJob]);

  useEffect(() => {
    if (replyError) {
      toast.error("返信処理の状態取得に失敗しました");
    }
  }, [replyError]);

  async function handleRun() {
    notifiedStatusRef.current = null;
    try {
      await run();
      toast("レビューの同期を開始しました", {
        description: "楽天RMSのレビューチェックツールからCSVを取得しています",
      });
    } catch {
      toast.error("同期の開始に失敗しました");
    }
  }

  async function handleRunReply() {
    notifiedReplyStatusRef.current = null;
    try {
      await runReply();
      toast("未返信レビューへの返信処理を開始しました", {
        description: "AIで返信文を生成します(自動投稿の有効/無効はサーバー側の設定に従います)",
      });
    } catch {
      toast.error("返信処理の開始に失敗しました");
    }
  }

  const canRun = !isStarting && !isPolling;
  const canRunReply = !isReplyStarting && !isReplyPolling;
  const progressPercentage = job?.progressPercentage ?? 0;
  const replyProgressPercentage = replyJob?.progressPercentage ?? 0;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 rounded-lg border border-border-subtle bg-surface p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-col gap-1">
            <h2 className="text-base font-semibold">レビュー同期</h2>
            <p className="text-sm text-muted-foreground">
              楽天RMSのレビューチェックツールから最新のレビューを取得し、一覧へ反映します。
            </p>
          </div>
          <Button size="sm" onClick={handleRun} disabled={!canRun}>
            <RefreshCw />
            同期する
          </Button>
        </div>

        {job && (
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{job.currentLabel ?? "処理待ち"}</span>
              <span className="font-mono tabular-nums text-muted-foreground">
                {progressPercentage}%
              </span>
            </div>
            <Progress value={progressPercentage} />
          </div>
        )}
      </div>

      <div className="flex flex-col gap-4 rounded-lg border border-border-subtle bg-surface p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-col gap-1">
            <h2 className="text-base font-semibold">未返信レビューへ一括返信</h2>
            <p className="text-sm text-muted-foreground">
              未返信のレビューへAIで返信文を生成します。RMSへの自動投稿はサーバー側の設定
              (RMS_REVIEW_REPLY_EXECUTE)で有効化するまでは行われず、下書きとして保存されます。
            </p>
          </div>
          <Button size="sm" onClick={handleRunReply} disabled={!canRunReply}>
            <Sparkles />
            一括返信を実行
          </Button>
        </div>

        {replyJob && (
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{replyJob.currentLabel ?? "処理待ち"}</span>
              <span className="font-mono tabular-nums text-muted-foreground">
                {replyProgressPercentage}%
              </span>
            </div>
            <Progress value={replyProgressPercentage} />
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <select
          className={selectClassName}
          value={filters.reviewType ?? ""}
          onChange={(event) =>
            setFilters((prev) => ({ ...prev, reviewType: event.target.value || undefined }))
          }
          aria-label="種別で絞り込み"
        >
          <option value="">すべての種別</option>
          {REVIEW_TYPE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        <select
          className={selectClassName}
          value={filters.rating ?? ""}
          onChange={(event) =>
            setFilters((prev) => ({
              ...prev,
              rating: event.target.value ? Number(event.target.value) : undefined,
            }))
          }
          aria-label="評価で絞り込み"
        >
          <option value="">すべての評価</option>
          {RATING_OPTIONS.map((rating) => (
            <option key={rating} value={rating}>
              {"★".repeat(rating)}のみ
            </option>
          ))}
        </select>

        <select
          className={selectClassName}
          value={filters.sinceDays ?? ""}
          onChange={(event) =>
            setFilters((prev) => ({
              ...prev,
              sinceDays: event.target.value ? Number(event.target.value) : undefined,
            }))
          }
          aria-label="期間で絞り込み"
        >
          <option value="">すべての期間</option>
          {SINCE_DAYS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border-subtle">
        <ReviewListTable filters={filters} refreshKey={refreshKey} />
      </div>
    </div>
  );
}
