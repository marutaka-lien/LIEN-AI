"use client";

import { useCallback, useState } from "react";

import type { AutomationJobDetailDTO, JobStatus } from "@/types/automation";
import { usePolling } from "./usePolling";

// automation-card.tsx から setInterval/fetch/停止判定を切り離すためのドメイン固有フック。
// UIは run()/stop() を呼び、jobの状態はこのフックが返すjobをそのまま表示するだけでよい。

const SETTLED_STATUSES: ReadonlySet<JobStatus> = new Set(["success", "failed", "stopped"]);

export interface RunOptions {
  rmsConfirmExecute?: boolean;
  clickPostExecute?: boolean;
  // 指定した場合、この注文番号一覧に含まれる注文のみを処理する(選択実行モード)。
  orderNumbers?: string[];
}

export interface UseAutomationJobResult {
  job: AutomationJobDetailDTO | null;
  error: unknown;
  isStarting: boolean;
  isPolling: boolean;
  run: (options?: RunOptions) => Promise<void>;
  stop: () => Promise<void>;
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

export function useAutomationJob(): UseAutomationJobResult {
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

  const run = useCallback(async (options?: RunOptions) => {
    setIsStarting(true);
    try {
      const res = await fetch("/api/automation/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(options ?? {}),
      });
      if (!res.ok) throw new Error("自動化の開始に失敗しました");
      const data: { jobId: string } = await res.json();
      setJobId(data.jobId);
    } finally {
      setIsStarting(false);
    }
  }, []);

  const stop = useCallback(async () => {
    if (!jobId) return;
    const res = await fetch("/api/automation/stop", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jobId }),
    });
    if (!res.ok) throw new Error("停止リクエストに失敗しました");
  }, [jobId]);

  return { job, error, isStarting, isPolling, run, stop };
}
