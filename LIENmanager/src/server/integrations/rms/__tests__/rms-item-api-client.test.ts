import type { AxiosInstance } from "axios";
import { describe, expect, it, vi } from "vitest";

import { RmsItemApiClient } from "../rms-item-api-client";
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
  };
}

function buildAxiosError(overrides: Record<string, unknown>) {
  return Object.assign(new Error("axios error"), {
    isAxiosError: true,
    ...overrides,
  });
}

function buildHttpClient(getImpl: (...args: unknown[]) => unknown): AxiosInstance {
  return { get: vi.fn(getImpl) } as unknown as AxiosInstance;
}

function toBuffer(value: unknown): Buffer {
  return Buffer.from(JSON.stringify(value), "utf-8");
}

describe("RmsItemApiClient", () => {
  it("正常なレスポンスをUTF-8としてデコードして返し、hits/offsetをクエリパラメータで送る", async () => {
    const httpClient = buildHttpClient(async () => ({
      data: toBuffer({ numFound: 1, results: [] }),
    }));
    const client = new RmsItemApiClient({ config: buildConfig(), httpClient });

    const result = await client.searchItems({ hits: 100, offset: 0 });

    expect(result).toEqual({ numFound: 1, results: [] });
    expect(httpClient.get).toHaveBeenCalledWith("/es/2.0/items/search", {
      params: { hits: 100, offset: 0 },
    });
  });

  it("401レスポンスはRmsAuthErrorに変換される", async () => {
    const httpClient = buildHttpClient(async () => {
      throw buildAxiosError({ response: { status: 401, data: toBuffer({}) } });
    });
    const client = new RmsItemApiClient({ config: buildConfig(), httpClient });

    await expect(client.searchItems({ hits: 100, offset: 0 })).rejects.toBeInstanceOf(
      RmsAuthError
    );
  });

  it("認証以外のHTTPエラーはRmsHttpErrorに変換される", async () => {
    const httpClient = buildHttpClient(async () => {
      throw buildAxiosError({
        response: { status: 400, data: toBuffer({ errors: [{ code: "IE0003" }] }) },
      });
    });
    const client = new RmsItemApiClient({ config: buildConfig(), httpClient });

    const error = await client.searchItems({ hits: 1000, offset: 0 }).catch((e) => e);
    expect(error).toBeInstanceOf(RmsHttpError);
    expect((error as RmsHttpError).status).toBe(400);
  });

  it("タイムアウト(ECONNABORTED)はRmsTimeoutErrorに変換される", async () => {
    const httpClient = buildHttpClient(async () => {
      throw buildAxiosError({ code: "ECONNABORTED" });
    });
    const client = new RmsItemApiClient({ config: buildConfig(), httpClient });

    await expect(client.searchItems({ hits: 100, offset: 0 })).rejects.toBeInstanceOf(
      RmsTimeoutError
    );
  });

  it("レスポンスを受け取れないネットワークエラーはRmsNetworkErrorに変換される", async () => {
    const httpClient = buildHttpClient(async () => {
      throw buildAxiosError({ request: {} });
    });
    const client = new RmsItemApiClient({ config: buildConfig(), httpClient });

    await expect(client.searchItems({ hits: 100, offset: 0 })).rejects.toBeInstanceOf(
      RmsNetworkError
    );
  });
});
