import { TrendingDown, TrendingUp } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  computeChange,
  formatPeriod,
  formatYen,
  latestWeek,
} from "@/lib/weekly-sales-view";
import type { WeeklySalesRecord } from "@/server/sales/weekly-sales.service";

/**
 * 直近週の販売実績KPI。MetricTileと違い金額（円）・小数（個数）を扱うため専用に作る。
 * データは全てBusinessData/sales/週次販売実績.csvの記録そのまま（捏造・推測なし）。
 */
export function SalesKpiRow({ records }: { records: WeeklySalesRecord[] }) {
  const latest = latestWeek(records);

  if (!latest) {
    return (
      <section className="rounded-xl border border-dashed border-border-subtle bg-surface-elevated p-4 text-sm text-text-secondary">
        週次販売実績はまだ記録されていません。
      </section>
    );
  }

  const { deltaYen, deltaPercent } = computeChange(records);

  return (
    <section className="rounded-xl border border-border-subtle bg-surface-elevated p-4">
      <div className="mb-3 flex items-baseline justify-between">
        <h3 className="text-sm font-semibold">直近週の販売実績</h3>
        <span className="font-mono text-[0.7rem] tracking-wide text-muted-foreground">
          {formatPeriod(latest)}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Tile label="売上">
          <div className="flex items-baseline gap-2">
            <span>{formatYen(latest.salesYen)}</span>
            {deltaPercent !== null && <ChangeBadge percent={deltaPercent} yen={deltaYen ?? 0} />}
          </div>
        </Tile>
        <Tile label="注文件数">{latest.orders.toLocaleString("ja-JP")}件</Tile>
        <Tile label="販売個数">{latest.qty.toLocaleString("ja-JP")}個</Tile>
        <Tile label="1注文あたり売上">{formatYen(latest.avgOrderYen)}</Tile>
      </div>
      <p className="mt-3 text-[0.7rem] text-text-secondary">
        取得日 {latest.recordedAt}（マスターがRMS画面から取得・毎週記録）
      </p>
    </section>
  );
}

function Tile({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border-subtle bg-surface p-3">
      <div className="font-mono text-[0.65rem] tracking-wide text-text-secondary">{label}</div>
      <div className="mt-1 font-mono text-xl font-semibold tabular-nums leading-none">
        {children}
      </div>
    </div>
  );
}

function ChangeBadge({ percent, yen }: { percent: number; yen: number }) {
  const isUp = percent >= 0;
  const Icon = isUp ? TrendingUp : TrendingDown;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[0.65rem] font-medium",
        isUp
          ? "bg-success-subtle text-success-foreground"
          : "bg-warning-subtle text-warning-foreground"
      )}
      title={`前週比 ${yen >= 0 ? "+" : ""}${formatYen(yen)}`}
    >
      <Icon className="size-3" aria-hidden />
      {isUp ? "+" : ""}
      {percent.toFixed(1)}%
    </span>
  );
}
