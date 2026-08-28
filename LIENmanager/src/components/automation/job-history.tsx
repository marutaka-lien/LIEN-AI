"use client";

import { useEffect, useState } from "react";
import { ChevronDown, Inbox } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/layout/empty-state";
import { usePolling } from "@/features/automation/hooks/usePolling";
import { getModuleMeta } from "@/lib/automation-modules";
import { JOB_ITEM_STATUS_BADGE, JOB_STATUS_BADGE } from "@/lib/automation-status";
import { cn } from "@/lib/utils";
import type { AutomationJobDetailDTO, AutomationJobSummaryDTO } from "@/types/automation";
import { ErrorGroupSummary } from "./error-group-summary";
import { JobTimeline } from "./job-timeline";

type LoadState = "loading" | "ready" | "error";

async function fetchJobs(): Promise<AutomationJobSummaryDTO[]> {
  const res = await fetch("/api/automation-jobs");
  if (!res.ok) throw new Error("failed to load jobs");
  const data: { jobs: AutomationJobSummaryDTO[] } = await res.json();
  return data.jobs;
}

function neverSettled(): boolean {
  return false;
}

export function JobHistory() {
  const [expandedJobId, setExpandedJobId] = useState<string | null>(null);

  // 履歴一覧は完了状態を持たないため、isSettledは常にfalse(マウント中は継続して定期更新する)。
  // 実行中のJobがあればここで進捗の変化が反映される。
  const { data: jobs, error } = usePolling<AutomationJobSummaryDTO[]>({
    enabled: true,
    fetcher: fetchJobs,
    isSettled: neverSettled,
  });

  const loadState: LoadState = jobs === null ? (error ? "error" : "loading") : "ready";

  return (
    <Card>
      <CardHeader>
        <CardTitle>実行履歴</CardTitle>
        <CardDescription>
          過去に実行された自動化ジョブと、その処理内訳(注文・ステップ)を確認できます。
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loadState === "loading" && (
          <p className="text-sm text-muted-foreground">読み込み中...</p>
        )}

        {loadState === "error" && (
          <p className="text-sm text-error-foreground">実行履歴の取得に失敗しました。</p>
        )}

        {loadState === "ready" && (jobs ?? []).length === 0 && (
          <EmptyState
            icon={Inbox}
            title="まだ実行履歴がありません"
            description="発送エントリーの「実行」ボタンから処理を開始すると、ここに履歴が蓄積されます。"
          />
        )}

        {loadState === "ready" && (jobs ?? []).length > 0 && (
          <div className="flex flex-col gap-2">
            {(jobs ?? []).map((job) => (
              <JobHistoryRow
                key={job.id}
                job={job}
                expanded={expandedJobId === job.id}
                onToggle={() =>
                  setExpandedJobId((current) => (current === job.id ? null : job.id))
                }
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function JobHistoryRow({
  job,
  expanded,
  onToggle,
}: {
  job: AutomationJobSummaryDTO;
  expanded: boolean;
  onToggle: () => void;
}) {
  const badge = JOB_STATUS_BADGE[job.status];
  const moduleMeta = getModuleMeta(job.moduleKey);
  const hasFailure = job.status === "failed";

  return (
    <div
      className={cn(
        "rounded-lg border border-border-subtle",
        hasFailure && "border-l-4 border-l-error-foreground"
      )}
    >
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-4 px-4 py-3 text-left"
      >
        <div className="flex flex-col gap-0.5">
          <span className="text-sm font-medium">{moduleMeta?.title ?? job.moduleKey}</span>
          <span className="font-mono text-xs text-muted-foreground">
            {new Date(job.createdAt).toLocaleString("ja-JP")} ・ 処理{" "}
            {job.successCount + job.failureCount}/{job.totalCount} ・ 成功 {job.successCount} ・
            失敗 {job.failureCount}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className={cn("gap-1 border-transparent", badge.className)}>
            <badge.icon className="size-3" aria-hidden />
            {badge.label}
          </Badge>
          <ChevronDown
            className={cn("size-4 text-muted-foreground transition-transform", expanded && "rotate-180")}
          />
        </div>
      </button>

      {expanded && <JobHistoryDetail jobId={job.id} />}
    </div>
  );
}

function JobHistoryDetail({ jobId }: { jobId: string }) {
  const [detail, setDetail] = useState<AutomationJobDetailDTO | null>(null);
  const [loadState, setLoadState] = useState<LoadState>("loading");

  useEffect(() => {
    let cancelled = false;

    async function loadDetail() {
      try {
        const res = await fetch(`/api/automation-jobs/${jobId}`);
        if (!res.ok) throw new Error("failed to load job detail");
        const data: { job: AutomationJobDetailDTO } = await res.json();
        if (!cancelled) {
          setDetail(data.job);
          setLoadState("ready");
        }
      } catch {
        if (!cancelled) setLoadState("error");
      }
    }

    loadDetail();
    return () => {
      cancelled = true;
    };
  }, [jobId]);

  if (loadState === "loading") {
    return (
      <p className="border-t border-border-subtle px-4 py-3 text-xs text-muted-foreground">
        読み込み中...
      </p>
    );
  }

  if (loadState === "error" || !detail) {
    return (
      <p className="border-t border-border-subtle px-4 py-3 text-xs text-error-foreground">
        詳細の取得に失敗しました。
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3 border-t border-border-subtle px-4 py-3">
      <ErrorGroupSummary items={detail.items} />

      {detail.items.map((item) => {
        const itemBadge = JOB_ITEM_STATUS_BADGE[item.status];
        return (
          <div key={item.id} className="rounded-md bg-muted/40 px-3 py-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex flex-col gap-0.5">
                <span className="font-mono text-xs">{item.order.orderNumber}</span>
                <span className="text-xs text-muted-foreground">
                  {item.order.ordererName} ・ {item.order.prefecture}
                  {item.order.address1}
                </span>
              </div>
              <Badge variant="outline" className={cn("gap-1 border-transparent", itemBadge.className)}>
                <itemBadge.icon className="size-3" aria-hidden />
                {itemBadge.label}
              </Badge>
            </div>

            {item.steps.length > 0 && (
              <div className="mt-2 border-t border-border-subtle pt-2">
                <JobTimeline steps={item.steps} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
