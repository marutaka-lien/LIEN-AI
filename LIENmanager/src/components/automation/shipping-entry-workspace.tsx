"use client";

import { FileDown, PauseCircle } from "lucide-react";
import { useCallback, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { CreateCsvButton } from "@/components/orders/create-csv-button";
import { OrderListTable } from "@/components/orders/order-list-table";
import { useCsvExportSummary } from "@/features/orders/hooks/useCsvExportSummary";
import { useOrderList } from "@/features/orders/hooks/useOrderList";
import type { AutomationModuleMeta } from "@/types/automation";
import { JobHistoryToggle } from "./job-history-toggle";

function formatJstTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("ja-JP", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Tokyo",
  });
}

// 発送エントリー画面。2026-08-25経営判断により、ClickPostへの自社アプリからの
// 自動登録(まとめ申込〜支払手続き画面までのブラウザ操作)は使わない方針となった
// (複数件をまとめようとすると結局Yahoo!ウォレット認証を都度要求され、GoQSystemの
// 「パスコード1回で一括決済」という利点を活かせないため)。今後は「対象者CSVを作成」
// が主要動線となり、そのCSVをGoQSystemへ読み込ませて一括申込・一括決済・一括印刷まで
// 行う(自社アプリはCSV作成までで完結する)。
//
// AutomationCard(実行/選択実行/停止ボタン)自体は削除せず、将来の再開に備えて
// コードは残すが、このページでは凍結中であることを示す表示に置き換えて表示しない。
export function ShippingEntryWorkspace({ modules }: { modules: AutomationModuleMeta[] }) {
  const [selectedOrderNumbers, setSelectedOrderNumbers] = useState<Set<string>>(new Set());

  // CSV出力対象件数の表示用。一覧テーブル自体もこの条件(pendingOnly)で取得しているが、
  // テーブルは自前でデータを持つ設計のため、件数表示はここで独立して同じ条件を取得する。
  const { data: pendingOrders } = useOrderList({ pendingOnly: true });
  const csvTargetCount = useMemo(
    () =>
      pendingOrders === null
        ? null
        : pendingOrders.filter((order) => order.orderStatus === "300" && !order.csvExportedAt).length,
    [pendingOrders]
  );

  // 「本日のCSV出力実績」表示用。上のpendingOrders(csvExportedAtが未設定の注文のみ)
  // では出力済みの実績が分からないため、独立して取得する。
  const { data: csvExportSummary } = useCsvExportSummary();

  const handleToggle = useCallback((orderNumber: string) => {
    setSelectedOrderNumbers((prev) => {
      const next = new Set(prev);
      if (next.has(orderNumber)) {
        next.delete(orderNumber);
      } else {
        next.add(orderNumber);
      }
      return next;
    });
  }, []);

  const handleToggleAll = useCallback((orderNumbers: string[], checked: boolean) => {
    setSelectedOrderNumbers((prev) => {
      const next = new Set(prev);
      for (const orderNumber of orderNumbers) {
        if (checked) next.add(orderNumber);
        else next.delete(orderNumber);
      }
      return next;
    });
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 rounded-lg border border-primary/30 bg-primary-subtle p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <FileDown className="size-5" aria-hidden />
            </div>
            <div className="flex flex-col gap-1">
              <h2 className="text-base font-semibold">対象者CSVを作成</h2>
              <p className="text-sm text-muted-foreground">
                発送待ち・CSV未出力の注文をまとめてCSV出力します。このCSVをGoQSystemへ読み込ませ、一括申込・一括決済・一括印刷を行ってください。
              </p>
              <p className="text-xs text-muted-foreground">
                受注日を問わず、状態(発送待ち・CSV未出力)のみで対象を判定します。
              </p>
            </div>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-2">
            <span className="font-mono text-2xl font-semibold tabular-nums">
              {csvTargetCount ?? "—"}
              <span className="ml-1 text-sm font-normal text-muted-foreground">件</span>
            </span>
            <CreateCsvButton />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          {csvExportSummary === null ? (
            "本日のCSV出力実績を読み込み中..."
          ) : csvExportSummary.count === 0 ? (
            "本日はまだCSV出力していません。"
          ) : (
            <>
              本日のCSV出力:{" "}
              <span className="font-mono font-semibold text-success-foreground">
                {csvExportSummary.count}件
              </span>
              (最終出力 {formatJstTime(csvExportSummary.lastExportedAt!)}・GoQSystem引き渡し済み)
            </>
          )}
        </p>
      </div>

      {modules.map((module) => (
        <div
          key={module.key}
          className="flex items-start gap-3 rounded-lg border border-border-subtle bg-surface p-5 text-muted-foreground"
        >
          <PauseCircle className="mt-0.5 size-5 shrink-0" aria-hidden />
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-foreground">{module.title}</h3>
              <Badge variant="outline" className="border-transparent bg-muted text-muted-foreground">
                現在使用していません
              </Badge>
            </div>
            <p className="text-xs">
              ClickPostへの自動登録は現在使用していません(GoQSystem運用に一本化したため)。上の「対象者CSVを作成」をご利用ください。
            </p>
          </div>
        </div>
      ))}

      <JobHistoryToggle />

      <div className="flex flex-col gap-3 rounded-lg border border-border-subtle bg-surface p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold">処理待ち注文者</h2>
            {selectedOrderNumbers.size > 0 && (
              <Badge variant="outline" className="border-transparent bg-primary-subtle text-primary">
                {selectedOrderNumbers.size}件選択中
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-3">
            <p className="text-sm text-muted-foreground">
              チェックボックスで選ぶと、選んだ注文者だけでCSVを作成できます(CSV出力済みの注文を選び直すと再出力できます)。
            </p>
            <CreateCsvButton selectedOrderNumbers={selectedOrderNumbers} />
          </div>
        </div>
        <OrderListTable
          filters={{ pendingOnly: true }}
          showPaymentAndShippingColumns={false}
          showFulfillmentColumns={false}
          selection={{
            selectedOrderNumbers,
            onToggle: handleToggle,
            onToggleAll: handleToggleAll,
          }}
        />
      </div>
    </div>
  );
}
