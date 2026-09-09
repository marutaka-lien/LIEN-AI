import { PackageCheck } from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { AlertPanel } from "@/components/dashboard/operations/alert-panel";
import { MetricTile } from "@/components/dashboard/operations/metric-tile";
import { NextActionCard } from "@/components/dashboard/operations/next-action-card";
import { OperationLog } from "@/components/dashboard/operations/operation-log";
import { OperationsClock } from "@/components/dashboard/operations/operations-clock";
import { ShippingPipeline } from "@/components/dashboard/operations/shipping-pipeline";
import { ThroughputChart } from "@/components/dashboard/operations/throughput-chart";
import {
  buildPipelineStages,
  buildThroughputSeries,
  deriveOperationAlerts,
  formatJstHm,
} from "@/lib/operations-dashboard";
import { automationJobService } from "@/server/automation/automation-job.service";
import { orderRepository } from "@/server/order/order.repository";
import { reviewRepository } from "@/server/review/review.repository";

export const dynamic = "force-dynamic";

// C案（ハイブリッド型）: 1画面を「いま やること＝作業」「きょうの ようす＝把握」の2ゾーンに分ける。
// すべて実データ。取れないものは空状態で出し、値は捏造しない。

export default async function DashboardPage() {
  const [overview, shippingToday, timeline, unrepliedReviews, recentJobs] = await Promise.all([
    orderRepository.countOperationsOverview(),
    orderRepository.getTodayShippingReportSummary(),
    orderRepository.getTodayOrderTimeline(),
    reviewRepository.countUnreplied(),
    automationJobService.listRecentJobs(5),
  ]);

  const checkedAt = formatJstHm(new Date());
  const alerts = deriveOperationAlerts({ awaitingConfirm: overview.awaitingConfirm });
  const series = buildThroughputSeries(timeline.orderedAt, timeline.shippedAt);
  const stages = buildPipelineStages({
    awaitingConfirm: overview.awaitingConfirm,
    pendingShip: overview.csvUnexported,
    csvExported: overview.csvExported,
    shippedToday: shippingToday.count,
  });
  const shipDone = overview.pendingShip === 0;

  return (
    <>
      <PageHeader
        title="今日のオペレーション"
        description="発送ミスを防ぎ、今日の作業を終わらせるための画面です。"
        action={<OperationsClock />}
      />

      <div className="grid grid-cols-1 gap-x-6 gap-y-8 px-4 py-5 sm:px-6 lg:grid-cols-[58fr_42fr] lg:px-8">
        {/* 左: 作業 */}
        <div className="flex flex-col gap-4 lg:border-r lg:border-border-subtle lg:pr-6">
          <ZoneHeading title="実行キュー" tag="EXECUTION" />
          <AlertPanel alerts={alerts} checkedAt={checkedAt} />

          <section>
            <h3 className="mb-2.5 font-mono text-xs font-semibold tracking-wide text-text-secondary">
              主要指標（現在値）
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <MetricTile
                label="発送待ち"
                value={overview.pendingShip}
                meta={`うち${overview.csvUnexported}件がCSV未出力`}
                href="/automation"
                linkLabel="一覧を見る"
                dot="warning"
              />
              <MetricTile
                label="CSV未出力"
                value={overview.csvUnexported}
                meta="発送待ちのうちCSV未作成"
                href="/automation"
                linkLabel="対象を確認"
                dot="cyan"
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
                linkLabel="履歴を見る"
                dot="success"
              />
              <MetricTile
                label="レビュー未返信"
                value={unrepliedReviews}
                meta="未返信のレビュー"
                href="/reviews"
                linkLabel="返信する"
                dot="neutral"
              />
            </div>
          </section>

          <ShippingPipeline stages={stages} />
          <NextActionCard
            pendingShip={overview.pendingShip}
            csvUnexported={overview.csvUnexported}
          />
        </div>

        {/* 右: 把握 */}
        <div className="flex flex-col gap-4">
          <ZoneHeading title="実績モニタリング" tag="MONITORING" />
          <ThroughputChart series={series} />
          <OperationLog jobs={recentJobs} />
          {shipDone && (
            <section className="flex items-center gap-2.5 rounded-xl border border-success-border bg-success-subtle px-4 py-3.5">
              <PackageCheck className="size-4 shrink-0 text-success-foreground" aria-hidden />
              <div>
                <p className="text-sm font-semibold">本日の発送は完了</p>
                <p className="text-xs text-text-secondary">
                  発送待ち 0件。新しい受注が入るとここに表示されます。
                </p>
              </div>
            </section>
          )}
        </div>
      </div>
    </>
  );
}

function ZoneHeading({ title, tag }: { title: string; tag: string }) {
  return (
    <div className="flex items-baseline gap-2.5">
      <h2 className="text-sm font-semibold tracking-wide">{title}</h2>
      <span className="font-mono text-[0.7rem] text-muted-foreground">{tag}</span>
    </div>
  );
}
