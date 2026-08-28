"use client";

import { usePolling } from "./usePolling";
import type { AutomationJobSummaryDTO } from "@/types/automation";

// TopBar/Sidebarで共通利用する「現在稼働中のJob数」。既存の /api/automation-jobs
// (JobHistoryが使っているものと同一)をクライアント側で集約するだけで、
// 新規APIやDTOの追加は行わない。

async function fetchJobs(): Promise<AutomationJobSummaryDTO[]> {
  const res = await fetch("/api/automation-jobs");
  if (!res.ok) throw new Error("failed to load jobs");
  const data: { jobs: AutomationJobSummaryDTO[] } = await res.json();
  return data.jobs;
}

function neverSettled(): boolean {
  return false;
}

export function useRunningJobCount(): number {
  const { data: jobs } = usePolling<AutomationJobSummaryDTO[]>({
    enabled: true,
    fetcher: fetchJobs,
    isSettled: neverSettled,
    intervalMs: 5000,
  });

  return (jobs ?? []).filter((job) => job.status === "running").length;
}
