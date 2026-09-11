"use client";

import { ArrowRight, FileDown, RefreshCw, TriangleAlert } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { getSegmentCopy } from "@/lib/shipping-segments";
import { useShippingReportSummary } from "@/features/orders/hooks/useShippingReportSummary";
import type {
  ShippingReportMatchedPair,
  ShippingReportPreviewDTO,
  ShippingReportSyncResultDTO,
} from "@/types/shipping-report";
import type { ShippingSegment } from "@/types/order";

// 発送日の既定値 = 日本時間の今日(yyyy-mm-dd)。
function todayInJst(): string {
  return new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Tokyo" });
}

export interface ShippingActionPanelProps {
  segment: ShippingSegment;
  targetCount: number;
  selectedCount: number;
  onCreateCsv: () => Promise<void> | void;
  isCreatingCsv: boolean;
  onHoldSelected: () => Promise<void> | void;
  onUnholdSelected: () => Promise<void> | void;
  isUpdatingHold: boolean;
  onReportDone: () => void;
}

// 発送エントリー「作業メニュー」の右アサイド、行動を促すアクション枠。
// セグメントごとに中身が変わる(Claude Design v2モック準拠)。
export function ShippingActionPanel({
  segment,
  targetCount,
  selectedCount,
  onCreateCsv,
  isCreatingCsv,
  onHoldSelected,
  onUnholdSelected,
  isUpdatingHold,
  onReportDone,
}: ShippingActionPanelProps) {
  const copy = getSegmentCopy(segment);
  const hasSelection = selectedCount > 0;
  const targetSource = hasSelection ? "選択した行" : "一覧の全件";
  const n = targetCount;

  return (
    <section className="flex flex-col gap-2.5 rounded-xl border border-primary-border bg-surface p-4">
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-semibold tracking-[0.14em] text-primary">
          {copy.kicker}
        </span>
        <span className="h-px flex-1 bg-border-subtle" aria-hidden />
      </div>
      <h3 className="text-[15px] font-semibold tracking-tight">{copy.title}</h3>
      <p className="text-[12.5px] text-text-secondary">{copy.desc}</p>

      {copy.actionable && (
        <div className="flex items-baseline gap-1.5">
          <span className="font-mono text-3xl font-semibold tabular-nums leading-none tracking-tight">
            {n}
          </span>
          <span className="text-xs text-muted-foreground">件が対象 · {targetSource}</span>
        </div>
      )}

      {segment === "unprocessed" && (
        <UnprocessedActions
          n={n}
          hasSelection={hasSelection}
          isCreatingCsv={isCreatingCsv}
          isUpdatingHold={isUpdatingHold}
          onCreateCsv={onCreateCsv}
          onHoldSelected={onHoldSelected}
        />
      )}

      {segment === "inProgress" && <InProgressActions onReportDone={onReportDone} />}

      {segment === "done" && (
        <button
          type="button"
          disabled
          className="flex h-10 w-full cursor-not-allowed items-center justify-center rounded-lg border border-border-strong text-[13.5px] font-semibold text-text-disabled"
        >
          {copy.ctaLabelBase}
        </button>
      )}
      {segment === "done" && (
        <p className="text-[11.5px] text-text-secondary">
          控えの再発行は今後の課題です。至急の場合はフライデーへご相談ください。
        </p>
      )}

      {segment === "held" && (
        <HeldActions
          n={n}
          hasSelection={hasSelection}
          isUpdatingHold={isUpdatingHold}
          isCreatingCsv={isCreatingCsv}
          onUnholdSelected={onUnholdSelected}
          onCreateCsv={onCreateCsv}
        />
      )}

      {!copy.actionable && (
        <p className="text-[11.5px] text-text-secondary">{copy.disabledReason}</p>
      )}
    </section>
  );
}

function UnprocessedActions({
  n,
  hasSelection,
  isCreatingCsv,
  isUpdatingHold,
  onCreateCsv,
  onHoldSelected,
}: {
  n: number;
  hasSelection: boolean;
  isCreatingCsv: boolean;
  isUpdatingHold: boolean;
  onCreateCsv: () => Promise<void> | void;
  onHoldSelected: () => Promise<void> | void;
}) {
  const enabled = n > 0 && !isCreatingCsv;
  return (
    <div className="flex flex-col gap-2">
      {enabled ? (
        <button
          type="button"
          onClick={() => onCreateCsv()}
          disabled={isCreatingCsv}
          className="flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-primary text-[13.5px] font-semibold text-primary-foreground hover:bg-primary-hover active:bg-primary-active disabled:opacity-60"
        >
          <FileDown className="size-4" aria-hidden />
          対象者CSVを作成{hasSelection ? `（選択${n}件）` : `（${n}件）`}
        </button>
      ) : (
        <button
          type="button"
          disabled
          className="flex h-10 w-full cursor-not-allowed items-center justify-center rounded-lg border border-border-strong text-[13.5px] font-semibold text-text-disabled"
        >
          対象者CSVを作成
        </button>
      )}
      {!enabled && n === 0 && (
        <p className="text-[11.5px] text-text-secondary">未処理の注文がありません</p>
      )}
      {hasSelection && (
        <button
          type="button"
          onClick={() => onHoldSelected()}
          disabled={isUpdatingHold}
          className="h-8 rounded-lg border border-border-strong text-xs text-text-secondary hover:bg-surface-hover hover:text-foreground disabled:opacity-60"
        >
          選択した行を一時保存にする
        </button>
      )}
      <div className="mt-1 flex items-center gap-2 border-t border-border-subtle pt-2.5 text-[11.5px] text-text-secondary">
        <ArrowRight className="size-3.5 shrink-0" aria-hidden />
        次: GoQSystemで 申込・決済・印刷
      </div>
    </div>
  );
}

function HeldActions({
  n,
  hasSelection,
  isUpdatingHold,
  isCreatingCsv,
  onUnholdSelected,
  onCreateCsv,
}: {
  n: number;
  hasSelection: boolean;
  isUpdatingHold: boolean;
  isCreatingCsv: boolean;
  onUnholdSelected: () => Promise<void> | void;
  onCreateCsv: () => Promise<void> | void;
}) {
  const enabled = n > 0 && !isUpdatingHold;
  return (
    <div className="flex flex-col gap-2">
      {enabled ? (
        <button
          type="button"
          onClick={() => onUnholdSelected()}
          className="flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-primary text-[13.5px] font-semibold text-primary-foreground hover:bg-primary-hover active:bg-primary-active disabled:opacity-60"
        >
          未処理へ戻す{hasSelection ? `（選択${n}件）` : `（${n}件）`}
        </button>
      ) : (
        <button
          type="button"
          disabled
          className="flex h-10 w-full cursor-not-allowed items-center justify-center rounded-lg border border-border-strong text-[13.5px] font-semibold text-text-disabled"
        >
          未処理へ戻す
        </button>
      )}
      {hasSelection && (
        <button
          type="button"
          onClick={() => onCreateCsv()}
          disabled={isCreatingCsv}
          className="h-8 rounded-lg border border-border-strong text-xs text-text-secondary hover:bg-surface-hover hover:text-foreground disabled:opacity-60"
        >
          選択した行でCSVを作成
        </button>
      )}
    </div>
  );
}

function InProgressActions({ onReportDone }: { onReportDone: () => void }) {
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
  const c = preview?.classification;

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
      toast.success(`発送待ち注文を最新化しました（対象 ${result.targetOrderCount}件）`);
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

      toast.success(`CSVを作成しました（${rowCount}行）`, {
        description: `${filename} を RMS「データアップロード（発送完了報告データ）」へアップロードしてください`,
      });
      setPreview(null);
      setExcluded(new Set());
      setFile(null);
      onReportDone();
    } catch {
      toast.error("CSVのダウンロードに失敗しました");
    } finally {
      setIsDownloading(false);
    }
  }

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleSync}
          disabled={isSyncing}
          className="flex h-8 items-center gap-1.5 rounded-lg border border-border-strong px-2.5 text-xs text-text-secondary hover:bg-surface-hover hover:text-foreground disabled:opacity-60"
        >
          <RefreshCw className={isSyncing ? "size-3.5 animate-spin" : "size-3.5"} aria-hidden />
          最新化
        </button>
        <span className="truncate text-[11px] text-text-secondary">
          {sync ? `対象 ${sync.targetOrderCount}件` : "先に最新化してください"}
        </span>
      </div>

      <label className="flex items-center gap-2 rounded-lg border border-border-strong px-2.5 py-1.5 text-xs">
        <input
          type="file"
          accept=".csv,text/csv"
          onChange={(event) => {
            setFile(event.target.files?.[0] ?? null);
            setPreview(null);
          }}
          className="min-w-0 flex-1 text-[11px] text-text-secondary file:mr-2 file:rounded-md file:border-0 file:bg-surface-elevated file:px-2 file:py-1 file:text-[11px]"
        />
      </label>
      <div className="flex items-center gap-2">
        <label className="flex items-center gap-1.5 text-xs text-text-secondary">
          発送日
          <input
            type="date"
            value={shippingDate}
            onChange={(event) => setShippingDate(event.target.value)}
            className="h-7 rounded-md border border-border-strong bg-transparent px-1.5 text-xs"
          />
        </label>
        <button
          type="button"
          onClick={handleConvert}
          disabled={isConverting || !file}
          className="h-7 flex-1 rounded-md border border-border-strong text-xs text-text-secondary hover:bg-surface-hover hover:text-foreground disabled:opacity-60"
        >
          変換
        </button>
      </div>

      {preview?.headerWarning && (
        <p className="flex items-start gap-1.5 rounded-md border border-warning-border bg-warning-subtle p-2 text-[11px] text-warning-foreground">
          <TriangleAlert className="mt-px size-3 shrink-0" aria-hidden />
          {preview.headerWarning}
        </p>
      )}

      {preview ? (
        <button
          type="button"
          onClick={handleDownload}
          disabled={isDownloading || outputCount === 0}
          className="flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-primary text-[13.5px] font-semibold text-primary-foreground hover:bg-primary-hover disabled:opacity-60"
        >
          <FileDown className="size-4" aria-hidden />
          報告CSVをダウンロード（{outputCount}件）
        </button>
      ) : (
        <button
          type="button"
          disabled
          className="flex h-10 w-full cursor-not-allowed items-center justify-center rounded-lg border border-border-strong text-[13.5px] font-semibold text-text-disabled"
        >
          追跡番号CSVを取り込んでください
        </button>
      )}

      {c && (
        <div className="flex flex-col gap-1 rounded-lg border border-border-subtle p-2.5">
          <div className="flex items-center justify-between text-[11.5px]">
            <span className="font-semibold">取込プレビュー</span>
            <span className="font-mono tabular-nums text-text-secondary">
              {includedRows.length + c.needsReview.length}件を読み込み
            </span>
          </div>
          <PreviewLine label="自動マッチ" value={c.autoMatched.length} dotClassName="bg-success-foreground" />
          <PreviewLine label="代表1件" value={c.representative.length} dotClassName="bg-status-skipped" />
          <PreviewLine
            label="要確認（氏名の表記差）"
            value={c.needsReview.length}
            dotClassName="bg-warning-foreground"
            tone="warning"
          />
          <PreviewLine
            label="未マッチ"
            value={c.unmatchedOrders.length + c.unmatchedTracking.length}
            dotClassName="bg-text-disabled"
            tone="muted"
          />
          <p className="pt-1 text-[10.5px] text-text-secondary">
            手入力済みの行はチェックを外して除外できます（二度流しは自動で防止）。
          </p>
        </div>
      )}

      <p className="text-[11px] text-text-secondary">
        {summary === null
          ? "本日の実績を読み込み中..."
          : summary.count === 0
            ? "本日はまだ発送完了報告CSVを作成していません。"
            : `本日: ${summary.count}件`}
      </p>
    </div>
  );
}

function PreviewLine({
  label,
  value,
  dotClassName,
  tone,
}: {
  label: string;
  value: number;
  dotClassName: string;
  tone?: "warning" | "muted";
}) {
  return (
    <div
      className={
        "flex items-center justify-between border-t border-border-subtle py-1 text-[12px] " +
        (tone === "warning" ? "text-warning-foreground" : tone === "muted" ? "text-text-secondary" : "")
      }
    >
      <span className="flex items-center gap-1.5">
        <span className={`size-1.5 rounded-full ${dotClassName}`} />
        {label}
      </span>
      <span className="font-mono tabular-nums">{value}</span>
    </div>
  );
}
