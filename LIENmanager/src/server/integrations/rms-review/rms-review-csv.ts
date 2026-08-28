import fs from "node:fs";

import iconv from "iconv-lite";

import { RmsReviewParseError } from "./rms-review-errors";

// 2026-08-06 実際にレビューチェックツールからダウンロードしたCSV(商品レビュー・
// ショップレビューとも)で確認済みの列構成。文字コードはShift_JIS。
const EXPECTED_HEADER = [
  "レビュータイプ",
  "商品名",
  "レビュー詳細URL",
  "評価",
  "投稿時間",
  "タイトル",
  "レビュー本文",
  "フラグ",
  "注文番号",
  "未対応フラグ",
];

export interface RmsReviewCsvRow {
  reviewType: string;
  productName: string;
  sourceUrl: string;
  rating: string;
  postedAt: string;
  title: string;
  body: string;
  flag: string;
  orderNumber: string;
  unhandledFlag: string;
}

// 引用符・カンマ・(引用符内の)改行を考慮した簡易CSVパーサー。レビュー本文には
// カンマ・改行が含まれ得るため単純な行分割では壊れる。プロジェクトにCSVパース
// ライブラリの依存がないため(clickpost-csv.tsも手組み)、ここでも手組みする。
function parseCsvText(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\r") {
      // \r\nの\rはここでは無視し、\nで行を確定する。
    } else if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }

  // 末尾に改行がない場合の最終フィールド・行を回収する。
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter((columns) => !(columns.length === 1 && columns[0] === ""));
}

export function parseReviewsCsv(buffer: Buffer): RmsReviewCsvRow[] {
  const text = iconv.decode(buffer, "Shift_JIS");
  const rows = parseCsvText(text);

  if (rows.length === 0) {
    return [];
  }

  const header = rows[0];
  const headerMatches = EXPECTED_HEADER.every((column, index) => header[index] === column);
  if (!headerMatches) {
    throw new RmsReviewParseError(
      `レビューCSVのヘッダー構成が想定と異なります(実際: ${JSON.stringify(header)})`
    );
  }

  return rows.slice(1).map((columns) => ({
    reviewType: columns[0] ?? "",
    productName: columns[1] ?? "",
    sourceUrl: columns[2] ?? "",
    rating: columns[3] ?? "",
    postedAt: columns[4] ?? "",
    title: columns[5] ?? "",
    body: columns[6] ?? "",
    flag: columns[7] ?? "",
    orderNumber: columns[8] ?? "",
    unhandledFlag: columns[9] ?? "",
  }));
}

export function readReviewsCsvFile(filePath: string): RmsReviewCsvRow[] {
  const buffer = fs.readFileSync(filePath);
  return parseReviewsCsv(buffer);
}
