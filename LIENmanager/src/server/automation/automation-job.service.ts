import type {
  AutomationJobDetailDTO,
  AutomationJobSummaryDTO,
  DashboardSummaryDTO,
} from "@/types/automation";
import { automationJobRepository } from "./automation-job.repository";
import { toJobDetailDTO, toJobSummaryDTO } from "./automation-job.mapper";

const DASHBOARD_LOOKBACK_LIMIT = 20;

export const automationJobService = {
  async listRecentJobs(limit = 10): Promise<AutomationJobSummaryDTO[]> {
    const jobs = await automationJobRepository.findRecent(limit);
    return jobs.map(toJobSummaryDTO);
  },

  async getJobDetail(id: string): Promise<AutomationJobDetailDTO | null> {
    const job = await automationJobRepository.findByIdWithDetails(id);
    return job ? toJobDetailDTO(job) : null;
  },

  async getDashboardSummary(): Promise<DashboardSummaryDTO> {
    const [jobs, runningJobCount] = await Promise.all([
      automationJobRepository.findRecent(DASHBOARD_LOOKBACK_LIMIT),
      automationJobRepository.countRunning(),
    ]);

    const totals = jobs.reduce(
      (acc, job) => {
        acc.successCount += job.successCount;
        acc.failureCount += job.failureCount;
        return acc;
      },
      { successCount: 0, failureCount: 0 }
    );

    return {
      processedCount: totals.successCount + totals.failureCount,
      successCount: totals.successCount,
      failureCount: totals.failureCount,
      runningJobCount,
      latestJob: jobs[0] ? toJobSummaryDTO(jobs[0]) : null,
    };
  },

  // Orchestratorはポーリングでこのフラグを確認し、trueならJobをstoppedにして中断する
  // (即座に処理を止めるわけではなく、次のチェックポイントで安全に停止する)。
  async requestStop(id: string): Promise<void> {
    await automationJobRepository.updateJob(id, { stopRequested: true });
  },
};
