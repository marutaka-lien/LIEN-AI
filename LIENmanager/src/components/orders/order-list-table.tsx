"use client";

import { Inbox } from "lucide-react";

import { CopyTrackingNumberButton } from "@/components/orders/copy-tracking-number-button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { EmptyState } from "@/components/layout/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useOrderList } from "@/features/orders/hooks/useOrderList";
import { getOrderStatusPresentation } from "@/lib/order-status";
import { cn } from "@/lib/utils";

// 発送エントリー画面から「選択した注文者のみ処理」する際に使う選択状態。
// /orders画面など選択不要な文脈ではpropsを渡さなければチェックボックス列自体が出ない。
export interface OrderListSelection {
  selectedOrderNumbers: ReadonlySet<string>;
  onToggle: (orderNumber: string) => void;
  // 現在表示中の注文番号一覧を渡す(このテーブルが自前でデータを持つため、
  // 「全選択」の対象を親へ伝える必要がある)。
  onToggleAll: (orderNumbers: string[], checked: boolean) => void;
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("ja-JP");
}

function formatPrice(price: number | null): string {
  if (price === null) return "—";
  return `¥${price.toLocaleString("ja-JP")}`;
}

export interface OrderListTableProps {
  selection?: OrderListSelection;
  // 今日(JST)の注文・処理未完了(注文確認待ち・発送待ち)のみに絞る。発送エントリー画面用。
  filters?: { todayOnly?: boolean; pendingOnly?: boolean };
  // 配送方法・合計金額・支払方法の列を表示するか(既定true)。発送エントリー画面では
  // 選択操作に集中できるよう非表示にする。
  showPaymentAndShippingColumns?: boolean;
  // CSV出力・ClickPost・発送情報の列を表示するか(既定true)。発送エントリー画面の
  // 「処理待ち注文者」一覧はcsvExportedAt/clickPostRegisteredAtが必ず未設定の注文のみを
  // 表示するため、これらの列が常に同じ値(未出力/未登録/未入力)になり情報価値がない。
  // そのためこの画面限定で非表示にする(/ordersページ側は既定trueのまま変更しない)。
  showFulfillmentColumns?: boolean;
}

export function OrderListTable({
  selection,
  filters,
  showPaymentAndShippingColumns = true,
  showFulfillmentColumns = true,
}: OrderListTableProps = {}) {
  const { data: orders, error } = useOrderList(filters);

  if (orders === null) {
    return (
      <p className="text-sm text-muted-foreground">
        {error ? "注文一覧の取得に失敗しました。" : "読み込み中..."}
      </p>
    );
  }

  if (orders.length === 0) {
    return (
      <EmptyState
        icon={Inbox}
        title={filters?.pendingOnly ? "処理待ちの注文者はいません" : "まだ注文がありません"}
        description={
          filters?.pendingOnly
            ? "処理が完了していない注文者がいなくなると、ここが空になります。"
            : "発送エントリー画面から実行すると、ここに同期された注文が表示されます。"
        }
      />
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          {selection && (
            <TableHead className="w-10">
              <Checkbox
                checked={
                  orders.length > 0 && orders.every((o) => selection.selectedOrderNumbers.has(o.orderNumber))
                }
                onCheckedChange={(checked) =>
                  selection.onToggleAll(
                    orders.map((o) => o.orderNumber),
                    checked
                  )
                }
                aria-label="すべて選択"
              />
            </TableHead>
          )}
          <TableHead>ステータス</TableHead>
          <TableHead>注文番号</TableHead>
          <TableHead>注文者</TableHead>
          <TableHead>郵便番号</TableHead>
          <TableHead>お届け先</TableHead>
          {showPaymentAndShippingColumns && (
            <>
              <TableHead>配送方法</TableHead>
              <TableHead>合計金額</TableHead>
              <TableHead>支払方法</TableHead>
            </>
          )}
          {showFulfillmentColumns && (
            <>
              <TableHead>CSV出力</TableHead>
              <TableHead>ClickPost</TableHead>
              <TableHead>発送情報</TableHead>
            </>
          )}
          <TableHead>注文日</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {orders.map((order) => {
          const status = getOrderStatusPresentation(order.orderStatus);
          return (
            <TableRow
              key={order.id}
              className={cn(
                "hover:bg-surface-hover",
                status.isProcessingTarget && "border-l-4 border-l-primary bg-primary-subtle"
              )}
            >
              {selection && (
                <TableCell>
                  <Checkbox
                    checked={selection.selectedOrderNumbers.has(order.orderNumber)}
                    onCheckedChange={() => selection.onToggle(order.orderNumber)}
                    aria-label={`${order.orderNumber}を選択`}
                  />
                </TableCell>
              )}
              <TableCell>
                <Badge
                  variant="outline"
                  className={cn(
                    "border-transparent",
                    status.isProcessingTarget
                      ? "bg-primary-subtle text-primary"
                      : status.isPendingConfirmation
                        ? "bg-warning-subtle text-warning-foreground"
                        : "bg-muted text-muted-foreground"
                  )}
                >
                  {status.isProcessingTarget ? "処理対象" : status.label}
                </Badge>
              </TableCell>
              <TableCell className="font-mono text-xs">{order.orderNumber}</TableCell>
              <TableCell>{order.ordererName}</TableCell>
              <TableCell className="font-mono text-xs">{order.postalCode ?? "—"}</TableCell>
              <TableCell>
                <div className="flex flex-col">
                  <span>{order.recipientName ?? order.ordererName}</span>
                  <span className="text-xs text-muted-foreground">
                    {order.prefecture}
                    {order.address1}
                    {order.address2}
                  </span>
                </div>
              </TableCell>
              {showPaymentAndShippingColumns && (
                <>
                  <TableCell className="text-xs text-muted-foreground">
                    {order.shippingMethod ?? "—"}
                  </TableCell>
                  <TableCell className="font-mono text-xs">{formatPrice(order.totalPrice)}</TableCell>
                  <TableCell className="text-xs">{order.paymentMethod ?? "—"}</TableCell>
                </>
              )}
              {showFulfillmentColumns && (
                <>
                  <TableCell className="text-xs">
                    {order.csvExportedAt ? (
                      <Badge
                        variant="outline"
                        className="border-transparent bg-success-subtle text-success-foreground"
                      >
                        出力済み
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">未出力</span>
                    )}
                  </TableCell>
                  <TableCell className="text-xs">
                    {order.clickPostRegisteredAt ? (
                      <Badge
                        variant="outline"
                        className="border-transparent bg-success-subtle text-success-foreground"
                      >
                        登録済み
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">未登録</span>
                    )}
                  </TableCell>
                  <TableCell className="text-xs">
                    {order.trackingNumber ? (
                      <div className="flex items-center">
                        <span className="font-mono">{order.trackingNumber}</span>
                        <CopyTrackingNumberButton trackingNumber={order.trackingNumber} />
                      </div>
                    ) : (
                      <span className="text-muted-foreground">未入力</span>
                    )}
                  </TableCell>
                </>
              )}
              <TableCell className="font-mono text-xs text-muted-foreground">
                {formatDate(order.orderedAt)}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
