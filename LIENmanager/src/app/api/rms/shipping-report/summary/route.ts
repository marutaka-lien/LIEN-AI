import { NextResponse } from "next/server";

import { orderRepository } from "@/server/order/order.repository";
import type { ShippingReportSummaryDTO } from "@/types/shipping-report";

// 発送完了報告CSVの「本日の実績」表示用。個人情報は一切含まない(件数と日時のみ)。
export async function GET() {
  const { count, lastReportedAt } = await orderRepository.getTodayShippingReportSummary();
  const body: ShippingReportSummaryDTO = {
    count,
    lastReportedAt: lastReportedAt ? lastReportedAt.toISOString() : null,
  };
  return NextResponse.json(body);
}
