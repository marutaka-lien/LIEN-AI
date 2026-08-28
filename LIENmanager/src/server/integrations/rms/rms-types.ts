import { z } from "zod";

import { RmsResponseFormatError } from "./rms-errors";

// RMS固有のAPIレスポンス型・リクエスト型。アプリ内部の共通Order型とは分離し、
// この境界(rms-order-mapper.ts)の外にRMS固有のフィールド名を漏らさない。

// --- orderProgress(注文進捗ステータス) ---
// サードパーティ実装(複数の独立した実装で一致)を根拠とした値。公式ドキュメントは
// 楽天出店者向け非公開のため未確認。実運用時にRMS管理画面の実データで要検証。
export const RMS_ORDER_PROGRESS = {
  AWAITING_CONFIRM: 100, // 注文確認待ち
  RAKUTEN_PROCESSING: 200, // 楽天処理中
  AWAITING_SHIPMENT: 300, // 発送待ち
  AWAITING_CHANGE_CONFIRM: 400, // 変更確定待ち
  SHIPPED: 500, // 発送済
  PAYMENT_PROCESSING: 600, // 支払手続き中
  PAYMENT_COMPLETE: 700, // 支払手続き済
  AWAITING_CANCEL_CONFIRM: 800, // キャンセル確定待ち
  CANCEL_CONFIRMED: 900, // キャンセル確定
} as const;

// 「発送待ち・注文確認前」に該当するステータス。searchOrderのorderProgressListに
// そのまま渡し、API側で絞り込む(アプリ側での状態判定は行わない)。
export const RMS_PENDING_ORDER_PROGRESS_LIST: number[] = [
  RMS_ORDER_PROGRESS.AWAITING_CONFIRM,
  RMS_ORDER_PROGRESS.AWAITING_SHIPMENT,
];

// dateType: 期間検索種別
export const RMS_DATE_TYPE = {
  ORDER_DATE: 1,
} as const;

// RMSの日時書式はISO8601(Z終端)ではなく "yyyy-MM-ddTHH:mm:ss+0900" 形式であることを
// 実APIへのDry Runで確認済み(2026-07-22)。ISO形式で送るとstartDatetime/endDatetimeの
// 書式エラー(ORDER_EXT_API_SEARCH_ORDER_ERROR_011)になる。
export function formatRmsDateTime(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  const jst = new Date(date.getTime() + 9 * 60 * 60 * 1000);
  const y = jst.getUTCFullYear();
  const m = pad(jst.getUTCMonth() + 1);
  const d = pad(jst.getUTCDate());
  const hh = pad(jst.getUTCHours());
  const mm = pad(jst.getUTCMinutes());
  const ss = pad(jst.getUTCSeconds());
  return `${y}-${m}-${d}T${hh}:${mm}:${ss}+0900`;
}

// updateOrderShippingのshippingDateはyyyyMMdd形式(2026-07-29実データテストで確認済み)。
export function formatRmsShippingDate(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  const jst = new Date(date.getTime() + 9 * 60 * 60 * 1000);
  return `${jst.getUTCFullYear()}${pad(jst.getUTCMonth() + 1)}${pad(jst.getUTCDate())}`;
}

// --- ページング ---
export interface RmsPaginationRequestModel {
  requestRecordsAmount: number;
  requestPage: number;
}

// 検索結果が0件の場合、RMSはtotalRecordsAmount/totalPages/requestPageをnullで返す
// (実データで確認済み、2026-07-29)。0件は正常系のため、これらはnullable扱いにする。
const RmsPaginationResponseModelSchema = z.object({
  totalRecordsAmount: z.number().nullable(),
  totalPages: z.number().nullable(),
  requestPage: z.number().nullable(),
});

// --- searchOrder ---
export interface RmsSearchOrderRequestBody {
  dateType: number;
  startDatetime: string;
  endDatetime: string;
  orderProgressList?: number[];
  PaginationRequestModel: RmsPaginationRequestModel;
}

const RmsMessageModelSchema = z
  .object({
    messageType: z.string().optional(),
    messageCode: z.string().optional(),
    message: z.string().optional(),
  })
  .loose();

const RmsSearchOrderResponseSchema = z.object({
  MessageModelList: z.array(RmsMessageModelSchema).optional().default([]),
  orderNumberList: z.array(z.string()).optional().default([]),
  PaginationResponseModel: RmsPaginationResponseModelSchema.optional(),
});

export type RmsSearchOrderResponse = z.infer<typeof RmsSearchOrderResponseSchema>;

// --- getOrder ---
// versionは必須パラメータ(未指定だとORDER_EXT_API_GET_ORDER_ERROR_009)。
// 実APIへのDry Runで3が有効な値であることを確認済み(2026-07-22)。1・2は不正値として拒否された。
export interface RmsGetOrderRequestBody {
  orderNumberList: string[];
  version: number;
}

// 注文者情報。楽天側でマスキングされた状態で返る想定(emailAddress等)。
const RmsOrdererModelSchema = z
  .object({
    zipCode1: z.string().optional(),
    zipCode2: z.string().optional(),
    prefecture: z.string().optional(),
    city: z.string().optional(),
    subAddress: z.string().optional(),
    familyName: z.string(),
    firstName: z.string(),
    familyNameKana: z.string().nullable().optional(),
    firstNameKana: z.string().nullable().optional(),
    phoneNumber1: z.string().nullable().optional(),
    phoneNumber2: z.string().nullable().optional(),
    phoneNumber3: z.string().nullable().optional(),
    emailAddress: z.string().optional(),
  })
  .loose();

// 送付先情報(荷物ごとのSenderModel)。
const RmsSenderModelSchema = z
  .object({
    zipCode1: z.string().optional(),
    zipCode2: z.string().optional(),
    prefecture: z.string().optional(),
    city: z.string().optional(),
    subAddress: z.string().optional(),
    familyName: z.string().nullable().optional(),
    firstName: z.string().nullable().optional(),
    phoneNumber1: z.string().nullable().optional(),
    phoneNumber2: z.string().nullable().optional(),
    phoneNumber3: z.string().nullable().optional(),
  })
  .loose();

const RmsDeliveryModelSchema = z
  .object({
    deliveryName: z.string().nullable().optional(),
    deliveryClass: z.number().nullable().optional(),
  })
  .loose();

const RmsPackageModelSchema = z
  .object({
    SenderModel: RmsSenderModelSchema.optional(),
  })
  .loose();

// 決済情報。cardNumber/cardOwner等の詳細項目も実レスポンスに含まれるが、
// アプリ側で保持・表示するのはsettlementMethod(支払方法の種別)のみのため、
// 型としてもそれ以外は明示的に取り込まない(.loose()によりrawPayload保存には影響しない)。
const RmsSettlementModelSchema = z
  .object({
    settlementMethod: z.string().optional(),
  })
  .loose();

const RmsOrderModelSchema = z
  .object({
    orderNumber: z.string(),
    orderProgress: z.number(),
    orderDatetime: z.string(),
    equalSenderFlag: z.number().optional(),
    totalPrice: z.number().optional(),
    OrdererModel: RmsOrdererModelSchema,
    DeliveryModel: RmsDeliveryModelSchema.optional(),
    PackageModelList: z.array(RmsPackageModelSchema).optional().default([]),
    SettlementModel: RmsSettlementModelSchema.optional(),
  })
  .loose();

export type RmsOrderModel = z.infer<typeof RmsOrderModelSchema>;

const RmsGetOrderResponseSchema = z.object({
  MessageModelList: z.array(RmsMessageModelSchema).optional().default([]),
  OrderModelList: z.array(RmsOrderModelSchema).optional().default([]),
});

export type RmsGetOrderResponse = z.infer<typeof RmsGetOrderResponseSchema>;

// --- レスポンス検証ヘルパー ---
// RMSレスポンスは外部入力として扱い、想定外の形式ならRmsResponseFormatErrorへ変換する。
// 未知の追加フィールドはpassthroughで許容し、RMS側の非破壊的な仕様変更では壊れないようにする。

export function parseSearchOrderResponse(raw: unknown): RmsSearchOrderResponse {
  const result = RmsSearchOrderResponseSchema.safeParse(raw);
  if (!result.success) {
    throw new RmsResponseFormatError(
      `searchOrderレスポンスの形式が不正です: ${result.error.issues.map((i) => i.path.join(".")).join(", ")}`,
      { cause: result.error }
    );
  }
  return result.data;
}

export function parseGetOrderResponse(raw: unknown): RmsGetOrderResponse {
  const result = RmsGetOrderResponseSchema.safeParse(raw);
  if (!result.success) {
    throw new RmsResponseFormatError(
      `getOrderレスポンスの形式が不正です: ${result.error.issues.map((i) => i.path.join(".")).join(", ")}`,
      { cause: result.error }
    );
  }
  return result.data;
}
