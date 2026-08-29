"use client";

import { FileDown } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  CLICKPOST_CSV_UNMAPPABLE_HEADER,
  type ClickPostCsvUnmappableReport,
} from "@/types/clickpost-csv";

// ClickPostの「まとめ申込」画面へそのままドラッグ&ドロップできるCSV(Shift_JIS)を
// 生成してダウンロードするだけのボタン。まとめ申込〜支払手続きまで自動で行う
// 自動化(AutomationCard)とは独立した、開発途中の暫定的な手作業補助。
export function CreateCsvButton({
  selectedOrderNumbers,
  onUnmappableReport,
}: {
  // 未指定・空の場合は現在発送待ちの注文者全員(上限40件)が対象になる。
  selectedOrderNumbers?: ReadonlySet<string>;
  // CSV作成のたびに呼ばれる。表現できない文字が残った注文の一覧(無ければ空配列)。
  // 呼び出し側で画面上部のバナー表示・クリアに使う。
  onUnmappableReport?: (report: ClickPostCsvUnmappableReport) => void;
} = {}) {
  const [isCreating, setIsCreating] = useState(false);

  // レスポンスヘッダーから「表現できない文字が残った注文」を取り出して親へ渡す。
  // ヘッダーが無ければ空配列を渡し、前回のバナーをクリアさせる。
  function reportUnmappable(response: Response) {
    if (!onUnmappableReport) return;

    const raw = response.headers.get(CLICKPOST_CSV_UNMAPPABLE_HEADER);
    if (!raw) {
      onUnmappableReport([]);
      return;
    }

    try {
      const report = JSON.parse(decodeURIComponent(raw)) as ClickPostCsvUnmappableReport;
      onUnmappableReport(report);
      if (report.length > 0) {
        toast.warning(
          `${report.length}件の注文に、CSVで表現できない文字が残っています。画面上部の案内をご確認ください`
        );
      }
    } catch {
      // ヘッダーが壊れていてもCSV本体は正常にダウンロード済みなので、通知だけ諦める。
    }
  }

  async function handleCreateCsv() {
    setIsCreating(true);
    try {
      const params = new URLSearchParams();
      if (selectedOrderNumbers && selectedOrderNumbers.size > 0) {
        params.set("orderNumbers", Array.from(selectedOrderNumbers).join(","));
      }
      const query = params.toString();
      const response = await fetch(`/api/clickpost/csv-export${query ? `?${query}` : ""}`);

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        toast.error(body?.error ?? "CSVの作成に失敗しました");
        return;
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

      reportUnmappable(response);

      toast.success(`CSVを作成しました(${orderCount}件)`, { description: filename });
      if (skippedCount > 0) {
        toast.warning(`${skippedCount}件は住所・郵便番号の不備のため除外されました`);
      }
      if (exceedsUploadLimit) {
        toast.warning("ClickPostの1回のアップロード上限(40件)を超えています。分割してアップロードしてください");
      }
    } catch {
      toast.error("CSVの作成に失敗しました");
    } finally {
      setIsCreating(false);
    }
  }

  const hasSelection = (selectedOrderNumbers?.size ?? 0) > 0;

  return (
    <Button size="sm" variant="outline" onClick={handleCreateCsv} disabled={isCreating}>
      <FileDown />
      {hasSelection ? `CSVを作成(選択${selectedOrderNumbers!.size}件)` : "CSVを作成"}
    </Button>
  );
}
