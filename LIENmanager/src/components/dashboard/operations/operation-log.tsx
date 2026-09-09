import { TriangleAlert } from "lucide-react";
import Link from "next/link";

import { cn } from "@/lib/utils";
import { formatJstHm } from "@/lib/operations-dashboard";
import type { AutomationJobSummaryDTO } from "@/types/automation";

const MODULE_LABEL: Record<string, string> = {
  rakuten_clickpost: "配送登録（ClickPost）",
  rms_review_sync: "レビュー同期",
  rms_review_reply: "レビュー返信",
};

function describe(job: AutomationJobSummaryDTO): { text: string; warning: boolean } {
  const label = MODULE_LABEL[job.moduleKey] ?? job.moduleKey;
  if (job.status === "failed" || job.failureCount > 0) {
    return { text: `${label}：${job.totalCount}件中${job.failureCount}件が失敗`, warning: true };
  }
  if (job.status === "running") {
    return { text: `${label}：実行中（${job.successCount}/${job.totalCount}）`, warning: false };
  }
  if (job.status === "stopped") {
    return { text: `${label}：停止（${job.successCount}/${job.totalCount}）`, warning: true };
  }
  return { text: `${label}：${job.successCount}件を処理`, warning: false };
}

/**
 * 「最新アクティビティ（オペレーションログ）」。C案モック準拠:
 * 時刻（等幅）＋内容、5行＋「すべて表示 →」。警告行は warning 文字色。
 */
export function OperationLog({ jobs }: { jobs: AutomationJobSummaryDTO[] }) {
  return (
    <section className="rounded-xl border border-border-subtle bg-surface-elevated p-4">
      <h3 className="mb-2.5 text-sm font-semibold">最新アクティビティ</h3>
      {jobs.length === 0 ? (
        <p className="py-2 text-sm text-text-secondary">まだ実行履歴がありません。</p>
      ) : (
        <ul className="flex flex-col">
          {jobs.map((job) => {
            const { text, warning } = describe(job);
            return (
              <li
                key={job.id}
                className={cn(
                  "flex gap-3 border-t border-border-subtle py-2.5 text-sm first:border-t-0",
                  warning && "text-warning-foreground"
                )}
              >
                <span className="shrink-0 font-mono tabular-nums text-muted-foreground">
                  {formatJstHm(new Date(job.createdAt))}
                </span>
                <span className="flex items-center gap-1.5">
                  {warning && <TriangleAlert className="size-3.5 shrink-0" aria-hidden />}
                  {text}
                </span>
              </li>
            );
          })}
        </ul>
      )}
      <div className="mt-2.5 border-t border-border-subtle pt-2.5">
        <Link href="/automation" className="text-xs font-medium text-primary hover:underline">
          すべて表示 →
        </Link>
      </div>
    </section>
  );
}
