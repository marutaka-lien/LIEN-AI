import { NextResponse } from "next/server";

import { createDefaultRmsItemService } from "@/server/integrations/rms/rms-item-service";

// 商品管理「商品一覧」タブ用。RMS商品API 2.0(items.search)から実商品データを取得する。
// 在庫・売上・購入率・評価は商品APIに含まれないため、ここでは返さない
// (Product型側でnull=「－」表示として扱う)。DBへの保存は行わない(都度RMSへ問い合わせる)。
export async function GET() {
  try {
    const service = createDefaultRmsItemService();
    const result = await service.listProducts();
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "unknown error" },
      { status: 500 }
    );
  }
}
