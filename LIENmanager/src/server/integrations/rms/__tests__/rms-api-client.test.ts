import type { AxiosInstance } from "axios";
import { describe, expect, it, vi } from "vitest";

import { RmsApiClient } from "../rms-api-client";
import type { RmsConfig } from "../rms-config";
import { RmsAuthError, RmsHttpError, RmsNetworkError, RmsTimeoutError } from "../rms-errors";

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

// RmsApiClientはresponseType: "arraybuffer"で受け取る前提のため、
// テストのモックもUTF-8バイト列(Buffer)としてレスポンスボディを返す。
function toBuffer(value: unknown): Buffer {
  return Buffer.from(JSON.stringify(value), "utf-8");
}

describe("RmsApiClient", () => {
  it("正常なレスポンスをUTF-8としてデコードして返す", async () => {
    const httpClient = buildHttpClient(async () => ({
      data: toBuffer({ orderNumberList: ["a"], message: "検索に成功しました" }),
    }));
    const client = new RmsApiClient({ config: buildConfig(), httpClient });

    const result = await client.searchOrder({ foo: "bar" });

    expect(result).toEqual({ orderNumberList: ["a"], message: "検索に成功しました" });
    expect(httpClient.post).toHaveBeenCalledWith("/rpay/order/searchOrder", { foo: "bar" });
  });

  it("401レスポンスはRmsAuthErrorに変換される", async () => {
    const httpClient = buildHttpClient(async () => {
      throw buildAxiosError({ response: { status: 401, data: toBuffer({}) } });
    });
    const client = new RmsApiClient({ config: buildConfig(), httpClient });

    await expect(client.searchOrder({})).rejects.toBeInstanceOf(RmsAuthError);
  });

  it("403レスポンスもRmsAuthErrorに変換される", async () => {
    const httpClient = buildHttpClient(async () => {
      throw buildAxiosError({ response: { status: 403, data: toBuffer({}) } });
    });
    const client = new RmsApiClient({ config: buildConfig(), httpClient });

    await expect(client.getOrder({})).rejects.toBeInstanceOf(RmsAuthError);
  });

  it("認証以外のHTTPエラー(5xx)はRmsHttpErrorに変換される(レスポンス本文も保持する)", async () => {
    const httpClient = buildHttpClient(async () => {
      throw buildAxiosError({
        response: { status: 500, data: toBuffer({ message: "内部エラー" }) },
      });
    });
    const client = new RmsApiClient({ config: buildConfig(), httpClient });

    const error = await client.searchOrder({}).catch((e) => e);
    expect(error).toBeInstanceOf(RmsHttpError);
    expect((error as RmsHttpError).status).toBe(500);
    expect((error as RmsHttpError).responseBody).toEqual({ message: "内部エラー" });
  });

  it("タイムアウト(ECONNABORTED)はRmsTimeoutErrorに変換される", async () => {
    const httpClient = buildHttpClient(async () => {
      throw buildAxiosError({ code: "ECONNABORTED" });
    });
    const client = new RmsApiClient({ config: buildConfig(), httpClient });

    await expect(client.searchOrder({})).rejects.toBeInstanceOf(RmsTimeoutError);
  });

  it("レスポンスを受け取れないネットワークエラーはRmsNetworkErrorに変換される", async () => {
    const httpClient = buildHttpClient(async () => {
      // レスポンスが無い = サーバーに到達できなかった場合を模す
      throw buildAxiosError({ request: {} });
    });
    const client = new RmsApiClient({ config: buildConfig(), httpClient });

    await expect(client.searchOrder({})).rejects.toBeInstanceOf(RmsNetworkError);
  });
});
