import { NextResponse } from "next/server";

import {
  isValidShippingDate,
  shippingReportService,
} from "@/server/integrations/rms-shipping-report/shipping-report-service";
import type { ShippingReportPreviewDTO } from "@/types/shipping-report";

// クリックポストの追跡番号CSVを受け取り、変換対象(発送待ち×未出力)の注文と宛先で
// 突き合わせた結果をプレビューとして返す。DBは一切変更しない。
// 実際のCSVダウンロード・出力済み記録は /api/rms/shipping-report/download で行う。
export async function POST(request: Request) {
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json(
      { error: "multipart/form-data で file と shippingDate を送ってください" },
      { status: 400 }
    );
  }

  const file = formData.get("file");
  const shippingDate = String(formData.get("shippingDate") ?? "");

  if (!(file instanceof Blob) || file.size === 0) {
    return NextResponse.json({ error: "クリックポストのCSVファイルが必要です" }, { status: 400 });
  }
  if (!isValidShippingDate(shippingDate)) {
    return NextResponse.json(
      { error: "発送日は yyyy-mm-dd 形式で指定してください" },
      { status: 400 }
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const preview: ShippingReportPreviewDTO = await shippingReportService.preview(buffer, shippingDate);
  return NextResponse.json(preview);
}
