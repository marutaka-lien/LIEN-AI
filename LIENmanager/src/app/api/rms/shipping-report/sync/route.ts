import { NextResponse } from "next/server";

import { createDefaultRmsService } from "@/server/integrations/rms/rms-service";
import { orderRepository } from "@/server/order/order.repository";
import type { ShippingReportSyncResultDTO } from "@/types/shipping-report";

// 「発送待ち注文を最新化」ボタン用。RMS から発送待ち注文を取得して DB へ反映し、
// 反映後の変換対象(発送待ち×未出力)件数を返す。
// 一覧を返す GET /api/orders は同期をバックグラウンドに投げるが、この画面では
// 「変換の直前に最新化できたか」を人が確実に確認したいので、ここでは同期の完了を待つ。
export async function POST() {
  const errors: string[] = [];
  try {
    const result = await createDefaultRmsService().fetchPendingOrders();
    for (const error of result.errors) {
      errors.push(error.orderNumber ? `${error.orderNumber}: ${error.message}` : error.message);
    }
  } catch (error) {
    errors.push(error instanceof Error ? error.message : "RMSとの同期に失敗しました");
  }

  const targets = await orderRepository.findShippingReportTargetOrders();
  const body: ShippingReportSyncResultDTO = {
    syncedAt: new Date().toISOString(),
    targetOrderCount: targets.length,
    errors,
  };
  return NextResponse.json(body);
}
