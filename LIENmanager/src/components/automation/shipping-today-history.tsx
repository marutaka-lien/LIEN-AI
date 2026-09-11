"use client";

import { TriangleAlert } from "lucide-react";

import { formatJstHm } from "@/lib/operations-dashboard";
import { useCsvExportSummary } from "@/features/orders/hooks/useCsvExportSummary";
import { useShippingReportSummary } from "@/features/orders/hooks/useShippingReportSummary";

interface HistoryLine {
  key: string;
  at: Date;
  text: string;
  warning?: boolean;
}

// 「本日の履歴」。実データの範囲だけで作る(ダッシュボードの推移グラフと同じ方針。
// 2026-09-09マスター決定: 集計テーブルは追加しない)。RMS同期の成否・件数はまだ
// 可視化できていない(Gram/課題_RMS同期失敗の可視化_2026-09-09.mdが完了してから追加)。
export function ShippingTodayHistory({ unmappableCount }: { unmappableCount: number }) {
  const { data: csvSummary } = useCsvExportSummary();
  const { data: reportSummary } = useShippingReportSummary();

  const lines: HistoryLine[] = [];
  if (csvSummary && csvSummary.count > 0 && csvSummary.lastExportedAt) {
    lines.push({
      key: "csv",
      at: new Date(csvSummary.lastExportedAt),
      text: `対象者CSVを作成（本日${csvSummary.count}件・最終出力）`,
    });
  }
  if (reportSummary && reportSummary.count > 0 && reportSummary.lastReportedAt) {
    lines.push({
      key: "report",
      at: new Date(reportSummary.lastReportedAt),
      text: `発送完了報告CSVを作成（本日${reportSummary.count}件・最終出力）`,
    });
  }
  if (unmappableCount > 0) {
    lines.push({
      key: "warning",
      at: new Date(),
      text: `CSVに変換できない文字の警告 ${unmappableCount}件`,
      warning: true,
    });
  }
  lines.sort((a, b) => b.at.getTime() - a.at.getTime());

  return (
    <section className="flex flex-1 flex-col overflow-y-auto rounded-xl border border-border-subtle bg-surface p-3.5">
      <div className="mb-2 text-[10px] font-semibold tracking-[0.14em] text-muted-foreground">
        本日の履歴
      </div>
      {lines.length === 0 ? (
        <p className="py-1 text-xs text-text-secondary">本日はまだ実績がありません。</p>
      ) : (
        <div className="flex flex-col">
          {lines.map((line) => (
            <div
              key={line.key}
              className="flex gap-2.5 border-t border-border-subtle py-1.5 text-xs first:border-t-0"
            >
              <span className="shrink-0 font-mono tabular-nums text-muted-foreground">
                {formatJstHm(line.at)}
              </span>
              <span className={line.warning ? "flex items-center gap-1 text-warning-foreground" : ""}>
                {line.warning && <TriangleAlert className="size-3 shrink-0" aria-hidden />}
                {line.text}
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
