"use client";

import { useCallback, useState } from "react";

import { usePolling } from "@/features/automation/hooks/usePolling";
import type { AutomationJobDetailDTO, JobStatus } from "@/types/automation";

// useReviewSyncJob.tsとほぼ同型(一括返信ジョブはstop・オプションを持たないため
// run()のみを公開する)。

const SETTLED_STATUSES: ReadonlySet<JobStatus> = new Set(["success", "failed", "stopped"]);

export interface UseReviewReplyJobResult {
  job: AutomationJobDetailDTO | null;
  error: unknown;
  isStarting: boolean;
  isPolling: boolean;
  run: () => Promise<void>;
}

async function fetchJobDetail(jobId: string): Promise<AutomationJobDetailDTO> {
  const res = await fetch(`/api/automation-jobs/${jobId}`);
  if (!res.ok) throw new Error("Jobの状態取得に失敗しました");
  const data: { job: AutomationJobDetailDTO } = await res.json();
  return data.job;
}

function isJobSettled(job: AutomationJobDetailDTO): boolean {
  return SETTLED_STATUSES.has(job.status);
}

export function useReviewReplyJob(): UseReviewReplyJobResult {
  const [jobId, setJobId] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);

  const fetcher = useCallback(() => fetchJobDetail(jobId as string), [jobId]);

  const {
    data: job,
    error,
    isPolling,
  } = usePolling<AutomationJobDetailDTO>({
    enabled: jobId !== null,
    fetcher,
    isSettled: isJobSettled,
  });

  const run = useCallback(async () => {
    setIsStarting(true);
    try {
      const res = await fetch("/api/automation/review-reply/run", { method: "POST" });
      if (!res.ok) throw new Error("一括返信の開始に失敗しました");
      const data: { jobId: string } = await res.json();
      setJobId(data.jobId);
    } finally {
      setIsStarting(false);
    }
  }, []);

  return { job, error, isStarting, isPolling, run };
}
