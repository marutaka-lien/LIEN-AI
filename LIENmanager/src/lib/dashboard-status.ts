import type { DashboardSummaryDTO } from "@/types/automation";

// Dashboard最上段(AutomationStatusHero)の状態導出ロジック。
// DashboardSummaryDTOには「現在の状態」という単一フィールドは存在しないため、
// runningJobCount(リアルタイム性が最も高い)を最優先し、
// それが0の場合のみ直近Jobの結果(latestJob.status)から導出する。
// 新しいAPI/DTOは必要とせず、既存フィールドのみを参照する純粋関数。

export type HeroState = "running" | "failed" | "stopped" | "idle" | "no_data";

export function deriveHeroState(summary: DashboardSummaryDTO): HeroState {
  if (summary.runningJobCount > 0) return "running";
  if (!summary.latestJob) return "no_data";

  switch (summary.latestJob.status) {
    case "failed":
      return "failed";
    case "stopped":
      return "stopped";
    default:
      // success / pending はどちらも「現在は稼働していない」状態としてidle扱いにする
      return "idle";
  }
}
