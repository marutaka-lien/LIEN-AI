"use client";

import { useCallback } from "react";

import { usePolling } from "@/features/automation/hooks/usePolling";
import type { ShippingReportSummaryDTO } from "@/types/shipping-report";

// 発送エントリー画面の「本日の発送完了報告CSV実績」表示用。
// useCsvExportSummary と同じ間隔で自動更新する。
const SHIPPING_REPORT_SUMMARY_POLL_INTERVAL_MS = 10 * 60 * 1000;

async function fetchShippingReportSummary(): Promise<ShippingReportSummaryDTO> {
  const res = await fetch("/api/rms/shipping-report/summary");
  if (!res.ok) throw new Error("failed to load shipping report summary");
  return res.json();
}

function neverSettled(): boolean {
  return false;
}

export function useShippingReportSummary() {
  const fetcher = useCallback(() => fetchShippingReportSummary(), []);

  return usePolling<ShippingReportSummaryDTO>({
    enabled: true,
    fetcher,
    isSettled: neverSettled,
    intervalMs: SHIPPING_REPORT_SUMMARY_POLL_INTERVAL_MS,
  });
}
