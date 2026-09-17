// 発送エントリー「作業メニュー」タブのセグメント表示ロジック(2026-09-10 発送ページ集約)。
// Claude Designモック「発送エントリー v2」の文言・判定をそのまま踏襲する
// (docs/design/shipping-page-2026-09-10/claude-design/発送エントリー v2.dc.html)。
// UIコンポーネント側は本ファイルの純粋関数だけを見ればよく、コピーを直接埋め込まない。

import { formatJstDateTime } from "@/lib/date";
import type { ShippingSegment, ShippingSegmentRowDTO } from "@/types/order";

export const SHIPPING_SEGMENT_ORDER: ShippingSegment[] = [
  "awaiting",
  "unprocessed",
  "inProgress",
  "done",
  "held",
  "excluded",
];

export const SHIPPING_SEGMENT_LABELS: Record<ShippingSegment, string> = {
  awaiting: "確認待ち",
  unprocessed: "未処理",
  inProgress: "作業中",
  done: "処理済み",
  held: "一時保存",
  excluded: "対象外",
};

const LIST_NOTE: Record<ShippingSegment, string> = {
  awaiting: "自動確認のあと未処理へ",
  unprocessed: "発送待ち × CSV未出力 × 一時保存でない",
  inProgress: "CSV出力済 · 追跡番号の反映待ち（直近7日）",
  done: "発送完了報告まで完了（直近7日）",
  held: "手動で退避 · 全件表示",
  excluded: "アプリでの処理が不要 · 全件表示",
};

const EMPTY_TEXT: Record<ShippingSegment, string> = {
  awaiting: "確認待ちの注文はありません",
  unprocessed: "未処理の注文はありません",
  inProgress: "作業中の注文はありません",
  done: "直近7日に処理済みの注文はありません",
  held: "一時保存中の注文はありません",
  excluded: "対象外の注文はありません",
};

const META_HEAD: Record<ShippingSegment, string> = {
  awaiting: "受注時刻",
  unprocessed: "受注時刻",
  inProgress: "CSV出力",
  done: "報告日時",
  held: "退避日時",
  excluded: "対象外日時",
};

export function getSegmentListNote(segment: ShippingSegment): string {
  return LIST_NOTE[segment];
}

export function getSegmentEmptyText(segment: ShippingSegment): string {
  return EMPTY_TEXT[segment];
}

export function getSegmentMetaHeadLabel(segment: ShippingSegment): string {
  return META_HEAD[segment];
}

// 一覧行の右端に出す日時列。セグメントごとに意味が違う一次ソースを見る。
export function getSegmentRowMetaValue(
  segment: ShippingSegment,
  row: ShippingSegmentRowDTO
): string {
  const iso =
    segment === "inProgress"
      ? row.csvExportedAt
      : segment === "done"
        ? row.shippingReportedAt
        : segment === "held"
          ? row.heldAt
          : segment === "excluded"
            ? row.excludedAt
            : row.orderedAt;
  return iso ? formatJstDateTime(iso) : "—";
}

export function formatOrderAddress(row: {
  prefecture: string | null;
  address1: string | null;
  address2: string | null;
}): string {
  return [row.prefecture, row.address1, row.address2].filter(Boolean).join("");
}

// 確認待ち・未処理の行だけ「一時保存にする」を出す(モックと同じ範囲)。
// held/inProgress/doneでは出さない(作業中・処理済みの注文を今から退避する意味がないため)。
export function canHoldInSegment(segment: ShippingSegment): boolean {
  return segment === "awaiting" || segment === "unprocessed";
}

// 確認待ち・未処理・作業中の行だけ「対象外にする」(ゴミ箱ボタン)を出す(2026-09-15
// マスター指示)。done/held/excludedでは出さない(処理済み・すでに退避済みの注文を
// 今から対象外にする意味がないため)。
export function canExcludeInSegment(segment: ShippingSegment): boolean {
  return segment === "awaiting" || segment === "unprocessed" || segment === "inProgress";
}

export interface ShippingSegmentCopy {
  kicker: string;
  title: string;
  desc: string;
  ctaLabelBase: string;
  disabledReason: string;
  // trueの間はCTAを出さない(確認待ちは自動確認を待つだけで人の操作がないため)。
  actionable: boolean;
}

const COPY: Record<ShippingSegment, ShippingSegmentCopy> = {
  awaiting: {
    kicker: "情報のみ",
    title: "自動確認を待っています",
    desc: "受注直後の注文です。自動確認が終わると「未処理」に移り、対象者CSVの対象になります。操作は不要です。",
    ctaLabelBase: "操作はありません",
    disabledReason: "自動確認の完了を待ってください",
    actionable: false,
  },
  unprocessed: {
    kicker: "STEP 1 · 対象者CSV",
    title: "対象者CSVを作成",
    desc: "GoQSystemへ読み込ませ、一括申込・一括決済・一括印刷を行います。一時保存の行は除外されます。",
    ctaLabelBase: "対象者CSVを作成",
    disabledReason: "未処理の注文がありません",
    actionable: true,
  },
  inProgress: {
    kicker: "STEP 2 · 発送完了報告",
    title: "発送完了報告CSVを作成",
    desc: "クリックポストの追跡番号CSVを取り込み、発送日を添えて6列・Shift-JISで書き出します。",
    ctaLabelBase: "報告CSVをダウンロード",
    disabledReason: "追跡番号CSVを取り込んでください",
    actionable: true,
  },
  done: {
    kicker: "再作成",
    title: "処理済みからCSVを作り直す",
    desc: "報告まで終わった注文です。控えが必要になったときのために一覧を残しています。",
    ctaLabelBase: "CSVを再作成",
    disabledReason: "直近7日に処理済みの注文がありません",
    actionable: true,
  },
  held: {
    kicker: "待機中",
    title: "一時保存から戻す",
    desc: "手動で退避した注文です。自動では戻りません。処理できる状態になったら未処理へ戻してください。",
    ctaLabelBase: "未処理へ戻す",
    disabledReason: "一時保存中の注文がありません",
    actionable: true,
  },
  excluded: {
    kicker: "対象外",
    title: "対象外から戻す",
    desc: "アプリでの処理が不要になったとして手動で外した注文です。自動では戻りません。もう一度アプリで扱いたい場合は戻してください。",
    ctaLabelBase: "対象外から戻す",
    disabledReason: "対象外の注文がありません",
    actionable: true,
  },
};

export function getSegmentCopy(segment: ShippingSegment): ShippingSegmentCopy {
  return COPY[segment];
}
