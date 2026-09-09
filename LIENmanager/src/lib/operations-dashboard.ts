// ダッシュボード「今日のオペレーション」(C案)の純粋な導出ロジック。
// 新しいAPI/DTOは必要とせず、既存のリポジトリ結果だけを引数に取る純粋関数群。
// UI(サーバーコンポーネント)からも Vitest からも同じものを使う。

const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

/** Date を日本時間の「時（0-23）」に変換する。 */
export function jstHour(date: Date): number {
  return new Date(date.getTime() + JST_OFFSET_MS).getUTCHours();
}

/** Date を日本時間の "HH:MM" 文字列にする。 */
export function formatJstHm(date: Date): string {
  const jst = new Date(date.getTime() + JST_OFFSET_MS);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${pad(jst.getUTCHours())}:${pad(jst.getUTCMinutes())}`;
}

export interface ThroughputSeries {
  /** X 軸に並ぶ時（例: [9,10,...,16]）。 */
  hours: number[];
  /** hours と同じ長さ。その時までの受注累計。 */
  orderedCumulative: number[];
  /** hours と同じ長さ。その時までの発送完了累計。 */
  shippedCumulative: number[];
  /** グラフ Y 軸の上限（きりのよい値）。 */
  yMax: number;
  /** 描画すべきデータがあるか（無ければ空状態を出す）。 */
  hasData: boolean;
}

/**
 * 今日(JST)の受注時刻・発送完了時刻の一覧から、時間帯別の累計系列を作る。
 * - startHour〜endHour の各時について「その時の終わりまでの累計」を出す。
 * - まだ来ていない時（現在時より後）は描かない。
 * - 2026-09-09 マスター決定により、集計テーブルは追加せず既存 Date 列だけで算出する。
 */
export function buildThroughputSeries(
  orderedAt: Date[],
  shippedAt: Date[],
  options: { startHour?: number; endHour?: number; now?: Date } = {}
): ThroughputSeries {
  const startHour = options.startHour ?? 9;
  const endHour = options.endHour ?? 16;
  const now = options.now ?? new Date();
  const currentHour = jstHour(now);

  const lastHour = Math.min(endHour, currentHour);
  if (lastHour < startHour) {
    return {
      hours: [],
      orderedCumulative: [],
      shippedCumulative: [],
      yMax: 10,
      hasData: false,
    };
  }

  const hours: number[] = [];
  for (let h = startHour; h <= lastHour; h += 1) hours.push(h);

  const orderedHours = orderedAt.map(jstHour);
  const shippedHours = shippedAt.map(jstHour);
  const countUpTo = (values: number[], hour: number) =>
    values.reduce((acc, value) => acc + (value <= hour ? 1 : 0), 0);

  const orderedCumulative = hours.map((h) => countUpTo(orderedHours, h));
  const shippedCumulative = hours.map((h) => countUpTo(shippedHours, h));

  const peak = Math.max(0, ...orderedCumulative, ...shippedCumulative);
  const yMax = niceCeiling(Math.max(1, peak));
  const hasData = peak > 0;

  return { hours, orderedCumulative, shippedCumulative, yMax, hasData };
}

/** 値を少し上に丸めて、グラフ Y 軸の上限として使えるきりのよい数にする。 */
export function niceCeiling(value: number): number {
  if (value <= 10) return 10;
  const step = value <= 50 ? 5 : value <= 200 ? 10 : 50;
  return Math.ceil(value / step) * step + step;
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
