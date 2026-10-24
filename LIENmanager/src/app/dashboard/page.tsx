import { RingGauge } from "@/components/dashboard/infographic/ring-gauge";
import { AlertPanel } from "@/components/dashboard/operations/alert-panel";
import { MetricTile } from "@/components/dashboard/operations/metric-tile";
import { NextActionCard } from "@/components/dashboard/operations/next-action-card";
import { ShippingPipeline } from "@/components/dashboard/operations/shipping-pipeline";
import { SalesKpiRow } from "@/components/dashboard/sales/sales-kpi-row";
import { SalesTrendChart } from "@/components/dashboard/sales/sales-trend-chart";
import {
  buildPipelineStages,
  deriveOperationAlerts,
  formatJstHm,
} from "@/lib/operations-dashboard";
import { orderRepository } from "@/server/order/order.repository";
import { reviewRepository } from "@/server/review/review.repository";
import { listWeeklySales } from "@/server/sales/weekly-sales.service";

export const dynamic = "force-dynamic";

// C案（ハイブリッド型）: 左＝作業（いま やること）、右＝把握（週次販売実績）の2ゾーン。
// 2026-10-24 白ベースのリキッドグラスへ刷新。ゾーン名・見出し・注記は置かず、
// 一番大事な操作（CSV作成）を最上段に出す。数値はカウントアップ、比率はリングで見せる。
// すべて実データ。取れないものは空状態で出し、値は捏造しない。

export default async function DashboardPage() {
  const [overview, shippingToday, unrepliedReviews, weeklySales] = await Promise.all([
    orderRepository.countOperationsOverview(),
    orderRepository.getTodayShippingReportSummary(),
    reviewRepository.countUnreplied(),
    listWeeklySales(),
  ]);

  const checkedAt = formatJstHm(new Date());
  const alerts = deriveOperationAlerts({ awaitingConfirm: overview.awaitingConfirm });
  const stages = buildPipelineStages({
    awaitingConfirm: overview.awaitingConfirm,
    pendingShip: overview.csvUnexported,
    csvExported: overview.csvExported,
    shippedToday: shippingToday.count,
  });
  // 今日の消化率 = 本日発送済み ÷（本日発送済み + まだ発送待ち）
  const todayTotal = shippingToday.count + overview.pendingShip;
  const csvExportedPending = Math.max(0, overview.pendingShip - overview.csvUnexported);

  return (
    <div className="grid grid-cols-1 gap-5 px-4 pb-10 pt-2 sm:px-6 lg:grid-cols-[minmax(0,58fr)_minmax(0,42fr)] lg:px-8">
      <div className="flex flex-col gap-5">
        <NextActionCard pendingShip={overview.pendingShip} csvUnexported={overview.csvUnexported} />
        <AlertPanel alerts={alerts} checkedAt={checkedAt} />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <MetricTile
            label="発送待ち"
            value={overview.pendingShip}
            meta={`CSV未出力 ${overview.csvUnexported} · 出力済 ${csvExportedPending}`}
            href="/automation"
            linkLabel="発送エントリーで一覧を見る"
            dot="warning"
            delay={140}
            bar={
              <SplitBar
                parts={[
                  { value: overview.csvUnexported, className: "bg-warning-foreground" },
                  { value: csvExportedPending, className: "bg-accent-cyan" },
                ]}
                label={`発送待ち${overview.pendingShip}件のうちCSV未出力${overview.csvUnexported}件、出力済${csvExportedPending}件`}
              />
            }
          />
          <MetricTile
            label="本日発送済み"
            value={shippingToday.count}
            meta={
              shippingToday.lastReportedAt
                ? `最終 ${formatJstHm(new Date(shippingToday.lastReportedAt))}`
                : "本日の発送完了報告"
            }
            href="/automation"
            linkLabel="発送エントリーで履歴を見る"
            dot="success"
            delay={200}
            visual={
              <RingGauge
                value={shippingToday.count}
                max={todayTotal}
                size={48}
                tone="success"
                delay={400}
                label={`今日の消化率 ${todayTotal > 0 ? Math.round((shippingToday.count / todayTotal) * 100) : 0}%`}
              >
                <span className="text-[0.6rem] font-semibold tabular-nums text-success-foreground">
                  {todayTotal > 0 ? Math.round((shippingToday.count / todayTotal) * 100) : 0}%
                </span>
              </RingGauge>
            }
          />
          <MetricTile
            label="レビュー未返信"
            value={unrepliedReviews}
            meta="未返信のレビュー"
            href="/reviews"
            linkLabel="レビュー画面で返信する"
            dot="neutral"
            delay={260}
          />
        </div>

        <ShippingPipeline stages={stages} />
      </div>

      <div className="flex flex-col gap-5">
        <SalesKpiRow records={weeklySales} />
        <SalesTrendChart records={weeklySales} />
      </div>
    </div>
  );
}

/** 合計に対する内訳を1本の横バーで見せる（左から順に伸びる）。 */
function SplitBar({
  parts,
  label,
}: {
  parts: { value: number; className: string }[];
  label: string;
}) {
  const total = parts.reduce((acc, part) => acc + part.value, 0);
  return (
    <div className="flex h-2 w-full overflow-hidden rounded-full bg-[oklch(0.235_0.018_262/7%)]" role="img" aria-label={label}>
      {total > 0 &&
        parts.map((part, index) => (
          <div
            key={index}
            className={`lg-grow-x h-full ${part.className}`}
            style={{ width: `${(part.value / total) * 100}%`, "--delay": `${420 + index * 120}ms` } as React.CSSProperties}
          />
        ))}
    </div>
  );
}
