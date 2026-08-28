import { Inbox } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/layout/empty-state";
import { getModuleMeta } from "@/lib/automation-modules";
import { JOB_STATUS_BADGE } from "@/lib/automation-status";
import { cn } from "@/lib/utils";
import type { AutomationJobSummaryDTO } from "@/types/automation";

export function LatestJobCard({ job }: { job: AutomationJobSummaryDTO | null }) {
  const badge = job ? JOB_STATUS_BADGE[job.status] : null;
  const moduleMeta = job ? getModuleMeta(job.moduleKey) : undefined;

  return (
    <Card>
      <CardHeader>
        <CardTitle>直近の実行結果</CardTitle>
        <CardDescription>最新の自動化ジョブのサマリーです。</CardDescription>
      </CardHeader>
      <CardContent>
        {job && badge ? (
          <div className="flex items-center justify-between rounded-lg border border-border-subtle bg-surface px-4 py-3">
            <div className="flex flex-col gap-0.5">
              <span className="text-sm font-medium">{moduleMeta?.title ?? job.moduleKey}</span>
              <span className="font-mono text-xs text-muted-foreground">
                処理件数 {job.successCount + job.failureCount}/{job.totalCount} ・ 成功{" "}
                {job.successCount} ・ 失敗 {job.failureCount}
              </span>
              <span className="font-mono text-[0.7rem] text-muted-foreground">
                {new Date(job.createdAt).toLocaleString("ja-JP")}
              </span>
            </div>
            <Badge variant="outline" className={cn("gap-1 border-transparent", badge.className)}>
              <badge.icon className="size-3" aria-hidden />
              {badge.label}
            </Badge>
          </div>
        ) : (
          <EmptyState
            icon={Inbox}
            title="まだ実行履歴がありません"
            description="発送エントリー画面から実行すると、ここに直近の結果が表示されます。"
          />
        )}
      </CardContent>
    </Card>
  );
}
