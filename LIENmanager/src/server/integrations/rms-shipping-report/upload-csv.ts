// RMS「発送完了報告データ(アップロード用)」CSVを組み立てる。
// 6列固定・順序固定・Shift-JIS。送付先ID・発送明細IDは常に空欄
// (= RMS仕様上「送付先1へ新規登録」)。

import iconv from "iconv-lite";

import { formatJstTimestampCompact } from "@/lib/date";
import { buildCsvText } from "@/server/shared/csv";
import {
  RMS_SHIPPING_REPORT_CSV_HEADER,
  type ShippingReportCsvRow,
} from "./rms-shipping-report-types";

function rowToColumns(row: ShippingReportCsvRow): string[] {
  return [
    row.orderNumber,
    "", // 送付先ID(空欄)
    "", // 発送明細ID(空欄)
    row.shippingTrackingNumber,
    row.deliveryCompany,
    row.shippingDate,
  ];
}

// UTF-8 の文字列として組み立てる(プレビュー・テスト用)。
export function buildShippingReportCsvText(rows: readonly ShippingReportCsvRow[]): string {
  return buildCsvText([[...RMS_SHIPPING_REPORT_CSV_HEADER], ...rows.map(rowToColumns)]);
}

// 実際に RMS へアップロードする Shift-JIS エンコード済みバッファ。
export function buildShippingReportCsvBuffer(rows: readonly ShippingReportCsvRow[]): Buffer {
  return iconv.encode(buildShippingReportCsvText(rows), "Shift_JIS");
}

// ダウンロードファイル名。1日に複数回作られ得るため分秒まで含める。ASCIIのみ。
export function buildShippingReportCsvFilename(now: Date = new Date()): string {
  return `rms_shipping_report_${formatJstTimestampCompact(now)}.csv`;
}

// 追跡番号に Shift-JIS で表現できない文字(iconv-lite が単独の 0x3F "?" へ落とす文字)が
// 混ざっていないか確認する。クリックポストの追跡番号は12桁数字なので通常は空配列。
export function findUnsafeTrackingNumbers(
  rows: readonly ShippingReportCsvRow[]
): Array<{ orderNumber: string; trackingNumber: string }> {
  const unsafe: Array<{ orderNumber: string; trackingNumber: string }> = [];
  for (const row of rows) {
    const value = row.shippingTrackingNumber;
    const roundTrip = iconv.decode(iconv.encode(value, "Shift_JIS"), "Shift_JIS");
    if (roundTrip !== value) {
      unsafe.push({ orderNumber: row.orderNumber, trackingNumber: value });
    }
  }
  return unsafe;
}
