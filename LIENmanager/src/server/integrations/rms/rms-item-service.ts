import type { Product } from "@/types/product";

import { RmsItemApiClient } from "./rms-item-api-client";
import { loadRmsConfig, type RmsConfig } from "./rms-config";
import { RmsItemMapper } from "./rms-item-mapper";
import { parseItemSearchResponse } from "./rms-item-types";

// 安全策(RMS側の実際の上限が非公開のため判明するまでは保守的な内部定数として持つ)。
const MAX_PAGES = 20;

export interface ListProductsResult {
  products: Product[];
  totalFound: number;
  skippedCount: number;
}

export interface RmsItemService {
  listProducts(): Promise<ListProductsResult>;
}

export interface RmsItemServiceDeps {
  apiClient: RmsItemApiClient;
  config: RmsConfig;
}

export function createRmsItemService(deps: RmsItemServiceDeps): RmsItemService {
  const { apiClient, config } = deps;

  async function listProducts(): Promise<ListProductsResult> {
    const hits = config.itemSearchHits;
    let offset = 0;
    let totalFound = 0;
    let skippedCount = 0;
    const products: Product[] = [];

    for (let page = 0; page < MAX_PAGES; page += 1) {
      const raw = await apiClient.searchItems({ hits, offset });
      const parsed = parseItemSearchResponse(raw);
      totalFound = parsed.numFound;
      skippedCount += parsed.skippedCount;

      for (const item of parsed.items) {
        products.push(RmsItemMapper.toProduct(item));
      }

      offset += hits;
      if (offset >= totalFound || parsed.items.length === 0) break;
    }

    return { products, totalFound, skippedCount };
  }

  return { listProducts };
}

// アプリ実運用向けのデフォルトファクトリ(実際の環境変数を使用する)。
export function createDefaultRmsItemService(): RmsItemService {
  const config = loadRmsConfig();
  const apiClient = new RmsItemApiClient({ config });
  return createRmsItemService({ apiClient, config });
}
