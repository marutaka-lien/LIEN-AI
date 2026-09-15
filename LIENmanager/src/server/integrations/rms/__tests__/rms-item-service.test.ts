import { describe, expect, it, vi } from "vitest";

import type { RmsInventoryApiClient } from "../rms-inventory-api-client";
import type { RmsItemApiClient } from "../rms-item-api-client";
import { createRmsItemService } from "../rms-item-service";
import type { RmsConfig } from "../rms-config";
import { RmsNetworkError } from "../rms-errors";

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
    inventoryBulkGetPath: "/es/2.0/inventories/bulk-get",
    ...overrides,
  };
}

function buildItem(manageNumber: string) {
  return {
    manageNumber,
    itemNumber: `IT-${manageNumber}`,
    title: `商品${manageNumber}`,
    images: [],
    hideItem: false,
    variantSelectors: [],
    variants: { v1: { selectorValues: {}, standardPrice: "1000", attributes: [] } },
  };
}

describe("RmsItemService.listProducts", () => {
  it("正常系: 商品検索結果と在庫一括取得結果をマージしてstockに実数を載せる", async () => {
    const apiClient = {
      searchItems: vi.fn(async () => ({
        numFound: 1,
        results: [{ item: buildItem("1000000151") }],
      })),
    } as unknown as RmsItemApiClient;

    const inventoryApiClient = {
      bulkGetInventories: vi.fn(async () => ({
        inventories: [{ manageNumber: "1000000151", variantId: "v1", quantity: 7 }],
      })),
    } as unknown as RmsInventoryApiClient;

    const service = createRmsItemService({ apiClient, inventoryApiClient, config: buildConfig() });
    const result = await service.listProducts();

    expect(result.products).toHaveLength(1);
    expect(result.products[0].stock).toBe(7);
    expect(result.inventoryError).toBeNull();
    expect(inventoryApiClient.bulkGetInventories).toHaveBeenCalledWith([
      { manageNumber: "1000000151", variantId: "v1" },
    ]);
  });

  it("在庫API失敗時: 商品一覧は返しつつstockはnull(－表示)のままにしフォールバックする", async () => {
    const apiClient = {
      searchItems: vi.fn(async () => ({
        numFound: 1,
        results: [{ item: buildItem("1000000151") }],
      })),
    } as unknown as RmsItemApiClient;

    const inventoryApiClient = {
      bulkGetInventories: vi.fn(async () => {
        throw new RmsNetworkError("接続失敗");
      }),
    } as unknown as RmsInventoryApiClient;

    const service = createRmsItemService({ apiClient, inventoryApiClient, config: buildConfig() });
    const result = await service.listProducts();

    expect(result.products).toHaveLength(1);
    expect(result.products[0].stock).toBeNull();
    expect(result.inventoryError).toBe("接続失敗");
  });

  it("在庫一括取得は保守的なバッチサイズで分割して呼び出す", async () => {
    const items = Array.from({ length: 3 }, (_, i) => buildItem(`item-${i}`));
    const apiClient = {
      searchItems: vi.fn(async () => ({
        numFound: items.length,
        results: items.map((item) => ({ item })),
      })),
    } as unknown as RmsItemApiClient;

    const inventoryApiClient = {
      bulkGetInventories: vi.fn(async () => ({ inventories: [] })),
    } as unknown as RmsInventoryApiClient;

    // バッチサイズより十分小さいキー数でも、分割ロジック自体が1回で完結することを確認する。
    const service = createRmsItemService({
      apiClient,
      inventoryApiClient,
      config: buildConfig({ itemSearchHits: 100 }),
    });
    await service.listProducts();

    expect(inventoryApiClient.bulkGetInventories).toHaveBeenCalledTimes(1);
    expect((inventoryApiClient.bulkGetInventories as ReturnType<typeof vi.fn>).mock.calls[0][0]).toHaveLength(3);
  });
});
