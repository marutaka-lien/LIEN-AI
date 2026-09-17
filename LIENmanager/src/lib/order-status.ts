// 注文一覧画面の表示専用。RMSのorderProgress値の意味づけをUI側で独立して持つ
// (UI層はserver/integrations/rmsに直接依存しない方針のため、値は
// src/server/integrations/rms/rms-types.tsのRMS_ORDER_PROGRESSと対応させて再定義している)。

export interface OrderStatusPresentation {
  label: string;
  // 「処理対象」= 発送待ち(300)。RMS注文確認待ち(100)は自動確認後に発送待ちへ遷移するため、
  // まだ処理対象そのものではなく「確認待ち」として区別する。
  isProcessingTarget: boolean;
  isPendingConfirmation: boolean;
}

const ORDER_STATUS_LABELS: Record<string, string> = {
  "100": "注文確認待ち",
  "200": "楽天処理中",
  "300": "発送待ち",
  "400": "変更確定待ち",
  "500": "発送済",
  "600": "支払手続き中",
  "700": "支払手続き済",
  "800": "キャンセル確定待ち",
  "900": "キャンセル確定",
};

// 「注文者情報一覧」タブのステータス絞り込みドロップダウン用。
export const ORDER_STATUS_OPTIONS: { value: string; label: string }[] = Object.entries(
  ORDER_STATUS_LABELS
).map(([value, label]) => ({ value, label }));

export function getOrderStatusPresentation(orderStatus: string | null): OrderStatusPresentation {
  if (!orderStatus) {
    return { label: "不明", isProcessingTarget: false, isPendingConfirmation: false };
  }

  return {
    label: ORDER_STATUS_LABELS[orderStatus] ?? `不明(${orderStatus})`,
    isProcessingTarget: orderStatus === "300",
    isPendingConfirmation: orderStatus === "100",
  };
}
