import { NextResponse } from "next/server";

import { orderService } from "@/server/order/order.service";

// 発送エントリー画面の「本日のCSV出力実績」表示用。個人情報は一切含まない
// (件数と日時のみ)。
export async function GET() {
  const summary = await orderService.getTodayCsvExportSummary();
  return NextResponse.json(summary);
}
