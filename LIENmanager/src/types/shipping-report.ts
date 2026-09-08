// 「発送完了報告CSVを作る」(クリックポスト追跡番号 → RMS発送完了報告データCSV)の
// サーバー ⇔ 画面でやり取りする型。個人情報のうち宛名は画面プレビュー表示のためだけに
// 含める(CSV本体・チャット・ログには出さない)。

export type NeedsReviewReason =
  // 同じ宛先に複数の注文、または複数の追跡番号があり、対応付けが自動では確定できない。
  | "multiple-in-group"
  // rawPayload 上、この注文に複数の送付先がある可能性。
  | "multiple-packages";

// 突き合わせが確定した1件(自動マッチ or 代表)。
export interface ShippingReportMatchedPair {
  orderId: string;
  orderNumber: string;
  recipientName: string;
  trackingNumber: string;
  orderedOn: string | null;
}

export interface ShippingReportNeedsReviewItem {
  orderNumber: string | null;
  recipientName: string;
  trackingNumber: string | null;
  reason: NeedsReviewReason;
}

export interface ShippingReportUnmatchedOrderItem {
  orderNumber: string;
  recipientName: string;
}

export interface ShippingReportUnmatchedTrackingItem {
  trackingNumber: string;
  recipientName: string;
  sourceRowNumber: number;
}

export interface ShippingReportSkippedExpiredItem {
  orderNumber: string;
  recipientName: string;
  orderedOn: string | null;
}

// classify() の戻り値。CSVに出すのは autoMatched + representative のみ。
export interface ShippingReportClassification {
  autoMatched: ShippingReportMatchedPair[];
  representative: ShippingReportMatchedPair[];
  needsReview: ShippingReportNeedsReviewItem[];
  skippedExpired: ShippingReportSkippedExpiredItem[];
  unmatchedOrders: ShippingReportUnmatchedOrderItem[];
  unmatchedTracking: ShippingReportUnmatchedTrackingItem[];
  csvRows: ShippingReportCsvRowDTO[];
}

// アップロード用CSVの1行(画面での件数把握用。実ファイルはサーバーが Shift-JIS で組む)。
export interface ShippingReportCsvRowDTO {
  orderNumber: string;
  shippingTrackingNumber: string;
  deliveryCompany: string;
  shippingDate: string;
}

// /api/rms/shipping-report/convert のレスポンス。
export interface ShippingReportPreviewDTO {
  classification: ShippingReportClassification;
  // 変換対象(発送待ち×未出力)の注文総数。
  targetOrderCount: number;
  // クリックポストCSVのヘッダー検出で想定と違う点があれば警告文。
  headerWarning?: string;
  // 追跡番号・宛先が空で突き合わせに使えなかったクリックポストCSVの行番号。
  droppedRowNumbers: number[];
  // 追跡番号に Shift-JIS で表現できない文字が混ざっている行(通常は空)。
  unsafeTracking: Array<{ orderNumber: string; trackingNumber: string }>;
  // CSV行数が1回のアップロード上限(5,000)を超えているか。
  exceedsRowLimit: boolean;
}

// /api/rms/shipping-report/sync のレスポンス。
export interface ShippingReportSyncResultDTO {
  syncedAt: string;
  // 同期後の変換対象(発送待ち×未出力)件数。
  targetOrderCount: number;
  // RMS同期時のエラー(あれば)。
  errors: string[];
}

// /api/rms/shipping-report/summary のレスポンス(本日の実績。個人情報なし)。
export interface ShippingReportSummaryDTO {
  count: number;
  lastReportedAt: string | null;
}
