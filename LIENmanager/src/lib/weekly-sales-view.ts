import type { WeeklySalesRecord } from "@/server/sales/weekly-sales.service";

// 週次販売実績(プロジェクトB)の純粋な表示用ロジック。ダッシュボードから使う。
// CSVの記録をそのまま見せるだけで、ここでは何も推測・補完しない。

export interface WeeklyChange {
  /** 直近週 - 前週。前週が無ければnull。 */
  deltaYen: number | null;
  /** 前週比（%）。前週の売上が0の場合はnull。 */
  deltaPercent: number | null;
}

export function latestWeek(records: WeeklySalesRecord[]): WeeklySalesRecord | null {
  return records.length > 0 ? records[records.length - 1] : null;
}

export function computeChange(records: WeeklySalesRecord[]): WeeklyChange {
  if (records.length < 2) return { deltaYen: null, deltaPercent: null };
  const current = records[records.length - 1];
  const previous = records[records.length - 2];
  const deltaYen = current.salesYen - previous.salesYen;
  const deltaPercent = previous.salesYen === 0 ? null : (deltaYen / previous.salesYen) * 100;
  return { deltaYen, deltaPercent };
}

export function formatYen(value: number): string {
  return `${value.toLocaleString("ja-JP")}円`;
}

export function formatPeriod(record: WeeklySalesRecord): string {
  const trim = (iso: string) => iso.slice(5).replace("-", "/");
  return `${trim(record.periodStart)}〜${trim(record.periodEnd)}`;
}

export interface SalesBar {
  record: WeeklySalesRecord;
  /** 0〜100の範囲でのバー高さ比率。 */
  heightPercent: number;
}

/** 直近N週分をグラフ用に切り出し、売上の最大値に対する高さ比率を付ける。 */
export function buildSalesBars(records: WeeklySalesRecord[], maxWeeks = 8): SalesBar[] {
  const recent = records.slice(-maxWeeks);
  const maxSales = Math.max(1, ...recent.map((r) => r.salesYen));
  return recent.map((record) => ({
    record,
    heightPercent: Math.max(4, (record.salesYen / maxSales) * 100),
  }));
}
