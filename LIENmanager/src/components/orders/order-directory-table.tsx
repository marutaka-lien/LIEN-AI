"use client";

import { ChevronLeft, ChevronRight, Inbox, TriangleAlert } from "lucide-react";

import { CopyTrackingNumberButton } from "@/components/orders/copy-tracking-number-button";
import { EmptyState } from "@/components/layout/empty-state";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getOrderStatusPresentation } from "@/lib/order-status";
import { cn } from "@/lib/utils";
import type { OrderDTO } from "@/types/order";

export interface OrderDirectorySelection {
  selectedOrderNumbers: ReadonlySet<string>;
  onToggle: (orderNumber: string) => void;
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

// 発送エントリー「注文者情報一覧」タブ(2026-09-10 発送ページ集約)。旧/orders画面の
// OrderListTableを土台に、全ステータス・全期間の検索/絞り込み/並べ替え/ページ送りと、
// 一時保存(heldAt)の切り替えを加えたもの。
export function OrderDirectoryTable({
  orders,
  isLoading,
  isError,
  onRetry,
  selection,
  onHold,
  onUnhold,
  isUpdatingHold,
}: {
  orders: OrderDTO[] | null;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  selection: OrderDirectorySelection;
  onHold: (order: OrderDTO) => void;
  onUnhold: (order: OrderDTO) => void;
  isUpdatingHold: boolean;
}) {
  if (isLoading && orders === null) {
    return <p className="p-6 text-sm text-text-secondary">読み込み中...</p>;
  }

  if (isError && orders === null) {
    return (
      <div className="flex flex-col items-center gap-2 p-10 text-center">
        <TriangleAlert className="size-5 text-error-foreground" aria-hidden />
        <p className="text-sm font-semibold">一覧を取得できませんでした</p>
        <button
          type="button"
          onClick={onRetry}
          className="mt-1 h-8 rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground hover:bg-primary-hover"
        >
          再試行する
        </button>
      </div>
    );
  }

  const rows = orders ?? [];

  if (rows.length === 0) {
    return (
      <EmptyState
        icon={Inbox}
        title="条件に合う注文がありません"
        description="検索語やステータスの絞り込みを変えてみてください。"
      />
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-10">
            <Checkbox
              checked={rows.length > 0 && rows.every((o) => selection.selectedOrderNumbers.has(o.orderNumber))}
              onCheckedChange={(checked) =>
                selection.onToggleAll(
                  rows.map((o) => o.orderNumber),
                  Boolean(checked)
                )
              }
              aria-label="すべて選択"
            />
          </TableHead>
          <TableHead>ステータス</TableHead>
          <TableHead>注文番号</TableHead>
          <TableHead>注文者</TableHead>
          <TableHead>郵便番号</TableHead>
          <TableHead>お届け先</TableHead>
          <TableHead>配送方法</TableHead>
          <TableHead>合計金額</TableHead>
          <TableHead>CSV出力</TableHead>
          <TableHead>発送情報</TableHead>
          <TableHead>一時保存</TableHead>
          <TableHead>注文日</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((order) => {
          const status = getOrderStatusPresentation(order.orderStatus);
          const isHeld = Boolean(order.heldAt);
          return (
            <TableRow
              key={order.id}
              className={cn(
                "hover:bg-surface-hover",
                status.isProcessingTarget && "border-l-4 border-l-primary bg-primary-subtle",
                isHeld && "opacity-70"
              )}
            >
              <TableCell>
                <Checkbox
                  checked={selection.selectedOrderNumbers.has(order.orderNumber)}
                  onCheckedChange={() => selection.onToggle(order.orderNumber)}
                  aria-label={`${order.orderNumber}を選択`}
                />
              </TableCell>
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
              <TableCell className="text-xs text-muted-foreground">
                {order.shippingMethod ?? "—"}
              </TableCell>
              <TableCell className="font-mono text-xs">{formatPrice(order.totalPrice)}</TableCell>
              <TableCell className="text-xs">
                {order.csvExportedAt ? (
                  <Badge variant="outline" className="border-transparent bg-success-subtle text-success-foreground">
                    出力済み
                  </Badge>
                ) : (
                  <span className="text-muted-foreground">未出力</span>
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
              <TableCell className="text-xs">
                {isHeld ? (
                  <button
                    type="button"
                    onClick={() => onUnhold(order)}
                    disabled={isUpdatingHold}
                    className="h-7 whitespace-nowrap rounded-md border border-primary-border bg-primary-subtle px-2 text-[11px] text-primary hover:bg-primary/20 disabled:opacity-60"
                  >
                    戻す
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => onHold(order)}
                    disabled={isUpdatingHold}
                    className="h-7 whitespace-nowrap rounded-md border border-border-strong px-2 text-[11px] text-text-secondary hover:bg-surface-hover hover:text-foreground disabled:opacity-60"
                  >
                    一時保存にする
                  </button>
                )}
              </TableCell>
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

export function OrderDirectoryPagination({
  page,
  pageSize,
  total,
  onPageChange,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  return (
    <div className="flex items-center justify-between border-t border-border-subtle px-3.5 py-2.5 text-xs text-text-secondary">
      <span>
        全{total}件中 {total === 0 ? 0 : (page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)}件
      </span>
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className="flex size-7 items-center justify-center rounded-md border border-border-strong disabled:opacity-40"
          aria-label="前のページ"
        >
          <ChevronLeft className="size-3.5" aria-hidden />
        </button>
        <span className="font-mono tabular-nums">
          {page} / {totalPages}
        </span>
        <button
          type="button"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          className="flex size-7 items-center justify-center rounded-md border border-border-strong disabled:opacity-40"
          aria-label="次のページ"
        >
          <ChevronRight className="size-3.5" aria-hidden />
        </button>
      </div>
    </div>
  );
}
