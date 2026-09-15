import { describe, expect, it, vi } from "vitest";

import type { Order } from "@/generated/prisma/client";
import type { OrderUpsertInput } from "@/types/order";

import type { RmsApiClient } from "../rms-api-client";
import type { RmsBrowserClient } from "../rms-browser-client";
import type { RmsConfig } from "../rms-config";
import { RmsApiBusinessError, RmsAuthError, RmsConfigError, RmsHttpError } from "../rms-errors";
import { createRmsService, type OrderSyncPort } from "../rms-service";

function buildConfig(overrides: Partial<RmsConfig> = {}): RmsConfig {
  return {
    baseUrl: "https://example.invalid",
    searchOrderPath: "/rpay/order/searchOrder",
    getOrderPath: "/rpay/order/getOrder",
    updateOrderShippingPath: "/rpay/order/updateOrderShipping",
    getOrderVersion: 3,
    authHeader: "ESA dGVzdDp0ZXN0",
    searchLookbackDays: 30,
    searchMaxWindowDays: 63,
    searchMaxRecordsPerPage: 200,
    requestIntervalMs: 0,
    requestTimeoutMs: 30000,
    itemSearchPath: "/es/2.0/items/search",
    itemSearchHits: 100,
    itemImageBaseUrl: "https://image.rakuten.co.jp/test-shop/cabinet",
    ...overrides,
  };
}

function buildRmsOrderModel(orderNumber: string) {
  return {
    orderNumber,
    orderProgress: 300,
    orderDatetime: "2026-01-01T10:00:00+09:00",
    OrdererModel: {
      familyName: "山田",
      firstName: "太郎",
      emailAddress: "test@example.com",
    },
    PackageModelList: [],
  };
}

function buildFakeSavedOrder(input: OrderUpsertInput): Order {
  return {
    id: `id-${input.orderNumber}`,
    channel: input.channel,
    orderNumber: input.orderNumber,
    ordererName: input.ordererName,
    recipientName: input.recipientName ?? null,
    postalCode: input.postalCode ?? null,
    prefecture: input.prefecture ?? null,
    address1: input.address1 ?? null,
    address2: input.address2 ?? null,
    phoneNumber: input.phoneNumber ?? null,
    email: input.email ?? null,
    shippingMethod: input.shippingMethod ?? null,
    orderStatus: input.orderStatus ?? null,
    orderedAt: input.orderedAt ?? null,
    totalPrice: input.totalPrice ?? null,
    paymentMethod: input.paymentMethod ?? null,
    trackingNumber: null,
    rmsShippingReflectedAt: null,
    clickPostRegisteredAt: null,
    csvExportedAt: null,
    shippingReportedAt: null,
    heldAt: null,
    rawPayload: input.rawPayload ?? null,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-01T00:00:00Z"),
  };
}

function buildOrderSyncMock(): OrderSyncPort & { calls: OrderUpsertInput[] } {
  const calls: OrderUpsertInput[] = [];
  return {
    calls,
    async upsertByChannelAndOrderNumber(input: OrderUpsertInput) {
      calls.push(input);
      return buildFakeSavedOrder(input);
    },
  };
}

describe("RmsService.fetchPendingOrders", () => {
  it("正常系: 1件の注文を取得しOrderRepositoryへ同期する", async () => {
    const apiClient = {
      searchOrder: vi.fn(async () => ({
        MessageModelList: [],
        orderNumberList: ["order-1"],
        PaginationResponseModel: { totalRecordsAmount: 1, totalPages: 1, requestPage: 1 },
      })),
      getOrder: vi.fn(async () => ({
        MessageModelList: [],
        OrderModelList: [buildRmsOrderModel("order-1")],
      })),
    } as unknown as RmsApiClient;

    const orderSync = buildOrderSyncMock();
    const service = createRmsService({ apiClient, orderSync, config: buildConfig() });

    const result = await service.fetchPendingOrders();

    expect(result.totalFetched).toBe(1);
    expect(result.totalSynced).toBe(1);
    expect(result.errors).toHaveLength(0);
    expect(result.orders[0].orderNumber).toBe("order-1");
    expect(orderSync.calls[0].orderNumber).toBe("order-1");
    expect(orderSync.calls[0].channel).toBe("rakuten");
  });

  it("認証エラー: searchOrderが失敗した場合はfetchPendingOrders全体が失敗する", async () => {
    const apiClient = {
      searchOrder: vi.fn(async () => {
        throw new RmsAuthError("auth failed", 401);
      }),
      getOrder: vi.fn(),
    } as unknown as RmsApiClient;

    const orderSync = buildOrderSyncMock();
    const service = createRmsService({ apiClient, orderSync, config: buildConfig() });

    await expect(service.fetchPendingOrders()).rejects.toBeInstanceOf(RmsAuthError);
    expect(orderSync.calls).toHaveLength(0);
  });

  it("RMS API固有エラー: MessageModelListにERRORが含まれる場合はRmsApiBusinessErrorになる", async () => {
    const apiClient = {
      searchOrder: vi.fn(async () => ({
        MessageModelList: [{ messageType: "ERROR", messageCode: "E001", message: "不正な検索条件です" }],
        orderNumberList: [],
      })),
      getOrder: vi.fn(),
    } as unknown as RmsApiClient;

    const orderSync = buildOrderSyncMock();
    const service = createRmsService({ apiClient, orderSync, config: buildConfig() });

    await expect(service.fetchPendingOrders()).rejects.toBeInstanceOf(RmsApiBusinessError);
  });

  it("APIエラー: getOrderが失敗しても他の処理を止めずerrorsに記録する", async () => {
    const apiClient = {
      searchOrder: vi.fn(async () => ({
        MessageModelList: [],
        orderNumberList: ["order-1"],
      })),
      getOrder: vi.fn(async () => {
        throw new RmsHttpError("server error", 500);
      }),
    } as unknown as RmsApiClient;

    const orderSync = buildOrderSyncMock();
    const service = createRmsService({ apiClient, orderSync, config: buildConfig() });

    const result = await service.fetchPendingOrders();

    expect(result.totalSynced).toBe(0);
    expect(result.errors).toHaveLength(1);
    expect(orderSync.calls).toHaveLength(0);
  });

  it("不正なレスポンス: getOrderのレスポンスが構造不正な場合もerrorsに記録し処理を継続する", async () => {
    const apiClient = {
      searchOrder: vi.fn(async () => ({
        MessageModelList: [],
        orderNumberList: ["order-1"],
      })),
      getOrder: vi.fn(async () => ({
        // OrdererModelが無い不正な形式
        OrderModelList: [{ orderNumber: "order-1", orderProgress: 300, orderDatetime: "x" }],
      })),
    } as unknown as RmsApiClient;

    const orderSync = buildOrderSyncMock();
    const service = createRmsService({ apiClient, orderSync, config: buildConfig() });

    const result = await service.fetchPendingOrders();

    expect(result.totalSynced).toBe(0);
    expect(result.errors).toHaveLength(1);
  });

  it("複数ページ取得: totalPagesに応じてsearchOrderを複数回呼び出し、全件をマージする", async () => {
    const searchOrder = vi
      .fn()
      .mockResolvedValueOnce({
        MessageModelList: [],
        orderNumberList: ["order-1"],
        PaginationResponseModel: { totalRecordsAmount: 2, totalPages: 2, requestPage: 1 },
      })
      .mockResolvedValueOnce({
        MessageModelList: [],
        orderNumberList: ["order-2"],
        PaginationResponseModel: { totalRecordsAmount: 2, totalPages: 2, requestPage: 2 },
      });

    const apiClient = {
      searchOrder,
      getOrder: vi.fn(async ({ orderNumberList }: { orderNumberList: string[] }) => ({
        MessageModelList: [],
        OrderModelList: orderNumberList.map((orderNumber) => buildRmsOrderModel(orderNumber)),
      })),
    } as unknown as RmsApiClient;

    const orderSync = buildOrderSyncMock();
    const service = createRmsService({ apiClient, orderSync, config: buildConfig() });

    const result = await service.fetchPendingOrders();

    expect(searchOrder).toHaveBeenCalledTimes(2);
    expect(searchOrder.mock.calls[0][0].PaginationRequestModel.requestPage).toBe(1);
    expect(searchOrder.mock.calls[1][0].PaginationRequestModel.requestPage).toBe(2);
    expect(result.totalFetched).toBe(2);
    expect(result.totalSynced).toBe(2);
    expect(orderSync.calls.map((c) => c.orderNumber).sort()).toEqual(["order-1", "order-2"]);
  });

  it("既存注文の更新: 同じ注文番号で2回同期しても同一キーでupsertが呼ばれる(冪等)", async () => {
    const apiClient = {
      searchOrder: vi.fn(async () => ({
        MessageModelList: [],
        orderNumberList: ["order-1"],
      })),
      getOrder: vi.fn(async () => ({
        MessageModelList: [],
        OrderModelList: [buildRmsOrderModel("order-1")],
      })),
    } as unknown as RmsApiClient;

    const orderSync = buildOrderSyncMock();
    const service = createRmsService({ apiClient, orderSync, config: buildConfig() });

    await service.fetchPendingOrders();
    await service.fetchPendingOrders();

    expect(orderSync.calls).toHaveLength(2);
    expect(orderSync.calls[0].channel).toBe(orderSync.calls[1].channel);
    expect(orderSync.calls[0].orderNumber).toBe(orderSync.calls[1].orderNumber);
  });
});

describe("RmsService.confirmOrder", () => {
  it("orderProgress=200以上(確認済み)の場合はブラウザ操作をせずスキップする", async () => {
    const apiClient = {} as unknown as RmsApiClient;
    const orderSync = buildOrderSyncMock();
    const service = createRmsService({ apiClient, orderSync, config: buildConfig() });

    const result = await service.confirmOrder("order-1", 300);

    expect(result.wasRequired).toBe(false);
    expect(result.executed).toBe(false);
    expect(result.success).toBe(true);
  });

  it("orderProgress=100(注文確認待ち)かつRmsBrowserClient未設定の場合はRmsConfigErrorを投げる", async () => {
    const apiClient = {} as unknown as RmsApiClient;
    const orderSync = buildOrderSyncMock();
    const service = createRmsService({ apiClient, orderSync, config: buildConfig() });

    await expect(service.confirmOrder("order-1", 100)).rejects.toBeInstanceOf(RmsConfigError);
  });

  it("orderProgress=100の場合はRmsBrowserClient.confirmOrderを呼び出す(execute未指定はfalseとして渡す)", async () => {
    const apiClient = {} as unknown as RmsApiClient;
    const orderSync = buildOrderSyncMock();
    const confirmOrderMock = vi.fn(async () => ({
      orderNumber: "order-1",
      found: true,
      executed: false,
      success: false,
      errorMessage: "execute=falseのためドライランとして扱い、注文確認は実行していません",
    }));
    const browserClient = {
      checkLoginState: vi.fn(),
      verifyPendingConfirmationScreen: vi.fn(),
      confirmOrder: confirmOrderMock,
      close: vi.fn(),
    } as unknown as RmsBrowserClient;

    const service = createRmsService({ apiClient, orderSync, config: buildConfig(), browserClient });

    const result = await service.confirmOrder("order-1", 100);

    expect(confirmOrderMock).toHaveBeenCalledWith("order-1", { execute: false });
    expect(result.wasRequired).toBe(true);
    expect(result.executed).toBe(false);
    expect(result.success).toBe(false);
  });

  it("execute:trueでブラウザ操作が成功した場合、RMS APIで実際にorderProgressが進んだか再確認してから成功と判定する", async () => {
    const getOrder = vi.fn(async () => ({
      MessageModelList: [],
      OrderModelList: [buildRmsOrderModel("order-1")], // orderProgress: 300(既定値)
    }));
    const apiClient = { getOrder } as unknown as RmsApiClient;
    const orderSync = buildOrderSyncMock();
    const confirmOrderMock = vi.fn(async () => ({
      orderNumber: "order-1",
      found: true,
      executed: true,
      success: true,
    }));
    const browserClient = {
      checkLoginState: vi.fn(),
      verifyPendingConfirmationScreen: vi.fn(),
      confirmOrder: confirmOrderMock,
      close: vi.fn(),
    } as unknown as RmsBrowserClient;

    const service = createRmsService({ apiClient, orderSync, config: buildConfig(), browserClient });

    const result = await service.confirmOrder("order-1", 100, { execute: true });

    expect(confirmOrderMock).toHaveBeenCalledWith("order-1", { execute: true });
    expect(getOrder).toHaveBeenCalledWith({ orderNumberList: ["order-1"], version: 3 });
    expect(result.executed).toBe(true);
    expect(result.success).toBe(true);
  });

  it("ブラウザ操作は成功してもRMS側がまだ注文確認待ちのままなら失敗として扱う", async () => {
    const getOrder = vi.fn(async () => ({
      MessageModelList: [],
      OrderModelList: [{ ...buildRmsOrderModel("order-1"), orderProgress: 100 }],
    }));
    const apiClient = { getOrder } as unknown as RmsApiClient;
    const orderSync = buildOrderSyncMock();
    const browserClient = {
      checkLoginState: vi.fn(),
      verifyPendingConfirmationScreen: vi.fn(),
      confirmOrder: vi.fn(async () => ({
        orderNumber: "order-1",
        found: true,
        executed: true,
        success: true,
      })),
      close: vi.fn(),
    } as unknown as RmsBrowserClient;

    const service = createRmsService({ apiClient, orderSync, config: buildConfig(), browserClient });

    const result = await service.confirmOrder("order-1", 100, { execute: true });

    expect(result.success).toBe(false);
    expect(result.message).toMatch(/注文確認待ちのまま/);
  });

  it("execute:falseの場合は状態確認APIを呼ばない(ドライランのため)", async () => {
    const getOrder = vi.fn();
    const apiClient = { getOrder } as unknown as RmsApiClient;
    const orderSync = buildOrderSyncMock();
    const browserClient = {
      checkLoginState: vi.fn(),
      verifyPendingConfirmationScreen: vi.fn(),
      confirmOrder: vi.fn(async () => ({
        orderNumber: "order-1",
        found: true,
        executed: false,
        success: false,
        errorMessage: "execute=falseのためドライランとして扱い、注文確認は実行していません",
      })),
      close: vi.fn(),
    } as unknown as RmsBrowserClient;

    const service = createRmsService({ apiClient, orderSync, config: buildConfig(), browserClient });

    await service.confirmOrder("order-1", 100, { execute: false });

    expect(getOrder).not.toHaveBeenCalled();
  });
});

describe("RmsService.checkRmsLoginState / verifyPendingConfirmationScreen", () => {
  it("RmsBrowserClient未設定の場合はRmsConfigErrorを投げる", async () => {
    const apiClient = {} as unknown as RmsApiClient;
    const orderSync = buildOrderSyncMock();
    const service = createRmsService({ apiClient, orderSync, config: buildConfig() });

    await expect(service.checkRmsLoginState()).rejects.toBeInstanceOf(RmsConfigError);
    await expect(service.verifyPendingConfirmationScreen()).rejects.toBeInstanceOf(RmsConfigError);
  });

  it("RmsBrowserClientへ処理を委譲する", async () => {
    const apiClient = {} as unknown as RmsApiClient;
    const orderSync = buildOrderSyncMock();
    const browserClient = {
      checkLoginState: vi.fn(async () => "logged_in" as const),
      verifyPendingConfirmationScreen: vi.fn(async () => ({
        tabVisible: true,
        bulkMenuVisible: true,
      })),
      confirmOrder: vi.fn(),
      close: vi.fn(),
    } as unknown as RmsBrowserClient;

    const service = createRmsService({ apiClient, orderSync, config: buildConfig(), browserClient });

    await expect(service.checkRmsLoginState()).resolves.toBe("logged_in");
    await expect(service.verifyPendingConfirmationScreen()).resolves.toEqual({
      tabVisible: true,
      bulkMenuVisible: true,
    });
  });
});
