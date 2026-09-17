import { toast } from "sonner";

import { CLICKPOST_CSV_UNMAPPABLE_HEADER, type ClickPostCsvUnmappableReport } from "@/types/clickpost-csv";

export interface CreateCsvResult {
  ok: boolean;
  unmappable: ClickPostCsvUnmappableReport;
}

// 「対象者CSVを作成」の実処理(フェッチ・ダウンロード・トースト通知)。CreateCsvButton
// (/orders注文者情報一覧タブ)と発送エントリー「作業メニュー」タブの両方から呼ぶため、
// ボタンのUIから切り離してある。
export async function createClickPostCsv(
  orderNumbers?: ReadonlySet<string> | readonly string[]
): Promise<CreateCsvResult> {
  const numbers = orderNumbers ? Array.from(orderNumbers) : [];
  const params = new URLSearchParams();
  if (numbers.length > 0) params.set("orderNumbers", numbers.join(","));
  const query = params.toString();

  try {
    const response = await fetch(`/api/clickpost/csv-export${query ? `?${query}` : ""}`);

    if (!response.ok) {
      const body = await response.json().catch(() => null);
      toast.error(body?.error ?? "CSVの作成に失敗しました");
      return { ok: false, unmappable: [] };
    }

    const filenameMatch = response.headers.get("Content-Disposition")?.match(/filename="(.+)"/);
    const filename = filenameMatch?.[1] ?? "clickpost_upload.csv";
    const orderCount = response.headers.get("X-Order-Count") ?? "0";
    const skippedCount = Number(response.headers.get("X-Skipped-Count") ?? "0");
    const exceedsUploadLimit = response.headers.get("X-Exceeds-Upload-Limit") === "true";

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);

    let unmappable: ClickPostCsvUnmappableReport = [];
    const raw = response.headers.get(CLICKPOST_CSV_UNMAPPABLE_HEADER);
    if (raw) {
      try {
        unmappable = JSON.parse(decodeURIComponent(raw)) as ClickPostCsvUnmappableReport;
      } catch {
        // ヘッダーが壊れていてもCSV本体は正常にダウンロード済みなので、通知だけ諦める。
      }
    }

    toast.success(`CSVを作成しました(${orderCount}件)`, { description: filename });
    if (unmappable.length > 0) {
      toast.warning(
        `${unmappable.length}件の注文に、CSVで表現できない文字が残っています。画面上部の案内をご確認ください`
      );
    }
    if (skippedCount > 0) {
      toast.warning(`${skippedCount}件は住所・郵便番号の不備のため除外されました`);
    }
    if (exceedsUploadLimit) {
      toast.warning("ClickPostの1回のアップロード上限(40件)を超えています。分割してアップロードしてください");
    }

    return { ok: true, unmappable };
  } catch {
    toast.error("CSVの作成に失敗しました");
    return { ok: false, unmappable: [] };
  }
}
