import type { Product } from "@/types/product";

import { RmsInventoryApiClient } from "./rms-inventory-api-client";
import { RmsItemApiClient } from "./rms-item-api-client";
import { loadRmsConfig, type RmsConfig } from "./rms-config";
import { RmsIntegrationError } from "./rms-errors";
import { RmsItemMapper } from "./rms-item-mapper";
import { parseInventoryBulkGetResponse } from "./rms-inventory-types";
import { parseItemSearchResponse, type RmsItemModel } from "./rms-item-types";

// 安全策(RMS側の実際の上限が非公開のため判明するまでは保守的な内部定数として持つ)。
const MAX_PAGES = 20;
// 在庫API一括取得の1回あたり上限。691件は1回で成功することを確認済み(2026-09-15)だが、
// 実際の上限は非公開のため保守的に分割する。
const INVENTORY_BATCH_SIZE = 500;

export interface ListProductsResult {
  products: Product[];
  totalFound: number;
  skippedCount: number;
  // 在庫APIの取得に失敗した場合のメッセージ(商品一覧自体は在庫「－」のまま返す)。
  inventoryError: string | null;
}

export interface RmsItemService {
  listProducts(): Promise<ListProductsResult>;
}

export interface RmsItemServiceDeps {
  apiClient: RmsItemApiClient;
  inventoryApiClient: RmsInventoryApiClient;
  config: RmsConfig;
}

export function createRmsItemService(deps: RmsItemServiceDeps): RmsItemService {
  const { apiClient, inventoryApiClient, config } = deps;

  async function listProducts(): Promise<ListProductsResult> {
    const hits = config.itemSearchHits;
    let offset = 0;
    let totalFound = 0;
    let skippedCount = 0;
    const items: RmsItemModel[] = [];

    for (let page = 0; page < MAX_PAGES; page += 1) {
      const raw = await apiClient.searchItems({ hits, offset });
      const parsed = parseItemSearchResponse(raw);
      totalFound = parsed.numFound;
      skippedCount += parsed.skippedCount;
      items.push(...parsed.items);

      offset += hits;
      if (offset >= totalFound || parsed.items.length === 0) break;
    }

    const { inventoryByKey, inventoryError } = await fetchInventoryByKey(inventoryApiClient, items);

    const products = items.map((item) =>
      RmsItemMapper.toProduct(item, config.itemImageBaseUrl, inventoryByKey)
    );

    return { products, totalFound, skippedCount, inventoryError };
  }

  return { listProducts };
}

async function fetchInventoryByKey(
  inventoryApiClient: RmsInventoryApiClient,
  items: RmsItemModel[]
): Promise<{ inventoryByKey: Map<string, number> | undefined; inventoryError: string | null }> {
  const keys = items.flatMap((item) =>
    Object.keys(item.variants ?? {}).map((variantId) => ({
      manageNumber: item.manageNumber,
      variantId,
    }))
  );
  if (keys.length === 0) return { inventoryByKey: new Map(), inventoryError: null };

  const merged = new Map<string, number>();
  const batches = chunk(keys, INVENTORY_BATCH_SIZE);

  try {
    for (const batch of batches) {
      const raw = await inventoryApiClient.bulkGetInventories(batch);
      const parsed = parseInventoryBulkGetResponse(raw);
      for (const [key, quantity] of parsed) merged.set(key, quantity);
    }
    return { inventoryByKey: merged, inventoryError: null };
  } catch (error) {
    // 在庫APIが失敗しても商品一覧自体は返す(在庫は「－」表示にフォールバック)。
    const message =
      error instanceof RmsIntegrationError || error instanceof Error
        ? error.message
        : "unknown error";
    return { inventoryByKey: undefined, inventoryError: message };
  }
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

// アプリ実運用向けのデフォルトファクトリ(実際の環境変数を使用する)。
export function createDefaultRmsItemService(): RmsItemService {
  const config = loadRmsConfig();
  const apiClient = new RmsItemApiClient({ config });
  const inventoryApiClient = new RmsInventoryApiClient({ config });
  return createRmsItemService({ apiClient, inventoryApiClient, config });
}
