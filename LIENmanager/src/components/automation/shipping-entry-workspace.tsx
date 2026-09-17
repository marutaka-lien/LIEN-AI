"use client";

import { AlertTriangle } from "lucide-react";
import { useCallback, useMemo, useState } from "react";

import { ShippingActionPanel } from "@/components/automation/shipping-action-panel";
import { ShippingFlowBar } from "@/components/automation/shipping-flow-bar";
import { ShippingSegmentList } from "@/components/automation/shipping-segment-list";
import { ShippingTodayHistory } from "@/components/automation/shipping-today-history";
import { createClickPostCsv } from "@/features/orders/create-csv";
import { setOrderExcluded, setOrdersExcludedMany } from "@/features/orders/exclude-actions";
import { setOrderHeld, setOrdersHeldMany } from "@/features/orders/hold-actions";
import { useShippingSegments } from "@/features/orders/hooks/useShippingSegments";
import { CLICKPOST_CSV_FIELD_LABELS, type ClickPostCsvUnmappableReport } from "@/types/clickpost-csv";
import type { ShippingSegment } from "@/types/order";

// 発送エントリー「作業メニュー」タブ(2026-09-10 発送ページ集約・v2採用)。
// Claude Designモック「発送エントリー v2.dc.html」の構成(セグメント切替＋左リスト＋
// 右アサイド)をそのまま踏襲する。docs/design/shipping-page-2026-09-10/claude-design/README.md参照。
export function ShippingEntryWorkspace() {
  const [active, setActive] = useState<ShippingSegment>("unprocessed");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState("");
  const [unmappableReport, setUnmappableReport] = useState<ClickPostCsvUnmappableReport>([]);
  const [isCreatingCsv, setIsCreatingCsv] = useState(false);
  const [isUpdatingHold, setIsUpdatingHold] = useState(false);
  const [isUpdatingExclude, setIsUpdatingExclude] = useState(false);

  const { data, error, isLoading, refresh } = useShippingSegments(active);

  const changeSegment = useCallback((segment: ShippingSegment) => {
    setActive(segment);
    setSelectedIds(new Set());
    setSearchTerm("");
  }, []);

  const rows = useMemo(() => {
    const allRows = data?.rows ?? [];
    if (!searchTerm.trim()) return allRows;
    const term = searchTerm.trim();
    return allRows.filter(
      (row) => row.orderNumber.includes(term) || row.ordererName.includes(term)
    );
  }, [data, searchTerm]);

  const toggle = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleAll = useCallback((ids: string[], checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const id of ids) {
        if (checked) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  }, []);

  // 一覧行のorder idから注文番号を引く(CSV作成APIはorderNumberで対象を指定するため)。
  const orderNumbersById = useMemo(() => {
    const map = new Map<string, string>();
    for (const row of data?.rows ?? []) map.set(row.id, row.orderNumber);
    return map;
  }, [data]);

  async function handleHold(id: string) {
    setIsUpdatingHold(true);
    try {
      await setOrderHeld(id, true);
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      await refresh();
    } finally {
      setIsUpdatingHold(false);
    }
  }

  async function handleUnhold(id: string) {
    setIsUpdatingHold(true);
    try {
      await setOrderHeld(id, false);
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      await refresh();
    } finally {
      setIsUpdatingHold(false);
    }
  }

  async function handleHoldSelected() {
    setIsUpdatingHold(true);
    try {
      await setOrdersHeldMany(Array.from(selectedIds), true);
      setSelectedIds(new Set());
      await refresh();
    } finally {
      setIsUpdatingHold(false);
    }
  }

  async function handleUnholdSelected() {
    setIsUpdatingHold(true);
    try {
      const ids = selectedIds.size > 0 ? Array.from(selectedIds) : rows.map((row) => row.id);
      await setOrdersHeldMany(ids, false);
      setSelectedIds(new Set());
      await refresh();
    } finally {
      setIsUpdatingHold(false);
    }
  }

  // 確認待ち・未処理・作業中のいずれからでも「対象外にする」(2026-09-15)。
  async function handleExclude(id: string) {
    setIsUpdatingExclude(true);
    try {
      await setOrderExcluded(id, true);
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      await refresh();
    } finally {
      setIsUpdatingExclude(false);
    }
  }

  // 一覧行の「戻す」。一時保存タブからは一時保存を外し、対象外タブからは対象外を外す
  // (どちらの一覧を見ているかはactiveで分かる)。
  async function handleRestore(id: string) {
    if (active === "excluded") {
      setIsUpdatingExclude(true);
      try {
        await setOrderExcluded(id, false);
        await refresh();
      } finally {
        setIsUpdatingExclude(false);
      }
      return;
    }
    await handleUnhold(id);
  }

  async function handleExcludeSelected() {
    setIsUpdatingExclude(true);
    try {
      await setOrdersExcludedMany(Array.from(selectedIds), true);
      setSelectedIds(new Set());
      await refresh();
    } finally {
      setIsUpdatingExclude(false);
    }
  }

  async function handleRestoreSelected() {
    setIsUpdatingExclude(true);
    try {
      const ids = selectedIds.size > 0 ? Array.from(selectedIds) : rows.map((row) => row.id);
      await setOrdersExcludedMany(ids, false);
      setSelectedIds(new Set());
      await refresh();
    } finally {
      setIsUpdatingExclude(false);
    }
  }

  async function handleCreateCsv() {
    setIsCreatingCsv(true);
    try {
      const orderNumbers =
        selectedIds.size > 0
          ? Array.from(selectedIds)
              .map((id) => orderNumbersById.get(id))
              .filter((value): value is string => Boolean(value))
          : undefined;
      const result = await createClickPostCsv(orderNumbers);
      if (result.ok) {
        setUnmappableReport(result.unmappable);
        setSelectedIds(new Set());
        await refresh();
      }
    } finally {
      setIsCreatingCsv(false);
    }
  }

  const counts = data?.counts ?? null;
  const targetCount = selectedIds.size > 0 ? selectedIds.size : (counts?.[active] ?? 0);

  return (
    <div className="flex flex-col gap-3.5">
      <ShippingFlowBar counts={counts} active={active} onChange={changeSegment} />

      <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-[minmax(0,1fr)_384px]">
        <ShippingSegmentList
          segment={active}
          rows={rows}
          count={counts?.[active] ?? 0}
          isLoading={isLoading}
          isError={!isLoading && error !== null && data === null}
          onRetry={refresh}
          searchTerm={searchTerm}
          onSearchTermChange={setSearchTerm}
          selection={{ selectedIds, onToggle: toggle, onToggleAll: toggleAll }}
          onHold={handleHold}
          onExclude={handleExclude}
          onRestore={handleRestore}
        />

        <aside className="flex min-w-0 flex-col gap-3">
          <ShippingActionPanel
            segment={active}
            targetCount={targetCount}
            selectedCount={selectedIds.size}
            onCreateCsv={handleCreateCsv}
            isCreatingCsv={isCreatingCsv}
            onHoldSelected={handleHoldSelected}
            onUnholdSelected={handleUnholdSelected}
            isUpdatingHold={isUpdatingHold}
            onExcludeSelected={handleExcludeSelected}
            onRestoreSelected={handleRestoreSelected}
            isUpdatingExclude={isUpdatingExclude}
            onReportDone={refresh}
          />

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
                      CSVに変換できない文字 {unmappableReport.length}件
                    </p>
                    <p className="text-[11.5px] text-text-secondary">
                      発送は止まりません。RMS側で表記を確認してください。
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
                          {issue.chars
                            .map((entry) => `「${entry.char}」(${entry.codePoint})`)
                            .join("、")}
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <ShippingTodayHistory unmappableCount={unmappableReport.length} />
        </aside>
      </div>
    </div>
  );
}
