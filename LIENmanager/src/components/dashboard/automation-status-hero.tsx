import { CircleCheck, CircleX, Inbox, LoaderCircle, PauseCircle } from "lucide-react";
import Link from "next/link";

import { EmptyState } from "@/components/layout/empty-state";
import { Progress } from "@/components/ui/progress";
import { deriveHeroState, type HeroState } from "@/lib/dashboard-status";
import { cn } from "@/lib/utils";
import type { DashboardSummaryDTO } from "@/types/automation";

const HERO_META: Record<
  Exclude<HeroState, "no_data">,
  { icon: typeof CircleCheck; label: string; containerClassName: string; iconClassName: string }
> = {
  running: {
    icon: LoaderCircle,
    label: "実行中",
    containerClassName: "border-primary-border bg-primary-subtle",
    iconClassName: "text-primary animate-pulse",
  },
  failed: {
    icon: CircleX,
    label: "失敗あり",
    containerClassName: "border-error-border border-l-4 bg-error-subtle",
    iconClassName: "text-error-foreground",
  },
  stopped: {
    icon: PauseCircle,
    label: "停止中",
    containerClassName: "border-warning-border bg-warning-subtle",
    iconClassName: "text-warning-foreground",
  },
  idle: {
    icon: CircleCheck,
    label: "待機中",
    containerClassName: "border-border-subtle bg-surface",
    iconClassName: "text-muted-foreground",
  },
};

export function AutomationStatusHero({ summary }: { summary: DashboardSummaryDTO }) {
  const state = deriveHeroState(summary);

  if (state === "no_data") {
    return (
      <div className="rounded-lg border border-dashed border-border-subtle bg-surface p-6">
        <EmptyState
          icon={Inbox}
          title="まだ実行履歴がありません"
          description="発送エントリー画面から実行すると、ここに現在の状態が表示されます。"
        />
      </div>
    );
  }

  const meta = HERO_META[state];
  const Icon = meta.icon;
  const job = summary.latestJob;

  return (
    <div className={cn("relative flex min-h-44 flex-col justify-between gap-5 overflow-hidden rounded-2xl border p-6 sm:p-7", meta.containerClassName)}>
      <div className="relative z-10 flex items-start gap-4">
        <div className="flex size-11 items-center justify-center rounded-xl border border-current/10 bg-background/30"><Icon className={cn("size-5", meta.iconClassName)} aria-hidden /></div>
        <div><p className="mb-1 text-[0.65rem] font-semibold tracking-[0.16em] text-muted-foreground">AUTOMATION STATUS</p><span className="text-xl font-semibold tracking-tight" role="status">
          {meta.label}
        </span></div>
      </div>

      {state === "running" && job && (
        <div className="relative z-10 flex flex-col gap-2">
          <span className="text-sm text-muted-foreground">{job.currentLabel ?? "処理中..."}</span>
          <Progress value={job.progressPercentage}>
            <div className="flex w-full items-center justify-end">
              <span className="font-mono text-xs tabular-nums text-muted-foreground">
                {job.progressPercentage}%
              </span>
            </div>
          </Progress>
        </div>
      )}

      {state === "failed" && job && (
        <div className="relative z-10 flex flex-wrap items-center justify-between gap-3">
          <span className="text-sm text-muted-foreground">
            直近の実行で{job.totalCount}件中{job.failureCount}件が失敗しました
          </span>
          <Link href="/automation" className="text-sm font-medium text-primary hover:underline">
            発送エントリー画面で詳細を確認 →
          </Link>
        </div>
      )}

      {state === "stopped" && job && (
        <span className="text-sm text-muted-foreground">
          実行が停止されました({job.successCount + job.failureCount}/{job.totalCount}件処理済み)
        </span>
      )}

      {state === "idle" && job && (
        <span className="text-sm text-muted-foreground">
          前回の実行は正常に完了しました({new Date(job.createdAt).toLocaleString("ja-JP")})
        </span>
      )}
      <div className="absolute -right-20 -top-20 size-56 rounded-full border-[32px] border-current opacity-[0.035]" />
    </div>
  );
}
