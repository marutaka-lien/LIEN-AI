import { NextResponse } from "next/server";

import { orderService } from "@/server/order/order.service";
import { createDefaultRmsService } from "@/server/integrations/rms/rms-service";
import type { ShippingSegment } from "@/types/order";

const VALID_SEGMENTS: ShippingSegment[] = [
  "awaiting",
  "unprocessed",
  "inProgress",
  "done",
  "held",
  "excluded",
];

function isShippingSegment(value: string | null): value is ShippingSegment {
  return value !== null && (VALID_SEGMENTS as string[]).includes(value);
}

// 発送エントリー「作業メニュー」タブ用。6セグメントすべての件数(フローバー表示)と、
// 選択中セグメントの一覧を1回で返す。旧/orders画面のuseOrderList({pendingOnly:true})が
// 担っていた「画面を開くたびRMSと同期する」役割をこのルートが引き継ぐ(2026-09-10
// 発送ページ集約でこの画面が唯一の常時ポーリング先になったため)。RMS側が失敗しても
// 一覧表示自体は止めない(/api/ordersと同じ方針)。
export async function GET(request: Request) {
  createDefaultRmsService()
    .fetchPendingOrders()
    .catch((error: unknown) => {
      console.error(
        "[api/orders/segments] RMSとの同期に失敗しました:",
        error instanceof Error ? error.message : "unknown error"
      );
    });

  const { searchParams } = new URL(request.url);
  const activeParam = searchParams.get("active");
  const active: ShippingSegment = isShippingSegment(activeParam) ? activeParam : "unprocessed";

  const segments = await orderService.getShippingSegments(active);
  return NextResponse.json(segments);
}
