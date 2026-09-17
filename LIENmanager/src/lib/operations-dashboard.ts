// ダッシュボード「今日のオペレーション」(C案)の純粋な導出ロジック。
// 新しいAPI/DTOは必要とせず、既存のリポジトリ結果だけを引数に取る純粋関数群。
// UI(サーバーコンポーネント)からも Vitest からも同じものを使う。

const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

/** Date を日本時間の "HH:MM" 文字列にする。 */
export function formatJstHm(date: Date): string {
  const jst = new Date(date.getTime() + JST_OFFSET_MS);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${pad(jst.getUTCHours())}:${pad(jst.getUTCMinutes())}`;
}

export type PipelineStageKey = "confirm" | "await_ship" | "csv_exported" | "shipped";

export interface PipelineStage {
  key: PipelineStageKey;
  label: string;
  count: number;
  /** 滞留（この段だけ強調）か。 */
  bottleneck: boolean;
}

/**
 * 出荷パイプライン4段の件数から表示用の段リストを作る。
 * 途中2段（受注確認・発送待ち）のうち、件数が最大でかつ 0 でない段を「滞留」として1つだけ強調する。
 */
export function buildPipelineStages(counts: {
  awaitingConfirm: number;
  pendingShip: number;
  csvExported: number;
  shippedToday: number;
}): PipelineStage[] {
  const middle = [
    { key: "confirm" as const, label: "受注確認", count: counts.awaitingConfirm },
    { key: "await_ship" as const, label: "発送待ち", count: counts.pendingShip },
  ];
  const bottleneckCount = Math.max(...middle.map((stage) => stage.count));
  const bottleneckKey =
    bottleneckCount > 0 ? middle.find((stage) => stage.count === bottleneckCount)?.key ?? null : null;

  return [
    ...middle.map((stage) => ({ ...stage, bottleneck: stage.key === bottleneckKey })),
    { key: "csv_exported" as const, label: "CSV出力済", count: counts.csvExported, bottleneck: false },
    { key: "shipped" as const, label: "発送完了", count: counts.shippedToday, bottleneck: false },
  ];
}

export interface OperationAlert {
  key: string;
  label: string;
  count: number;
  href: string;
}

/**
 * 「要確認事項」パネルの中身。捏造しない方針のため、いま実データで確実に言えるものだけを出す。
 * - 注文確認待ち(100)の注文が残っている
 * さらなるソース（CSV文字化け・住所不備・同一宛先の複数注文 など）の集約は別タスク
 * (Gram/課題_RMS同期失敗の可視化_2026-09-09.md の隣で扱う)。
 */
export function deriveOperationAlerts(input: { awaitingConfirm: number }): OperationAlert[] {
  const alerts: OperationAlert[] = [];
  if (input.awaitingConfirm > 0) {
    alerts.push({
      key: "awaiting_confirm",
      label: "注文確認待ちの注文があります",
      count: input.awaitingConfirm,
      href: "/automation",
    });
  }
  return alerts;
}
