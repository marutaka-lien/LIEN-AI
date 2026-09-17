import { readFile } from "node:fs/promises";
import path from "node:path";

// 週次販売実績(プロジェクトB)の記録を読み込む。マスターがRMS画面から取得した数字を
// 手作業でBusinessData/sales/週次販売実績.csvへ追記していく運用のため、ここでは
// そのCSVをそのまま読むだけで、自動集計・推測による補完は行わない。
// リポジトリ直下のBusinessDataはLIENmanagerの1つ上の階層にある(モノレポ構成)。

export interface WeeklySalesRecord {
  periodStart: string;
  periodEnd: string;
  salesYen: number;
  orders: number;
  qty: number;
  avgOrderYen: number;
  avgQty: number;
  recordedAt: string;
  note: string;
}

const CSV_PATH = path.join(process.cwd(), "..", "BusinessData", "sales", "週次販売実績.csv");

// CSVテキスト → レコード配列の変換のみを担う純粋関数(単体テスト用に分離)。
export function parseWeeklySalesCsv(raw: string): WeeklySalesRecord[] {
  const lines = raw
    .replace(/^﻿/, "")
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0);

  // 1行目はヘッダー。
  const records: WeeklySalesRecord[] = [];
  for (const line of lines.slice(1)) {
    const cols = line.split(",");
    if (cols.length < 9) continue;
    const [
      periodStart,
      periodEnd,
      salesYen,
      orders,
      qty,
      avgOrderYen,
      avgQty,
      recordedAt,
      ...noteParts
    ] = cols;

    records.push({
      periodStart,
      periodEnd,
      salesYen: Number(salesYen),
      orders: Number(orders),
      qty: Number(qty),
      avgOrderYen: Number(avgOrderYen),
      avgQty: Number(avgQty),
      recordedAt,
      note: noteParts.join(","),
    });
  }

  // CSVは記録順(古い順)のため、期間開始日でも並べ替えて安定させる。
  return records.sort((a, b) => a.periodStart.localeCompare(b.periodStart));
}

export async function listWeeklySales(): Promise<WeeklySalesRecord[]> {
  let raw: string;
  try {
    raw = await readFile(CSV_PATH, "utf-8");
  } catch {
    return [];
  }

  return parseWeeklySalesCsv(raw);
}
