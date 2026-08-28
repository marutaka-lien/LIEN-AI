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
  createdAt: string;
  updatedAt: string;
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
