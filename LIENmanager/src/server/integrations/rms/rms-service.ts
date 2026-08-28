import type { Order } from "@/generated/prisma/client";
import { orderRepository } from "@/server/order/order.repository";
import { toOrderDTO } from "@/server/order/order.mapper";
import type { OrderDTO, OrderUpsertInput } from "@/types/order";

import { RmsApiClient } from "./rms-api-client";
import { loadRmsBrowserConfig } from "./rms-browser-config";
import {
  createDefaultRmsBrowserClient,
  type RmsBrowserClient,
  type RmsLoginState,
  type RmsPendingConfirmationScreenCheck,
} from "./rms-browser-client";
import { loadRmsConfig, type RmsConfig } from "./rms-config";
import { RmsApiBusinessError, RmsConfigError, RmsHttpError, RmsIntegrationError } from "./rms-errors";
import { RmsOrderMapper } from "./rms-order-mapper";
import { isOrderAlreadyConfirmed, isOrderConfirmationRequired } from "./rms-order-status";
import {
  RMS_DATE_TYPE,
  RMS_PENDING_ORDER_PROGRESS_LIST,
  formatRmsDateTime,
  formatRmsShippingDate,
  parseGetOrderResponse,
  parseSearchOrderResponse,
} from "./rms-types";

// 安全策(RMS側の実際の上限が非公開のため、判明するまでは保守的な内部定数として持つ)。
const MAX_PAGES_PER_WINDOW = 50;
const MAX_TOTAL_ORDER_NUMBERS = 20000;
const GET_ORDER_BATCH_SIZE = 100;

export interface FetchPendingOrdersQuery {
  startDate?: Date;
  endDate?: Date;
  orderProgressList?: number[];
}

export interface FetchPendingOrdersResult {
  orders: OrderDTO[];
  totalFetched: number;
  totalSynced: number;
  errors: Array<{ orderNumber?: string; message: string }>;
}

export interface ConfirmOrderResult {
  orderNumber: string;
  // isOrderConfirmationRequired(orderProgress)の結果。falseならブラウザ操作自体を行わない。
  wasRequired: boolean;
  found: boolean;
  executed: boolean;
  success: boolean;
  message?: string;
}

export interface ReflectTrackingNumberParams {
  trackingNumber: string;
  // RMSのdeliveryCompanyコード。既知の値は非公開ドキュメントに依存するため
  // 呼び出し側で明示的に指定させる(推測値を関数内にハードコードしない)。
  deliveryCompany: string;
  shippingDate?: Date;
}

export interface ReflectTrackingNumberResult {
  orderNumber: string;
  success: boolean;
  message?: string;
}

export interface RmsService {
  fetchPendingOrders(query?: FetchPendingOrdersQuery): Promise<FetchPendingOrdersResult>;

  // orderProgressを見て注文確認が必要かどうかを判定し、必要な場合のみRmsBrowserClientを呼ぶ。
  // options.executeを明示的にtrueにしない限り、実際のクリックは行わない
  // (通常の自動化フローからはexecute未指定=falseで呼び出すこと)。
  confirmOrder(
    orderNumber: string,
    orderProgress: number,
    options?: { execute?: boolean }
  ): Promise<ConfirmOrderResult>;

  // RMSのログイン状態を確認する(未ログイン/セッション切れの場合は自動で継続しない)。
  checkRmsLoginState(): Promise<RmsLoginState>;

  // 「注文確認待ち」一覧画面の構造を確認する(状態変更なし)。
  verifyPendingConfirmationScreen(): Promise<RmsPendingConfirmationScreenCheck>;

  // ClickPost等で発行された追跡番号をRMSのupdateOrderShippingへ反映する。
  // basketIdは呼び出し時点の最新getOrderから取得する(呼び出し側にRMS固有のID管理を
  // 持たせないため)。shippingDetailIdは意図的に送らない(初回登録時は存在しないため。
  // 2026-08-06時点、既存のShippingModelListがある場合の更新挙動は未検証)。
  reflectTrackingNumber(
    orderNumber: string,
    params: ReflectTrackingNumberParams
  ): Promise<ReflectTrackingNumberResult>;
}

// Repositoryへ直接依存させず、必要な操作だけを最小インターフェースとして受け取る。
// テスト時はこのインターフェースを満たすモックを注入できる。
export interface OrderSyncPort {
  upsertByChannelAndOrderNumber(input: OrderUpsertInput): Promise<Order>;
}

export interface RmsServiceDeps {
  apiClient: RmsApiClient;
  orderSync: OrderSyncPort;
  config: RmsConfig;
  // 未設定の場合、confirmOrder/checkRmsLoginState/verifyPendingConfirmationScreenは
  // RmsConfigErrorを投げる(fetchPendingOrders等のAPI専用機能には影響しない)。
  browserClient?: RmsBrowserClient;
  now?: () => Date;
}

export function createRmsService(deps: RmsServiceDeps): RmsService {
  const { apiClient, orderSync, config, browserClient, now = () => new Date() } = deps;

  async function fetchPendingOrders(
    query: FetchPendingOrdersQuery = {}
  ): Promise<FetchPendingOrdersResult> {
    const endDate = query.endDate ?? now();
    const startDate = query.startDate ?? addDays(endDate, -config.searchLookbackDays);
    const orderProgressList = query.orderProgressList ?? RMS_PENDING_ORDER_PROGRESS_LIST;

    const orderNumbers = await collectPendingOrderNumbers(
      apiClient,
      config,
      startDate,
      endDate,
      orderProgressList
    );

    const orderNumberList = Array.from(orderNumbers).slice(0, MAX_TOTAL_ORDER_NUMBERS);
    const batches = chunk(orderNumberList, GET_ORDER_BATCH_SIZE);

    const syncedOrders: OrderDTO[] = [];
    const errors: Array<{ orderNumber?: string; message: string }> = [];

    for (const [batchIndex, batch] of batches.entries()) {
      if (batch.length === 0) continue;

      let rawResponse: unknown;
      try {
        rawResponse = await apiClient.getOrder({
          orderNumberList: batch,
          version: config.getOrderVersion,
        });
      } catch (error) {
        errors.push({ message: toErrorMessage(error) });
        continue;
      }

      let orderModelList;
      try {
        const parsed = parseGetOrderResponse(rawResponse);
        assertNoBusinessError(parsed.MessageModelList);
        orderModelList = parsed.OrderModelList;
      } catch (error) {
        errors.push({ message: toErrorMessage(error) });
        continue;
      }

      for (const rmsOrder of orderModelList) {
        try {
          const upsertInput = RmsOrderMapper.toOrderUpsertInput(rmsOrder);
          const saved = await orderSync.upsertByChannelAndOrderNumber(upsertInput);
          syncedOrders.push(toOrderDTO(saved));
        } catch (error) {
          errors.push({ orderNumber: rmsOrder.orderNumber, message: toErrorMessage(error) });
        }
      }

      if (batchIndex < batches.length - 1) {
        await sleep(config.requestIntervalMs);
      }
    }

    return {
      orders: syncedOrders,
      totalFetched: orderNumberList.length,
      totalSynced: syncedOrders.length,
      errors,
    };
  }

  async function confirmOrder(
    orderNumber: string,
    orderProgress: number,
    options: { execute?: boolean } = {}
  ): Promise<ConfirmOrderResult> {
    const wasRequired = isOrderConfirmationRequired(orderProgress);

    if (!wasRequired) {
      return {
        orderNumber,
        wasRequired: false,
        found: true,
        executed: false,
        success: true,
        message: "既に確認済み(またはRMS側で自動確認済み)のため注文確認をスキップしました",
      };
    }

    if (!browserClient) {
      throw new RmsConfigError(
        "RmsBrowserClientが設定されていないため注文確認を実行できません"
      );
    }

    const execute = options.execute ?? false;
    const result = await browserClient.confirmOrder(orderNumber, { execute });

    if (!execute || !result.success) {
      return {
        orderNumber,
        wasRequired: true,
        found: result.found,
        executed: result.executed,
        success: result.success,
        message: result.errorMessage,
      };
    }

    // ブラウザ操作(クリック)が例外なく完了したという報告だけでは、RMS側で実際に
    // 注文確認が完了した証明にはならない。APIで該当注文を再取得し、orderProgressが
    // 実際に進んでいることを確認してから最終的な成功を判定する。
    try {
      const raw = await apiClient.getOrder({
        orderNumberList: [orderNumber],
        version: config.getOrderVersion,
      });
      const parsed = parseGetOrderResponse(raw);
      assertNoBusinessError(parsed.MessageModelList);

      const updatedOrder = parsed.OrderModelList.find(
        (candidate) => candidate.orderNumber === orderNumber
      );

      if (!updatedOrder) {
        return {
          orderNumber,
          wasRequired: true,
          found: true,
          executed: true,
          success: false,
          message: "注文確認操作後、RMSから該当注文を再取得できませんでした",
        };
      }

      if (!isOrderAlreadyConfirmed(updatedOrder.orderProgress)) {
        return {
          orderNumber,
          wasRequired: true,
          found: true,
          executed: true,
          success: false,
          message: "注文確認操作を行いましたが、RMS側の状態は注文確認待ちのままでした",
        };
      }

      return { orderNumber, wasRequired: true, found: true, executed: true, success: true };
    } catch (error) {
      return {
        orderNumber,
        wasRequired: true,
        found: true,
        executed: true,
        success: false,
        message: `注文確認後の状態確認に失敗しました: ${toErrorMessage(error)}`,
      };
    }
  }

  async function checkRmsLoginState(): Promise<RmsLoginState> {
    if (!browserClient) {
      throw new RmsConfigError(
        "RmsBrowserClientが設定されていないためログイン状態を確認できません"
      );
    }
    return browserClient.checkLoginState();
  }

  async function verifyPendingConfirmationScreen(): Promise<RmsPendingConfirmationScreenCheck> {
    if (!browserClient) {
      throw new RmsConfigError(
        "RmsBrowserClientが設定されていないため画面確認を実行できません"
      );
    }
    return browserClient.verifyPendingConfirmationScreen();
  }

  async function reflectTrackingNumber(
    orderNumber: string,
    params: ReflectTrackingNumberParams
  ): Promise<ReflectTrackingNumberResult> {
    try {
      const raw = await apiClient.getOrder({
        orderNumberList: [orderNumber],
        version: config.getOrderVersion,
      });
      const parsed = parseGetOrderResponse(raw);
      assertNoBusinessError(parsed.MessageModelList);

      const order = parsed.OrderModelList.find((candidate) => candidate.orderNumber === orderNumber);
      if (!order) {
        return {
          orderNumber,
          success: false,
          message: "RMSから該当注文を取得できませんでした",
        };
      }

      // PackageModelListの型はSenderModelのみ明示している(.looseによりbasketIdは
      // 実際には含まれるが型定義外)。RMS固有の生レスポンス構造のためここでのみcastする。
      const basketId = (order.PackageModelList[0] as { basketId?: number } | undefined)?.basketId;
      if (typeof basketId !== "number") {
        return {
          orderNumber,
          success: false,
          message: "対象注文からbasketIdを取得できませんでした",
        };
      }

      await apiClient.updateOrderShipping({
        orderNumber,
        BasketidModelList: [
          {
            basketId,
            ShippingModelList: [
              {
                shippingNumber: params.trackingNumber,
                deliveryCompany: params.deliveryCompany,
                shippingDate: formatRmsShippingDate(params.shippingDate ?? now()),
              },
            ],
          },
        ],
      });

      return { orderNumber, success: true };
    } catch (error) {
      // RMSのエラーレスポンス本文には具体的な原因(必須パラメータ不足等)が含まれるため、
      // 汎用メッセージだけでなくresponseBodyも合わせて返す(呼び出し側での原因調査用)。
      const detail =
        error instanceof RmsHttpError ? ` detail=${JSON.stringify(error.responseBody)}` : "";
      return {
        orderNumber,
        success: false,
        message: `追跡番号のRMS反映に失敗しました: ${toErrorMessage(error)}${detail}`,
      };
    }
  }

  return {
    fetchPendingOrders,
    confirmOrder,
    checkRmsLoginState,
    verifyPendingConfirmationScreen,
    reflectTrackingNumber,
  };
}

async function collectPendingOrderNumbers(
  apiClient: RmsApiClient,
  config: RmsConfig,
  startDate: Date,
  endDate: Date,
  orderProgressList: number[]
): Promise<Set<string>> {
  const windows = splitDateRangeIntoWindows(startDate, endDate, config.searchMaxWindowDays);
  const orderNumbers = new Set<string>();

  for (const [windowIndex, window] of windows.entries()) {
    let requestPage = 1;
    let totalPages = 1;

    while (requestPage <= totalPages) {
      if (orderNumbers.size >= MAX_TOTAL_ORDER_NUMBERS) return orderNumbers;
      if (requestPage > MAX_PAGES_PER_WINDOW) break;

      const rawResponse = await apiClient.searchOrder({
        dateType: RMS_DATE_TYPE.ORDER_DATE,
        startDatetime: formatRmsDateTime(window.start),
        endDatetime: formatRmsDateTime(window.end),
        orderProgressList,
        PaginationRequestModel: {
          requestRecordsAmount: config.searchMaxRecordsPerPage,
          requestPage,
        },
      });

      const parsed = parseSearchOrderResponse(rawResponse);
      assertNoBusinessError(parsed.MessageModelList);

      for (const orderNumber of parsed.orderNumberList) {
        orderNumbers.add(orderNumber);
      }

      totalPages = parsed.PaginationResponseModel?.totalPages ?? 1;
      requestPage += 1;

      if (requestPage <= totalPages) {
        await sleep(config.requestIntervalMs);
      }
    }

    if (windowIndex < windows.length - 1) {
      await sleep(config.requestIntervalMs);
    }
  }

  return orderNumbers;
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function splitDateRangeIntoWindows(
  start: Date,
  end: Date,
  maxWindowDays: number
): Array<{ start: Date; end: Date }> {
  const windows: Array<{ start: Date; end: Date }> = [];
  let windowStart = new Date(start);

  while (windowStart < end) {
    const windowEnd = new Date(
      Math.min(addDays(windowStart, maxWindowDays).getTime(), end.getTime())
    );
    windows.push({ start: windowStart, end: windowEnd });
    windowStart = windowEnd;
  }

  return windows.length > 0 ? windows : [{ start, end }];
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

function sleep(ms: number): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// RMSはHTTP 200でもMessageModelList内にエラー内容を含める場合がある。
// messageTypeの正確な取りうる値は非公開のため未確認("ERROR"はサードパーティ実装からの推測)。
// 実運用時に実際の値を確認し、必要に応じて調整すること。
function assertNoBusinessError(
  messages: Array<{ messageType?: string; messageCode?: string; message?: string }>
): void {
  const error = messages.find((message) => message.messageType === "ERROR");
  if (error) {
    throw new RmsApiBusinessError(
      error.message ?? "RMS APIがエラーメッセージを返しました",
      error.messageCode
    );
  }
}

function toErrorMessage(error: unknown): string {
  if (error instanceof RmsIntegrationError) return error.message;
  if (error instanceof Error) return error.message;
  return "unknown error";
}

// アプリ実運用向けのデフォルトファクトリ(実際の環境変数・Prisma Repository・
// RmsBrowserClientを使用する)。
export function createDefaultRmsService(): RmsService {
  const config = loadRmsConfig();
  const apiClient = new RmsApiClient({ config });
  const browserConfig = loadRmsBrowserConfig();
  const browserClient = createDefaultRmsBrowserClient(browserConfig);
  return createRmsService({ apiClient, orderSync: orderRepository, config, browserClient });
}
