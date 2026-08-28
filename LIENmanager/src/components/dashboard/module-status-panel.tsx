import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AUTOMATION_MODULES } from "@/lib/automation-modules";
import type { AutomationJobSummaryDTO } from "@/types/automation";

// 「接続正常」「連携済み」等の根拠のないステータスは表示しない。
// 表示するのは静的なモジュールメタ情報と、runningJobCount/latestJobから
// 導出できる「現在実行中かどうか」だけ。
export function ModuleStatusPanel({
  runningJobCount,
  latestJob,
}: {
  runningJobCount: number;
  latestJob: AutomationJobSummaryDTO | null;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>モジュール状態</CardTitle>
        <CardDescription>登録されている自動化フローの一覧です。</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {AUTOMATION_MODULES.map((module) => {
          const isRunning = runningJobCount > 0 && latestJob?.moduleKey === module.key;
          return (
            <div
              key={module.key}
              className="flex items-center justify-between rounded-lg border border-border-subtle px-4 py-3"
            >
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-medium">{module.title}</span>
                <span className="text-xs text-muted-foreground">{module.description}</span>
              </div>
              <Badge
                variant="outline"
                className={
                  isRunning
                    ? "border-transparent bg-primary-subtle text-primary animate-pulse"
                    : "border-transparent bg-muted text-muted-foreground"
                }
              >
                {isRunning ? "実行中" : "待機中"}
              </Badge>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
