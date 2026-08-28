import { RMS_ORDER_PROGRESS } from "./rms-types";

// orderProgressに基づく「注文確認が必要かどうか」の判定ロジック。
// 数値の意味はrms-types.tsのRMS_ORDER_PROGRESSに一元化しており、ここでは直接ハードコードしない。
//
// 2026-07-22 実データ・実画面で確認済み:
// - orderProgress=100(注文確認待ち)の注文にはRMS画面上に「注文確認」操作が必要。
// - クレジットカード決済等では楽天側で自動的に確認され、注文確認日時が注文日時と
//   同時刻で記録される(orderProgressは200以上へ自動遷移する)。
// - 200以上は既に確認済みとして扱ってよい。

export function isOrderConfirmationRequired(orderProgress: number): boolean {
  return orderProgress === RMS_ORDER_PROGRESS.AWAITING_CONFIRM;
}

export function isOrderAlreadyConfirmed(orderProgress: number): boolean {
  return orderProgress >= RMS_ORDER_PROGRESS.RAKUTEN_PROCESSING;
}
