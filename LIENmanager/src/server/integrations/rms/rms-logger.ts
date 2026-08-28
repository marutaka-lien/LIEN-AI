// ログ出力用のマスキングユーティリティ。
// 氏名・住所・電話番号・メールアドレス・APIキー等の個人情報/秘匿情報を
// デバッグログにそのまま出さないためのヘルパー。

import type { RmsOrderModel } from "./rms-types";

export function maskSecret(value: string | undefined | null): string {
  if (!value) return "(empty)";
  return "***";
}

export function maskAuthHeader(): string {
  return "Authorization: ESA ***";
}

function maskString(value: string | null | undefined): string {
  if (!value) return "(empty)";
  return "***";
}

// デバッグログ用に、個人情報を含む可能性のあるフィールドを全てマスクした要約を返す。
export function maskRmsOrderForLog(order: RmsOrderModel) {
  return {
    orderNumber: order.orderNumber,
    orderProgress: order.orderProgress,
    orderDatetime: order.orderDatetime,
    ordererName: maskString(`${order.OrdererModel.familyName}${order.OrdererModel.firstName}`),
    ordererEmail: maskString(order.OrdererModel.emailAddress),
    ordererPhone: maskString(order.OrdererModel.phoneNumber1),
    packageCount: order.PackageModelList?.length ?? 0,
  };
}
