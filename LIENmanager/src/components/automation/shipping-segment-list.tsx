"use client";

import { CheckCircle2, RotateCcw, Search, TriangleAlert } from "lucide-react";

import { Checkbox } from "@/components/ui/checkbox";
import {
  canHoldInSegment,
  formatOrderAddress,
  getSegmentEmptyText,
  getSegmentListNote,
  getSegmentMetaHeadLabel,
  getSegmentRowMetaValue,
  SHIPPING_SEGMENT_LABELS,
} from "@/lib/shipping-segments";
import { cn } from "@/lib/utils";
import type { ShippingSegment, ShippingSegmentRowDTO } from "@/types/order";

export interface ShippingSegmentListSelection {
  selectedIds: ReadonlySet<string>;
  onToggle: (id: string) => void;
  onToggleAll: (ids: string[], checked: boolean) => void;
}

export function ShippingSegmentList({
  segment,
  rows,
  count,
  isLoading,
  isError,
  onRetry,
  searchTerm,
  onSearchTermChange,
  selection,
  onHold,
  onUnhold,
}: {
  segment: ShippingSegment;
  rows: ShippingSegmentRowDTO[];
  count: number;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  searchTerm: string;
  onSearchTermChange: (value: string) => void;
  selection: ShippingSegmentListSelection;
  onHold: (id: string) => void;
  onUnhold: (id: string) => void;
}) {
  const allChecked = rows.length > 0 && rows.every((row) => selection.selectedIds.has(row.id));
  const selectedCount = rows.filter((row) => selection.selectedIds.has(row.id)).length;

  return (
    <section className="flex min-w-0 flex-col overflow-hidden rounded-xl border border-border-subtle bg-surface">
      <div className="flex h-[52px] shrink-0 items-center gap-3 border-b border-border-subtle px-3.5">
        <h2 className="text-sm font-semibold">{SHIPPING_SEGMENT_LABELS[segment]}</h2>
        <span className="font-mono text-xs tabular-nums text-muted-foreground">{count}件</span>
        <span className="h-4 w-px bg-border-subtle" aria-hidden />
        <span className="hidden truncate text-[11.5px] text-text-secondary sm:inline">
          {getSegmentListNote(segment)}
        </span>
        <label className="ml-auto flex h-[30px] w-[190px] shrink-0 items-center gap-1.5 rounded-lg border border-border-strong px-2.5 text-muted-foreground">
          <Search className="size-3.5 shrink-0" aria-hidden />
          <input
            type="text"
            value={searchTerm}
            onChange={(event) => onSearchTermChange(event.target.value)}
            placeholder="注文番号・氏名"
            className="min-w-0 flex-1 bg-transparent text-xs text-foreground outline-none placeholder:text-text-disabled"
          />
        </label>
      </div>

      {selectedCount > 0 && (
        <div className="flex shrink-0 items-center gap-3 border-b border-border-subtle bg-primary-subtle px-3.5 py-2">
          <span className="font-mono text-xs tabular-nums">{selectedCount}件を選択中</span>
          <button
            type="button"
            onClick={() => selection.onToggleAll(rows.map((r) => r.id), false)}
            className="h-6 rounded-md border border-border-strong px-2 text-[11.5px] text-text-secondary hover:bg-surface-hover hover:text-foreground"
          >
            選択を解除
          </button>
          <span className="ml-auto hidden text-[11.5px] text-text-secondary sm:inline">
            右のパネルから選択分だけを処理できます
          </span>
        </div>
      )}

      <div
        className="grid shrink-0 grid-cols-[28px_1fr] items-center gap-x-3 border-b border-border-subtle bg-surface-elevated px-3.5 text-[11px] tracking-wide text-muted-foreground sm:grid-cols-[28px_140px_100px_84px_minmax(0,1fr)_88px_92px]"
        style={{ height: 32 }}
      >
        <span>
          <Checkbox
            checked={allChecked}
            onCheckedChange={(checked) =>
              selection.onToggleAll(
                rows.map((r) => r.id),
                Boolean(checked)
              )
            }
            aria-label="すべて選択"
          />
        </span>
        <span>注文番号</span>
        <span className="hidden sm:inline">注文者</span>
        <span className="hidden sm:inline">郵便番号</span>
        <span className="hidden sm:inline">お届け先</span>
        <span className="hidden sm:inline">{getSegmentMetaHeadLabel(segment)}</span>
        <span />
      </div>

      <div className="flex-1 overflow-y-auto">
        {isLoading && (
          <div className="flex flex-col gap-2 p-3.5">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-[30px] animate-pulse rounded-md bg-surface-elevated" />
            ))}
          </div>
        )}

        {!isLoading && isError && (
          <div className="flex h-full flex-col items-center justify-center gap-2 p-5 text-center">
            <TriangleAlert className="size-[22px] text-error-foreground" aria-hidden />
            <p className="text-sm font-semibold">一覧を取得できませんでした</p>
            <p className="text-xs text-text-secondary">
              対象0件ではありません。時間をおいて再試行してください。
            </p>
            <button
              type="button"
              onClick={onRetry}
              className="mt-1 h-[30px] rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground hover:bg-primary-hover"
            >
              再試行する
            </button>
          </div>
        )}

        {!isLoading && !isError && rows.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-text-secondary">
            <CheckCircle2 className="size-[22px] text-success-foreground" aria-hidden />
            <span className="text-sm text-text-secondary">{getSegmentEmptyText(segment)}</span>
          </div>
        )}

        {!isLoading &&
          !isError &&
          rows.map((row) => {
            const checked = selection.selectedIds.has(row.id);
            return (
              <div
                key={row.id}
                onClick={() => selection.onToggle(row.id)}
                className={cn(
                  "grid cursor-pointer grid-cols-[28px_1fr] items-center gap-x-3 border-b border-border-subtle px-3.5 text-[12.5px] sm:grid-cols-[28px_140px_100px_84px_minmax(0,1fr)_88px_92px]",
                  checked && "bg-primary-subtle"
                )}
                style={{ height: 40 }}
              >
                <span onClick={(event) => event.stopPropagation()}>
                  <Checkbox checked={checked} onCheckedChange={() => selection.onToggle(row.id)} />
                </span>
                <span className="truncate font-mono text-[12px] tabular-nums">{row.orderNumber}</span>
                <span className="hidden truncate sm:inline">{row.ordererName}</span>
                <span className="hidden font-mono text-xs tabular-nums text-text-secondary sm:inline">
                  {row.postalCode ?? "—"}
                </span>
                <span className="hidden truncate text-text-secondary sm:inline">
                  {formatOrderAddress(row)}
                </span>
                <span className="hidden truncate font-mono text-[11.5px] tabular-nums text-muted-foreground sm:inline">
                  {getSegmentRowMetaValue(segment, row)}
                </span>
                <span
                  className="flex items-center justify-end gap-1.5"
                  onClick={(event) => event.stopPropagation()}
                >
                  {segment === "held" && (
                    <button
                      type="button"
                      onClick={() => onUnhold(row.id)}
                      className="flex h-6 items-center gap-1 whitespace-nowrap rounded-md border border-primary-border bg-primary-subtle px-2 text-[11px] text-primary hover:bg-primary/20"
                    >
                      <RotateCcw className="size-3" aria-hidden />
                      戻す
                    </button>
                  )}
                  {segment === "done" && (
                    <span className="flex items-center gap-1 whitespace-nowrap text-[11px] text-success-foreground">
                      <CheckCircle2 className="size-3" aria-hidden />
                      報告済
                    </span>
                  )}
                  {canHoldInSegment(segment) && (
                    <button
                      type="button"
                      onClick={() => onHold(row.id)}
                      className="h-6 whitespace-nowrap rounded-md border border-border-strong px-2 text-[11px] text-text-secondary hover:bg-surface-hover hover:text-foreground"
                    >
                      一時保存
                    </button>
                  )}
                </span>
              </div>
            );
          })}
      </div>
    </section>
  );
}
