import { NextResponse } from "next/server";

import { createDefaultClickPostService } from "@/server/integrations/clickpost/clickpost-service";
import { createDefaultRmsService } from "@/server/integrations/rms/rms-service";
import { orderRepository } from "@/server/order/order.repository";

// ClickPostマイページの発送履歴から追跡番号を取得し、RMSのupdateOrderShippingへ
// 反映する(Order.rmsShippingReflectedAtが未実装だった導線を繋ぐ)。
// deliveryCompanyはRMS固有のコード値(非公開ドキュメント依存)のため、
// 呼び出し側に明示させる(このルート内で推測値をハードコードしない)。
export async function POST(request: Request) {
  const raw = await request.json().catch(() => null);
  const orderNumber = typeof raw?.orderNumber === "string" ? raw.orderNumber : undefined;
  const deliveryCompany = typeof raw?.deliveryCompany === "string" ? raw.deliveryCompany : undefined;

  if (!orderNumber || !deliveryCompany) {
    return NextResponse.json(
      { error: "orderNumberとdeliveryCompanyは必須です" },
      { status: 400 }
    );
  }

  const order = await orderRepository.findByChannelAndOrderNumber("rakuten", orderNumber);
  if (!order) {
    return NextResponse.json({ error: "対象注文がローカルDBに見つかりません" }, { status: 404 });
  }

  const clickPostService = createDefaultClickPostService();
  const [trackingResult] = await clickPostService.fetchTrackingNumbers([order]);

  if (!trackingResult.trackingNumber) {
    return NextResponse.json({
      orderNumber,
      trackingNumber: null,
      reflected: false,
      message: "ClickPostマイページの発送履歴から追跡番号を取得できませんでした",
    });
  }

  const rmsService = createDefaultRmsService();
  const reflectResult = await rmsService.reflectTrackingNumber(orderNumber, {
    trackingNumber: trackingResult.trackingNumber,
    deliveryCompany,
  });

  // RMSへのAPI反映が成功したか否かによらず、ClickPostから取得できた追跡番号自体は
  // 保存する(API反映が未実装/未成功の間は、UI上でコピーして手動でRMSへ入力する運用のため)。
  await orderRepository.updateTrackingInfo(order.id, {
    trackingNumber: trackingResult.trackingNumber,
    ...(reflectResult.success ? { rmsShippingReflectedAt: new Date() } : {}),
  });

  return NextResponse.json({
    orderNumber,
    trackingNumber: trackingResult.trackingNumber,
    reflected: reflectResult.success,
    message: reflectResult.message,
  });
}
