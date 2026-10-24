import { TrendingDown, TrendingUp } from "lucide-react";
import type { CSSProperties, ReactNode } from "react";

import { AnimatedNumber } from "@/components/ui/animated-number";
import { cn } from "@/lib/utils";
import { computeChange, formatPeriod, formatYen, latestWeek } from "@/lib/weekly-sales-view";
import type { WeeklySalesRecord } from "@/server/sales/weekly-sales.service";

/**
 * 直近週の販売実績。売上を大きく見せ、前週との比較を2本のバーで並べる。
 * データは全てBusinessData/sales/週次販売実績.csvの記録そのまま（捏造・推測なし）。
 * 出典（取得日）は期間チップのツールチップに入れる。
 */
export function SalesKpiRow({ records }: { records: WeeklySalesRecord[] }) {
  const latest = latestWeek(records);

  if (!latest) {
    return (
      <section className="glass lg-rise rounded-2xl p-6 text-sm text-text-secondary">
        週次販売実績はまだ記録されていません。
      </section>
    );
  }

  const previous = records.length >= 2 ? records[records.length - 2] : null;
  const { deltaYen, deltaPercent } = computeChange(records);
  const compareMax = Math.max(1, latest.salesYen, previous?.salesYen ?? 0);

  return (
    <section
      className="glass lg-rise flex flex-col gap-5 rounded-[1.75rem] p-6"
      style={{ "--delay": "120ms" } as CSSProperties}
    >
      <div className="flex items-center justify-between gap-3">
        <span
          className="rounded-full bg-white/70 px-3 py-1 text-xs font-medium tabular-nums text-text-secondary shadow-[inset_0_1px_0_oklch(1_0_0)]"
          title={`取得日 ${latest.recordedAt}（RMS画面から毎週記録）`}
        >
          {formatPeriod(latest)}
        </span>
        {deltaPercent !== null && <ChangeBadge percent={deltaPercent} yen={deltaYen ?? 0} />}
      </div>

      <div className="text-[2.6rem] font-semibold leading-none tracking-tight">
        <AnimatedNumber value={latest.salesYen} duration={1400} delay={120} />
        <span className="ml-1.5 text-base font-normal text-text-secondary">円</span>
      </div>

      {previous && (
        <div className="flex flex-col gap-2" aria-label={`今週${formatYen(latest.salesYen)}、前週${formatYen(previous.salesYen)}`}>
          <CompareBar label="今週" value={latest.salesYen} max={compareMax} tone="primary" delay={260} />
          <CompareBar label="前週" value={previous.salesYen} max={compareMax} tone="muted" delay={340} />
        </div>
      )}

      <div className="grid grid-cols-3 gap-2.5">
        <MiniStat label="注文" unit="件" delay={300}>
          {latest.orders}
        </MiniStat>
        <MiniStat label="販売個数" unit="個" delay={360}>
          {latest.qty}
        </MiniStat>
        <MiniStat label="客単価" unit="円" delay={420}>
          {latest.avgOrderYen}
        </MiniStat>
      </div>
    </section>
  );
}

function CompareBar({
  label,
  value,
  max,
  tone,
  delay,
}: {
  label: string;
  value: number;
  max: number;
  tone: "primary" | "muted";
  delay: number;
}) {
  return (
    <div className="grid grid-cols-[2.5rem_1fr_auto] items-center gap-3 text-xs" aria-hidden>
      <span className="text-text-secondary">{label}</span>
      <div className="h-2 overflow-hidden rounded-full bg-[oklch(0.235_0.018_262/6%)]">
        <div
          className={cn(
            "lg-grow-x h-full rounded-full",
            tone === "primary"
              ? "bg-[linear-gradient(90deg,oklch(0.7_0.1_24),var(--primary))]"
              : "bg-[oklch(0.235_0.018_262/22%)]"
          )}
          style={{ width: `${(value / max) * 100}%`, "--delay": `${delay}ms` } as CSSProperties}
        />
      </div>
      <span className="tabular-nums text-text-secondary">{Math.round(value / 1000).toLocaleString("ja-JP")}k</span>
    </div>
  );
}

function MiniStat({
  label,
  unit,
  delay,
  children,
}: {
  label: string;
  unit: string;
  delay: number;
  children: number;
}): ReactNode {
  return (
    <div className="rounded-2xl bg-white/55 px-3.5 py-3 shadow-[inset_0_1px_0_oklch(1_0_0)]">
      <div className="text-[0.7rem] text-text-secondary">{label}</div>
      <div className="mt-1 text-lg font-semibold leading-none tracking-tight">
        <AnimatedNumber value={children} delay={delay} />
        <span className="ml-0.5 text-xs font-normal text-text-secondary">{unit}</span>
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
        "lg-pop inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold tabular-nums",
        isUp ? "bg-success-subtle text-success-foreground" : "bg-warning-subtle text-warning-foreground"
      )}
      style={{ "--delay": "600ms" } as CSSProperties}
      title={`前週比 ${yen >= 0 ? "+" : ""}${formatYen(yen)}`}
    >
      <Icon className="size-3.5" aria-hidden />
      前週比 {isUp ? "+" : ""}
      {percent.toFixed(1)}%
    </span>
  );
}
