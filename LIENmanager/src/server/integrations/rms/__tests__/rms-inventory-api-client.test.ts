import type { AxiosInstance } from "axios";
import { describe, expect, it, vi } from "vitest";

import type { RmsConfig } from "../rms-config";
import { RmsAuthError, RmsHttpError, RmsNetworkError, RmsTimeoutError } from "../rms-errors";
import { RmsInventoryApiClient } from "../rms-inventory-api-client";

function buildConfig(): RmsConfig {
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
    inventoryBulkGetPath: "/es/2.0/inventories/bulk-get",
  };
}

function buildAxiosError(overrides: Record<string, unknown>) {
  return Object.assign(new Error("axios error"), {
    isAxiosError: true,
    ...overrides,
  });
}

function buildHttpClient(postImpl: (...args: unknown[]) => unknown): AxiosInstance {
  return { post: vi.fn(postImpl) } as unknown as AxiosInstance;
}

function toBuffer(value: unknown): Buffer {
  return Buffer.from(JSON.stringify(value), "utf-8");
}

describe("RmsInventoryApiClient", () => {
  it("正常なレスポンスをUTF-8としてデコードして返し、{inventories:[...]}形式で送る", async () => {
    const httpClient = buildHttpClient(async () => ({
      data: toBuffer({ inventories: [{ manageNumber: "1", variantId: "v1", quantity: 3 }] }),
    }));
    const client = new RmsInventoryApiClient({ config: buildConfig(), httpClient });

    const result = await client.bulkGetInventories([{ manageNumber: "1", variantId: "v1" }]);

    expect(result).toEqual({ inventories: [{ manageNumber: "1", variantId: "v1", quantity: 3 }] });
    expect(httpClient.post).toHaveBeenCalledWith("/es/2.0/inventories/bulk-get", {
      inventories: [{ manageNumber: "1", variantId: "v1" }],
    });
  });

  it("401レスポンスはRmsAuthErrorに変換される", async () => {
    const httpClient = buildHttpClient(async () => {
      throw buildAxiosError({ response: { status: 401, data: toBuffer({}) } });
    });
    const client = new RmsInventoryApiClient({ config: buildConfig(), httpClient });

    await expect(client.bulkGetInventories([])).rejects.toBeInstanceOf(RmsAuthError);
  });

  it("認証以外のHTTPエラーはRmsHttpErrorに変換される", async () => {
    const httpClient = buildHttpClient(async () => {
      throw buildAxiosError({ response: { status: 400, data: toBuffer({ errors: [] }) } });
    });
    const client = new RmsInventoryApiClient({ config: buildConfig(), httpClient });

    const error = await client.bulkGetInventories([]).catch((e) => e);
    expect(error).toBeInstanceOf(RmsHttpError);
    expect((error as RmsHttpError).status).toBe(400);
  });

  it("タイムアウト(ECONNABORTED)はRmsTimeoutErrorに変換される", async () => {
    const httpClient = buildHttpClient(async () => {
      throw buildAxiosError({ code: "ECONNABORTED" });
    });
    const client = new RmsInventoryApiClient({ config: buildConfig(), httpClient });

    await expect(client.bulkGetInventories([])).rejects.toBeInstanceOf(RmsTimeoutError);
  });

  it("レスポンスを受け取れないネットワークエラーはRmsNetworkErrorに変換される", async () => {
    const httpClient = buildHttpClient(async () => {
      throw buildAxiosError({ request: {} });
    });
    const client = new RmsInventoryApiClient({ config: buildConfig(), httpClient });

    await expect(client.bulkGetInventories([])).rejects.toBeInstanceOf(RmsNetworkError);
  });
});
