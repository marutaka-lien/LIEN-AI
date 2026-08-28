import { NextResponse } from "next/server";

import { buildClickPostCsvBuffer, buildClickPostCsvFilename } from "@/server/integrations/clickpost/clickpost-csv";
import { createClickPostService } from "@/server/integrations/clickpost/clickpost-service";
import { CLICKPOST_MAX_ITEMS_PER_BATCH } from "@/server/integrations/clickpost/clickpost-types";
import { orderRepository } from "@/server/order/order.repository";
import type { Order } from "@/generated/prisma/client";

// 「CSVを作成」ボタン専用: 発送待ち注文者情報をClickPost「まとめ申込」にそのまま
// ドラッグ&ドロップできるCSV(Shift_JIS)として即ダウンロードさせる。
// 自動化(まとめ申込〜支払手続き画面までのブラウザ操作)とは独立しており、
// ClickPostへのログイン・ブラウザ設定なしで使える(開発途中の暫定的な手作業補助)。
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const orderNumbersParam = searchParams.get("orderNumbers");

  let orders: Order[];

  if (orderNumbersParam) {
    const orderNumbers = orderNumbersParam
      .split(",")
      .map((value) => value.trim())
      .filter((value) => value.length > 0);

    if (orderNumbers.length === 0) {
      return NextResponse.json({ error: "orderNumbersが空です" }, { status: 400 });
    }

    const found: Order[] = [];
    const notFound: string[] = [];
    for (const orderNumber of orderNumbers) {
      const order = await orderRepository.findByChannelAndOrderNumber("rakuten", orderNumber);
      if (!order) {
        notFound.push(orderNumber);
        continue;
      }
      found.push(order);
    }

    if (notFound.length > 0) {
      return NextResponse.json(
        { error: "ローカルDBに見つからない注文があります", notFound },
        { status: 404 }
      );
    }

    orders = found;
  } else {
    // 全件出力(orderNumbers未指定)は状態ベースの対象判定を使う: orderStatus=300 かつ
    // csvExportedAtが未設定の注文のみ(受注日には依存しない、2026-08-25経営判断)。
    // 選択実行(orderNumbers指定あり)の場合はこの絞り込みを経由しない=既に出力済みの
    // 注文でも明示的に選び直せば再出力できる(csvExportedAtが未実装のリセット機能を兼ねる)。
    orders = await orderRepository.findCsvExportTargetOrders();
  }

  if (orders.length === 0) {
    return NextResponse.json({ error: "対象の注文がありません" }, { status: 400 });
  }

  // dryRunMapOrdersはCSV変換のみ行い、ClickPostへは一切アクセスしないため
  // browserClient(ログイン設定)なしで安全に呼び出せる。
  const dryRun = createClickPostService().dryRunMapOrders(orders);

  if (dryRun.rows.length === 0) {
    return NextResponse.json(
      { error: "住所・郵便番号などの不備によりCSV化できる注文がありません", details: dryRun.errors },
      { status: 422 }
    );
  }

  const buffer = buildClickPostCsvBuffer(dryRun.rows);
  const filename = buildClickPostCsvFilename();
  // 出力自体は絞らず、ClickPost側の1回のアップロード上限(40件)を超えているかどうかだけを
  // クライアントへ伝える(超えている場合は手元でファイルを分割してアップロードする想定)。
  const exceedsUploadLimit = dryRun.mappableCount > CLICKPOST_MAX_ITEMS_PER_BATCH;

  // 実際にCSVへ含められた(マッピングエラーで除外されなかった)注文だけへ、出力日時を記録する。
  // 除外された注文は次回また対象として拾われ、再挑戦できるようにするため記録しない。
  const unmappableOrderNumbers = new Set(dryRun.errors.map((error) => error.orderNumber));
  const exportedOrderIds = orders
    .filter((order) => !unmappableOrderNumbers.has(order.orderNumber))
    .map((order) => order.id);
  await orderRepository.markCsvExported(exportedOrderIds, new Date());

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "text/csv; charset=Shift_JIS",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "X-Order-Count": String(dryRun.mappableCount),
      "X-Skipped-Count": String(dryRun.unmappableCount),
      "X-Exceeds-Upload-Limit": String(exceedsUploadLimit),
    },
  });
}
