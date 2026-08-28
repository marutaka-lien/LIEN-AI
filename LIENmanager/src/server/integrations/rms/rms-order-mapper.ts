import type { OrderUpsertInput } from "@/types/order";
import type { RmsOrderModel } from "./rms-types";

const DEFAULT_CHANNEL = "rakuten";

// RmsApiResponse(RmsOrderModel) → 共通Order型 への変換のみを責務とする。
// RMS固有のフィールド名(zipCode1/subAddress等)はこのファイルの外に漏らさない。
//
// 既知の制約: RMSの1注文は複数の送付先(PackageModelList)を持ちうるが、
// 現在のOrderスキーマは注文1件につき送付先1件しか保持できない。
// このステップでは「基盤づくり」の範囲として、先頭のPackageModelのSenderModelを
// 代表の送付先として採用する(存在しない場合は注文者情報にフォールバック)。
// 複数送付先を正しく扱う場合は、後続でOrder:Packageを1:Nにするスキーマ変更が必要。
export const RmsOrderMapper = {
  toOrderUpsertInput(order: RmsOrderModel, channel: string = DEFAULT_CHANNEL): OrderUpsertInput {
    const orderer = order.OrdererModel;
    const primarySender = order.PackageModelList?.[0]?.SenderModel;
    const recipientSource = primarySender ?? orderer;

    return {
      channel,
      orderNumber: order.orderNumber,
      ordererName: joinName(orderer.familyName, orderer.firstName),
      recipientName: joinNameOrNull(recipientSource.familyName, recipientSource.firstName),
      postalCode: joinPostalCode(recipientSource.zipCode1, recipientSource.zipCode2),
      prefecture: recipientSource.prefecture ?? null,
      address1: recipientSource.city ?? null,
      address2: recipientSource.subAddress ?? null,
      phoneNumber: recipientSource.phoneNumber1 ?? null,
      email: orderer.emailAddress ?? null,
      shippingMethod: order.DeliveryModel?.deliveryName ?? null,
      orderStatus: String(order.orderProgress),
      orderedAt: parseRmsDatetime(order.orderDatetime),
      totalPrice: order.totalPrice ?? null,
      paymentMethod: order.SettlementModel?.settlementMethod ?? null,
      rawPayload: JSON.stringify(order),
    };
  },
};

function joinName(familyName: string, firstName: string): string {
  return [familyName, firstName].filter(Boolean).join(" ");
}

function joinNameOrNull(
  familyName: string | null | undefined,
  firstName: string | null | undefined
): string | null {
  const joined = [familyName, firstName].filter(Boolean).join(" ");
  return joined.length > 0 ? joined : null;
}

function joinPostalCode(
  zip1: string | null | undefined,
  zip2: string | null | undefined
): string | null {
  const joined = [zip1, zip2].filter(Boolean).join("-");
  return joined.length > 0 ? joined : null;
}

// RMSの日時文字列フォーマットは未確認のため、パース失敗時はnullとして扱い、
// 同期処理全体を失敗させない(rawPayloadには元の値が残るため後から追跡可能)。
function parseRmsDatetime(value: string | undefined | null): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}
