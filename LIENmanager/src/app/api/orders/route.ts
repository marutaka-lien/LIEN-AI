import { NextResponse } from "next/server";

import { orderService } from "@/server/order/order.service";
import { createDefaultRmsService } from "@/server/integrations/rms/rms-service";

// ページの読み込み(リロード・自動ポーリングとも)のたびにRMSへ最新状態を問い合わせ、
// ローカルDBへ反映する。RMSへの同期(searchOrder/getOrderのネットワーク往復)を待つと
// 表示が数秒遅れるため、一覧の取得はDBから即座に返し、同期はバックグラウンドで進める
// (次回の読み込み・10分毎の自動ポーリングで結果が反映される)。RMS側が失敗しても
// 一覧表示自体は止めない。
export async function GET(request: Request) {
  createDefaultRmsService()
    .fetchPendingOrders()
    .catch((error: unknown) => {
      console.error(
        "[api/orders] RMSとの同期に失敗しました:",
        error instanceof Error ? error.message : "unknown error"
      );
    });

  const { searchParams } = new URL(request.url);
  const orders = await orderService.listOrders(undefined, {
    todayOnly: searchParams.get("todayOnly") === "true",
    pendingOnly: searchParams.get("pendingOnly") === "true",
  });
  return NextResponse.json({ orders });
}
