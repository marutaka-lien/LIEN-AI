"use client";

import { AlertTriangle, FileDown, RefreshCw, Truck } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useShippingReportSummary } from "@/features/orders/hooks/useShippingReportSummary";
import type {
  ShippingReportMatchedPair,
  ShippingReportPreviewDTO,
  ShippingReportSyncResultDTO,
} from "@/types/shipping-report";

// 発送日の既定値 = 日本時間の今日(yyyy-mm-dd)。
function todayInJst(): string {
  return new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Tokyo" });
}

function formatJstTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("ja-JP", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Tokyo",
  });
}

// クリックポストの「追跡番号入りCSV」を取り込み、RMS「発送完了報告データ」用の
// 6列CSV(Shift-JIS)へ変換してダウンロードするパネル。1画面完結。
// - 対象は「発送待ち × この仕組みで未出力」の注文のみ(サーバー側で絞り込み)。
// - 変換の前に「発送待ち注文を最新化」で必ずRMSと同期する。
// - 同一宛先に複数注文がある等の曖昧なケースは代表1件だけCSVへ出し、残りは画面表示のみ
//   (マスターがRMSで手入力)。手入力済みの行はプレビューでチェックを外す。
export function ShippingReportPanel() {
  const [file, setFile] = useState<File | null>(null);
  const [shippingDate, setShippingDate] = useState<string>(todayInJst());
  const [preview, setPreview] = useState<ShippingReportPreviewDTO | null>(null);
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const [isConverting, setIsConverting] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [sync, setSync] = useState<ShippingReportSyncResultDTO | null>(null);
  const { data: summary } = useShippingReportSummary();

  const includedRows = useMemo<ShippingReportMatchedPair[]>(() => {
    if (!preview) return [];
    return [...preview.classification.autoMatched, ...preview.classification.representative].sort(
      (a, b) => a.orderNumber.localeCompare(b.orderNumber)
    );
  }, [preview]);

  const outputCount = includedRows.filter((row) => !excluded.has(row.orderNumber)).length;

  async function handleSync() {
    setIsSyncing(true);
    try {
      const res = await fetch("/api/rms/shipping-report/sync", { method: "POST" });
      if (!res.ok) {
        toast.error("発送待ち注文の最新化に失敗しました");
        return;
      }
      const result: ShippingReportSyncResultDTO = await res.json();
      setSync(result);
      if (result.errors.length > 0) {
        toast.warning(`最新化しましたが、RMS側で${result.errors.length}件のエラーがありました`);
      } else {
        toast.success(`発送待ち注文を最新化しました(対象 ${result.targetOrderCount}件)`);
      }
    } catch {
      toast.error("発送待ち注文の最新化に失敗しました");
    } finally {
      setIsSyncing(false);
    }
  }

  async function handleConvert() {
    if (!file) {
      toast.error("クリックポストのCSVを選んでください");
      return;
    }
    setIsConverting(true);
    try {
      const form = new FormData();
      form.set("file", file);
      form.set("shippingDate", shippingDate);
      const res = await fetch("/api/rms/shipping-report/convert", { method: "POST", body: form });
      const body = await res.json();
      if (!res.ok) {
        toast.error(body?.error ?? "変換に失敗しました");
        return;
      }
      setPreview(body as ShippingReportPreviewDTO);
      setExcluded(new Set());
    } catch {
      toast.error("変換に失敗しました");
    } finally {
      setIsConverting(false);
    }
  }

  async function handleDownload() {
    if (!file || !preview) return;
    setIsDownloading(true);
    try {
      const form = new FormData();
      form.set("file", file);
      form.set("shippingDate", shippingDate);
      form.set("excludeOrderNumbers", Array.from(excluded).join(","));
      const res = await fetch("/api/rms/shipping-report/download", { method: "POST", body: form });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        toast.error(body?.error ?? "CSVのダウンロードに失敗しました");
        return;
      }
      const filenameMatch = res.headers.get("Content-Disposition")?.match(/filename="(.+)"/);
      const filename = filenameMatch?.[1] ?? "rms_shipping_report.csv";
      const rowCount = res.headers.get("X-Row-Count") ?? "0";

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      link.click();
      URL.revokeObjectURL(url);

      toast.success(`CSVを作成しました(${rowCount}行)`, {
        description: `${filename} を RMS「データアップロード(発送完了報告データ)」へアップロードしてください`,
      });
      setPreview(null);
      setExcluded(new Set());
    } catch {
      toast.error("CSVのダウンロードに失敗しました");
    } finally {
      setIsDownloading(false);
    }
  }

  function toggleExclude(orderNumber: string) {
    setExcluded((prev) => {
      const next = new Set(prev);
      if (next.has(orderNumber)) next.delete(orderNumber);
      else next.add(orderNumber);
      return next;
    });
  }

  const c = preview?.classification;

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-border-subtle bg-surface p-6">
      <div className="flex items-start gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Truck className="size-5" aria-hidden />
        </div>
        <div className="flex flex-col gap-1">
          <h2 className="text-base font-semibold">発送完了報告CSVを作る</h2>
          <p className="text-sm text-muted-foreground">
            クリックポストの「追跡番号入りCSV」を読み込み、RMSの「お荷物伝票番号」欄へ一括反映するためのCSV(6列・Shift-JIS)に変換します。対象は発送待ち・未出力の注文のみです。
          </p>
        </div>
      </div>

      {/* 手順1: 最新化 */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border-subtle bg-background p-4">
        <div className="flex flex-col gap-0.5 text-sm">
          <span className="font-medium">1. 発送待ち注文を最新化</span>
          <span className="text-xs text-muted-foreground">
            {sync
              ? `最終同期 ${formatJstTime(sync.syncedAt)}・変換対象 ${sync.targetOrderCount}件`
              : "変換の前に必ずRMSと同期してください(手入力済みの注文を対象から外すため)"}
          </span>
        </div>
        <Button size="sm" variant="outline" onClick={handleSync} disabled={isSyncing}>
          <RefreshCw className={isSyncing ? "animate-spin" : undefined} />
          最新化
        </Button>
      </div>

      {/* 手順2: 入力 */}
      <div className="flex flex-col gap-3 rounded-lg border border-border-subtle bg-background p-4">
        <span className="text-sm font-medium">2. クリックポストのCSVと発送日</span>
        <div className="flex flex-wrap items-center gap-4">
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={(event) => {
              setFile(event.target.files?.[0] ?? null);
              setPreview(null);
            }}
            className="text-sm file:mr-3 file:rounded-md file:border file:border-border file:bg-muted file:px-3 file:py-1.5 file:text-sm"
          />
          <label className="flex items-center gap-2 text-sm">
            発送日
            <input
              type="date"
              value={shippingDate}
              onChange={(event) => setShippingDate(event.target.value)}
              className="rounded-md border border-border bg-background px-2 py-1 text-sm"
            />
          </label>
          <Button size="sm" onClick={handleConvert} disabled={isConverting || !file}>
            変換
          </Button>
        </div>
      </div>

      {/* 手順3: プレビュー */}
      {c && (
        <div className="flex flex-col gap-3 rounded-lg border border-border-subtle bg-background p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-sm font-medium">3. 内容を確認してダウンロード</span>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Badge variant="outline">自動マッチ {c.autoMatched.length}</Badge>
              <Badge variant="outline">代表のみ {c.representative.length}</Badge>
              <Badge variant="outline">要確認 {c.needsReview.length}</Badge>
              <Badge variant="outline">スキップ {c.skippedExpired.length}</Badge>
              <Badge variant="outline">
                未マッチ 注文{c.unmatchedOrders.length}・追跡{c.unmatchedTracking.length}
              </Badge>
            </div>
          </div>

          {preview?.headerWarning && (
            <p className="rounded-md border border-l-4 border-warning-border bg-warning-subtle p-3 text-xs text-warning-foreground">
              <AlertTriangle className="mr-1 inline size-3.5" aria-hidden />
              {preview.headerWarning}
            </p>
          )}
          {preview && preview.droppedRowNumbers.length > 0 && (
            <p className="text-xs text-muted-foreground">
              クリックポストCSVのうち {preview.droppedRowNumbers.length}行 は追跡番号か宛先が空のため無視しました(行 {preview.droppedRowNumbers.join(", ")})。
            </p>
          )}
          {preview && preview.unsafeTracking.length > 0 && (
            <p className="rounded-md border border-l-4 border-warning-border bg-warning-subtle p-3 text-xs text-warning-foreground">
              <AlertTriangle className="mr-1 inline size-3.5" aria-hidden />
              追跡番号に文字コードで表現できない文字が混ざった行が {preview.unsafeTracking.length}件 あります。クリックポストCSVをご確認ください。
            </p>
          )}
          {preview?.exceedsRowLimit && (
            <p className="rounded-md border border-l-4 border-warning-border bg-warning-subtle p-3 text-xs text-warning-foreground">
              <AlertTriangle className="mr-1 inline size-3.5" aria-hidden />
              CSVの行数が1回のアップロード上限(5,000行)を超えています。ファイルを分割してアップロードしてください。
            </p>
          )}

          <p className="rounded-md border border-l-4 border-warning-border bg-warning-subtle p-2 text-xs text-warning-foreground">
            RMSで既に伝票番号を入れた注文が混じっていないか確認してください。手入力済みの行はチェックを外すとCSVに含まれません。
          </p>

          {/* 出力対象(自動マッチ + 代表)の行 */}
          {includedRows.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="text-muted-foreground">
                  <tr>
                    <th className="w-10 py-1">出力</th>
                    <th className="py-1">注文番号</th>
                    <th className="py-1">宛名</th>
                    <th className="py-1">追跡番号</th>
                    <th className="py-1">区分</th>
                  </tr>
                </thead>
                <tbody>
                  {includedRows.map((row) => {
                    const isRepresentative = preview!.classification.representative.some(
                      (r) => r.orderNumber === row.orderNumber
                    );
                    return (
                      <tr key={row.orderNumber} className="border-t border-border-subtle">
                        <td className="py-1.5">
                          <Checkbox
                            checked={!excluded.has(row.orderNumber)}
                            onCheckedChange={() => toggleExclude(row.orderNumber)}
                          />
                        </td>
                        <td className="py-1.5 font-mono">{row.orderNumber}</td>
                        <td className="py-1.5">{row.recipientName}</td>
                        <td className="py-1.5 font-mono">{row.trackingNumber}</td>
                        <td className="py-1.5 text-muted-foreground">
                          {isRepresentative ? "代表として1件のみ(要確認)" : "自動マッチ"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">CSVに出力できる行がありません。</p>
          )}

          {/* 人手が要る区分(表示のみ) */}
          {c.needsReview.length > 0 && (
            <details className="text-xs">
              <summary className="cursor-pointer font-medium">要確認 {c.needsReview.length}件(RMSで手入力)</summary>
              <ul className="mt-2 flex flex-col gap-1 pl-4">
                {c.needsReview.map((item, index) => (
                  <li key={`${item.orderNumber ?? "x"}-${index}`} className="text-muted-foreground">
                    {item.orderNumber ? <span className="font-mono">{item.orderNumber}</span> : "(注文番号なし)"}
                    {" / "}
                    {item.recipientName}
                    {item.trackingNumber ? ` / ${item.trackingNumber}` : ""}
                    {" — "}
                    {item.reason === "multiple-packages"
                      ? "複数の送付先がある可能性"
                      : "同じ宛先に複数の注文/追跡番号"}
                  </li>
                ))}
              </ul>
            </details>
          )}
          {c.skippedExpired.length > 0 && (
            <details className="text-xs">
              <summary className="cursor-pointer font-medium">スキップ {c.skippedExpired.length}件(注文日から180日超)</summary>
              <ul className="mt-2 flex flex-col gap-1 pl-4">
                {c.skippedExpired.map((item) => (
                  <li key={item.orderNumber} className="text-muted-foreground">
                    <span className="font-mono">{item.orderNumber}</span> / {item.recipientName}
                    {item.orderedOn ? ` / 注文日 ${item.orderedOn}` : ""}
                  </li>
                ))}
              </ul>
            </details>
          )}
          {(c.unmatchedOrders.length > 0 || c.unmatchedTracking.length > 0) && (
            <details className="text-xs">
              <summary className="cursor-pointer font-medium">
                未マッチ 注文{c.unmatchedOrders.length}件 / 追跡番号{c.unmatchedTracking.length}件
              </summary>
              <div className="mt-2 flex flex-col gap-2 pl-4 text-muted-foreground">
                {c.unmatchedOrders.length > 0 && (
                  <div>
                    <span className="font-medium">対応する追跡番号が見つからない注文:</span>
                    <ul className="flex flex-col gap-0.5">
                      {c.unmatchedOrders.map((item) => (
                        <li key={item.orderNumber}>
                          <span className="font-mono">{item.orderNumber}</span> / {item.recipientName}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {c.unmatchedTracking.length > 0 && (
                  <div>
                    <span className="font-medium">対応する注文が見つからない追跡番号:</span>
                    <ul className="flex flex-col gap-0.5">
                      {c.unmatchedTracking.map((item) => (
                        <li key={`${item.trackingNumber}-${item.sourceRowNumber}`}>
                          <span className="font-mono">{item.trackingNumber}</span> / {item.recipientName}(CSV {item.sourceRowNumber}行目)
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </details>
          )}

          <div className="flex items-center justify-end gap-3">
            <span className="text-xs text-muted-foreground">CSVに出力: {outputCount}行</span>
            <Button size="sm" onClick={handleDownload} disabled={isDownloading || outputCount === 0}>
              <FileDown />
              ダウンロード
            </Button>
          </div>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        {summary === null
          ? "本日の実績を読み込み中..."
          : summary.count === 0
            ? "本日はまだ発送完了報告CSVを作成していません。"
            : `本日の発送完了報告CSV: ${summary.count}件(最終 ${formatJstTime(summary.lastReportedAt!)})`}
      </p>
    </div>
  );
}
