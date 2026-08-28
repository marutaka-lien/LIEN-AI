import iconv from "iconv-lite";

import { formatJstTimestampCompact } from "@/lib/date";
import { CLICKPOST_CSV_HEADER, type ClickPostCsvRow } from "./clickpost-types";

// クリックポストが受け付ける文字コードはShift_JISのみ(2026-07-22調査で複数の情報源から確認)。
// UTF-8で保存するとファイル全体が文字化けするため、実登録時は必ずこのエンコードを使うこと。

function escapeCsvField(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function rowToLine(row: ClickPostCsvRow): string {
  return [
    row.postalCode,
    row.recipientName,
    row.honorific,
    row.addressLine1,
    row.addressLine2,
    row.addressLine3,
    row.addressLine4,
    row.contents,
  ]
    .map(escapeCsvField)
    .join(",");
}

// UTF-8の文字列としてCSVを組み立てる(Dry Run時のプレビュー・テスト用)。
export function buildClickPostCsvText(rows: ClickPostCsvRow[]): string {
  const lines = [CLICKPOST_CSV_HEADER.join(","), ...rows.map(rowToLine)];
  return lines.join("\r\n");
}

// 実際にクリックポストへアップロードする際に使用するShift-JISエンコード済みバッファ。
export function buildClickPostCsvBuffer(rows: ClickPostCsvRow[]): Buffer {
  const text = buildClickPostCsvText(rows);
  return iconv.encode(text, "Shift_JIS");
}

// 手動作成CSV(注文者情報CSVを作成ボタン)用のファイル名。1日に何度も作成され得るため、
// 分・秒まで含めて一意にする。Content-Dispositionヘッダーに載せるためASCII文字のみ使う。
export function buildClickPostCsvFilename(now: Date = new Date()): string {
  return `clickpost_upload_${formatJstTimestampCompact(now)}.csv`;
}
