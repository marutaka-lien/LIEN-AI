// 注文の共通型。特定モール(RMS/Yahoo/Amazon等)固有の型はここに含めない。
// 外部連携(src/server/integrations/*)は必ずこの型へ変換してからRepositoryへ渡すこと。

export interface OrderDTO {
  id: string;
  channel: string;
  orderNumber: string;
  ordererName: string;
  recipientName: string | null;
  postalCode: string | null;
  prefecture: string | null;
  address1: string | null;
  address2: string | null;
  phoneNumber: string | null;
  email: string | null;
  shippingMethod: string | null;
  orderStatus: string | null;
  orderedAt: string | null;
  totalPrice: number | null;
  paymentMethod: string | null;
  // RMSへ反映済み(rmsShippingReflectedAtがある)の場合のみ値を持つ。
  // 未反映の間はRMS側の実際の状態と一致させるためnullのまま扱うこと。
  trackingNumber: string | null;
  rmsShippingReflectedAt: string | null;
  // ClickPostへの「まとめ申込〜支払手続き画面到達」が成功した日時。未登録の間はnull。
  clickPostRegisteredAt: string | null;
  // 「注文者CSVを作成」でCSVに含めて出力した日時。未出力の間はnull。
  csvExportedAt: string | null;
  // クリックポスト追跡番号CSVを取り込み、RMS発送完了報告データ用CSVへ含めて
  // 出力した日時(プロジェクトL)。未出力の間はnull。
  shippingReportedAt: string | null;
  // 「一時保存」= 人が手動で退避した目印(2026-09-10 発送ページ集約)。ON=押した時刻、
  // OFF(null)=「未処理へ戻す」/「一時保存から外す」。RMS同期では一切触れない。
  heldAt: string | null;
  createdAt: string;
  updatedAt: string;
}

// 発送エントリー「作業メニュー」タブのセグメント切替(2026-09-10 発送ページ集約)。
// 確認待ち→未処理→作業中→処理済みが基本の流れ、一時保存はいつでも出入りする退避置き場。
export type ShippingSegment = "awaiting" | "unprocessed" | "inProgress" | "done" | "held";

export interface ShippingSegmentCounts {
  awaiting: number;
  unprocessed: number;
  inProgress: number;
  done: number;
  held: number;
}

// セグメント一覧の1行。氏名・住所などはOrderDTOと同じ粒度で持つ(表示用に絞らない。
// 絞り込み・列の出し分けはUI側の責務)。
export interface ShippingSegmentRowDTO {
  id: string;
  orderNumber: string;
  ordererName: string;
  postalCode: string | null;
  prefecture: string | null;
  address1: string | null;
  address2: string | null;
  orderedAt: string | null;
  csvExportedAt: string | null;
  shippingReportedAt: string | null;
  heldAt: string | null;
}

export interface ShippingSegmentsDTO {
  counts: ShippingSegmentCounts;
  active: ShippingSegment;
  rows: ShippingSegmentRowDTO[];
}

// 発送エントリー画面の「本日のCSV出力実績」表示用。
export interface CsvExportSummaryDTO {
  // 今日(JST)csvExportedAtが設定された注文の件数。
  count: number;
  // countの中で最新のcsvExportedAt。countが0の場合はnull。
  lastExportedAt: string | null;
}

// 外部連携のMapperが生成する、DB同期用の入力。
// channel + orderNumber が一意キー。rawPayload には変換元の生レスポンスをJSON文字列で保持する。
export interface OrderUpsertInput {
  channel: string;
  orderNumber: string;
  ordererName: string;
  recipientName?: string | null;
  postalCode?: string | null;
  prefecture?: string | null;
  address1?: string | null;
  address2?: string | null;
  phoneNumber?: string | null;
  email?: string | null;
  shippingMethod?: string | null;
  orderStatus?: string | null;
  orderedAt?: Date | null;
  totalPrice?: number | null;
  paymentMethod?: string | null;
  rawPayload?: string | null;
}
