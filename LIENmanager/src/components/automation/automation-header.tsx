import { Play, Square } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { JOB_STATUS_BADGE } from "@/lib/automation-status";
import { cn } from "@/lib/utils";
import type { AutomationModuleMeta, JobStatus } from "@/types/automation";

export function AutomationHeader({
  module,
  status,
  canRun,
  canStop,
  onRun,
  onStop,
  selectedCount = 0,
  onRunSelected,
}: {
  module: AutomationModuleMeta;
  status: JobStatus;
  canRun: boolean;
  canStop: boolean;
  onRun: () => void;
  onStop: () => void;
  // 発送エントリー画面で注文者一覧から選択された件数。0の場合は選択実行ボタンを出さない。
  selectedCount?: number;
  onRunSelected?: () => void;
}) {
  const badge = JOB_STATUS_BADGE[status];

  return (
    <div className="flex flex-row items-start justify-between gap-4 rounded-lg border border-border-subtle bg-surface p-5">
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-semibold">{module.title}</h2>
          <Badge variant="outline" className={cn("gap-1 border-transparent", badge.className)}>
            <badge.icon className="size-3" aria-hidden />
            {badge.label}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">{module.description}</p>
      </div>
      <div className="flex items-center gap-2">
        <Button size="sm" onClick={onRun} disabled={!canRun}>
          <Play />
          全件実行
        </Button>
        {selectedCount > 0 && onRunSelected && (
          <Button size="sm" variant="secondary" onClick={onRunSelected} disabled={!canRun}>
            <Play />
            選択した注文者のみ実行({selectedCount}件)
          </Button>
        )}
        <Button size="sm" variant="outline" onClick={onStop} disabled={!canStop}>
          <Square />
          停止
        </Button>
      </div>
    </div>
  );
}
