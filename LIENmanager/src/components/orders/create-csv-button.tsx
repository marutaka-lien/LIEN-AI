"use client";

import { FileDown } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { createClickPostCsv } from "@/features/orders/create-csv";
import type { ClickPostCsvUnmappableReport } from "@/types/clickpost-csv";

// ClickPostの「まとめ申込」画面へそのままドラッグ&ドロップできるCSV(Shift_JIS)を
// 生成してダウンロードするだけのボタン。まとめ申込〜支払手続きまで自動で行う
// 自動化(AutomationCard)とは独立した、開発途中の暫定的な手作業補助。
// 実処理は features/orders/create-csv.ts(発送エントリー「作業メニュー」タブとも共有)。
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

  async function handleCreateCsv() {
    setIsCreating(true);
    try {
      const result = await createClickPostCsv(selectedOrderNumbers);
      if (result.ok) onUnmappableReport?.(result.unmappable);
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
