import type { CSSProperties } from "react";

import { cn } from "@/lib/utils";
import { buildSalesBars, formatPeriod, formatYen } from "@/lib/weekly-sales-view";
import type { WeeklySalesRecord } from "@/server/sales/weekly-sales.service";

/**
 * 週次売上の推移（棒グラフ・直近8週）。自前HTML/CSS（チャートライブラリは使わない）。
 * 棒は左から順に伸び、最新週だけ色を付ける。点線＝表示期間の平均。
 * 値は千円単位で棒の上に直接書く（凡例いらず）。ホバー／フォーカスで内訳。
 */
export function SalesTrendChart({ records }: { records: WeeklySalesRecord[] }) {
  if (records.length === 0) {
    return (
      <section className="glass lg-rise flex h-[220px] items-center justify-center rounded-2xl text-sm text-text-secondary">
        記録された週次販売実績はまだありません
      </section>
    );
  }

  const bars = buildSalesBars(records);
  const maxSales = Math.max(1, ...bars.map((bar) => bar.record.salesYen));
  const average = bars.reduce((acc, bar) => acc + bar.record.salesYen, 0) / bars.length;
  const averagePercent = (average / maxSales) * 100;
  const summary = bars.map((bar) => `${formatPeriod(bar.record)} ${formatYen(bar.record.salesYen)}`).join("、");

  return (
    <section
      className="glass lg-rise rounded-[1.75rem] px-6 pb-5 pt-6"
      style={{ "--delay": "220ms" } as CSSProperties}
      aria-label={`週次売上の推移（直近${bars.length}週）：${summary}`}
    >
      <div className="relative h-[180px]">
        {/* 平均線 */}
        <div
          className="pointer-events-none absolute inset-x-0 z-10 flex items-center"
          style={{ bottom: `calc(${averagePercent}% * 0.72 + 1.3rem)` }}
          aria-hidden
        >
          <div
            className="lg-grow-x h-px flex-1 border-t border-dashed border-[oklch(0.235_0.018_262/28%)]"
            style={{ "--delay": "900ms" } as CSSProperties}
          />
          <span className="ml-2 rounded-full bg-white/80 px-2 py-0.5 text-[0.62rem] tabular-nums text-text-secondary">
            平均 {Math.round(average / 1000).toLocaleString("ja-JP")}k
          </span>
        </div>

        <div className="flex h-full items-end gap-2 pr-16">
          {bars.map(({ record, heightPercent }, index) => {
            const isLatest = index === bars.length - 1;
            const delay = 300 + index * 70;
            return (
              <div
                key={record.periodStart}
                tabIndex={0}
                className="group flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1.5 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                title={`${formatPeriod(record)}\n売上 ${formatYen(record.salesYen)}\n注文 ${record.orders}件 / 個数 ${record.qty}個`}
              >
                <span
                  className={cn(
                    "lg-rise text-[0.66rem] font-medium tabular-nums",
                    isLatest ? "text-primary" : "text-text-secondary"
                  )}
                  style={{ "--delay": `${delay + 450}ms` } as CSSProperties}
                >
                  {Math.round(record.salesYen / 1000).toLocaleString("ja-JP")}k
                </span>
                <div className="flex w-full items-end" style={{ height: "72%" }}>
                  <div
                    className={cn(
                      "lg-grow-y w-full rounded-t-[0.6rem] rounded-b-[0.3rem] transition-[filter] duration-300 group-hover:brightness-105",
                      isLatest
                        ? "bg-[linear-gradient(180deg,oklch(0.7_0.1_24),var(--primary))] shadow-[0_8px_20px_-10px_oklch(0.555_0.118_24/70%)]"
                        : "bg-[linear-gradient(180deg,oklch(0.86_0.05_245),oklch(0.74_0.09_245))]"
                    )}
                    style={{ height: `${heightPercent}%`, "--delay": `${delay}ms` } as CSSProperties}
                  />
                </div>
                <span className="truncate text-[0.62rem] tabular-nums text-text-secondary">
                  {formatPeriod(record).split("〜")[0]}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
