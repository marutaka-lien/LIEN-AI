import { Circle, CircleCheck, CircleSlash, CircleX, LoaderCircle } from "lucide-react";

import { cn } from "@/lib/utils";
import type { AnyStageView, PipelineStageStatus } from "@/lib/pipeline-status";

const STATUS_ICON: Record<PipelineStageStatus, typeof Circle> = {
  pending: Circle,
  running: LoaderCircle,
  success: CircleCheck,
  failed: CircleX,
  skipped: CircleSlash,
};

const STATUS_NODE_CLASS: Record<PipelineStageStatus, string> = {
  pending: "border-dashed border-border-subtle text-status-skipped",
  running: "border-primary-border bg-primary-subtle text-primary animate-pulse",
  success: "border-success-border bg-success-subtle text-success-foreground",
  failed: "border-error-border bg-error-subtle text-error-foreground",
  skipped: "border-dashed border-border-subtle text-status-skipped",
};

const STATUS_CONNECTOR_CLASS: Record<PipelineStageStatus, string> = {
  pending: "border-dashed border-border-subtle",
  running: "border-border",
  success: "border-border",
  failed: "border-border",
  skipped: "border-dashed border-border-subtle",
};

function statusAriaLabel(stage: AnyStageView): string {
  if (!stage.implemented) return `${stage.label}: 未実装`;
  const STATUS_LABEL: Record<PipelineStageStatus, string> = {
    pending: "未着手",
    running: "実行中",
    success: "成功",
    failed: `失敗、${stage.failedCount}件`,
    skipped: "スキップ",
  };
  return `${stage.label}: ${STATUS_LABEL[stage.status]}`;
}

export function PipelineStage({ stage, isLast }: { stage: AnyStageView; isLast: boolean }) {
  if (!stage.implemented) {
    return (
      <div className="flex flex-1 items-center" aria-label={statusAriaLabel(stage)}>
        <div className="flex flex-col items-center gap-1.5">
          <div className="flex size-8 items-center justify-center rounded-full border border-dashed border-border-subtle bg-surface-disabled text-text-disabled">
            <Circle className="size-4" aria-hidden />
          </div>
          <span className="whitespace-nowrap text-[0.7rem] text-text-disabled">{stage.label}</span>
          <span className="text-[0.6rem] text-text-disabled">未実装</span>
        </div>
        {!isLast && (
          <div className="mx-2 h-px flex-1 self-start border-t border-dashed border-border-subtle mt-4" />
        )}
      </div>
    );
  }

  const Icon = STATUS_ICON[stage.status];

  return (
    <div className="flex flex-1 items-center" aria-label={statusAriaLabel(stage)}>
      <div className="flex flex-col items-center gap-1.5">
        <div
          className={cn(
            "flex size-8 items-center justify-center rounded-full border",
            STATUS_NODE_CLASS[stage.status]
          )}
        >
          <Icon className="size-4" aria-hidden />
        </div>
        <span className="whitespace-nowrap text-xs font-medium">{stage.label}</span>
        {stage.status === "failed" && stage.failedCount > 0 && (
          <span className="whitespace-nowrap font-mono text-[0.65rem] tabular-nums text-error-foreground">
            {stage.failedCount}件失敗
          </span>
        )}
      </div>
      {!isLast && (
        <div
          className={cn(
            "mx-2 mt-4 h-px flex-1 self-start border-t",
            STATUS_CONNECTOR_CLASS[stage.status]
          )}
        />
      )}
    </div>
  );
}
