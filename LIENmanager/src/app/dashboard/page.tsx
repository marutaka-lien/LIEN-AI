import { CircleCheck, CircleX, PackageCheck, Workflow } from "lucide-react";

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
      <PageHeader description="発送自動化の稼働状況を確認できます。" />

      <div className="flex flex-col gap-6 px-8 py-6">
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
