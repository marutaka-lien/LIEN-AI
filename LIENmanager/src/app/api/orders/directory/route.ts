import { NextResponse } from "next/server";

import { orderService } from "@/server/order/order.service";

// 発送エントリー「注文者情報一覧」タブ用。全ステータス・全期間を検索/絞り込み/
// 並べ替え/ページ送りできる一覧。/api/ordersのようなRMS同期起動は行わない
// (一覧側の役割は過去含めた検索であり、同期は/api/ordersや発送エントリー他タブに任せる)。
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search") ?? undefined;
  const status = searchParams.get("status") ?? undefined;
  const sortParam = searchParams.get("sort");
  const sort = sortParam === "orderedAtAsc" ? "orderedAtAsc" : "orderedAtDesc";
  const page = Math.max(1, Number(searchParams.get("page") ?? "1") || 1);

  const result = await orderService.listOrderDirectory({ search, status, sort, page });
  return NextResponse.json(result);
}
