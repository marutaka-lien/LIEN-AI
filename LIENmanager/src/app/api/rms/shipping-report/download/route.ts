import { NextResponse } from "next/server";

import {
  isValidShippingDate,
  shippingReportService,
} from "@/server/integrations/rms-shipping-report/shipping-report-service";

// プレビューで確認した内容をCSV(6列・Shift-JIS)としてダウンロードさせ、実際に
// 含めた注文へ shippingReportedAt を記録する(二度流し防止)。
// excludeOrderNumbers: プレビューでチェックを外した注文番号(カンマ区切り)。
export async function POST(request: Request) {
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json(
      { error: "multipart/form-data で送ってください" },
      { status: 400 }
    );
  }

  const file = formData.get("file");
  const shippingDate = String(formData.get("shippingDate") ?? "");
  const excludeOrderNumbers = String(formData.get("excludeOrderNumbers") ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter((value) => value.length > 0);

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
  const { csvBuffer, filename, preview, markedCount } = await shippingReportService.buildCsvAndMark(
    buffer,
    shippingDate,
    excludeOrderNumbers
  );

  if (csvBuffer.length === 0 || preview.classification.csvRows.length === 0) {
    return NextResponse.json(
      { error: "CSVに出力できる行がありません。プレビューの区分をご確認ください" },
      { status: 422 }
    );
  }

  return new NextResponse(new Uint8Array(csvBuffer), {
    headers: {
      "Content-Type": "text/csv; charset=Shift_JIS",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "X-Row-Count": String(preview.classification.csvRows.length),
      "X-Marked-Count": String(markedCount),
      "X-Exceeds-Row-Limit": String(preview.exceedsRowLimit),
    },
  });
}
