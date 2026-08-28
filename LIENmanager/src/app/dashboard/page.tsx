import { CircleCheck, CircleX, PackageCheck, Workflow, ArrowUpRight } from "lucide-react";
import Link from "next/link";

import { PageHeader } from "@/components/layout/page-header";
import { AutomationStatusHero } from "@/components/dashboard/automation-status-hero";
import { KPICard } from "@/components/dashboard/kpi-card";
import { LatestJobCard } from "@/components/dashboard/latest-job-card";
import { ModuleStatusPanel } from "@/components/dashboard/module-status-panel";
import { automationJobService } from "@/server/automation/automation-job.service";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const summary = await automationJobService.getDashboardSummary();
  const hasFailure = summary.failureCount > 0;

  return (
    <>
      <PageHeader title="今日のオペレーション" description="発送・レビュー業務の状態を、ひと目で確認できます。" action={<Link href="/automation" className="hidden items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-[0_8px_28px_oklch(0.78_0.13_205/0.18)] transition hover:bg-primary-hover sm:flex">発送処理を開始<ArrowUpRight className="size-4" /></Link>} />

      <div className="flex flex-col gap-5 px-4 py-5 sm:px-6 lg:gap-6 lg:px-8">
        <AutomationStatusHero summary={summary} />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KPICard
            label="失敗件数"
            value={summary.failureCount}
            icon={CircleX}
            emphasis={hasFailure ? "error" : "neutral"}
            wide={hasFailure}
          />
          <KPICard label="処理件数" value={summary.processedCount} icon={PackageCheck} />
          <KPICard label="成功件数" value={summary.successCount} icon={CircleCheck} emphasis="success" />
          <KPICard
            label="稼働中ジョブ"
            value={summary.runningJobCount}
            icon={Workflow}
            emphasis={summary.runningJobCount > 0 ? "running" : "neutral"}
          />
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <LatestJobCard job={summary.latestJob} />
          <ModuleStatusPanel
            runningJobCount={summary.runningJobCount}
            latestJob={summary.latestJob}
          />
        </div>
      </div>
    </>
  );
}
