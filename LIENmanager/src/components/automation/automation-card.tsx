"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";

import { Progress } from "@/components/ui/progress";
import { useAutomationJob } from "@/features/automation/hooks/useAutomationJob";
import type { AutomationModuleMeta, JobStatus } from "@/types/automation";
import { AutomationHeader } from "./automation-header";
import { PipelineVisualization } from "./pipeline-visualization";

const SETTLED_TOASTS: Partial<Record<JobStatus, (label: string) => void>> = {
  success: () => toast.success("処理が完了しました"),
  failed: () => toast.error("処理が失敗しました"),
  stopped: () => toast.warning("処理を停止しました"),
};

export function AutomationCard({
  module,
  onJobSettled,
  selectedOrderNumbers,
}: {
  module: AutomationModuleMeta;
  onJobSettled?: () => void;
  // 発送エントリー画面の注文者一覧で選択された注文番号。指定時は「選択実行」ボタンを表示する。
  selectedOrderNumbers?: ReadonlySet<string>;
}) {
  const { job, error, isStarting, isPolling, run, stop } = useAutomationJob();
  const notifiedStatusRef = useRef<JobStatus | null>(null);

  useEffect(() => {
    if (!job) return;
    const notify = SETTLED_TOASTS[job.status];
    if (notify && notifiedStatusRef.current !== job.status) {
      notifiedStatusRef.current = job.status;
      notify(job.status);
      onJobSettled?.();
    }
  }, [job, onJobSettled]);

  useEffect(() => {
    if (error) {
      toast.error("Job状態の取得に失敗しました");
    }
  }, [error]);

  async function handleRun() {
    notifiedStatusRef.current = null;
    try {
      await run();
      toast("処理を開始しました", {
        description: "楽天RMSから発送待ちの注文を取得しています",
      });
    } catch {
      toast.error("処理の開始に失敗しました");
    }
  }

  async function handleRunSelected() {
    if (!selectedOrderNumbers || selectedOrderNumbers.size === 0) return;
    notifiedStatusRef.current = null;
    try {
      await run({ orderNumbers: Array.from(selectedOrderNumbers) });
      toast("選択した注文者の処理を開始しました", {
        description: `${selectedOrderNumbers.size}件を対象に実行しています`,
      });
    } catch {
      toast.error("処理の開始に失敗しました");
    }
  }

  async function handleStop() {
    try {
      await stop();
    } catch {
      toast.error("停止リクエストに失敗しました");
    }
  }

  const status = job?.status ?? "pending";
  const totalCount = job?.totalCount ?? 0;
  const successCount = job?.successCount ?? 0;
  const failureCount = job?.failureCount ?? 0;
  const processed = successCount + failureCount;
  const progressPercentage = job?.progressPercentage ?? 0;
  const canRun = !isStarting && !isPolling;
  const canStop = isPolling && status === "running";
  const hasFailure = failureCount > 0;

  return (
    <div className="flex flex-col gap-4">
      <AutomationHeader
        module={module}
        status={status}
        canRun={canRun}
        canStop={canStop}
        onRun={handleRun}
        onStop={handleStop}
        selectedCount={selectedOrderNumbers?.size ?? 0}
        onRunSelected={handleRunSelected}
      />

      <PipelineVisualization job={job} />

      <div className="flex flex-col gap-2 rounded-lg border border-border-subtle bg-surface p-5">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">{job?.currentLabel ?? "処理待ち"}</span>
          <span className="font-mono tabular-nums text-muted-foreground">{progressPercentage}%</span>
        </div>
        <Progress
          value={progressPercentage}
          className={hasFailure ? "[&_[data-slot=progress-indicator]]:bg-error-foreground" : undefined}
        />

        <div className="mt-3 grid grid-cols-3 divide-x divide-border-subtle rounded-lg border border-border-subtle">
          <div className="flex flex-col items-center gap-0.5 py-3">
            <span className="font-mono text-lg font-semibold tabular-nums">
              {processed}/{totalCount}
            </span>
            <span className="text-xs text-muted-foreground">処理件数</span>
          </div>
          <div className="flex flex-col items-center gap-0.5 py-3">
            <span className="font-mono text-lg font-semibold tabular-nums text-success-foreground">
              {successCount}
            </span>
            <span className="text-xs text-muted-foreground">成功件数</span>
          </div>
          <div className="flex flex-col items-center gap-0.5 py-3">
            <span className="font-mono text-lg font-semibold tabular-nums text-error-foreground">
              {failureCount}
            </span>
            <span className="text-xs text-muted-foreground">失敗件数</span>
          </div>
        </div>
      </div>
    </div>
  );
}
