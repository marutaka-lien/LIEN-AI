import { buildSalesBars, formatPeriod, formatYen } from "@/lib/weekly-sales-view";
import type { WeeklySalesRecord } from "@/server/sales/weekly-sales.service";

/**
 * 週次売上の推移（棒グラフ）。自前HTML/CSS（チャートライブラリは使わない、throughput-chartと同方針）。
 * 直近8週分まで。単一系列のため凡例は出さない。各バーにホバーで内訳を表示する。
 */
export function SalesTrendChart({ records }: { records: WeeklySalesRecord[] }) {
  if (records.length === 0) {
    return (
      <section className="rounded-xl border border-border-subtle bg-surface-elevated p-4">
        <ChartHeading />
        <div className="flex h-[160px] items-center justify-center rounded-lg border border-dashed border-border-subtle text-sm text-text-secondary">
          記録された週次販売実績はまだありません
        </div>
      </section>
    );
  }

  const bars = buildSalesBars(records);

  return (
    <section className="rounded-xl border border-border-subtle bg-surface-elevated p-4">
      <ChartHeading />
      <div className="flex h-[160px] items-end gap-2.5">
        {bars.map(({ record, heightPercent }) => (
          <div
            key={record.periodStart}
            className="group flex min-w-0 flex-1 flex-col items-center gap-1.5"
            title={`${formatPeriod(record)}\n売上 ${formatYen(record.salesYen)}\n注文 ${record.orders}件 / 個数 ${record.qty}個`}
          >
            <span className="font-mono text-[0.6rem] tabular-nums text-text-secondary">
              {Math.round(record.salesYen / 1000)}k
            </span>
            <div className="flex h-[110px] w-full items-end">
              <div
                className="w-full rounded-t bg-primary/70 transition-colors group-hover:bg-primary"
                style={{ height: `${heightPercent}%` }}
              />
            </div>
            <span className="truncate font-mono text-[0.6rem] text-muted-foreground">
              {formatPeriod(record).split("〜")[0]}
            </span>
          </div>
        ))}
      </div>
      <p className="mt-2 border-t border-border-subtle pt-2 text-[0.7rem] text-text-secondary">
        単位：千円。マスターがRMS画面から毎週手動で取得・記録した実績（推測補完なし）。
      </p>
    </section>
  );
}

function ChartHeading() {
  return (
    <div className="mb-3">
      <h3 className="text-sm font-semibold">週次売上の推移</h3>
      <p className="font-mono text-[0.65rem] tracking-wide text-muted-foreground">
        期間開始日ごと / 直近8週
      </p>
    </div>
  );
}
