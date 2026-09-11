"use client";

import { AlertTriangle, ArrowDownUp, Search } from "lucide-react";
import { useCallback, useState } from "react";

import { CreateCsvButton } from "@/components/orders/create-csv-button";
import { OrderDirectoryPagination, OrderDirectoryTable } from "@/components/orders/order-directory-table";
import { Badge } from "@/components/ui/badge";
import { setOrderHeld } from "@/features/orders/hold-actions";
import { useOrderDirectory } from "@/features/orders/hooks/useOrderDirectory";
import { CLICKPOST_CSV_FIELD_LABELS, type ClickPostCsvUnmappableReport } from "@/types/clickpost-csv";
import { ORDER_STATUS_OPTIONS } from "@/lib/order-status";

// 発送エントリー「注文者情報一覧」タブ(2026-09-10 発送ページ集約)。全ステータス・
// 全期間を検索/絞り込み/並べ替え/ページ送りできる一覧。RMSとの相違確認・過去検索用途。
export function OrderDirectoryTab() {
  const [unmappableReport, setUnmappableReport] = useState<ClickPostCsvUnmappableReport>([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [sort, setSort] = useState<"orderedAtDesc" | "orderedAtAsc">("orderedAtDesc");
  const [page, setPage] = useState(1);
  const [selectedOrderNumbers, setSelectedOrderNumbers] = useState<Set<string>>(new Set());
  const [isUpdatingHold, setIsUpdatingHold] = useState(false);

  const { data, error, isLoading, refresh } = useOrderDirectory({ search, status, sort, page });

  const handleToggle = useCallback((orderNumber: string) => {
    setSelectedOrderNumbers((prev) => {
      const next = new Set(prev);
      if (next.has(orderNumber)) next.delete(orderNumber);
      else next.add(orderNumber);
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

  async function handleHold(order: { id: string }) {
    setIsUpdatingHold(true);
    try {
      await setOrderHeld(order.id, true);
      await refresh();
    } finally {
      setIsUpdatingHold(false);
    }
  }

  async function handleUnhold(order: { id: string }) {
    setIsUpdatingHold(true);
    try {
      await setOrderHeld(order.id, false);
      await refresh();
    } finally {
      setIsUpdatingHold(false);
    }
  }

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex flex-wrap items-center gap-2.5">
        <label className="flex h-9 w-[240px] items-center gap-1.5 rounded-lg border border-border-strong px-2.5 text-muted-foreground">
          <Search className="size-3.5 shrink-0" aria-hidden />
          <input
            type="text"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder="注文番号・氏名で検索"
            className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-text-disabled"
          />
        </label>

        <select
          value={status}
          onChange={(event) => {
            setStatus(event.target.value);
            setPage(1);
          }}
          className="h-9 rounded-lg border border-border-strong bg-transparent px-2.5 text-sm text-foreground"
        >
          <option value="">すべてのステータス</option>
          {ORDER_STATUS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        <button
          type="button"
          onClick={() => setSort((prev) => (prev === "orderedAtDesc" ? "orderedAtAsc" : "orderedAtDesc"))}
          className="flex h-9 items-center gap-1.5 rounded-lg border border-border-strong px-2.5 text-sm text-text-secondary hover:bg-surface-hover hover:text-foreground"
        >
          <ArrowDownUp className="size-3.5" aria-hidden />
          注文日 {sort === "orderedAtDesc" ? "新しい順" : "古い順"}
        </button>

        <div className="ml-auto flex items-center gap-2.5">
          {selectedOrderNumbers.size > 0 && (
            <Badge variant="outline" className="border-transparent bg-primary-subtle text-primary">
              {selectedOrderNumbers.size}件選択中
            </Badge>
          )}
          <CreateCsvButton
            selectedOrderNumbers={selectedOrderNumbers}
            onUnmappableReport={setUnmappableReport}
          />
        </div>
      </div>

      {unmappableReport.length > 0 && (
        <section
          role="alert"
          className="flex flex-col gap-2 rounded-xl border border-warning-border bg-warning-subtle p-3.5"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning-foreground" aria-hidden />
              <div className="flex flex-col gap-0.5">
                <p className="text-[12.5px] font-semibold text-warning-foreground">
                  CSVに変換できない文字が残った注文が{unmappableReport.length}件あります
                </p>
                <p className="text-[11.5px] text-text-secondary">
                  発送は止まりません。RMS側で該当項目の表記を確認してください。
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setUnmappableReport([])}
              className="shrink-0 text-[11px] text-text-secondary underline underline-offset-2 hover:text-foreground"
            >
              閉じる
            </button>
          </div>
          <ul className="flex flex-col gap-1.5 pl-6">
            {unmappableReport.map((order) => (
              <li key={order.orderNumber} className="flex flex-col gap-0.5 text-[11px]">
                <span className="font-mono font-semibold">{order.orderNumber}</span>
                <ul className="flex flex-col gap-0.5 pl-3 text-text-secondary">
                  {order.issues.map((issue) => (
                    <li key={issue.field}>
                      {CLICKPOST_CSV_FIELD_LABELS[issue.field]}:{" "}
                      {issue.chars.map((entry) => `「${entry.char}」(${entry.codePoint})`).join("、")}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="overflow-hidden rounded-xl border border-border-subtle bg-surface">
        <div className="overflow-x-auto">
          <OrderDirectoryTable
            orders={data?.orders ?? null}
            isLoading={isLoading}
            isError={error !== null}
            onRetry={refresh}
            selection={{
              selectedOrderNumbers,
              onToggle: handleToggle,
              onToggleAll: handleToggleAll,
            }}
            onHold={handleHold}
            onUnhold={handleUnhold}
            isUpdatingHold={isUpdatingHold}
          />
        </div>
        {data && data.total > 0 && (
          <OrderDirectoryPagination
            page={data.page}
            pageSize={data.pageSize}
            total={data.total}
            onPageChange={setPage}
          />
        )}
      </div>
    </div>
  );
}
