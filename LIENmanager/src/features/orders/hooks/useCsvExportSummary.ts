"use client";

import { useCallback } from "react";

import { usePolling } from "@/features/automation/hooks/usePolling";
import type { CsvExportSummaryDTO } from "@/types/order";

// 発送エントリー画面の「本日のCSV出力実績」表示用。他の注文一覧と同じ間隔で
// 自動更新する(useOrderListに合わせる)。
const CSV_EXPORT_SUMMARY_POLL_INTERVAL_MS = 10 * 60 * 1000;

async function fetchCsvExportSummary(): Promise<CsvExportSummaryDTO> {
  const res = await fetch("/api/orders/csv-export-summary");
  if (!res.ok) throw new Error("failed to load csv export summary");
  return res.json();
}

function neverSettled(): boolean {
  return false;
}

export function useCsvExportSummary() {
  const fetcher = useCallback(() => fetchCsvExportSummary(), []);

  return usePolling<CsvExportSummaryDTO>({
    enabled: true,
    fetcher,
    isSettled: neverSettled,
    intervalMs: CSV_EXPORT_SUMMARY_POLL_INTERVAL_MS,
  });
}
